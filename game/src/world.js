// Solmar City — world simulation.
// Written from v2-spec.md only. createWorld(seed) builds the whole game
// state; step(input, dt) advances it one frame and returns an events
// bitmask. The world owns the rules that must happen exactly once per
// frame: killing (dead enemies are swept here and only here), wanted
// decay, police sync, mission ticks, pickups, and the Grand Prix clock.
import { createRng } from './random.js';
import { buildCity } from './city.js';
import { createCombat, stepCombat, firePlayerBullet, meleeAttack } from './combat.js';
import { createTraffic, stepTraffic } from './traffic.js';
import { createBoats, stepBoating } from './boats.js';
import { createRadio } from './radio.js';
import { createAudio } from './audio.js';
import { createPolice, stepPolice } from './police.js';
import { createPolice2, stepPolice2 } from './police2.js';
import { createSideJobs, stepSideJobs } from './sidejobs.js';
import { MISSIONS, startMission, updateMission } from './missions.js';
import { registerStoryMissions } from './missions2.js';
import { registerMissions3 } from './missions3.js';
import { registerMissions4 } from './missions4.js';

// Events bitmask returned by step().
export const EVENTS = {
  SHOT: 1,
  PUNCH: 2,
  PICKUP: 4,
  CRASH: 8,
  MISSION: 16,
  DIED: 32,
  BUSTED: 64,
  ENEMY_SHOT: 128,
  VAULT: 256,
  STEAL: 512,
  MISSION_COMPLETE: 1024,
};

// World facts from the spec (probed, do not guess elsewhere).
export const WORLD_WIDTH = 2880;
export const WORLD_HEIGHT = 2160;
export const SEA_TOP = 2100;
export const BEACH_TOP = 2020;
const PLAYER_SPAWN = { x: 1420, y: 1230, angle: -Math.PI / 2 };
const PLAYER_RADIUS = 11;
const WALK_SPEED = 175;
const RUN_SPEED = 268;
const CAR_ACCEL = 640;
const CAR_BRAKE = 980;
const CAR_REVERSE = 420;
const CAR_MAX_SPEED = 560;
const CAR_MAX_REVERSE = 190;
const CAR_TURN_RATE = 2.7;
const CAR_DRAG = 0.55;
const WANTED_MAX = 5;
const WANTED_DECAY_DELAY = 12;
const WANTED_DECAY_EVERY = 8;
const BUST_SECONDS = 1.6;
const MONEY_START = 50;
const GRAND_PRIX_COUNTDOWN = 3600;

// No-op audio stand-in for headless runs (node smoke tests).
function silentAudio() {
  const noop = () => {};
  return {
    ensure: noop, isMuted: () => false, setMuted: noop, engine: noop,
    siren: noop, stepMusic: noop, shot: noop, enemyShot: noop,
    punch: noop, crash: noop, pickup: noop, missionComplete: noop,
    click: noop, busted: noop,
  };
}

function spawnPickups(rng, city) {
  const list = [];
  const kinds = [];
  for (let i = 0; i < 14; i++) kinds.push({ kind: 'cash', amount: 60 });
  for (let i = 0; i < 8; i++) kinds.push({ kind: 'health', amount: 40 });
  for (let i = 0; i < 8; i++) kinds.push({ kind: 'ammo', amount: 36 });
  for (const k of kinds) {
    const pt = city.randomStreetPoint(rng);
    list.push({ x: pt.x, y: pt.y, kind: k.kind, amount: k.amount, taken: false, bob: rng.next() * 6 });
  }
  return list;
}

