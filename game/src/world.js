// Solmar City — world.js: the living game world.
//
// Owns the whole simulation: the player (on foot / in a car / in a boat),
// traffic, police, combat, wanted stars, pickups, missions, side jobs,
// the camera, and the save snapshot. One step per frame:
//
//   const events = world.step(input, dt);
//
// `input` is a plain values object built by main.js every frame:
//   { mx, my, aimX, aimY, actions, shooting, running,
//     steer, throttle, handbrake }
// `actions` is a bitmask (see input.js). `step` returns an events
// bitmask (see EV below) that main.js turns into sounds and banners.
//
// Cross-module notes (all names come from the spec's probed facts):
//   - random.js exports createRng (there is no mulberry32 export).
//   - city.js resolveCircle takes an ENTITY object ({ x, y, radius }).
//   - Dead enemies are swept and kills are counted HERE, in world.step,
//     never inside combat — so a kill is counted exactly once.
//   - Wanted stars decay only here, never inside police.js.

import * as Random from './random.js';
import * as CityMod from './city.js';
import * as CombatMod from './combat.js';
import * as RadioMod from './radio.js';
import * as BoatsMod from './boats.js';
import * as TrafficMod from './traffic.js';
import * as PoliceMod from './police.js';
import * as Police2Mod from './police2.js';
import * as SideJobsMod from './sidejobs.js';
import * as AudioMod from './audio.js';
import {
  MISSIONS,
  startMission,
  updateMission,
  tryInteract,
} from './missions.js';
import { registerStoryMissions } from './missions2.js';
import { registerMissions3 } from './missions3.js';
import { registerMissions4 } from './missions4.js';

// Register every story mission exactly once, in order.
registerStoryMissions();
registerMissions3();
registerMissions4();

// Event bits returned by step().
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

// Action bits (mirror input.js).
export const ACT = {
  CONFIRM: 1,
  PAUSE: 2,
  INTERACT: 4,
  PUNCH: 8,
  MUTE: 16,
  RADIO: 32,
};

// --- World constants (probed facts from the spec) --------------------------
export const WORLD_W = 2880;
export const WORLD_H = 2160;
export const SEA_TOP = 2100;
export const BEACH_TOP = 2020;
export const SPAWN_X = 1420;
export const SPAWN_Y = 1230;
export const MONEY_START = 50;

const WALK_SPEED = 175;
const RUN_SPEED = 268;
const PLAYER_RADIUS = 11;
const PLAYER_HP = 100;
const START_AMMO = 48;
const GUN_COOLDOWN = 0.22;
const PUNCH_COOLDOWN = 0.45;

// Car physics.
const CAR_ACCEL = 640;
const CAR_BRAKE = 980;
const CAR_REVERSE = 420;
const CAR_MAX_SPEED = 560;
const CAR_MAX_REVERSE = 190;
const CAR_TURN_RATE = 2.7;
const CAR_GRIP = 3.2;
const CAR_DRAG = 0.55;
const CAR_RADIUS = 18;

// Wanted rules.
const WANTED_MAX = 5;
const WANTED_SHOOT = 1;
const WANTED_HIT_PED = 1;
const WANTED_KILL_PED = 2;
const WANTED_DECAY_DELAY = 12;
const WANTED_DECAY_EVERY = 8;
const BUST_SECONDS = 1.6;
const BUST_RADIUS = 46;
const SHOOT_WANTED_COOLDOWN = 3;

// Pickups scattered on the streets.
const PICKUP_CASH_COUNT = 14;
const PICKUP_CASH_VALUE = 60;
const PICKUP_HEALTH_COUNT = 8;
const PICKUP_HEALTH_VALUE = 40;
const PICKUP_AMMO_COUNT = 8;
const PICKUP_AMMO_VALUE = 36;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// --- World construction -----------------------------------------------------

function makePlayer() {
  return {
    x: SPAWN_X,
    y: SPAWN_Y,
    angle: -Math.PI / 2,
    aimAngle: -Math.PI / 2,
    hp: PLAYER_HP,
    ammo: START_AMMO,
    inCar: false,
    car: null,
    inBoat: false,
    boat: null,
    invuln: 0,
    gunCooldown: 0,
    punchCooldown: 0,
    speed: 0,
    vx: 0,
    vy: 0,
    radius: PLAYER_RADIUS,
    r: PLAYER_RADIUS,
  };
}

