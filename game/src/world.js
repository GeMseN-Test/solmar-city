// world.js — Solmar City simulation core.
// Written from the v2 spec only (probed facts + v2 / v2-retry / attempt-3).
// createWorld(seed) -> { state, reset, step }. step returns an events
// bitmask. Kill sweep + counting happen ONLY here (combat leaves dead
// enemies in place). Wanted decay happens ONLY here (police is read-only).
import { mulberry32 } from './random.js';
import { buildCity } from './city.js';
import { createCombat, stepCombat, firePlayerBullet, meleeAttack } from './combat.js';
import { createTraffic, stepTraffic } from './traffic.js';
import { createPolice, stepPolice } from './police.js';
import { createPolice2, stepPolice2 } from './police2.js';
import { createBoats, stepBoating } from './boats.js';
import { createRadio } from './radio.js';
import { createSideJobs, stepSideJobs } from './sidejobs.js';
import {
  MISSIONS, startMission, updateMission, tryInteract,
} from './missions.js';
import { registerStoryMissions } from './missions2.js';
import { registerMissions3 } from './missions3.js';
import { registerMissions4 } from './missions4.js';

registerStoryMissions();
registerMissions3();
registerMissions4();

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

// Probed tuning (spec): world 2880x2160, sea above y=2100, beach above 2020.
const WORLD_W = 2880;
const WORLD_H = 2160;
const SEA_TOP = 2100;
const WALK_SPEED = 175;
const RUN_SPEED = 268;
const PLAYER_RADIUS = 11;
const CAR_ACCEL = 640;
const CAR_BRAKE = 980;
const CAR_REVERSE = 420;
const CAR_MAX_SPEED = 560;
const CAR_MAX_REVERSE = 190;
const CAR_TURN = 2.7;
const CAR_DRAG = 0.55;
const GUN_RANGE = 520;
const START_AMMO = 48;
const WANTED_MAX = 5;
const WANTED_DECAY_DELAY = 12;
const WANTED_DECAY_EVERY = 8;
const BUST_SECONDS = 1.6;
const MONEY_START = 50;

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function approach(v, target, step) {
  if (v < target) return Math.min(target, v + step);
  if (v > target) return Math.max(target, v - step);
  return v;
}

function isInSea(city, x, y) {
  if (city && typeof city.isInSea === 'function') return city.isInSea(x, y);
  return y > SEA_TOP;
}

// A point on a road, for pickups. Prefers the city's own helper.
function streetPoint(city, rng) {
  if (city && typeof city.randomStreetPoint === 'function') {
    try {
      const p = city.randomStreetPoint(rng);
      if (p && typeof p.x === 'number') return { x: p.x, y: p.y };
    } catch (err) { /* fall through to the grid fallback */ }
  }
  const xs = [180, 540, 900, 1260, 1620, 1980, 2340, 2700];
  const ys = [180, 540, 900, 1260, 1620, 1980];
  const x = xs[Math.floor(rng() * xs.length)] + (rng() - 0.5) * 40;
  const y = ys[Math.floor(rng() * ys.length)] + (rng() - 0.5) * 40;
  return { x, y };
}

function buildPickups(city, rng) {
  const list = [];
  for (let i = 0; i < 14; i++) {
    const p = streetPoint(city, rng);
    list.push({ x: p.x, y: p.y, kind: 'cash', amount: 60, taken: false });
  }
  for (let i = 0; i < 8; i++) {
    const p = streetPoint(city, rng);
    list.push({ x: p.x, y: p.y, kind: 'health', amount: 40, taken: false });
  }
  for (let i = 0; i < 8; i++) {
    const p = streetPoint(city, rng);
    list.push({ x: p.x, y: p.y, kind: 'ammo', amount: 36, taken: false });
  }
  return list;
}

