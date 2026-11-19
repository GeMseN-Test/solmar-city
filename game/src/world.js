// world.js — the living world of Solmar City.
// Owns the whole game state and one frame of simulation: walking, driving
// (with handbrake), boating, shooting, punching, pickups, wanted level,
// police, missions, and the save snapshot.
//
// Two rules that matter:
//   1. The wanted level lives HERE, in state.wanted. Police modules read
//      it; they never own it. world.step is the only place it goes up
//      (crime) or down (decay).
//   2. Dead enemies are swept out and counted HERE, in world.step — never
//      in combat. An enemy with hp <= 0 stays in the fight list until this
//      step removes it and bumps state.kills exactly once, which is what
//      defeat objectives count.

import { buildCity } from './city.js';
import { createRng } from './random.js';
import { createCombat, stepCombat, firePlayerBullet, meleeAttack } from './combat.js';
import { createBoats, stepBoating, exitBoat } from './boats.js';
import { createRadio } from './radio.js';
import { createTraffic, stepTraffic } from './traffic.js';
import { createSideJobs, stepSideJobs } from './sidejobs.js';
import { createPolice2, stepPolice2 } from './police2.js';
import { createAudio } from './audio.js';
import * as policeMod from './police.js';
import {
  MISSIONS,
  EVENTS,
  startMission,
  updateMission,
  tryInteract,
  exitCar,
} from './missions.js';
import { registerStoryMissions } from './missions2.js';
import { registerMissions3 } from './missions3.js';
import { registerMissions4 } from './missions4.js';

export { EVENTS };

// ---- Tunables (the numbers the spec pins down) ----
const WORLD_W = 2880;
const WORLD_H = 2160;
const SEA_TOP = 2100;
const BEACH_TOP = 2020;
const SPAWN_X = 1420;
const SPAWN_Y = 1230;
const WALK_SPEED = 175;
const RUN_SPEED = 268;
const PLAYER_RADIUS = 11;
const MONEY_START = 50;
const PLAYER_HP = 100;
const START_AMMO = 48;
const MAX_AMMO = 240;
const MAX_HP = 100;

// Driving feel.
const CAR_ACCEL = 640;
const CAR_BRAKE = 980;
const CAR_REVERSE = 420;
const CAR_MAX_SPEED = 560;
const CAR_MAX_REVERSE = 190;
const CAR_TURN = 2.7;
const CAR_GRIP = 3.2;
const CAR_DRAG = 0.55;
const CAR_RAM_DAMAGE = 18;

// Wanted rules.
const WANTED_MAX = 5;
const WANTED_DECAY_DELAY = 12;
const WANTED_DECAY_EVERY = 8;
const BUST_SECONDS = 1.6;
const BUST_DIST = 34;

// Pickups scattered around the streets.
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

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Small helpers over the seeded rng. Only rng.next() is assumed to exist.
function rr(rng, a, b) {
  return a + rng.next() * (b - a);
}

function pickPoint(rng, city) {
  if (city && typeof city.randomStreetPoint === 'function') {
    return city.randomStreetPoint(rng);
  }
  return { x: rr(rng, 200, WORLD_W - 200), y: rr(rng, 200, BEACH_TOP - 100) };
}

// Push an entity out of buildings. city.resolveCircle takes an entity
// object and either mutates it or returns a corrected { x, y }.
function resolveBuildings(state, ent, radius) {
  const city = state.city;
  if (!city || typeof city.resolveCircle !== 'function') return;
  const probe = { x: ent.x, y: ent.y, radius };
  let out;
  try {
    out = city.resolveCircle(probe);
  } catch (err) {
    return;
  }
  const fixed = out && typeof out.x === 'number' ? out : probe;
  ent.x = fixed.x;
  ent.y = fixed.y;
}

function safehousePos(state) {
  const lm = state.city && state.city.landmarks ? state.city.landmarks.safehouse : null;
  if (!lm) return { x: SPAWN_X, y: SPAWN_Y - 40 };
  return {
    x: typeof lm.x === 'number' ? lm.x : lm[0],
    y: typeof lm.y === 'number' ? lm.y : lm[1],
  };
}

