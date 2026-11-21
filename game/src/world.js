// world.js — Solmar City world simulation: state, step, save, respawn.
// Written from the v2 spec + probed facts only (see FINISH.md).
//   createRng(seed) returns an object with .next() (no mulberry32 export).
//   state.combat = { bullets, enemies, gunCooldown, punchCooldown }.
//   state.police = { cars, cops, bustTimer, spawnCooldown, siren } — NO wanted.
//   world.js is the ONLY writer of police.wanted (sync before stepPolice).
//   Wanted decay ONLY here (stepWanted: 12s delay, then -1 every 8s).
//   Kill sweep + counting ONLY here, exactly once per step.
import { createRng } from './random.js';
import { buildCity } from './city.js';
import { createCombat, firePlayerBullet, meleeAttack, stepCombat } from './combat.js';
import { createPolice, stepPolice } from './police.js';
import { createPolice2, stepPolice2 } from './police2.js';
import { createBoats, stepBoating } from './boats.js';
import { createRadio } from './radio.js';
import { createSideJobs, stepSideJobs } from './sidejobs.js';
import { createTraffic, stepTraffic } from './traffic.js';
import {
  MISSIONS,
  registerStoryMissions as registerM1,
  updateMission,
  tryInteract,
  startMission,
} from './missions.js';
import { registerStoryMissions as registerM2 } from './missions2.js';
import { registerStoryMissions as registerM3 } from './missions3.js';
import { registerStoryMissions as registerM4 } from './missions4.js';

// Register all 12 story missions (idempotent, safe to call again).
registerM1();
registerM2();
registerM3();
registerM4();

