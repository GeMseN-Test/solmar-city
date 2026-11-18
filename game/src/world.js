// The world: one `state` object and the `step(input, dt)` that moves
// it one frame. The frame input is a plain VALUES object built by
// main.js — no functions cross this boundary:
//   { mx, my, aimX, aimY, actions, shooting, running, steer,
//     throttle, handbrake }
// `step` returns an events bitmask: SHOT 1, PUNCH 2, PICKUP 4, CRASH 8,
// MISSION 16, DIED 32, BUSTED 64, ENEMY_SHOT 128, VAULT 256, STEAL 512,
// MISSION_COMPLETE 1024.
import { createBoats, stepBoating } from './boats.js';
import { CAR, MONEY_START, PICKUPS, PLAYER, WANTED, WORLD_H, WORLD_W } from './config.js';
import { createCombat, firePlayerBullet, meleeAttack, stepCombat } from './combat.js';
import { buildCity } from './city.js';
import { createRadio } from './radio.js';
import { createRng } from './random.js';
import { createPolice, addWanted, stepPolice } from './police.js';
import { createPolice2, stepPolice2 } from './police2.js';
import { stepSideJobs, createSideJobs } from './sidejobs.js';
import { MISSIONS, startMission, tryInteract, updateMission } from './missions.js';
import { registerMissions2 } from './missions2.js';
import { registerMissions3 } from './missions3.js';
import { registerMissions4 } from './missions4.js';
import { createTraffic, stepTraffic } from './traffic.js';
import { applySave, saveSnapshot } from './save.js';
import { clamp, dist } from './util.js';

const ACTION_CONFIRM = 1;
const ACTION_INTERACT = 4;
const ACTION_PUNCH = 8;

function makePickups(rng, city) {
  const pickups = [];
  function add(kind, value, count) {
    for (let i = 0; i < count; i++) {
      const spot = city.randomStreetPoint(rng);
      pickups.push({ x: spot.x, y: spot.y, kind, value, bob: rng.range(0, Math.PI * 2) });
    }
  }
  add('cash', PICKUPS.cashValue, PICKUPS.cashCount);
  add('health', PICKUPS.healthValue, PICKUPS.healthCount);
  add('ammo', PICKUPS.ammoValue, PICKUPS.ammoCount);
  return pickups;
}

function buildState(seed) {
  registerMissions2();
  registerMissions3();
  registerMissions4();
  const rng = createRng(seed);
  const city = buildCity(rng);
  const state = {
    seed,
    rng,
    city,
    screen: 'game',
    playTime: 0,
    money: MONEY_START,
    missionIndex: 0,
    mission: null,
    missionStep: 0,
    killsAtStart: 0,
    missionFlags: { vault: false },
    missionStartedInCar: false,
    missionCrates: [],
    missionsDone: 0,
    storyComplete: false,
    kills: 0,
    gunCooldown: 0,
    punchCooldown: 0,
    shotWantedAt: -10,
    player: {
      x: PLAYER.startX, y: PLAYER.startY,
      angle: PLAYER.startAngle, aimAngle: PLAYER.startAngle,
      hp: PLAYER.maxHp, ammo: PLAYER.startAmmo,
      inCar: false, car: null, inBoat: false, boat: null,
      invuln: 0,
    },
    traffic: null,
    combat: createCombat(),
    police: createPolice(),
    police2: createPolice2(),
    boats: null,
    radio: createRadio(),
    sideJobs: null,
    pickups: [],
  };
  state.traffic = createTraffic(rng, city);
  state.boats = createBoats(rng);
  state.sideJobs = createSideJobs(rng, city);
  state.pickups = makePickups(rng, city);
  startMission(state, 0);
  return state;
}

export function respawnPlayer(state, reason) {
  const p = state.player;
  const safe = state.city.landmarks.safehouse;
  if (reason === 'wasted') {
    state.money = Math.max(0, Math.round(state.money * 0.9));
  } else if (reason === 'busted') {
    state.money = Math.max(0, state.money - 150);
  }
  p.x = safe.x;
  p.y = safe.y + 40;
  p.angle = -Math.PI / 2;
  p.aimAngle = -Math.PI / 2;
  p.hp = PLAYER.maxHp;
  p.ammo = Math.max(p.ammo, 24);
  p.inCar = false;
  p.car = null;
  p.inBoat = false;
  if (p.boat) { p.boat.inUse = false; p.boat = null; }
  p.invuln = 2;
  state.police.wanted = 0;
  state.police.cars = [];
  state.police.cops = [];
  state.police.bustTimer = 0;
  state.police2.roadblocks = [];
  state.police2.heli = null;
  state.combat.bullets = [];
  state.sideJobs.fare = null;
}