function buildState(seed) {
  const rng = createRng(seed);
  const city = buildCity(rng);
  const state = {
    seed,
    rng,
    city,
    time: 0,
    playTime: 0,
    money: MONEY_START,
    wanted: 0,
    wantedTimer: 0,
    decayTimer: 0,
    kills: 0,
    killsAtStart: 0,
    missionIndex: 0,
    missionsDone: 0,
    storyComplete: false,
    mission: null,
    missionActive: false,
    missionObjectiveIndex: 0,
    missionFlags: { collected: 0, vaultGrabbed: false },
    missionBanner: null,
    missionCooldown: 1.5,
    player: {
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
    },
    traffic: createTraffic(rng, city),
    combat: createCombat(),
    boats: createBoats(rng),
    radio: createRadio(),
    police: typeof policeMod.createPolice === 'function'
      ? policeMod.createPolice()
      : { cars: [], cops: [] },
    police2: createPolice2(),
    sideJobs: createSideJobs(rng, city),
    audio: createAudio(),
    parkedCars: [],
    crates: [],
    particles: [],
    pickups: [],
    gunCooldown: 0,
    punchCooldown: 0,
    bustTimer: 0,
    ramCooldown: 0,
    camera: { x: SPAWN_X, y: SPAWN_Y },
    lastDeath: null,
  };

  for (let i = 0; i < PICKUP_CASH_COUNT; i++) {
    const p = pickPoint(rng, city);
    state.pickups.push({ x: p.x, y: p.y, kind: 'cash', amount: PICKUP_CASH_VALUE, taken: false });
  }
  for (let i = 0; i < PICKUP_HEALTH_COUNT; i++) {
    const p = pickPoint(rng, city);
    state.pickups.push({ x: p.x, y: p.y, kind: 'health', amount: PICKUP_HEALTH_VALUE, taken: false });
  }
  for (let i = 0; i < PICKUP_AMMO_COUNT; i++) {
    const p = pickPoint(rng, city);
    state.pickups.push({ x: p.x, y: p.y, kind: 'ammo', amount: PICKUP_AMMO_VALUE, taken: false });
  }
  return state;
}

// Put the player back on their feet at the Safehouse after WASTED or
// BUSTED. Keeps the mission and the money; clears the heat and the ride.
export function respawnPlayer(state, reason) {
  const p = state.player;
  if (p.inCar && p.car) {
    state.parkedCars.push(p.car);
  }
  if (p.inBoat && p.boat) {
    p.boat.inUse = false;
  }
  const home = safehousePos(state);
  p.x = home.x;
  p.y = home.y + 30;
  p.angle = -Math.PI / 2;
  p.aimAngle = -Math.PI / 2;
  p.hp = PLAYER_HP;
  p.inCar = false;
  p.car = null;
  p.inBoat = false;
  p.boat = null;
  p.invuln = 2;
  state.wanted = 0;
  state.wantedTimer = 0;
  state.decayTimer = 0;
  state.bustTimer = 0;
  state.lastDeath = reason || 'wasted';
  state.missionBanner = {
    title: reason === 'busted' ? 'BUSTED' : 'WASTED',
    text: reason === 'busted'
      ? 'The cops dragged Mara back to the Safehouse.'
      : 'Mara woke up at the Safehouse, patched up and broke even.',
    timer: 3.5,
  };
}

// Everything the save file needs to restore a run.
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

// Restore a snapshot onto a live state (keeps the world, moves the player).
export function applySave(state, save) {
  if (!save) return false;
  state.money = typeof save.money === 'number' ? save.money : state.money;
  state.missionIndex = typeof save.missionIndex === 'number' ? save.missionIndex : 0;
  state.missionsDone = typeof save.missionsDone === 'number' ? save.missionsDone : 0;
  state.storyComplete = !!save.storyComplete;
  state.kills = typeof save.kills === 'number' ? save.kills : 0;
  state.player.hp = typeof save.hp === 'number' ? save.hp : PLAYER_HP;
  state.player.ammo = typeof save.ammo === 'number' ? save.ammo : START_AMMO;
  if (typeof save.x === 'number') state.player.x = save.x;
  if (typeof save.y === 'number') state.player.y = save.y;
  if (typeof save.playTime === 'number') state.playTime = save.playTime;
  state.mission = null;
  state.missionActive = false;
  state.missionCooldown = 1.5;
  return true;
}