export function createWorld(seed) {
  // Story missions M6–M12 register onto MISSIONS (idempotent).
  registerStoryMissions();
  registerMissions3();
  registerMissions4();

  const rng = createRng(seed >>> 0);
  const city = buildCity(rng);

  let audio;
  try {
    audio = createAudio();
  } catch (e) {
    audio = silentAudio();
  }

  const state = {
    seed: seed >>> 0,
    rng,
    city,
    combat: createCombat(),
    traffic: createTraffic(rng, city),
    boats: createBoats(rng),
    radio: createRadio(),
    audio,
    police: createPolice(),
    police2: createPolice2(),
    sideJobs: createSideJobs(rng, city),
    money: MONEY_START,
    hp: 100,
    ammo: 48,
    kills: 0,
    wanted: 0,
    wantedTimer: 0,
    wantedDecays: 0,
    missionIndex: 0,
    missionsDone: 0,
    storyComplete: false,
    mission: null,
    crates: [],
    player: {
      x: PLAYER_SPAWN.x,
      y: PLAYER_SPAWN.y,
      angle: PLAYER_SPAWN.angle,
      aimAngle: PLAYER_SPAWN.angle,
      hp: 100,
      ammo: 48,
      inCar: false,
      car: null,
      inBoat: false,
      boat: null,
      invuln: 0,
      gunCooldown: 0,
      punchCooldown: 0,
      speed: 0,
    },
    grandPrix: { startsIn: GRAND_PRIX_COUNTDOWN, total: GRAND_PRIX_COUNTDOWN },
    playTime: 0,
    time: 0,
    pickups: spawnPickups(rng, city),
    camera: { x: PLAYER_SPAWN.x, y: PLAYER_SPAWN.y },
    bustTimer: 0,
    shootWantedCooldown: 0,
    nextMissionTimer: 0,
    banner: null,
    screen: 'game',
    prompt: null,
  };

  function respawnPlayer(reason) {
    const p = state.player;
    const safe = state.city.landmarks.safehouse;
    p.x = safe ? safe.x : PLAYER_SPAWN.x;
    p.y = safe ? safe.y : PLAYER_SPAWN.y;
    p.angle = -Math.PI / 2;
    p.aimAngle = -Math.PI / 2;
    p.hp = 100;
    p.inCar = false;
    p.car = null;
    p.inBoat = false;
    p.boat = null;
    p.speed = 0;
    p.invuln = 3;
    state.hp = 100;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.wantedDecays = 0;
    if (state.police) state.police.wanted = 0;
    state.bustTimer = 0;
    state.banner = { text: reason === 'busted' ? 'BUSTED!' : 'WASTED!', t: 2.5 };
  }

  // Wanted decay lives ONLY here. First decay ~12s after the last heat,
  // then one star every ~8s. police.js never touches wanted.
  function stepWanted(dt) {
    if (state.wanted <= 0) {
      state.wantedTimer = 0;
      state.wantedDecays = 0;
      return;
    }
    state.wantedTimer += dt;
    const need = state.wantedDecays === 0 ? WANTED_DECAY_DELAY : WANTED_DECAY_EVERY;
    if (state.wantedTimer >= need) {
      state.wantedTimer = 0;
      state.wantedDecays += 1;
      state.wanted = Math.max(0, state.wanted - 1);
    }
  }

  function addHeat(n) {
    state.wanted = Math.min(WANTED_MAX, (state.wanted || 0) + n);
    state.wantedTimer = 0;
    state.wantedDecays = 0;
  }

  function moveOnFoot(input, dt) {
    const p = state.player;
    let mx = input.mx || 0;
    let my = input.my || 0;
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; }
    const speed = input.running ? RUN_SPEED : WALK_SPEED;
    let nx = p.x + mx * speed * dt;
    let ny = p.y + my * speed * dt;
    nx = Math.max(16, Math.min(WORLD_WIDTH - 16, nx));
    // On foot the sea is a wall: the beach ends at the waterline.
    ny = Math.max(16, Math.min(SEA_TOP - 2, ny));
    const fixed = state.city.resolveCircle(nx, ny, PLAYER_RADIUS);
    if (fixed && typeof fixed.x === 'number' && typeof fixed.y === 'number') {
      nx = fixed.x;
      ny = fixed.y;
    }
    p.x = nx;
    p.y = ny;
    if (len > 0) p.angle = Math.atan2(my, mx);
    p.speed = len > 0 ? speed : 0;
  }

  function driveCar(input, dt) {
    const p = state.player;
    const car = p.car;
    if (!car) { p.inCar = false; return; }
    const steer = input.steer || 0;
    const throttle = input.throttle || 0;
    if (throttle > 0) car.speed += CAR_ACCEL * throttle * dt;
    else if (throttle < 0) {
      car.speed -= (car.speed > 10 ? CAR_BRAKE : CAR_REVERSE) * dt;
    }
    if (input.handbrake) {
      // Hard decel + slide: speed bleeds fast, grip drops.
      car.speed -= Math.sign(car.speed) * 1400 * dt;
      if (Math.abs(car.speed) < 30) car.speed = 0;
    }
    car.speed -= car.speed * CAR_DRAG * dt;
    car.speed = Math.max(-CAR_MAX_REVERSE, Math.min(CAR_MAX_SPEED, car.speed));
    const dir = car.speed >= 0 ? 1 : -1;
    const grip = Math.min(1, Math.abs(car.speed) / 120);
    car.angle += steer * CAR_TURN_RATE * dt * dir * grip;
    let nx = car.x + Math.cos(car.angle) * car.speed * dt;
    let ny = car.y + Math.sin(car.angle) * car.speed * dt;
    nx = Math.max(16, Math.min(WORLD_WIDTH - 16, nx));
    ny = Math.max(16, Math.min(SEA_TOP - 2, ny));
    const fixed = state.city.resolveCircle(nx, ny, 23);
    let crashed = false;
    if (fixed && typeof fixed.x === 'number' && typeof fixed.y === 'number') {
      if (Math.hypot(fixed.x - nx, fixed.y - ny) > 2 && Math.abs(car.speed) > 150) crashed = true;
      nx = fixed.x;
      ny = fixed.y;
      if (Math.abs(car.speed) > 60) car.speed *= -0.15;
    }
    car.x = nx;
    car.y = ny;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = car.speed;
    return crashed;
  }

  function ramPedestrians() {
    const p = state.player;
    if (!p.inCar || !p.car) return false;
    let hit = false;
    for (const ped of state.traffic.peds || []) {
      if (ped.down) continue;
      if (Math.hypot(ped.x - p.car.x, ped.y - p.car.y) < 30 && Math.abs(p.car.speed) > 60) {
        ped.down = true;
        addHeat(1);
        hit = true;
      }
    }
    return hit;
  }

  function collectPickups() {
    const p = state.player;
    let events = 0;
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      if (Math.hypot(p.x - pk.x, p.y - pk.y) < 32) {
        pk.taken = true;
        if (pk.kind === 'cash') state.money += pk.amount;
        else if (pk.kind === 'health') { state.hp = Math.min(100, state.hp + pk.amount); p.hp = state.hp; }
        else if (pk.kind === 'ammo') { state.ammo = Math.min(240, state.ammo + pk.amount); p.ammo = state.ammo; }
        events |= EVENTS.PICKUP;
      }
    }
    return events;
  }

  function step(input, dt) {
    dt = Math.max(0, Math.min(0.05, dt || 0.016));
    let events = 0;
    const p = state.player;
    state.time += dt;
    state.playTime += dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (state.banner) {
      state.banner.t -= dt;
      if (state.banner.t <= 0) state.banner = null;
    }
    if (state.shootWantedCooldown > 0) state.shootWantedCooldown -= dt;

    // Grand Prix countdown: ticks every step, wraps back to a full hour.
    state.grandPrix.startsIn -= dt;
    if (state.grandPrix.startsIn <= 0) {
      state.grandPrix.startsIn = state.grandPrix.total;
    }

    // Aim follows the mouse in world space.
    if (typeof input.aimX === 'number' && typeof input.aimY === 'number') {
      p.aimAngle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
    }

    // Combat input: shoot on foot, punch on foot.
    if (!p.inCar && !p.inBoat) {
      if (input.shooting) {
        const a0 = state.ammo;
        const pa0 = p.ammo;
        firePlayerBullet(state, p.x, p.y, p.aimAngle);
        const fired = state.ammo < a0 || p.ammo < pa0;
        state.ammo = Math.min(state.ammo, p.ammo);
        p.ammo = state.ammo;
        if (fired) {
          events |= EVENTS.SHOT;
          if (state.shootWantedCooldown <= 0) {
            addHeat(1);
            state.shootWantedCooldown = 1.5;
          }
        }
      }
      if (input.actions & 8) {
        meleeAttack(state);
        events |= EVENTS.PUNCH;
      }
    }

    // Movement branch: boat, car, or feet.
    if (p.inBoat) {
      stepBoating(state, input, dt);
      p.x = p.boat ? p.boat.x : p.x;
      p.y = p.boat ? p.boat.y : p.y;
      if (p.boat) p.angle = p.boat.angle;
    } else if (p.inCar) {
      const crashed = driveCar(input, dt);
      if (crashed) events |= EVENTS.CRASH;
      if (ramPedestrians()) events |= EVENTS.CRASH;
    } else {
      moveOnFoot(input, dt);
    }

    // Traffic, combat, then the kill sweep: dead enemies are removed
    // here and ONLY here, and each one counts exactly one kill.
    stepTraffic(state.traffic, state.city, state.rng, dt);
    const hpBefore = p.hp;
    stepCombat(state, dt);
    if (p.hp < hpBefore) events |= EVENTS.ENEMY_SHOT;
    for (let i = state.combat.enemies.length - 1; i >= 0; i--) {
      if (state.combat.enemies[i].hp <= 0) {
        state.combat.enemies.splice(i, 1);
        state.kills += 1;
      }
    }
    // Keep the two hp/ammo mirrors in sync.
    state.hp = p.hp;
    state.ammo = p.ammo;

    // Police read state.wanted; sync BEFORE stepping them.
    if (state.police) state.police.wanted = state.wanted;
    if (state.police) stepPolice(state, dt);
    stepPolice2(state, dt);

    // Side jobs: coins + taxi fares (returns its own events, if any).
    const sjEvents = stepSideJobs(state, dt);
    if (typeof sjEvents === 'number') events |= sjEvents;

    // Wanted decay, owned by this module only.
    stepWanted(dt);
    if (state.police) state.police.wanted = state.wanted;

    events |= collectPickups();
    events |= updateMission(state);

    // Busted: a cop standing on the player on foot for 1.6s.
    if (!p.inCar && !p.inBoat && state.wanted > 0 && p.invuln <= 0) {
      let close = false;
      for (const cop of (state.police && state.police.cars) || []) {
        if (Math.hypot(cop.x - p.x, cop.y - p.y) < 46) { close = true; break; }
      }
      if (close) {
        state.bustTimer += dt;
        if (state.bustTimer >= BUST_SECONDS) {
          events |= EVENTS.BUSTED;
          respawnPlayer('busted');
        }
      } else {
        state.bustTimer = 0;
      }
    } else {
      state.bustTimer = 0;
    }

    // Wasted: no health left.
    if (p.hp <= 0) {
      events |= EVENTS.DIED;
      respawnPlayer('wasted');
    }

    // No mission running and story not done: start the next one after
    // a short beat so the game keeps flowing.
    if (!state.mission && !state.storyComplete && state.missionIndex < MISSIONS.length) {
      state.nextMissionTimer += dt;
      if (state.nextMissionTimer > 2) {
        state.nextMissionTimer = 0;
        startMission(state, state.missionIndex);
      }
    } else {
      state.nextMissionTimer = 0;
    }

    // Camera follows the player; boats get a lookahead down their course.
    let lookX = 0;
    let lookY = 0;
    if (p.inBoat && p.boat) {
      lookX = Math.cos(p.boat.angle) * 120;
      lookY = Math.sin(p.boat.angle) * 120;
    }
    state.camera.x = Math.max(640, Math.min(WORLD_WIDTH - 640, p.x + lookX));
    state.camera.y = Math.max(400, Math.min(WORLD_HEIGHT - 400, p.y + lookY));

    return events;
  }

  function reset() {
    const fresh = createWorld((Math.random() * 0x7fffffff) | 0);
    for (const k of Object.keys(state)) delete state[k];
    Object.assign(state, fresh.state);
  }

  return { state, reset, step };
}