export function createWorld(seed) {
  let state = buildState(seed);

  function reset() {
    // Re-roll: a fresh seed, a fresh city, mission 1 again. The state
    // object is replaced IN PLACE so every holder of the old reference
    // (main.js, the test handle) keeps seeing the live world.
    const fresh = buildState((state.seed + 1) >>> 0);
    for (const k of Object.keys(state)) delete state[k];
    Object.assign(state, fresh);
    return state;
  }

  function step(input, dt) {
    if (state.screen !== 'game') return 0;
    dt = clamp(dt, 0, 0.05);
    let events = 0;
    const p = state.player;
    state.playTime += dt;
    if (p.invuln > 0) p.invuln -= dt;

    // Aim follows the mouse in world coordinates.
    if (typeof input.aimX === 'number' && typeof input.aimY === 'number') {
      p.aimAngle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
    }

    const actions = input.actions || 0;
    if (actions & ACTION_INTERACT) {
      events |= tryInteract(state);
    }
    if (actions & ACTION_PUNCH) {
      if (!p.inCar && !p.inBoat) {
        const hits = meleeAttack(state);
        if (hits > 0) events |= 2;
      }
    }
    if (input.shooting && !p.inCar && !p.inBoat) {
      if (firePlayerBullet(state, p.x, p.y, p.aimAngle)) {
        events |= 1;
        if (state.playTime - state.shotWantedAt > 3) {
          state.shotWantedAt = state.playTime;
          addWanted(state, WANTED.shoot);
        }
      }
    }

    // --- Movement --------------------------------------------------
    if (p.inBoat) {
      stepBoating(state, input, dt);
    } else if (p.inCar && p.car) {
      const car = p.car;
      const steer = input.steer || 0;
      const throttle = input.throttle || 0;
      if (throttle > 0) car.speed += CAR.accel * throttle * dt;
      else if (throttle < 0) {
        if (car.speed > 0.5) car.speed -= CAR.brake * dt;
        else car.speed += CAR.reverse * throttle * dt;
      }
      if (input.handbrake) {
        car.speed -= Math.sign(car.speed) * 900 * dt;
        if (Math.abs(car.speed) < 12) car.speed = 0;
      }
      car.speed -= car.speed * CAR.drag * dt;
      car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
      if (Math.abs(car.speed) > 6) {
        car.angle += steer * CAR.turnRate * dt * clamp(Math.abs(car.speed) / 140, 0, 1) * Math.sign(car.speed);
      }
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      // Buildings stop cars — hard.
      const before = { x: car.x, y: car.y };
      const fixed = state.city.resolveCircle(car.x, car.y, 20);
      car.x = fixed.x;
      car.y = fixed.y;
      if ((fixed.x !== before.x || fixed.y !== before.y) && Math.abs(car.speed) > 120) {
        events |= 8;
        car.speed *= 0.45;
      }
      car.x = clamp(car.x, 24, WORLD_W - 24);
      car.y = clamp(car.y, 24, WORLD_H - 24);
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      // Running over pedestrians: a knock-down, or worse at speed.
      for (let i = state.traffic.peds.length - 1; i >= 0; i--) {
        const ped = state.traffic.peds[i];
        if (ped.down) continue;
        if (dist(p.x, p.y, ped.x, ped.y) < 26 && Math.abs(car.speed) > 60) {
          if (Math.abs(car.speed) >= 260) {
            state.traffic.peds.splice(i, 1);
            addWanted(state, WANTED.killPedestrian);
          } else {
            ped.down = true;
            ped.downTimer = 3;
            addWanted(state, WANTED.hitPedestrian);
          }
          events |= 8;
          car.speed *= 0.7;
        }
      }
    } else {
      // On foot: WASD / arrows, Shift to run, Space punches.
      let mx = input.mx || 0;
      let my = input.my || 0;
      const len = Math.sqrt(mx * mx + my * my);
      if (len > 1) { mx /= len; my /= len; }
      const speed = input.running ? PLAYER.runSpeed : PLAYER.walkSpeed;
      p.x += mx * speed * dt;
      p.y += my * speed * dt;
      if (len > 0.1) p.angle = Math.atan2(my, mx);
      else p.angle = p.aimAngle;
      const fixed = state.city.resolveCircle(p.x, p.y, PLAYER.radius);
      p.x = fixed.x;
      p.y = fixed.y;
      p.x = clamp(p.x, 12, WORLD_W - 12);
      // The sea is not walkable — the beach is the edge of the world.
      p.y = clamp(p.y, 12, 2100);
    }

    // --- Pickups ----------------------------------------------------
    for (let i = state.pickups.length - 1; i >= 0; i--) {
      const pk = state.pickups[i];
      pk.bob += dt * 2;
      if (dist(p.x, p.y, pk.x, pk.y) < 26) {
        if (pk.kind === 'cash') state.money += pk.value;
        else if (pk.kind === 'health') p.hp = Math.min(PLAYER.maxHp, p.hp + pk.value);
        else if (pk.kind === 'ammo') p.ammo = Math.min(PLAYER.maxAmmo, p.ammo + pk.value);
        state.pickups.splice(i, 1);
        events |= 4;
      }
    }

    events |= stepCombat(state, dt);
    stepTraffic(state.traffic, state.city, state.rng, dt, state);
    events |= stepPolice(state, dt);
    stepPolice2(state, dt);
    events |= stepSideJobs(state, dt);
    events |= updateMission(state);

    // --- Wasted / busted --------------------------------------------
    if (p.hp <= 0) {
      events |= 32;
      respawnPlayer(state, 'wasted');
    } else if (events & 64) {
      respawnPlayer(state, 'busted');
    }
    return events;
  }

  return { state, reset, step };
}

export { saveSnapshot, applySave };
