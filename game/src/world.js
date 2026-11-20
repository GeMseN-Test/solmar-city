// Solmar City — the world. createWorld(seed) builds a whole game
// state (city, player, traffic, police, boats, radio, side jobs,
// pickups, parked cars, the Grand Prix countdown) and returns
// { state, reset, step }.
//
// step(input, dt) moves the world one frame: the input is a plain
// values object { mx, my, aimX, aimY, actions, shooting, running,
// steer, throttle, handbrake } and dt is seconds. It returns an
// events bitmask (see EV in config.js) so main.js knows which sounds
// to play. Big dt values are split into small sub-steps so nothing
// tunnels through a wall on a slow frame.
//
// The world owns the rules that cut across modules: driving and
// walking, wanted decay, busting, dying, pickups, the kill sweep
// (dead enemies are removed and counted HERE, exactly once — combat
// only leaves them in place), and the Grand Prix countdown.
//
// Contracts used from the other modules (all from the spec):
//   combat: createCombat, spawnGang, firePlayerBullet, meleeAttack,
//     stepCombat. Dead enemies stay in state.combat.enemies.
//   traffic: createTraffic(rng, city), stepTraffic, nearestTrafficCar.
//   police: createPolice(rng, city), stepPolice(state, dt).
//     Cruisers live in state.police.cars; roadblocks are pushed there
//     too with roadblock: true.
//   police2: createPolice2, stepPolice2(state, dt), heliSpotlight.
//   boats: createBoats(rng), nearestBoat, boardBoat, exitBoat,
//     stepBoating(state, input, dt), isSailable.
//   radio: createRadio. sidejobs: createSideJobs(rng, city),
//     stepSideJobs(state, dt).

import {
  WORLD_W, WORLD_H, CAR, PLAYER, WANTED, MONEY_START,
  TRAFFIC_CARS, PEDESTRIANS, PICKUPS, GRAND_PRIX_SECONDS,
  EV, SPAWN,
} from './config.js';
import { createRng } from './random.js';
import { clamp, dist, normalizeAngle, angleTo } from './util.js';
import { buildCity } from './city.js';
import {
  MISSIONS, startMission, updateMission, tryInteract,
} from './missions.js';
import { registerStoryMissions } from './missions2.js';
import { registerMissions3 } from './missions3.js';
import { registerMissions4 } from './missions4.js';
import {
  createCombat, stepCombat, firePlayerBullet, meleeAttack,
} from './combat.js';
import { createTraffic, stepTraffic } from './traffic.js';
import { createPolice, stepPolice } from './police.js';
import { createPolice2, stepPolice2 } from './police2.js';
import { createBoats, stepBoating } from './boats.js';
import { createRadio } from './radio.js';
import { createSideJobs, stepSideJobs } from './sidejobs.js';
import { saveSnapshot, applySave } from './save.js';

export { saveSnapshot, applySave, EV };

// The full mission list: v1 five plus the v2 / retry / attempt-3
// packs, registered once when this module loads.
registerStoryMissions();
registerMissions3();
registerMissions4();

const ACTION_INTERACT = 4;
const ACTION_PUNCH = 8;
const MAX_SUBSTEP = 1 / 30;
const CAR_MODELS = ['sedan', 'van', 'taxi', 'truck', 'sport'];
const CAR_COLORS = [
  '#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad',
  '#ecf0f1', '#2c3e50', '#e67e22', '#16a085', '#d35400',
];

function freshPlayer() {
  return {
    x: SPAWN.x,
    y: SPAWN.y,
    angle: SPAWN.angle,
    aimAngle: SPAWN.angle,
    hp: 100,
    ammo: PLAYER.startAmmo,
    inCar: false,
    car: null,
    inBoat: false,
    boat: null,
    invuln: 0,
  };
}

// Parked cars Mara can steal: seeded street points, spread out.
function spawnParkedCars(rng, city) {
  const cars = [];
  for (let i = 0; i < 10; i++) {
    const spot = city.randomStreetPoint(rng);
    cars.push({
      kind: 'parked',
      x: spot.x,
      y: spot.y,
      angle: rng.range(0, Math.PI * 2),
      speed: 0,
      model: CAR_MODELS[i % CAR_MODELS.length],
      color: CAR_COLORS[i % CAR_COLORS.length],
    });
  }
  return cars;
}

// Cash / health / ammo pickups scattered on the streets.
function spawnPickups(rng, city) {
  const pickups = [];
  const kinds = [
    ['cash', PICKUPS.cash.count, PICKUPS.cash.amount],
    ['health', PICKUPS.health.count, PICKUPS.health.amount],
    ['ammo', PICKUPS.ammo.count, PICKUPS.ammo.amount],
  ];
  for (const [kind, count, amount] of kinds) {
    for (let i = 0; i < count; i++) {
      const spot = city.randomStreetPoint(rng);
      pickups.push({
        x: spot.x,
        y: spot.y,
        kind,
        amount,
        taken: false,
        bob: rng.range(0, Math.PI * 2),
      });
    }
  }
  return pickups;
}

