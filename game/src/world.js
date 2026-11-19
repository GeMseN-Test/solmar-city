// world.js — Solmar City simulation core.
// Written from the v2 spec only. Owns: player movement (foot / car /
// boat), combat kill counting, wanted decay, pickups, crates, camera,
// save snapshots. Kill counting happens ONLY here (once, in step);
// wanted decay happens ONLY in stepWanted.
import { buildCity } from './city.js';
import { createCombat, spawnGang, firePlayerBullet, meleeAttack, stepCombat } from './combat.js';
import { createBoats, stepBoating, exitBoat, isSailable } from './boats.js';
import { createRadio } from './radio.js';
import { createAudio } from './audio.js';
import { createTraffic, stepTraffic } from './traffic.js';
import { createPolice, stepPolice } from './police.js';
import { createPolice2, stepPolice2 } from './police2.js';
import { createSideJobs, stepSideJobs } from './sidejobs.js';
import {
  MISSIONS, startMission, updateMission, currentObjective,
  tryInteract, exitCar,
} from './missions.js';
import { registerStoryMissions } from './missions2.js';
import { registerMissions3 } from './missions3.js';
import { registerMissions4 } from './missions4.js';

// Event bitmask returned by step() (spec).
export const EV = {
  SHOT: 1, PUNCH: 2, PICKUP: 4, CRASH: 8, MISSION: 16, DIED: 32,
  BUSTED: 64, ENEMY_SHOT: 128, VAULT: 256, STEAL: 512, MISSION_COMPLETE: 1024,
};

// Spec constants.
export const WORLD_W = 2880;
export const WORLD_H = 2160;
export const SEA_TOP = 2100;
export const SPAWN = { x: 1420, y: 1230 };
export const WALK_SPEED = 175;
export const RUN_SPEED = 268;
export const PLAYER_RADIUS = 11;
export const MONEY_START = 50;
export const WANTED_DECAY_DELAY = 12;
export const WANTED_DECAY_EVERY = 8;

// Deterministic RNG (mulberry32) as a callable function with helpers
// attached, so callers can use rng(), rng.next(), rng.int() or rng.pick().
export function makeRng(seed) {
  let a = seed >>> 0;
  function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  rng.next = rng;
  rng.int = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  rng.range = (lo, hi) => lo + rng() * (hi - lo);
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.chance = (p) => rng() < p;
  rng.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };
  rng.seed = seed;
  return rng;
}