function buildState(seed) {
  const rng = Random.createRng(seed);
  const city = CityMod.buildCity(rng);
  const combat = CombatMod.createCombat();
  const traffic = TrafficMod.createTraffic(rng, city);
  const police =
    typeof PoliceMod.createPolice === 'function'
      ? PoliceMod.createPolice()
      : { cars: [] };
  if (!Array.isArray(police.cars)) police.cars = [];
  const police2 =
    typeof Police2Mod.createPolice2 === 'function'
      ? Police2Mod.createPolice2()
      : { roadblocks: [], heli: null };
  const boats =
    typeof BoatsMod.createBoats === 'function' ? BoatsMod.createBoats(rng) : [];
  const radio =
    typeof RadioMod.createRadio === 'function' ? RadioMod.createRadio() : null;
  const sideJobs =
    typeof SideJobsMod.createSideJobs === 'function'
      ? SideJobsMod.createSideJobs(rng, city)
      : null;
  const audio =
    typeof AudioMod.createAudio === 'function' ? AudioMod.createAudio() : null;

  const state = {
    seed,
    rng,
    city,
    combat,
    traffic,
    police,
    police2,
    boats,
    radio,
    sideJobs,
    audio,
    player: makePlayer(),
    camera: { x: SPAWN_X, y: SPAWN_Y },
    money: MONEY_START,
    wanted: 0,
    wantedTimer: 0,
    wantedGainCooldown: 0,
    bustTimer: 0,
    missionIndex: 0,
    mission: null,
    missionsDone: 0,
    storyComplete: false,
    kills: 0,
    crates: [],
    parkedCars: [],
    pickups: [],
    playTime: 0,
    handbrakeSmoke: 0,
  };

  // Scatter pickups on random street points.
  const randomStreetPoint =
    city && typeof city.randomStreetPoint === 'function'
      ? city.randomStreetPoint.bind(city)
      : () => ({ x: 900 + rng() * 1000, y: 500 + rng() * 1000 });
  for (let i = 0; i < PICKUP_CASH_COUNT; i++) {
    const pt = randomStreetPoint(rng);
    state.pickups.push({ x: pt.x, y: pt.y, kind: 'cash', value: PICKUP_CASH_VALUE, taken: false, bob: rng() * 6 });
  }
  for (let i = 0; i < PICKUP_HEALTH_COUNT; i++) {
    const pt = randomStreetPoint(rng);
    state.pickups.push({ x: pt.x, y: pt.y, kind: 'health', value: PICKUP_HEALTH_VALUE, taken: false, bob: rng() * 6 });
  }
  for (let i = 0; i < PICKUP_AMMO_COUNT; i++) {
    const pt = randomStreetPoint(rng);
    state.pickups.push({ x: pt.x, y: pt.y, kind: 'ammo', value: PICKUP_AMMO_VALUE, taken: false, bob: rng() * 6 });
  }

  return state;
}

export function createWorld(seed = 1) {
  let currentSeed = seed;
  let state = buildState(currentSeed);

  function reset() {
    currentSeed += 1;
    state = buildState(currentSeed);
    return state;
  }

  function step(input, dt) {
    return stepWorld(state, input, dt);
  }

  return {
    get state() {
      return state;
    },
    reset,
    step,
  };
}

// --- Wanted helpers ---------------------------------------------------------

function addWanted(state, n) {
  state.wanted = clamp((state.wanted || 0) + n, 0, WANTED_MAX);
  state.wantedTimer = 0;
}

// Wanted decays only here: after 12 quiet seconds the first star
// falls, then one more every 8s.
function stepWanted(state, dt) {
  if ((state.wanted || 0) <= 0) return;
  state.wantedTimer = (state.wantedTimer || 0) + dt;
  if (state.wantedTimer >= WANTED_DECAY_DELAY) {
    state.wanted -= 1;
    // Leave the timer 8s short of the delay: the next star falls in 8s.
    state.wantedTimer = WANTED_DECAY_DELAY - WANTED_DECAY_EVERY;
  }
}