function buildState(seed) {
  const rng = createRng(seed);
  const city = buildCity(rng);
  const state = {
    seed,
    rng,
    city,
    player: freshPlayer(),
    money: MONEY_START,
    wanted: 0,
    wantedQuiet: 0,
    wantedTimer: 0,
    missionIndex: 0,
    missionsDone: 0,
    storyComplete: false,
    mission: null,
    kills: 0,
    playTime: 0,
    traffic: createTraffic(rng, city),
    combat: createCombat(),
    police: createPolice(rng, city),
    police2: createPolice2(),
    boats: createBoats(rng),
    radio: createRadio(),
    sideJobs: createSideJobs(rng, city),
    parkedCars: spawnParkedCars(rng, city),
    pickups: spawnPickups(rng, city),
    crates: [],
    // The Grand Prix countdown: 6 hours of seconds, ticking down
    // in step; wraps back to a full 6 hours at zero. The HUD reads
    // state.grandPrix.startsIn — this exact shape is the contract.
    grandPrix: { startsIn: GRAND_PRIX_SECONDS },
    camera: { x: SPAWN.x, y: SPAWN.y },
    gunCooldown: 0,
    punchCooldown: 0,
    bustTimer: 0,
    wasted: false,
    busted: false,
    particles: [],
    shootHeatTimer: 0,
  };
  return state;
}

export function createWorld(seed) {
  const worldSeed = (seed >>> 0) || 1;
  let state = buildState(worldSeed);

  // Re-roll the world with a fresh seed (New Game after WASTED, or
  // the reset button). The state object keeps its identity — callers
  // hold a reference to it — so the fresh world is poured into the
  // same object instead of replacing it.
  function reset() {
    const nextSeed = ((state.seed * 1664525 + 1013904223) >>> 0) || 1;
    const fresh = buildState(nextSeed);
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, fresh);
    return state;
  }

  function step(input, dt) {
    let events = 0;
    let left = Math.min(Math.max(dt, 0), 0.25);
    while (left > 0) {
      const h = Math.min(left, MAX_SUBSTEP);
      events |= stepOnce(state, input, h);
      left -= h;
    }
    return events;
  }

  return { state, reset, step };
}

function stepOnce(state, input, dt) {
  let events = 0;
  const p = state.player;
  state.playTime += dt;

  // Grand Prix countdown: one second per second, wrap at zero.
  state.grandPrix.startsIn -= dt;
  if (state.grandPrix.startsIn <= 0) {
    state.grandPrix.startsIn = GRAND_PRIX_SECONDS;
  }

  if (p.invuln > 0) p.invuln -= dt;
  if (state.shootHeatTimer > 0) state.shootHeatTimer -= dt;

  // Aim follows the mouse, on foot and in a car.
  if (input.aimX !== undefined && input.aimY !== undefined) {
    p.aimAngle = angleTo(p.x, p.y, input.aimX, input.aimY);
  }

  // E: board a boat, steal a car, grab a crate, crack the vault...
  if (input.actions & ACTION_INTERACT) {
    events |= tryInteract(state);
  }

  // Space on foot punches; the cooldown lives in combat.
  if ((input.actions & ACTION_PUNCH) && !p.inCar && !p.inBoat) {
    const hits = meleeAttack(state);
    if (hits) events |= EV.PUNCH;
  }

  // Mouse held: fire the gun (combat checks ammo + cooldown).
  if (input.shooting && !p.inCar && !p.inBoat) {
    if (firePlayerBullet(state, p.x, p.y, p.aimAngle)) {
      events |= EV.SHOT;
      if (state.shootHeatTimer <= 0) {
        state.wanted = Math.min(WANTED.max, state.wanted + WANTED.shoot);
        state.shootHeatTimer = 3;
      }
    }
  }

  // Movement: boat, car, or on foot.
  if (p.inBoat) {
    stepBoating(state, input, dt);
  } else if (p.inCar) {
    events |= driveCar(state, input, dt);
  } else {
    walkPlayer(state, input, dt);
  }

  // Combat: bullets fly, enemies chase and shoot. Dead enemies are
  // left in place here — the sweep below removes and counts them.
  stepCombat(state, dt);
  events |= sweepKills(state);

  stepTraffic(state.traffic, state.city, state.rng, dt);
  // Finisher fix (v2-retry integration): state.wanted is the single source
  // of truth — steal/vault/shoot raise it, stepWanted decays it. The police
  // modules only read police.wanted, which nothing in live play ever set,
  // so no chase cars, roadblocks or heli ever appeared. Mirror it here.
  state.police.wanted = state.wanted;
  stepPolice(state, dt);
  stepPolice2(state, dt);
  stepSideJobs(state, dt);

  events |= collectPickups(state);
  events |= updateMission(state);
  events |= stepWanted(state, dt);
  events |= checkBusted(state, dt);

  // Death: out of health means WASTED; main.js shows the screen
  // and respawns Mara at the safehouse on Enter.
  if (p.hp <= 0 && !state.wasted) {
    state.wasted = true;
    events |= EV.DIED;
  }

  updateCamera(state, dt);
  updateParticles(state, dt);
  return events;
}