function addCrime(state, amount) {
  state.wanted = clamp((state.wanted || 0) + amount, 0, WANTED_MAX);
  state.wantedTimer = 0;
  state.decayTimer = 0;
}

function stepOnFoot(state, input, dt) {
  const p = state.player;
  let mx = input.mx || 0;
  let my = input.my || 0;
  const len = Math.sqrt(mx * mx + my * my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  const speed = input.running ? RUN_SPEED : WALK_SPEED;
  const nx = p.x + mx * speed * dt;
  const ny = p.y + my * speed * dt;
  if (mx !== 0 || my !== 0) {
    p.angle = Math.atan2(my, mx);
  }
  const inSea = state.city && typeof state.city.isInSea === 'function'
    ? state.city.isInSea(nx, ny)
    : ny > SEA_TOP;
  if (!inSea) {
    p.x = nx;
    p.y = ny;
  }
  resolveBuildings(state, p, PLAYER_RADIUS);
  p.x = clamp(p.x, 16, WORLD_W - 16);
  p.y = clamp(p.y, 16, SEA_TOP);
  p.aimAngle = Math.atan2((input.aimY || 0) - p.y, (input.aimX || 0) - p.x);
}

function stepDriving(state, input, dt) {
  const p = state.player;
  const car = p.car;
  if (!car) {
    p.inCar = false;
    return 0;
  }
  let events = 0;
  const throttle = clamp(input.throttle || 0, -1, 1);
  const steer = clamp(input.steer || 0, -1, 1);
  let speed = car.speed || 0;

  if (input.handbrake) {
    // Handbrake: hard stop, a little slide, tyre smoke behind the car.
    const decel = CAR_BRAKE * 1.6 * dt;
    speed -= Math.sign(speed) * Math.min(Math.abs(speed), decel);
    car.angle += steer * CAR_TURN * 0.35 * dt * clamp(Math.abs(speed) / 200, 0, 1);
    if (Math.abs(speed) > 60 && state.rng.next() < 0.6) {
      state.particles.push({
        x: p.x - Math.cos(car.angle) * 20,
        y: p.y - Math.sin(car.angle) * 20,
        life: 0.7,
        maxLife: 0.7,
        kind: 'smoke',
      });
    }
  } else if (throttle > 0) {
    speed += CAR_ACCEL * throttle * dt;
  } else if (throttle < 0) {
    if (speed > 5) speed -= CAR_BRAKE * dt;
    else speed -= CAR_REVERSE * dt;
  } else {
    speed -= speed * CAR_DRAG * dt;
    if (Math.abs(speed) < 4) speed = 0;
  }
  speed = clamp(speed, -CAR_MAX_REVERSE, CAR_MAX_SPEED);

  const gripFactor = input.handbrake ? CAR_GRIP * 0.45 : CAR_GRIP;
  const turnAuthority = clamp(Math.abs(speed) / 180, 0, 1) * (speed >= 0 ? 1 : -1);
  car.angle += steer * CAR_TURN * gripFactor * 0.32 * turnAuthority * dt;

  const nx = car.x + Math.cos(car.angle) * speed * dt;
  const ny = car.y + Math.sin(car.angle) * speed * dt;
  const beforeX = car.x;
  const beforeY = car.y;
  car.x = nx;
  car.y = ny;
  resolveBuildings(state, car, 22);
  const hitWall = Math.abs(car.x - nx) > 0.5 || Math.abs(car.y - ny) > 0.5;
  if (hitWall && Math.abs(speed) > 240) {
    events |= EVENTS.CRASH;
    p.hp = Math.max(0, p.hp - 6);
    if (state.audio && typeof state.audio.crash === 'function') {
      state.audio.crash(Math.min(1, Math.abs(speed) / CAR_MAX_SPEED));
    }
    speed *= -0.25;
  }
  car.x = clamp(car.x, 16, WORLD_W - 16);
  car.y = clamp(car.y, 16, BEACH_TOP - 20);
  car.speed = speed;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.aimAngle = car.angle;

  // Ramming a pedestrian on the road is a crime, and it hurts them.
  if (Math.abs(speed) > 120) {
    for (const ped of state.traffic.peds || []) {
      if (ped.down) continue;
      if (dist(p.x, p.y, ped.x, ped.y) < 30) {
        ped.down = true;
        ped.panic = 1;
        addCrime(state, 1);
        speed *= 0.82;
        car.speed = speed;
      }
    }
  }
  void beforeX;
  void beforeY;
  return events;
}

function stepShooting(state, input) {
  const p = state.player;
  let events = 0;
  if (input.shooting && !p.inCar && !p.inBoat) {
    const ammoBefore = p.ammo;
    firePlayerBullet(state, p.x, p.y, p.aimAngle);
    if (p.ammo < ammoBefore) {
      events |= EVENTS.SHOT;
      addCrime(state, 1);
    }
  }
  if ((input.actions || 0) & 8) {
    meleeAttack(state);
    events |= EVENTS.PUNCH;
  }
  return events;
}

function sweepDeadEnemies(state) {
  const combat = state.combat;
  if (!combat || !Array.isArray(combat.enemies)) return;
  let kept = 0;
  for (let i = 0; i < combat.enemies.length; i++) {
    const e = combat.enemies[i];
    if (e.hp <= 0) {
      state.kills += 1;
    } else {
      combat.enemies[kept] = e;
      kept += 1;
    }
  }
  combat.enemies.length = kept;
}

function stepPickups(state) {
  const p = state.player;
  let events = 0;
  for (const pk of state.pickups) {
    if (pk.taken) continue;
    if (dist(p.x, p.y, pk.x, pk.y) > 26) continue;
    pk.taken = true;
    if (pk.kind === 'cash') state.money += pk.amount;
    if (pk.kind === 'health') p.hp = Math.min(MAX_HP, p.hp + pk.amount);
    if (pk.kind === 'ammo') p.ammo = Math.min(MAX_AMMO, p.ammo + pk.amount);
    events |= EVENTS.PICKUP;
  }
  return events;
}

function stepWanted(state, dt) {
  if (state.wanted <= 0) return;
  state.wantedTimer += dt;
  if (state.wantedTimer < WANTED_DECAY_DELAY) return;
  state.decayTimer += dt;
  if (state.decayTimer >= WANTED_DECAY_EVERY) {
    state.decayTimer = 0;
    state.wanted = Math.max(0, state.wanted - 1);
  }
}

function stepBustAndRam(state, dt) {
  const p = state.player;
  let events = 0;
  const cars = (state.police && state.police.cars) || [];
  let nearCop = false;
  for (const cop of cars) {
    if (cop.roadblock) continue;
    const d = dist(p.x, p.y, cop.x, cop.y);
    if (d < BUST_DIST && !p.inCar && !p.inBoat && p.invuln <= 0) nearCop = true;
    // A cruiser ramming the player's car hurts — unless the player is
    // still invulnerable from a fresh respawn.
    if (d < 46 && p.inCar && p.invuln <= 0 && state.ramCooldown <= 0) {
      p.hp = Math.max(0, p.hp - 9);
      state.ramCooldown = 0.8;
      events |= EVENTS.CRASH;
    }
  }
  if (nearCop) {
    state.bustTimer += dt;
    if (state.bustTimer >= BUST_SECONDS) {
      state.bustTimer = 0;
      events |= EVENTS.BUSTED;
      respawnPlayer(state, 'busted');
    }
  } else {
    state.bustTimer = Math.max(0, state.bustTimer - dt * 2);
  }
  if (state.ramCooldown > 0) state.ramCooldown -= dt;
  return events;
}

function stepCamera(state, input) {
  const p = state.player;
  let tx = p.x;
  let ty = p.y;
  if (p.inBoat && p.boat) {
    tx += Math.cos(p.angle) * 120;
    ty += Math.sin(p.angle) * 120;
  } else if (p.inCar && p.car) {
    tx += Math.cos(p.angle) * 90;
    ty += Math.sin(p.angle) * 90;
  }
  const cam = state.camera;
  cam.x += (tx - cam.x) * 0.12;
  cam.y += (ty - cam.y) * 0.12;
  cam.x = clamp(cam.x, 640, WORLD_W - 640);
  cam.y = clamp(cam.y, 400, WORLD_H - 400);
  void input;
}

// One frame. `input` is a plain values object built by main.js each frame:
// { mx, my, aimX, aimY, actions, shooting, running, steer, throttle,
//   handbrake }. Returns the events bitmask for this frame.
export function stepWorld(state, input, dt) {
  const safeDt = clamp(typeof dt === 'number' && dt > 0 ? dt : 0.016, 0.001, 0.05);
  let events = 0;
  state.time += safeDt;
  state.playTime += safeDt;
  const p = state.player;
  if (p.invuln > 0) p.invuln -= safeDt;
  if (state.missionBanner && state.missionBanner.timer > 0) {
    state.missionBanner.timer -= safeDt;
  }

  const actions = input.actions || 0;
  if (actions & 4) {
    if (p.inCar) {
      exitCar(state);
    } else if (p.inBoat) {
      exitBoat(state);
    } else {
      events |= tryInteract(state);
    }
  }

  if (p.inBoat) {
    stepBoating(state, input, safeDt);
    if (p.boat && Math.abs(p.boat.speed || 0) > 60) {
      state.particles.push({
        x: p.x - Math.cos(p.angle) * 26,
        y: p.y - Math.sin(p.angle) * 26,
        life: 0.9,
        maxLife: 0.9,
        kind: 'wake',
      });
    }
  } else if (p.inCar) {
    events |= stepDriving(state, input, safeDt);
  } else {
    stepOnFoot(state, input, safeDt);
    events |= stepShooting(state, input);
  }

  if (p.hp <= 0) {
    events |= EVENTS.DIED;
    respawnPlayer(state, 'wasted');
  }

  stepCombat(state, safeDt);
  sweepDeadEnemies(state);
  stepTraffic(state.traffic, state.city, state.rng, safeDt);
  if (typeof policeMod.stepPolice === 'function') {
    policeMod.stepPolice(state, safeDt);
  }
  stepPolice2(state, safeDt);
  events |= stepSideJobs(state, safeDt);
  events |= stepPickups(state);
  events |= stepBustAndRam(state, safeDt);
  stepWanted(state, safeDt);

  // Missions: start the next one a few seconds after the last ended, and
  // keep the current one moving.
  if (!state.mission && !state.storyComplete) {
    if (state.missionIndex < MISSIONS.length) {
      state.missionCooldown -= safeDt;
      if (state.missionCooldown <= 0) {
        events |= startMission(state, state.missionIndex);
      }
    }
  } else if (state.mission) {
    events |= updateMission(state);
  }

  // Age particles out.
  for (let i = state.particles.length - 1; i >= 0; i--) {
    state.particles[i].life -= safeDt;
    if (state.particles[i].life <= 0) state.particles.splice(i, 1);
  }

  stepCamera(state, input);
  if (state.audio && typeof state.audio.siren === 'function') {
    state.audio.siren(state.wanted > 0);
  }
  return events;
}

// Build a fresh world. Registers every story mission batch once (the
// register calls are idempotent, so re-creating a world is safe).
export function createWorld(seed) {
  registerStoryMissions();
  registerMissions3();
  registerMissions4();
  const state = buildState(typeof seed === 'number' ? seed : 1);
  const api = {
    state,
    step(input, dt) {
      return stepWorld(state, input, dt);
    },
    reset(newSeed) {
      const next = buildState(typeof newSeed === 'number' ? newSeed : state.seed + 1);
      for (const key of Object.keys(state)) delete state[key];
      Object.assign(state, next);
      return state;
    },
  };
  return api;
}