// Snapshot for saves: plain values only, safe to JSON.
export function saveSnapshot(state) {
  return {
    seed: state.seed,
    money: state.money,
    missionIndex: state.missionIndex,
    missionsDone: state.missionsDone,
    storyComplete: state.storyComplete,
    kills: state.kills,
    hp: state.hp,
    ammo: state.ammo,
    x: state.player.x,
    y: state.player.y,
    playTime: state.playTime,
  };
}

// Restore a snapshot made by saveSnapshot. The active mission is
// cleared; the game resumes at missionIndex.
export function applySave(state, save) {
  if (!save) return false;
  state.money = save.money ?? state.money;
  state.missionIndex = save.missionIndex ?? state.missionIndex;
  state.missionsDone = save.missionsDone ?? state.missionsDone;
  state.storyComplete = !!save.storyComplete;
  state.kills = save.kills ?? state.kills;
  state.hp = save.hp ?? state.hp;
  state.ammo = save.ammo ?? state.ammo;
  state.playTime = save.playTime ?? state.playTime;
  state.player.x = save.x ?? state.player.x;
  state.player.y = save.y ?? state.player.y;
  state.player.hp = state.hp;
  state.player.ammo = state.ammo;
  state.player.inCar = false;
  state.player.car = null;
  state.player.inBoat = false;
  state.player.boat = null;
  state.mission = null;
  state.crates = [];
  state.wanted = 0;
  state.wantedTimer = 0;
  state.wantedDecays = 0;
  if (state.police) state.police.wanted = 0;
  return true;
}