// On foot: WASD/arrows move, Shift runs. Buildings push back.
function walkPlayer(state, input, dt) {
  const p = state.player;
  const mx = input.mx || 0;
  const my = input.my || 0;
  const len = Math.hypot(mx, my);
  if (len < 0.01) return;
  const speed = input.running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  p.x += (mx / len) * speed * dt;
  p.y += (my / len) * speed * dt;
  p.angle = Math.atan2(my, mx);
  p.radius = PLAYER.radius;
  state.city.resolveCircle(p);
}

// Driving: W/S throttle and brake/reverse, A/D steer, Space
// handbrakes (hard stop + tyre smoke + a little slide). The car
// pushes through pedestrians (heat) and bounces off traffic.
function driveCar(state, input, dt) {
  const p = state.player;
  const car = p.car;
  if (!car) { p.inCar = false; return 0; }
  let events = 0;
  const throttle = input.throttle || 0;
  const steer = input.steer || 0;

  if (throttle > 0) {
    car.speed += CAR.accel * throttle * dt;
  } else if (throttle < 0) {
    if (car.speed > 5) car.speed -= CAR.brake * dt;
    else car.speed += CAR.reverse * throttle * dt;
  } else {
    car.speed -= car.speed * CAR.drag * dt;
  }

  if (input.handbrake) {
    const before = Math.abs(car.speed);
    car.speed -= car.speed * 6 * dt;
    if (before > 120) {
      spawnSmoke(state, car.x, car.y);
      // A touch of slide while the brake is held.
      car.angle += steer * 0.4 * dt * Math.sign(car.speed || 1);
    }
  }

  car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
  const grip = input.handbrake ? CAR.grip * 0.35 : CAR.grip;
  const turn = steer * CAR.turnRate * clamp(car.speed / 220, -1, 1)
    * (car.speed >= 0 ? 1 : -1) * (grip / CAR.grip);
  car.angle = normalizeAngle(car.angle + turn * dt);
  p.angle = car.angle;

  const beforeX = car.x;
  const beforeY = car.y;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.radius = 16;
  state.city.resolveCircle(car);
  if ((car.x !== beforeX || car.y !== beforeY)
    && Math.abs(car.speed) > 150) {
    // A wall stopped the car mid-flight: crash, lose speed.
    const moved = dist(beforeX, beforeY, car.x, car.y);
    const expected = Math.abs(car.speed) * dt;
    if (expected - moved > 4) {
      car.speed *= 0.4;
      events |= EV.CRASH;
    }
  }
  p.x = car.x;
  p.y = car.y;

  // Ram a pedestrian: down they go (+1 heat); hit one who is already
  // down and they are gone (+2 heat).
  for (const ped of state.traffic.peds) {
    if (Math.abs(car.speed) < 40) continue;
    if (dist(car.x, car.y, ped.x, ped.y) > 30) continue;
    if (ped.down) {
      ped.gone = true;
      state.wanted = Math.min(WANTED.max, state.wanted + WANTED.killPedestrian);
    } else {
      ped.down = true;
      ped.wait = 3;
      state.wanted = Math.min(WANTED.max, state.wanted + WANTED.hitPedestrian);
      events |= EV.CRASH;
    }
  }
  state.traffic.peds = state.traffic.peds.filter((ped) => !ped.gone);

  // Bump a traffic car: both slow down, no damage model.
  for (const other of state.traffic.cars) {
    if (dist(car.x, car.y, other.x, other.y) > 42) continue;
    if (Math.abs(car.speed) > 120) events |= EV.CRASH;
    car.speed *= 0.55;
    other.speed *= 0.5;
    const push = angleTo(other.x, other.y, car.x, car.y);
    other.x += Math.cos(push) * 6;
    other.y += Math.sin(push) * 6;
  }
  return events;
}

// Remove dead enemies and count the kills — exactly once, here.
// Combat leaves the bodies in place for this sweep.
function sweepKills(state) {
  const enemies = state.combat.enemies;
  if (!enemies || enemies.length === 0) return 0;
  let dead = 0;
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].hp <= 0) {
      enemies.splice(i, 1);
      dead++;
    }
  }
  state.kills += dead;
  return 0;
}