// Event bitmask returned by step().
export const EV = {
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

// Action bitmask (mirrors input.js).
export const ACTION = {
  CONFIRM: 1,
  PAUSE: 2,
  INTERACT: 4,
  PUNCH: 8,
  MUTE: 16,
  RADIO: 32,
};

// Spec constants (config.js values, written out here so world.js never
// depends on another module's constant names).
const WORLD_W = 2880;
const WORLD_H = 2160;
const SEA_TOP = 2100;
const BEACH_TOP = 2020;
const PLAYER_WALK = 175;
const PLAYER_RUN = 268;
const PLAYER_RADIUS = 11;
const CAR_ACCEL = 640;
const CAR_BRAKE = 980;
const CAR_REVERSE = 420;
const CAR_MAX_SPEED = 560;
const CAR_MAX_REVERSE = 190;
const CAR_TURN = 2.7;
const CAR_DRAG = 0.55;
const MONEY_START = 50;
const BUST_SECONDS = 1.6;

const CAR_COLORS = ['#d23b3b', '#3b7dd2', '#e0a83c', '#4caf50', '#8e44ad', '#e0e0e0'];
const CAR_MODELS = ['sedan', 'van', 'taxi', 'sport', 'truck'];

function rand(rng, a, b) {
  return a + rng.next() * (b - a);
}
function pick(rng, arr) {
  return arr[Math.floor(rng.next() * arr.length)];
}
function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
function dist(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

function initWorld(seed) {
  const rng = createRng(seed);
  const city = buildCity(rng);
  const state = {
    seed,
    rng,
    city,
    player: {
      x: 1420, y: 1230, angle: -Math.PI / 2, aimAngle: -Math.PI / 2,
      hp: 100, ammo: 48, inCar: false, car: null, inBoat: false, boat: null,
      invuln: 0,
    },
    combat: createCombat(),
    police: createPolice(),
    police2: createPolice2(),
    boats: createBoats(rng),
    radio: createRadio(),
    sideJobs: createSideJobs(rng, city),
    traffic: createTraffic(rng, city),
    parkedCars: [],
    pickups: [],
    money: MONEY_START,
    wanted: 0,
    kills: 0,
    killsAtStart: 0,
    missionIndex: -1,
    missionStep: 0,
    missionsDone: 0,
    storyComplete: false,
    playTime: 0,
    grandPrix: { startsIn: 2 * 3600 + 60 + 5 },
    vaultTaken: false,
    lastReward: 0,
    lastMissionTitle: '',
    wantedSince: 0,
    wantedLastDecay: 0,
    bustProgress: 0,
    _prevWanted: 0,
  };
  // Parked cars on the streets (stealable with E).
  for (let i = 0; i < 8; i++) {
    const pt = city.randomStreetPoint(rng);
    state.parkedCars.push({
      kind: 'parked',
      x: pt.x, y: pt.y, angle: rand(rng, 0, Math.PI * 2), speed: 0,
      color: pick(rng, CAR_COLORS), model: pick(rng, CAR_MODELS),
    });
  }
  // Pickups: cash 14x$60, health 8x40, ammo 8x36.
  const pickupKinds = [];
  for (let i = 0; i < 14; i++) pickupKinds.push(['cash', 60]);
  for (let i = 0; i < 8; i++) pickupKinds.push(['health', 40]);
  for (let i = 0; i < 8; i++) pickupKinds.push(['ammo', 36]);
  for (const [kind, value] of pickupKinds) {
    const pt = city.randomStreetPoint(rng);
    state.pickups.push({ kind, value, x: pt.x, y: pt.y, bob: rand(rng, 0, 6) });
  }
  return state;
}

// Wanted decay: only after 12s quiet, then -1 star every 8s.
function stepWanted(state) {
  if (state.wanted <= 0) return;
  if (state.playTime - state.wantedSince < 12) return;
  if (state.playTime - state.wantedLastDecay >= 8) {
    state.wanted = Math.max(0, state.wanted - 1);
    state.wantedLastDecay = state.playTime;
  }
}

function resolvePos(state, x, y, r) {
  // city.resolveCircle(x, y, r) -> { x, y } (probed, attempt 10 retry 2).
  if (state.city && typeof state.city.resolveCircle === 'function') {
    return state.city.resolveCircle(x, y, r);
  }
  return { x, y };
}

function stepOnFoot(state, input, dt) {
  const p = state.player;
  let mx = input.mx || 0;
  let my = input.my || 0;
  const len = Math.sqrt(mx * mx + my * my);
  if (len > 1) { mx /= len; my /= len; }
  const speed = input.running ? PLAYER_RUN : PLAYER_WALK;
  let nx = p.x + mx * speed * dt;
  let ny = p.y + my * speed * dt;
  // Stay out of the sea on foot (beach edge).
  ny = Math.min(ny, BEACH_TOP + 75);
  nx = clamp(nx, 16, WORLD_W - 16);
  ny = clamp(ny, 16, WORLD_H - 16);
  const fixed = resolvePos(state, nx, ny, PLAYER_RADIUS);
  p.x = fixed.x;
  p.y = fixed.y;
  if (len > 0.1) p.angle = Math.atan2(my, mx);
}

function stepDriving(state, input, dt) {
  const p = state.player;
  const car = p.car;
  if (!car) { p.inCar = false; return 0; }
  let events = 0;
  const steer = clamp(input.steer || 0, -1, 1);
  const throttle = clamp(input.throttle || 0, -1, 1);
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steer * CAR_TURN * dt * clamp(Math.abs(car.speed) / 120, 0, 1) * dir;
  if (input.handbrake) {
    // Handbrake: hard decel + slight slide.
    const dec = 1500 * dt;
    if (Math.abs(car.speed) <= dec) car.speed = 0;
    else car.speed -= Math.sign(car.speed) * dec;
    car.angle += steer * 0.6 * dt * dir;
  } else if (throttle > 0) {
    car.speed += CAR_ACCEL * throttle * dt;
  } else if (throttle < 0) {
    if (car.speed > 5) car.speed -= CAR_BRAKE * dt;
    else car.speed += CAR_REVERSE * throttle * dt;
  } else {
    car.speed -= car.speed * CAR_DRAG * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  car.speed = clamp(car.speed, -CAR_MAX_REVERSE, CAR_MAX_SPEED);
  let nx = car.x + Math.cos(car.angle) * car.speed * dt;
  let ny = car.y + Math.sin(car.angle) * car.speed * dt;
  nx = clamp(nx, 16, WORLD_W - 16);
  ny = clamp(ny, 16, SEA_TOP - 8); // cars stay out of the sea
  const fixed = resolvePos(state, nx, ny, 22);
  const hitWall = Math.abs(fixed.x - nx) > 0.5 || Math.abs(fixed.y - ny) > 0.5;
  if (hitWall && Math.abs(car.speed) > 200) {
    events |= EV.CRASH;
    p.hp = Math.max(0, p.hp - 6);
    car.speed *= 0.4;
  } else if (hitWall) {
    car.speed *= 0.5;
  }
  car.x = fixed.x;
  car.y = fixed.y;
  // Ram traffic cars.
  if (state.traffic && state.traffic.cars) {
    for (const t of state.traffic.cars) {
      if (dist(car.x, car.y, t.x, t.y) < 42 && Math.abs(car.speed) > 120) {
        events |= EV.CRASH;
        p.hp = Math.max(0, p.hp - 4);
        car.speed *= 0.6;
        t.speed = 0;
      }
    }
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  return events;
}

function stepWorld(state, input, dt) {
  dt = Math.min(Math.max(dt || 0.016, 0), 0.05);
  let events = 0;
  const p = state.player;
  state.playTime += dt;
  // Grand Prix countdown ticks down; wraps to a fresh 3h when it hits 0.
  state.grandPrix.startsIn -= dt;
  if (state.grandPrix.startsIn <= 0) state.grandPrix.startsIn = 3 * 3600;
  if (p.invuln > 0) p.invuln -= dt;

  const actions = input.actions || 0;
  // Aim follows the mouse in world coords.
  if (typeof input.aimX === 'number' && typeof input.aimY === 'number') {
    p.aimAngle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
  }

  // Interact (E).
  if (actions & ACTION.INTERACT) {
    events |= tryInteract(state);
  }
  // Punch (Space on foot).
  if ((actions & ACTION.PUNCH) && !p.inCar && !p.inBoat) {
    meleeAttack(state);
    events |= EV.PUNCH;
  }
  // Shoot (mouse held).
  if (input.shooting && !p.inCar && !p.inBoat) {
    const ammoBefore = p.ammo;
    firePlayerBullet(state, p.x, p.y, p.aimAngle);
    if (p.ammo < ammoBefore) events |= EV.SHOT;
  }

  // Movement.
  if (p.inBoat) {
    stepBoating(state, input, dt);
  } else if (p.inCar) {
    events |= stepDriving(state, input, dt);
  } else {
    stepOnFoot(state, input, dt);
  }

  // Combat step, then the kill sweep — ONLY here, exactly once.
  const hpBeforeCombat = p.hp;
  stepCombat(state, dt);
  if (p.hp < hpBeforeCombat) events |= EV.ENEMY_SHOT;
  const enemies = state.combat.enemies;
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].hp <= 0) {
      enemies.splice(i, 1);
      state.kills += 1;
    }
  }

  // Police: sync wanted FIRST (world is the only writer of police.wanted),
  // then step police AI, roadblocks + heli, side jobs, traffic.
  state.police.wanted = state.wanted;
  events |= stepPolice(state, dt) || 0;
  stepPolice2(state, dt);
  stepSideJobs(state, dt);
  stepTraffic(state.traffic, state.city, state.rng, dt);

  // Bust: a cop standing on the player for BUST_SECONDS.
  if (state.wanted > 0 && state.police.cops) {
    let touching = false;
    for (const cop of state.police.cops) {
      if (dist(p.x, p.y, cop.x, cop.y) < 30) { touching = true; break; }
    }
    if (touching && p.invuln <= 0) {
      state.bustProgress += dt;
      if (state.bustProgress >= BUST_SECONDS) {
        state.bustProgress = 0;
        state.money = Math.max(0, (state.money || 0) - 100);
        respawnPlayer(state, 'busted');
        return events | EV.BUSTED;
      }
    } else {
      state.bustProgress = Math.max(0, state.bustProgress - dt * 2);
    }
  }

  // Pickups by proximity.
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const pk = state.pickups[i];
    if (dist(p.x, p.y, pk.x, pk.y) < 32) {
      state.pickups.splice(i, 1);
      if (pk.kind === 'cash') state.money = (state.money || 0) + (pk.value || 60);
      else if (pk.kind === 'health') p.hp = Math.min(100, p.hp + (pk.value || 40));
      else if (pk.kind === 'ammo') p.ammo = Math.min(240, p.ammo + (pk.value || 36));
      events |= EV.PICKUP;
    }
  }

  // Wanted bookkeeping: a rise (re)starts the decay clock.
  if (state.wanted > state._prevWanted) {
    state.wantedSince = state.playTime;
    state.wantedLastDecay = state.playTime;
  }
  state._prevWanted = state.wanted;
  stepWanted(state);

  // Missions.
  events |= updateMission(state);

  // Death -> WASTED, respawn at the safehouse.
  if (p.hp <= 0) {
    respawnPlayer(state, 'wasted');
    return events | EV.DIED;
  }
  return events;
}