function freshState(seed) {
  const rng = mulberry32(seed);
  const city = buildCity(rng);
  const state = {
    seed,
    rng,
    city,
    time: 0,
    playTime: 0,
    money: MONEY_START,
    wanted: 0,
    wantedGainAt: -100,
    wantedTick: 0,
    kills: 0,
    killsAtStart: 0,
    missionIndex: 0,
    mission: null,
    missionObjective: 0,
    missionsDone: 0,
    storyComplete: false,
    missionCollected: 0,
    crates: [],
    vaultGrabbed: false,
    loseArmed: false,
    bustTimer: 0,
    gunCooldown: 0,
    punchCooldown: 0,
    shootWantedAt: -100,
    player: {
      x: 1420, y: 1230, angle: -Math.PI / 2, aimAngle: -Math.PI / 2,
      hp: 100, ammo: START_AMMO, inCar: false, car: null,
      inBoat: false, boat: null, invuln: 0, radius: PLAYER_RADIUS,
    },
    combat: createCombat(),
    traffic: createTraffic(rng, city),
    police: createPolice(),
    police2: createPolice2(),
    boats: createBoats(rng),
    radio: createRadio(),
    sideJobs: createSideJobs(rng, city),
    pickups: buildPickups(city, rng),
    particles: [],
    parkedCars: [],
  };
  return state;
}

// Push an entity out of buildings. Prefers the city's own resolver;
// falls back to blocking via pointInBuilding, then a plain AABB push.
function collideBuildings(state, e) {
  const city = state.city;
  if (city && typeof city.resolveCircle === 'function') {
    try {
      city.resolveCircle(e);
      return;
    } catch (err) { /* fall through */ }
  }
  if (city && typeof city.pointInBuilding === 'function') {
    return; // callers already blocked the move with pointInBuilding
  }
  const r = e.radius || PLAYER_RADIUS;
  const list = (city && city.buildings) || [];
  for (const b of list) {
    const w = b.w || b.width || 120;
    const h = b.h || b.height || 90;
    const cx = b.x;
    const cy = b.y;
    const dx = e.x - cx;
    const dy = e.y - cy;
    const ox = w / 2 + r - Math.abs(dx);
    const oy = h / 2 + r - Math.abs(dy);
    if (ox > 0 && oy > 0) {
      if (ox < oy) e.x = cx + Math.sign(dx || 1) * (w / 2 + r);
      else e.y = cy + Math.sign(dy || 1) * (h / 2 + r);
    }
  }
}

function blockedByBuilding(state, x, y) {
  const city = state.city;
  if (city && typeof city.pointInBuilding === 'function') {
    try {
      return !!city.pointInBuilding(x, y);
    } catch (err) { return false; }
  }
  return false;
}

function addWanted(state, n) {
  state.wanted = Math.min(WANTED_MAX, (state.wanted || 0) + n);
  state.wantedGainAt = state.time;
  state.wantedTick = 0;
}

function spawnSmoke(state, x, y) {
  state.particles.push({
    x: x + (Math.random() - 0.5) * 10,
    y: y + (Math.random() - 0.5) * 10,
    life: 0.6,
    maxLife: 0.6,
    kind: 'smoke',
  });
}

function driveCar(state, input, dt) {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  if (input.handbrake) {
    car.speed = approach(car.speed, 0, 1400 * dt);
    if (Math.abs(car.speed) > 60) {
      spawnSmoke(state, car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20);
    }
  } else if (input.throttle > 0) {
    car.speed += CAR_ACCEL * input.throttle * dt;
  } else if (input.throttle < 0) {
    if (car.speed > 5) car.speed -= CAR_BRAKE * dt;
    else car.speed -= CAR_REVERSE * dt;
  } else {
    car.speed -= car.speed * CAR_DRAG * dt;
    if (Math.abs(car.speed) < 2) car.speed = 0;
  }
  car.speed = clamp(car.speed, -CAR_MAX_REVERSE, CAR_MAX_SPEED);
  const speedFactor = Math.min(1, Math.abs(car.speed) / 240);
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += input.steer * CAR_TURN * speedFactor * dir * dt;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 16, WORLD_W - 16);
  if (isInSea(state.city, car.x, car.y)) car.y = SEA_TOP;
  car.y = clamp(car.y, 16, WORLD_H - 16);
  car.radius = 24;
  collideBuildings(state, car);
  // Ram pedestrians: they go down, wanted +1, car slows a touch.
  let ev = 0;
  const peds = (state.traffic && state.traffic.peds) || [];
  for (const ped of peds) {
    if (ped.down) continue;
    if (dist(car.x, car.y, ped.x, ped.y) < 34) {
      ped.down = true;
      ped.panic = 1;
      addWanted(state, 1);
      car.speed *= 0.85;
      ev |= EV.CRASH;
    }
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  return ev;
}