// Push an entity out of buildings. city.resolveCircle(x, y, r) takes
// COORDINATES + radius and returns the corrected { x, y } — it does not
// take an entity object (probed live: rc(1420,1230,11) -> {x,y}).
function resolveEntity(state, e, radius) {
  const city = state.city;
  if (!city || typeof city.resolveCircle !== 'function') return;
  const fixed = city.resolveCircle(e.x, e.y, radius);
  if (fixed && Number.isFinite(fixed.x) && Number.isFinite(fixed.y)) {
    e.x = fixed.x;
    e.y = fixed.y;
  }
}

// --- Respawn ----------------------------------------------------------------

export function respawnPlayer(state, reason) {
  const p = state.player;
  // Leave the car behind as a parked car instead of deleting it.
  if (p.inCar && p.car) {
    p.car.speed = 0;
    p.car.vx = 0;
    p.car.vy = 0;
    if (!Array.isArray(state.parkedCars)) state.parkedCars = [];
    state.parkedCars.push(p.car);
  }
  // Step off the boat (it stays moored where it was).
  if (p.inBoat && p.boat) {
    p.boat.inUse = false;
  }
  const safe = state.city && state.city.landmarks && state.city.landmarks.safehouse;
  p.x = safe ? safe.x : SPAWN_X;
  p.y = safe ? safe.y : SPAWN_Y;
  p.angle = -Math.PI / 2;
  p.aimAngle = -Math.PI / 2;
  p.hp = PLAYER_HP;
  p.inCar = false;
  p.car = null;
  p.inBoat = false;
  p.boat = null;
  p.invuln = 2;
  p.speed = 0;
  p.vx = 0;
  p.vy = 0;
  state.wanted = 0;
  state.wantedTimer = 0;
  state.bustTimer = 0;
  state.camera.x = p.x;
  state.camera.y = p.y;
  return reason;
}

// --- Save snapshot ----------------------------------------------------------

export function saveSnapshot(state) {
  const p = state.player;
  return {
    seed: state.seed,
    money: state.money,
    missionIndex: state.missionIndex,
    missionsDone: state.missionsDone,
    storyComplete: !!state.storyComplete,
    kills: state.kills,
    hp: p.hp,
    ammo: p.ammo,
    x: p.x,
    y: p.y,
    playTime: state.playTime,
  };
}

export function applySave(state, save) {
  if (!save) return false;
  state.money = save.money ?? MONEY_START;
  state.missionIndex = save.missionIndex ?? 0;
  state.missionsDone = save.missionsDone ?? 0;
  state.storyComplete = !!save.storyComplete;
  state.kills = save.kills ?? 0;
  state.playTime = save.playTime ?? 0;
  const p = state.player;
  p.hp = save.hp ?? PLAYER_HP;
  p.ammo = save.ammo ?? START_AMMO;
  p.x = save.x ?? SPAWN_X;
  p.y = save.y ?? SPAWN_Y;
  p.inCar = false;
  p.car = null;
  p.inBoat = false;
  p.boat = null;
  state.wanted = 0;
  state.wantedTimer = 0;
  state.bustTimer = 0;
  state.camera.x = p.x;
  state.camera.y = p.y;
  state.mission = null;
  if (!state.storyComplete && state.missionIndex < MISSIONS.length) {
    startMission(state, state.missionIndex);
  }
  return true;
}

// --- Driving ----------------------------------------------------------------