// Wasted / busted: wake up at the Safehouse, full health, heat gone.
export function respawnPlayer(state, reason) {
  const p = state.player;
  const safe = state.city.landmarks.safehouse;
  p.x = safe ? safe.x : 1420;
  p.y = safe ? safe.y : 1190;
  p.angle = -Math.PI / 2;
  p.aimAngle = -Math.PI / 2;
  p.hp = 100;
  p.inCar = false;
  p.car = null;
  p.inBoat = false;
  p.boat = null;
  p.speed = 0;
  p.invuln = 3;
  state.hp = 100;
  state.wanted = 0;
  state.wantedTimer = 0;
  state.wantedDecays = 0;
  if (state.police) state.police.wanted = 0;
  state.bustTimer = 0;
  state.banner = { text: reason === 'busted' ? 'BUSTED!' : 'WASTED!', t: 2.5 };
}

// Wanted decay, exported for tests: first star falls ~12s after the
// last heat, then one star every ~8s. Never call it from anywhere else.
export function stepWanted(state, dt) {
  if (state.wanted <= 0) {
    state.wantedTimer = 0;
    state.wantedDecays = 0;
    return;
  }
  state.wantedTimer += dt;
  const need = state.wantedDecays === 0 ? WANTED_DECAY_DELAY : WANTED_DECAY_EVERY;
  if (state.wantedTimer >= need) {
    state.wantedTimer = 0;
    state.wantedDecays += 1;
    state.wanted = Math.max(0, state.wanted - 1);
  }
}