function walkPlayer(state, input, dt) {
  const p = state.player;
  let mx = input.mx || 0;
  let my = input.my || 0;
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  const speed = input.running ? RUN_SPEED : WALK_SPEED;
  const nx = p.x + mx * speed * dt;
  const ny = p.y + my * speed * dt;
  if (mx !== 0 || my !== 0) p.angle = Math.atan2(my, mx);
  // On foot the sea is off limits (the beach strip stays walkable).
  const tryY = isInSea(state.city, p.x, ny) ? p.y : ny;
  const tryX = isInSea(state.city, nx, tryY) ? p.x : nx;
  if (!blockedByBuilding(state, tryX, p.y)) p.x = clamp(tryX, 16, WORLD_W - 16);
  if (!blockedByBuilding(state, p.x, tryY)) p.y = clamp(tryY, 16, WORLD_H - 16);
  collideBuildings(state, p);
}

function stepOnce(state, input, dt) {
  let ev = 0;
  const p = state.player;
  state.time += dt;
  state.playTime += dt;
  if (state.gunCooldown > 0) state.gunCooldown -= dt;
  if (state.punchCooldown > 0) state.punchCooldown -= dt;
  if (p.invuln > 0) p.invuln -= dt;

  // Movement: boat, car, or on foot.
  if (p.inBoat) {
    stepBoating(state, input, dt);
    if (p.boat) {
      p.x = p.boat.x;
      p.y = p.boat.y;
      p.angle = p.boat.angle;
    }
  } else if (p.inCar) {
    ev |= driveCar(state, input, dt) || 0;
  } else {
    walkPlayer(state, input, dt);
  }

  // Shooting (mouse held, on foot only) and punching are edge/held input
  // handled by the caller once per frame; here the held trigger fires.
  if (input.shooting && !p.inCar && !p.inBoat) {
    if (state.gunCooldown <= 0 && p.ammo > 0) {
      const mx = p.x + Math.cos(p.aimAngle) * 16;
      const my = p.y + Math.sin(p.aimAngle) * 16;
      firePlayerBullet(state, mx, my, p.aimAngle);
      state.gunCooldown = 0.22;
      ev |= EV.SHOT;
      // Shooting in public draws heat, throttled so one burst is +1.
      if (state.time - state.shootWantedAt > 3) {
        addWanted(state, 1);
        state.shootWantedAt = state.time;
      }
    }
  }

  stepCombat(state, dt);
  // Kill sweep + counting: ONLY here. Combat leaves dead enemies in place.
  if (state.combat && state.combat.enemies) {
    const alive = [];
    for (const e of state.combat.enemies) {
      if (e.hp <= 0) state.kills += 1;
      else alive.push(e);
    }
    state.combat.enemies = alive;
  }

  if (state.traffic) stepTraffic(state.traffic, state.city, state.rng, dt);
  if (state.police) stepPolice(state, dt);
  if (state.police2) stepPolice2(state, dt);
  if (state.sideJobs) stepSideJobs(state, dt);

  // Pickups: cash, health, ammo lying on the street.
  for (const pk of state.pickups) {
    if (pk.taken) continue;
    if (dist(p.x, p.y, pk.x, pk.y) < 26) {
      pk.taken = true;
      if (pk.kind === 'cash') state.money += pk.amount;
      else if (pk.kind === 'health') p.hp = Math.min(100, p.hp + pk.amount);
      else if (pk.kind === 'ammo') p.ammo = Math.min(240, p.ammo + pk.amount);
      ev |= EV.PICKUP;
    }
  }

  // Wanted decay: ONLY here. Police reads wanted, it never decays it.
  if (state.wanted > 0 && state.time - state.wantedGainAt > WANTED_DECAY_DELAY) {
    state.wantedTick += dt;
    if (state.wantedTick >= WANTED_DECAY_EVERY) {
      state.wanted -= 1;
      state.wantedTick = 0;
    }
  }

  // Bust: a cop sitting on the player for BUST_SECONDS ends the run.
  let copNear = false;
  const pol = state.police;
  if (pol && pol.cars) {
    for (const c of pol.cars) {
      if (dist(c.x, c.y, p.x, p.y) < 36) { copNear = true; break; }
    }
  }
  if (pol && !copNear && pol.cops) {
    for (const c of pol.cops) {
      if (dist(c.x, c.y, p.x, p.y) < 36) { copNear = true; break; }
    }
  }
  if (copNear && state.wanted > 0 && p.invuln <= 0) {
    state.bustTimer += dt;
    if (state.bustTimer >= BUST_SECONDS) {
      respawnPlayer(state, 'busted');
      ev |= EV.BUSTED;
    }
  } else {
    state.bustTimer = 0;
  }

  // Wasted: no health left, wake up at the Safehouse.
  if (p.hp <= 0) {
    respawnPlayer(state, 'wasted');
    ev |= EV.DIED;
  }

  // Particles fade.
  for (let i = state.particles.length - 1; i >= 0; i--) {
    state.particles[i].life -= dt;
    if (state.particles[i].life <= 0) state.particles.splice(i, 1);
  }

  ev |= updateMission(state);
  return ev;
}