function stepDriving(state, input, dt) {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  if (car.vx === undefined) car.vx = 0;
  if (car.vy === undefined) car.vy = 0;
  if (car.radius === undefined) {
    car.radius = CAR_RADIUS;
    car.r = CAR_RADIUS;
  }

  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let speed = car.vx * fx + car.vy * fy;
  let latX = car.vx - fx * speed;
  let latY = car.vy - fy * speed;

  const throttle = clamp(input.throttle || 0, -1, 1);
  const steer = clamp(input.steer || 0, -1, 1);

  if (input.handbrake) {
    // Handbrake: hard decel + slide (grip almost gone) + tyre smoke.
    const dec = 1500 * dt;
    if (Math.abs(speed) <= dec) speed = 0;
    else speed -= Math.sign(speed) * dec;
    state.handbrakeSmoke = 0.25;
  } else if (throttle > 0) {
    speed += CAR_ACCEL * throttle * dt;
  } else if (throttle < 0) {
    if (speed > 0.5) speed -= CAR_BRAKE * dt; // brake
    else speed += CAR_REVERSE * dt * -throttle; // reverse
    if (speed < 0 && throttle >= 0) speed = 0;
  } else {
    // Coast: gentle drag.
    speed -= speed * CAR_DRAG * 0.5 * dt;
    if (Math.abs(speed) < 2) speed = 0;
  }
  speed = clamp(speed, -CAR_MAX_REVERSE, CAR_MAX_SPEED);

  // Steering bites harder the faster the car goes (up to a point).
  const steerAuthority = clamp(Math.abs(speed) / 240, 0, 1);
  car.angle += steer * CAR_TURN_RATE * steerAuthority * Math.sign(speed || 1) * dt;
  car.angle = normAngle(car.angle);

  // Grip kills sideways slide; handbrake lets the tail hang out.
  const grip = input.handbrake ? 0.7 : CAR_GRIP;
  const latDamp = Math.exp(-grip * dt);
  latX *= latDamp;
  latY *= latDamp;

  const nfx = Math.cos(car.angle);
  const nfy = Math.sin(car.angle);
  car.vx = nfx * speed + latX;
  car.vy = nfy * speed + latY;
  car.speed = speed;

  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.x = clamp(car.x, 16, WORLD_W - 16);
  car.y = clamp(car.y, 16, SEA_TOP - 4); // cars cannot drive into the sea

  if (state.city && typeof state.city.resolveCircle === 'function') {
    resolveEntity(state, car, CAR_RADIUS);
  }

  // Bump into traffic cars: shove apart, lose speed, crash event.
  let crashed = false;
  const traffic = state.traffic;
  if (traffic && Array.isArray(traffic.cars)) {
    for (const other of traffic.cars) {
      const d = dist(car.x, car.y, other.x, other.y);
      if (d > 0.01 && d < 42) {
        const push = (42 - d) / 2;
        const nx = (car.x - other.x) / d;
        const ny = (car.y - other.y) / d;
        car.x += nx * push;
        car.y += ny * push;
        other.x -= nx * push;
        other.y -= ny * push;
        car.vx *= 0.55;
        car.vy *= 0.55;
        car.speed *= 0.55;
        crashed = true;
      }
    }
  }
  if (crashed) state._crashed = true;

  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = Math.abs(speed);
  p.vx = car.vx;
  p.vy = car.vy;
}

// --- Walking ----------------------------------------------------------------

function stepWalking(state, input, dt) {
  const p = state.player;
  const mx = input.mx || 0;
  const my = input.my || 0;
  const len = Math.sqrt(mx * mx + my * my);
  const speed = input.running ? RUN_SPEED : WALK_SPEED;
  if (len > 0.01) {
    const nx = mx / len;
    const ny = my / len;
    p.x += nx * speed * dt;
    p.y += ny * speed * dt;
    p.angle = Math.atan2(ny, nx);
    p.speed = speed;
  } else {
    p.speed = 0;
  }
  p.x = clamp(p.x, 16, WORLD_W - 16);
  // On foot the sea is a wall: the beach ends at SEA_TOP.
  p.y = clamp(p.y, 16, SEA_TOP - 6);
  p.vx = 0;
  p.vy = 0;

  if (state.city && typeof state.city.resolveCircle === 'function') {
    resolveEntity(state, p, PLAYER_RADIUS);
  }
}

// --- The main step ----------------------------------------------------------

function stepWorld(state, input, dt) {
  if (!input) input = {};
  // Substep big frames so physics stays stable (max ~33ms per substep).
  let remaining = Math.min(dt || 0, 0.25);
  let events = 0;
  while (remaining > 0) {
    const h = Math.min(remaining, 1 / 30);
    events |= stepOnce(state, input, h);
    remaining -= h;
  }
  return events;
}