export function respawnPlayer(state, reason) {
  const p = state.player;
  const safe = state.city && state.city.landmarks ? state.city.landmarks.safehouse : null;
  p.x = safe ? safe.x : 1420;
  p.y = safe ? safe.y : 1190;
  p.angle = -Math.PI / 2;
  p.aimAngle = -Math.PI / 2;
  p.hp = 100;
  p.inCar = false;
  p.car = null;
  p.inBoat = false;
  p.boat = null;
  p.invuln = 3;
  if (reason === 'busted') state.wanted = 0;
  if (state.police) state.police.bustTimer = 0;
  state.bustProgress = 0;
  return p;
}

export function saveSnapshot(state) {
  return {
    seed: state.seed,
    money: state.money,
    missionIndex: state.missionIndex,
    missionsDone: state.missionsDone,
    storyComplete: state.storyComplete,
    kills: state.kills,
    hp: state.player.hp,
    ammo: state.player.ammo,
    x: state.player.x,
    y: state.player.y,
    playTime: state.playTime,
  };
}

export function applySave(state, save) {
  if (!save) return false;
  state.money = save.money ?? state.money;
  state.missionsDone = save.missionsDone ?? 0;
  state.storyComplete = !!save.storyComplete;
  state.kills = save.kills ?? 0;
  state.player.hp = save.hp ?? 100;
  state.player.ammo = save.ammo ?? 48;
  state.player.x = save.x ?? 1420;
  state.player.y = save.y ?? 1230;
  state.playTime = save.playTime ?? 0;
  if (typeof save.missionIndex === 'number' && save.missionIndex >= 0) {
    startMission(state, save.missionIndex);
  } else {
    state.missionIndex = -1;
    state.missionStep = 0;
  }
  return true;
}

export function createWorld(seed) {
  const api = {
    state: initWorld(seed == null ? 1 : seed),
    reset() {
      const fresh = initWorld(api.state.seed + 1);
      for (const k of Object.keys(api.state)) delete api.state[k];
      Object.assign(api.state, fresh);
    },
    step(input, dt) {
      return stepWorld(api.state, input || {}, dt);
    },
  };
  return api;
}

// Re-exported for main.js / shots.js convenience.
export { MISSIONS, startMission, updateMission };