function stepWorld(state, input, dt) {
  let ev = 0;
  const p = state.player;
  // Aim follows the mouse in world coordinates.
  p.aimAngle = Math.atan2((input.aimY || 0) - p.y, (input.aimX || 0) - p.x);
  // Edge actions fire exactly once per frame (never per substep).
  if (input.actions & 4) ev |= tryInteract(state);
  if ((input.actions & 8) && !p.inCar && !p.inBoat && state.punchCooldown <= 0) {
    const hit = meleeAttack(state);
    state.punchCooldown = 0.45;
    if (hit) ev |= EV.PUNCH;
  }
  // Split big frames into small physics steps.
  const clamped = Math.max(0, Math.min(dt, 0.1));
  let left = clamped;
  if (left === 0) left = 0.016;
  while (left > 0) {
    const h = Math.min(left, 1 / 30);
    ev |= stepOnce(state, input, h);
    left -= h;
  }
  return ev;
}

export function respawnPlayer(state, reason) {
  const p = state.player;
  const safe = (state.city && state.city.landmarks && state.city.landmarks.safehouse)
    || { x: 1420, y: 1190 };
  if (p.boat) p.boat.inUse = false;
  p.inCar = false;
  p.car = null;
  p.inBoat = false;
  p.boat = null;
  p.x = safe.x;
  p.y = safe.y;
  p.angle = -Math.PI / 2;
  p.hp = 100;
  p.invuln = 2;
  state.wanted = 0;
  state.wantedTick = 0;
  state.bustTimer = 0;
  if (state.police2) {
    state.police2.roadblocks = [];
    state.police2.heli = null;
  }
  return reason;
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
    x: Math.round(state.player.x),
    y: Math.round(state.player.y),
    playTime: Math.round(state.playTime),
  };
}

export function applySave(state, save) {
  if (!save) return false;
  state.money = save.money;
  state.missionsDone = save.missionsDone || 0;
  state.storyComplete = !!save.storyComplete;
  state.kills = save.kills || 0;
  state.playTime = save.playTime || 0;
  state.player.hp = save.hp;
  state.player.ammo = save.ammo;
  state.player.x = save.x;
  state.player.y = save.y;
  if (state.storyComplete) {
    state.mission = null;
    state.missionIndex = state.missionsDone;
  } else {
    startMission(state, save.missionIndex || 0);
  }
  return true;
}

export function createWorld(seed = 1) {
  const state = freshState(seed);
  startMission(state, 0);
  const world = {
    state,
    seed,
    reset() {
      const fresh = freshState(seed);
      for (const k of Object.keys(state)) delete state[k];
      Object.assign(state, fresh);
      startMission(state, 0);
    },
    step(input, dt) {
      return stepWorld(state, input, dt);
    },
  };
  return world;
}