// Pick up cash / health / ammo within reach (on foot or in a car).
function collectPickups(state) {
  const p = state.player;
  let events = 0;
  for (const item of state.pickups) {
    if (item.taken) continue;
    if (dist(p.x, p.y, item.x, item.y) > 30) continue;
    item.taken = true;
    if (item.kind === 'cash') state.money += item.amount;
    else if (item.kind === 'health') p.hp = Math.min(100, p.hp + item.amount);
    else if (item.kind === 'ammo') {
      p.ammo = Math.min(PLAYER.maxAmmo, p.ammo + item.amount);
    }
    events |= EV.PICKUP;
  }
  return events;
}

// Wanted stars decay after a quiet spell: 12s of no heat, then one
// star every 8s. Any heat resets the quiet timer.
function stepWanted(state, dt) {
  if (state.wanted <= 0) {
    state.wantedQuiet = 0;
    state.wantedTimer = 0;
    return 0;
  }
  state.wantedQuiet += dt;
  if (state.wantedQuiet < WANTED.decayDelay) return 0;
  state.wantedTimer += dt;
  if (state.wantedTimer >= WANTED.decayEvery) {
    state.wantedTimer = 0;
    state.wanted = Math.max(0, state.wanted - 1);
  }
  return 0;
}

// Busted: a cop stays on top of Mara for 1.6 seconds. Works with
// cruisers (police.cars) and foot cops (police.foot) alike.
function checkBusted(state, dt) {
  if (state.busted || state.wasted) return 0;
  const p = state.player;
  if (p.invuln > 0) return 0;
  let close = false;
  const cars = (state.police && state.police.cars) || [];
  for (const cop of cars) {
    if (cop.roadblock) continue;
    if (dist(p.x, p.y, cop.x, cop.y) < 34) { close = true; break; }
  }
  if (!close && state.police && Array.isArray(state.police.foot)) {
    for (const cop of state.police.foot) {
      if (dist(p.x, p.y, cop.x, cop.y) < 30) { close = true; break; }
    }
  }
  if (close) {
    state.bustTimer += dt;
    if (state.bustTimer >= WANTED.bustSeconds) {
      state.busted = true;
      return EV.BUSTED;
    }
  } else {
    state.bustTimer = Math.max(0, state.bustTimer - dt);
  }
  return 0;
}

// The camera eases after the player, looking a little ahead when
// driving or sailing so the road (or the sea) stays visible.
function updateCamera(state, dt) {
  const p = state.player;
  const look = (p.inCar || p.inBoat) ? 60 : 0;
  const tx = p.x + Math.cos(p.angle) * look;
  const ty = p.y + Math.sin(p.angle) * look;
  const k = Math.min(1, 5 * dt);
  state.camera.x += (tx - state.camera.x) * k;
  state.camera.y += (ty - state.camera.y) * k;
}

function spawnSmoke(state, x, y) {
  if (state.particles.length > 200) return;
  state.particles.push({
    x: x + (Math.random() - 0.5) * 20,
    y: y + (Math.random() - 0.5) * 20,
    life: 0.6,
    kind: 'smoke',
  });
}

function updateParticles(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    state.particles[i].life -= dt;
    if (state.particles[i].life <= 0) state.particles.splice(i, 1);
  }
}

// WASTED / BUSTED: Mara wakes up at the safehouse, healthy, clean,
// and out of whatever vehicle she was in. The current mission
// restarts from its first objective.
export function respawnPlayer(state, reason) {
  const p = state.player;
  if (p.inCar && p.car) {
    p.car.kind = 'parked';
    p.car.speed = 0;
    state.parkedCars.push(p.car);
  }
  const home = state.city.landmarks.safehouse;
  p.x = home.x;
  p.y = home.y + 40;
  p.angle = SPAWN.angle;
  p.aimAngle = SPAWN.angle;
  p.hp = 100;
  p.ammo = Math.max(p.ammo, 24);
  p.inCar = false;
  p.car = null;
  p.inBoat = false;
  p.boat = null;
  p.invuln = 3;
  state.wanted = 0;
  state.wantedQuiet = 0;
  state.wantedTimer = 0;
  state.bustTimer = 0;
  state.wasted = false;
  state.busted = false;
  state.camera.x = p.x;
  state.camera.y = p.y;
  if (state.mission) {
    startMission(state, state.mission.index);
  }
  return state;
}

// How many missions exist in total (12 once every pack registered).
export function missionCount() {
  return MISSIONS.length;
}

// Clamp a point into the playable world (used by tests and the
// headless playthrough).
export function clampToWorld(x, y) {
  return {
    x: clamp(x, 16, WORLD_W - 16),
    y: clamp(y, 16, WORLD_H - 16),
  };
}