function stepOnce(state, input, dt) {
  const p = state.player;
  let events = 0;
  state.playTime = (state.playTime || 0) + dt;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.gunCooldown > 0) p.gunCooldown -= dt;
  if (p.punchCooldown > 0) p.punchCooldown -= dt;
  if (state.wantedGainCooldown > 0) state.wantedGainCooldown -= dt;
  if (state.handbrakeSmoke > 0) state.handbrakeSmoke -= dt;

  const actions = input.actions || 0;

  // Aim follows the mouse, always.
  if (input.aimX !== undefined && input.aimY !== undefined) {
    p.aimAngle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
  }

  // Mute toggle.
  if (actions & ACT.MUTE) {
    if (state.audio && typeof state.audio.isMuted === 'function') {
      const muted = !state.audio.isMuted();
      if (typeof state.audio.setMuted === 'function') state.audio.setMuted(muted);
      if (state.radio && typeof RadioMod.setRadioMuted === 'function') {
        RadioMod.setRadioMuted(state.radio, muted);
      }
    }
  }

  // Radio: Q cycles the station (a key press is a user gesture, so the
  // AudioContext may be created here).
  if (actions & ACT.RADIO) {
    if (state.radio) {
      if (typeof RadioMod.ensureRadio === 'function') RadioMod.ensureRadio(state.radio);
      if (typeof RadioMod.cycleRadio === 'function') RadioMod.cycleRadio(state.radio);
    }
  }

  // Interact (E).
  if (actions & ACT.INTERACT) {
    events |= tryInteract(state);
  }

  // Punch (Space on foot).
  if ((actions & ACT.PUNCH) && !p.inCar && !p.inBoat && p.punchCooldown <= 0) {
    if (typeof CombatMod.meleeAttack === 'function') {
      CombatMod.meleeAttack(state);
      p.punchCooldown = PUNCH_COOLDOWN;
      events |= EV.PUNCH;
    }
  }

  // Shooting (mouse held, on foot only).
  if (input.shooting && !p.inCar && !p.inBoat && p.gunCooldown <= 0 && p.ammo > 0) {
    if (typeof CombatMod.firePlayerBullet === 'function') {
      const before = p.ammo;
      CombatMod.firePlayerBullet(state, p.x, p.y, p.aimAngle);
      if (p.ammo < before) {
        p.gunCooldown = GUN_COOLDOWN;
        events |= EV.SHOT;
        if (state.wantedGainCooldown <= 0) {
          addWanted(state, WANTED_SHOOT);
          state.wantedGainCooldown = SHOOT_WANTED_COOLDOWN;
        }
      }
    }
  }

  // Movement: boat / car / feet.
  if (p.inBoat) {
    if (typeof BoatsMod.stepBoating === 'function') {
      BoatsMod.stepBoating(state, input, dt);
    }
    if (p.boat) {
      p.x = p.boat.x;
      p.y = p.boat.y;
      p.angle = p.boat.angle;
      p.speed = Math.abs(p.boat.speed || 0);
    }
  } else if (p.inCar) {
    stepDriving(state, input, dt);
  } else {
    stepWalking(state, input, dt);
  }

  // Traffic + combat.
  if (typeof TrafficMod.stepTraffic === 'function' && state.traffic) {
    TrafficMod.stepTraffic(state.traffic, state.city, state.rng, dt);
  }
  const hpBefore = p.hp;
  if (typeof CombatMod.stepCombat === 'function' && state.combat) {
    CombatMod.stepCombat(state, dt);
  }
  if (p.hp < hpBefore) events |= EV.ENEMY_SHOT;

  // Kill sweep (the ONLY place kills are counted): dead enemies are
  // removed from the world and state.kills goes up exactly once each.
  if (state.combat && Array.isArray(state.combat.enemies)) {
    const alive = [];
    for (const e of state.combat.enemies) {
      if (e.hp <= 0) state.kills = (state.kills || 0) + 1;
      else alive.push(e);
    }
    state.combat.enemies = alive;
  }

  // Police chase + deeper police AI.
  if (typeof PoliceMod.stepPolice === 'function' && state.police) {
    PoliceMod.stepPolice(state, dt);
  }
  if (typeof Police2Mod.stepPolice2 === 'function' && state.police2) {
    Police2Mod.stepPolice2(state, dt);
  }

  // Side jobs: coins + taxi fares.
  if (typeof SideJobsMod.stepSideJobs === 'function' && state.sideJobs) {
    SideJobsMod.stepSideJobs(state, dt);
  }

  // Police ramming the player + busting on foot.
  const cops = state.police && Array.isArray(state.police.cars) ? state.police.cars : [];
  let copNear = false;
  for (const cop of cops) {
    const d = dist(p.x, p.y, cop.x, cop.y);
    if (p.inCar) {
      if (d < 40) {
        cop._ramCd = (cop._ramCd || 0) - dt;
        if (cop._ramCd <= 0 && p.invuln <= 0) {
          cop._ramCd = 0.9;
          p.hp = Math.max(0, p.hp - 6);
          events |= EV.CRASH;
        }
        // Shove the cars apart so they do not stick together.
        if (d > 0.01) {
          const nx = (p.x - cop.x) / d;
          const ny = (p.y - cop.y) / d;
          if (p.car) {
            p.car.x += nx * 12 * dt * 10;
            p.car.y += ny * 12 * dt * 10;
          }
        }
      }
    } else if (!p.inBoat) {
      if (d < BUST_RADIUS) copNear = true;
    }
  }
  if (copNear && p.invuln <= 0) {
    state.bustTimer = (state.bustTimer || 0) + dt;
    if (state.bustTimer >= BUST_SECONDS) {
      respawnPlayer(state, 'busted');
      events |= EV.BUSTED;
    }
  } else {
    state.bustTimer = 0;
  }

  // Running pedestrians over (only while driving).
  if (p.inCar && state.traffic && Array.isArray(state.traffic.peds)) {
    const peds = state.traffic.peds;
    for (let i = peds.length - 1; i >= 0; i--) {
      const ped = peds[i];
      if (dist(p.x, p.y, ped.x, ped.y) < 26) {
        if (!ped.down) {
          ped.down = true;
          ped.panic = 1;
          addWanted(state, WANTED_HIT_PED);
          events |= EV.CRASH;
        } else if (!ped._counted) {
          ped._counted = true;
          addWanted(state, WANTED_KILL_PED);
          peds.splice(i, 1);
          events |= EV.CRASH;
        }
      }
    }
  }

  // Crash flag from the driving step.
  if (state._crashed) {
    state._crashed = false;
    events |= EV.CRASH;
  }

  // Pickups: cash / health / ammo on the street.
  for (const pk of state.pickups || []) {
    if (!pk.taken && dist(p.x, p.y, pk.x, pk.y) < 34) {
      pk.taken = true;
      if (pk.kind === 'cash') state.money += pk.value;
      else if (pk.kind === 'health') p.hp = Math.min(PLAYER_HP, p.hp + pk.value);
      else if (pk.kind === 'ammo') p.ammo = Math.min(240, p.ammo + pk.value);
      events |= EV.PICKUP;
    }
  }

  // Wanted decay (only here).
  stepWanted(state, dt);

  // Missions.
  events |= updateMission(state);

  // WASTED: hp hit zero.
  if (p.hp <= 0) {
    respawnPlayer(state, 'wasted');
    events |= EV.DIED;
  }

  // Camera: follow the player, look ahead a little when moving fast.
  const look = clamp(p.speed || 0, 0, 560) * 0.22;
  const tx = p.x + Math.cos(p.angle) * look;
  const ty = p.y + Math.sin(p.angle) * look;
  const k = 1 - Math.exp(-5 * dt);
  state.camera.x += (tx - state.camera.x) * k;
  state.camera.y += (ty - state.camera.y) * k;
  state.camera.x = clamp(state.camera.x, 640, WORLD_W - 640);
  state.camera.y = clamp(state.camera.y, 400, WORLD_H - 400);

  return events;
}

export { MISSIONS };