// city.resolveCircle(x, y, r) returns {x, y} (a position, not an
// entity). This helper is the only place world.js resolves collisions.
export function resolveEntity(state, x, y, r) {
  try {
    const out = state.city.resolveCircle(x, y, r);
    if (out && typeof out.x === 'number' && typeof out.y === 'number') {
      return { x: out.x, y: out.y };
    }
  } catch (e) { /* no city collision data */ }
  return { x, y };
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function dist(ax, ay, bx, by) {
  const dx = ax - bx; const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function streetPoint(state, rng) {
  try {
    if (state.city && typeof state.city.randomStreetPoint === 'function') {
      return state.city.randomStreetPoint(rng);
    }
  } catch (e) { /* fall through */ }
  return { x: 180 + rng() * 2520, y: 180 + rng() * 1800 };
}

function buildPickups(state, rng) {
  const list = [];
  for (let i = 0; i < 14; i++) {
    const p = streetPoint(state, rng);
    list.push({ x: p.x, y: p.y, kind: 'cash', amount: 60, taken: false, bob: rng() * 6 });
  }
  for (let i = 0; i < 8; i++) {
    const p = streetPoint(state, rng);
    list.push({ x: p.x, y: p.y, kind: 'health', amount: 40, taken: false, bob: rng() * 6 });
  }
  for (let i = 0; i < 8; i++) {
    const p = streetPoint(state, rng);
    list.push({ x: p.x, y: p.y, kind: 'ammo', amount: 36, taken: false, bob: rng() * 6 });
  }
  return list;
}

function buildCrates(state) {
  // Five crates by the docks for M3 (collect 3 of them).
  const spots = [[330, 170], [400, 150], [360, 210], [300, 120], [430, 200]];
  return spots.map(([x, y]) => ({ x, y, taken: false }));
}

export function createState(seed) {
  const rng = makeRng(seed);
  registerStoryMissions();
  registerMissions3();
  registerMissions4();

  const city = buildCity(rng);
  const state = {
    seed,
    rng,
    city,
    traffic: null,
    combat: null,
    police: null,
    police2: null,
    boats: null,
    radio: null,
    audio: null,
    sideJobs: null,
    player: {
      x: SPAWN.x, y: SPAWN.y, angle: -Math.PI / 2, aimAngle: -Math.PI / 2,
      hp: 100, ammo: 48, inCar: false, car: null, inBoat: false, boat: null,
      invuln: 0, gunCooldown: 0, punchCooldown: 0, speed: 0,
    },
    money: MONEY_START,
    missionIndex: -1,
    currentMission: null,
    missionObjectiveIndex: 0,
    missionsDone: 0,
    storyComplete: false,
    kills: 0,
    killsAtStart: 0,
    missionCollect: 0,
    missionInteracted: false,
    missionHadWanted: false,
    missionGangSpawnedFor: null,
    playTime: 0,
    pickups: [],
    crates: [],
    smoke: [],
    camera: { x: SPAWN.x - 640, y: SPAWN.y - 400 },
    viewW: 1280,
    viewH: 800,
    bustTimer: 0,
    time: 0,
  };

  try { state.traffic = createTraffic(rng, city); } catch (e) { state.traffic = { cars: [], peds: [] }; }
  try { state.combat = createCombat(); } catch (e) { state.combat = { bullets: [], enemies: [] }; }
  try {
    state.police = createPolice();
    if (!state.police) state.police = {};
  } catch (e) { state.police = {}; }
  state.police.wanted = state.police.wanted || 0;
  state.police.cars = state.police.cars || [];
  state.police.decayTimer = 0;
  state.police.firstDecayDone = false;
  // Called whenever wanted goes up: the 12s clock restarts.
  state.police.resetWantedTimer = () => {
    state.police.decayTimer = 0;
    state.police.firstDecayDone = false;
  };
  try { state.police2 = createPolice2(); } catch (e) { state.police2 = { roadblocks: [], heli: null }; }
  try { state.boats = createBoats(rng); } catch (e) { state.boats = []; }
  try { state.radio = createRadio(); } catch (e) { state.radio = { stationIndex: 0 }; }
  try { state.audio = createAudio(); } catch (e) { state.audio = null; }
  try { state.sideJobs = createSideJobs(rng, city); } catch (e) { state.sideJobs = { coins: [], coinsFound: 0 }; }
  state.pickups = buildPickups(state, rng);
  state.crates = buildCrates(state);
  return state;
}

export function respawnPlayer(state, reason) {
  const p = state.player;
  if (p.boat) { try { p.boat.inUse = false; } catch (e) {} }
  p.x = SPAWN.x;
  p.y = SPAWN.y;
  p.angle = -Math.PI / 2;
  p.aimAngle = -Math.PI / 2;
  p.hp = 100;
  p.inCar = false;
  p.car = null;
  p.inBoat = false;
  p.boat = null;
  p.invuln = 2;
  p.speed = 0;
  state.bustTimer = 0;
  if (reason === 'busted') {
    state.police.wanted = 0;
    state.police.resetWantedTimer();
  } else {
    state.police.wanted = Math.max(0, (state.police.wanted || 0) - 2);
    state.police.resetWantedTimer();
  }
  state.camera.x = p.x - state.viewW / 2;
  state.camera.y = p.y - state.viewH / 2;
}

// Wanted decay — the ONLY place wanted ticks down.
// First drop after ~12s, then one star every ~8s.
export function stepWanted(state, dt) {
  const pol = state.police;
  if (!pol || (pol.wanted || 0) <= 0) {
    if (pol) { pol.decayTimer = 0; pol.firstDecayDone = false; }
    return;
  }
  pol.decayTimer = (pol.decayTimer || 0) + dt;
  const need = pol.firstDecayDone ? WANTED_DECAY_EVERY : WANTED_DECAY_DELAY;
  if (pol.decayTimer >= need) {
    pol.wanted = Math.max(0, pol.wanted - 1);
    pol.decayTimer = 0;
    pol.firstDecayDone = true;
  }
}

function addWanted(state, n) {
  const pol = state.police;
  if (!pol) return;
  const before = pol.wanted || 0;
  pol.wanted = Math.min(5, before + n);
  if (pol.wanted > before && typeof pol.resetWantedTimer === 'function') {
    pol.resetWantedTimer();
  }
}

function stepFoot(state, input, dt) {
  const p = state.player;
  const mx = input.mx || 0;
  const my = input.my || 0;
  const len = Math.hypot(mx, my);
  if (len > 0.01) {
    const speed = input.running ? RUN_SPEED : WALK_SPEED;
    const nx = p.x + (mx / len) * speed * dt;
    const ny = p.y + (my / len) * speed * dt;
    // Do not walk into the sea (beach y <= 2100 is fine).
    let tx = nx;
    let ty = ny;
    try {
      if (state.city.isInSea && state.city.isInSea(nx, ny)) { tx = p.x; ty = p.y; }
    } catch (e) {}
    const solved = resolveEntity(state, tx, ty, PLAYER_RADIUS);
    p.x = clamp(solved.x, 16, WORLD_W - 16);
    p.y = clamp(solved.y, 16, WORLD_H - 16);
    p.angle = Math.atan2(my, mx);
    p.speed = speed;
  } else {
    p.speed = 0;
  }
  // Aim follows the mouse in world coords.
  if (typeof input.aimX === 'number' && typeof input.aimY === 'number') {
    p.aimAngle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
  }
}

function stepDriving(state, input, dt) {
  const p = state.player;
  const car = p.car;
  if (!car) { p.inCar = false; return 0; }
  const throttle = input.throttle || 0;
  const steer = input.steer || 0;
  const handbrake = !!input.handbrake;
  car.speed = car.speed || 0;
  if (handbrake) {
    // Hard decel + tyre smoke + slight slide.
    car.speed *= Math.max(0, 1 - 3.2 * dt);
    if (Math.abs(car.speed) > 60 && Math.random() < 0.6) {
      state.smoke.push({ x: car.x, y: car.y, life: 0.5, max: 0.5 });
    }
    car.angle += steer * 0.6 * dt * Math.sign(car.speed || 1);
  } else if (throttle !== 0) {
    if (throttle > 0) car.speed += 640 * dt;
    else car.speed -= 420 * dt; // reverse
    car.speed = clamp(car.speed, -190, 560);
    car.angle += steer * 2.7 * dt * (car.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 120 + 0.25);
  } else {
    car.speed *= Math.max(0, 1 - 0.55 * dt);
    if (Math.abs(car.speed) < 5) car.speed = 0;
    car.angle += steer * 1.2 * dt * Math.sign(car.speed || 1) * Math.min(1, Math.abs(car.speed) / 200);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const solved = resolveEntity(state, nx, ny, 23);
  let events = 0;
  if (dist(nx, ny, solved.x, solved.y) > 6 && Math.abs(car.speed) > 120) {
    car.speed *= 0.35;
    events |= EV.CRASH;
    try { if (state.audio) state.audio.crash(Math.abs(car.speed) / 560); } catch (e) {}
  }
  car.x = clamp(solved.x, 16, WORLD_W - 16);
  car.y = clamp(solved.y, 16, WORLD_H - 16);
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = Math.abs(car.speed);
  // Ram pedestrians: hit +1 star, and a downed ped counts as a kill (+2 total is handled by the hit rule here as +1 hit; death adds below).
  for (const ped of state.traffic.peds || []) {
    if (ped.down) continue;
    if (dist(car.x, car.y, ped.x, ped.y) < 30 && Math.abs(car.speed) > 60) {
      ped.down = true;
      addWanted(state, 1);
      events |= EV.CRASH;
    }
  }
  return events;
}

function stepPickups(state) {
  const p = state.player;
  let events = 0;
  for (const pk of state.pickups) {
    if (pk.taken) continue;
    if (dist(p.x, p.y, pk.x, pk.y) < 28) {
      pk.taken = true;
      if (pk.kind === 'cash') state.money += pk.amount;
      else if (pk.kind === 'health') p.hp = Math.min(100, p.hp + pk.amount);
      else if (pk.kind === 'ammo') p.ammo = Math.min(240, p.ammo + pk.amount);
      events |= EV.PICKUP;
    }
  }
  return events;
}

// Count dead enemies exactly once, here — never in combat.js.
function countKills(state) {
  const combat = state.combat;
  if (!combat || !combat.enemies) return 0;
  let dead = 0;
  const alive = [];
  for (const e of combat.enemies) {
    if (e.hp <= 0) dead++;
    else alive.push(e);
  }
  if (dead > 0) {
    combat.enemies = alive;
    state.kills = (state.kills || 0) + dead;
  }
  return dead;
}

export function step(state, input, dt) {
  let events = 0;
  dt = Math.min(dt, 0.05);
  state.time += dt;
  state.playTime += dt;
  const p = state.player;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.gunCooldown > 0) p.gunCooldown -= dt;
  if (p.punchCooldown > 0) p.punchCooldown -= dt;

  // Smoke particles age out.
  for (const s of state.smoke) s.life -= dt;
  state.smoke = state.smoke.filter((s) => s.life > 0);

  // Movement branch: boat / car / foot.
  if (p.inBoat) {
    try { stepBoating(state, input, dt); } catch (e) { /* boat module guards */ }
    p.x = p.boat ? p.boat.x : p.x;
    p.y = p.boat ? p.boat.y : p.y;
  } else if (p.inCar) {
    events |= stepDriving(state, input, dt);
  } else {
    stepFoot(state, input, dt);
  }

  // Interact (E).
  if (input.actions && (input.actions & 4)) {
    const tag = tryInteract(state);
    if (tag === 'steal') events |= EV.STEAL;
    else if (tag === 'vault') events |= EV.VAULT;
    else if (tag === 'crate') events |= EV.PICKUP;
    else if (tag === 'exitBoat') {
      try { exitBoat(state); } catch (e) {}
    }
  }

  // Shooting (mouse held, on foot only).
  if (input.shooting && !p.inCar && !p.inBoat && p.ammo > 0 && p.gunCooldown <= 0) {
    const hpBefore = p.hp;
    try {
      firePlayerBullet(state, p.x, p.y, p.aimAngle);
      p.ammo -= 1;
      p.gunCooldown = 0.22;
      events |= EV.SHOT;
      addWanted(state, 1);
      try { if (state.audio) state.audio.shot(); } catch (e) {}
    } catch (e) { /* combat guards ammo/cooldown itself */ }
    void hpBefore;
  }

  // Punch (Space on foot).
  if (input.actions && (input.actions & 8) && !p.inCar && !p.inBoat && p.punchCooldown <= 0) {
    try {
      meleeAttack(state);
      p.punchCooldown = 0.45;
      events |= EV.PUNCH;
      try { if (state.audio) state.audio.punch(); } catch (e) {}
    } catch (e) {}
  }

  // Combat: bullets move, enemies shoot. Dead stay until counted below.
  const hpBeforeCombat = p.hp;
  try { stepCombat(state, dt); } catch (e) {}
  if (p.hp < hpBeforeCombat) events |= EV.ENEMY_SHOT;
  countKills(state);

  // Traffic, police, police2, side jobs.
  try { stepTraffic(state.traffic, state.city, state.rng, dt); } catch (e) {}
  try { stepPolice(state, dt); } catch (e) {}
  try { stepPolice2(state, dt); } catch (e) {}
  try { stepSideJobs(state, dt); } catch (e) {}

  // Pickups + mission progress.
  events |= stepPickups(state);
  const missionResult = updateMission(state);
  if (missionResult === 'complete') {
    events |= EV.MISSION_COMPLETE | EV.MISSION;
    try { if (state.audio) state.audio.missionComplete(); } catch (e) {}
  } else if (missionResult === 'objective') {
    events |= EV.MISSION;
  }

  // Wanted decay (only here, via stepWanted).
  stepWanted(state, dt);

  // Busted: a cop car on top of the player on foot, 1.6s to get away.
  if ((state.police.wanted || 0) > 0 && !p.inCar && !p.inBoat && p.invuln <= 0) {
    let caught = false;
    for (const c of state.police.cars || []) {
      if (c.roadblock) continue;
      if (dist(p.x, p.y, c.x, c.y) < 46) { caught = true; break; }
    }
    if (caught) {
      state.bustTimer += dt;
      if (state.bustTimer > 1.6) {
        events |= EV.BUSTED;
        respawnPlayer(state, 'busted');
      }
    } else {
      state.bustTimer = 0;
    }
  }

  // Died.
  if (p.hp <= 0) {
    events |= EV.DIED;
    respawnPlayer(state, 'died');
  }

  // Camera: follow the player, look ahead when driving / sailing.
  const look = p.inBoat || p.inCar ? 90 : 30;
  const tx = clamp(p.x + Math.cos(p.angle) * look - state.viewW / 2, 0, WORLD_W - state.viewW);
  const ty = clamp(p.y + Math.sin(p.angle) * look - state.viewH / 2, 0, WORLD_H - state.viewH);
  state.camera.x += (tx - state.camera.x) * Math.min(1, 6 * dt);
  state.camera.y += (ty - state.camera.y) * Math.min(1, 6 * dt);

  // Engine + siren ambience.
  try {
    if (state.audio) {
      const norm = p.inCar && p.car ? Math.abs(p.car.speed || 0) / 560 : 0;
      if (typeof state.audio.engine === 'function') state.audio.engine(norm);
      if (typeof state.audio.siren === 'function') state.audio.siren((state.police.wanted || 0) > 0);
    }
  } catch (e) {}

  return events;
}

export function createWorld(seed) {
  const s = typeof seed === 'number' ? seed : 1;
  let state = createState(s);
  return {
    state,
    step: (input, dt) => step(state, input, dt),
    reset: () => {
      state = createState((s + 101) % 2147483647);
      return state;
    },
    getState: () => state,
  };
}

export function saveSnapshot(state) {
  return {
    seed: state.seed,
    money: state.money,
    missionIndex: state.missionIndex,
    missionsDone: state.missionsDone,
    storyComplete: !!state.storyComplete,
    kills: state.kills,
    hp: Math.round(state.player.hp),
    ammo: state.player.ammo,
    x: Math.round(state.player.x),
    y: Math.round(state.player.y),
    playTime: Math.round(state.playTime),
  };
}

export function applySave(state, save) {
  if (!save) return false;
  if (typeof save.seed === 'number') state.seed = save.seed;
  if (typeof save.money === 'number') state.money = save.money;
  if (typeof save.missionsDone === 'number') state.missionsDone = save.missionsDone;
  if (typeof save.storyComplete === 'boolean') state.storyComplete = save.storyComplete;
  if (typeof save.kills === 'number') state.kills = save.kills;
  if (typeof save.hp === 'number') state.player.hp = save.hp;
  if (typeof save.ammo === 'number') state.player.ammo = save.ammo;
  if (typeof save.x === 'number') state.player.x = save.x;
  if (typeof save.y === 'number') state.player.y = save.y;
  if (typeof save.playTime === 'number') state.playTime = save.playTime;
  if (typeof save.missionIndex === 'number' && save.missionIndex >= 0) {
    state.missionIndex = save.missionIndex;
    state.currentMission = MISSIONS[save.missionIndex] || null;
    state.missionObjectiveIndex = 0;
    state.killsAtStart = state.kills || 0;
  }
  return true;
}

// Re-export for callers that import mission control from world.
export { startMission, currentObjective, MISSIONS, spawnGang };
