// Solmar City's rules and state, with no drawing and no browser in it:
// the player on foot and behind the wheel, the traffic, the police, the
// gang, the missions, the pickups and the particles. step() advances one
// fixed step and returns what happened as bit flags, so the caller (main)
// can play sounds and switch screens without the world knowing about them.

import { CAR, MONEY_START, PICKUPS, PLAYER, TRAFFIC_CARS, WANTED } from './config.js';
import { buildCity } from './city.js';
import { createRng } from './random.js';
import { createTraffic, stepTraffic } from './traffic.js';
import { addWanted, createPolice, stepPolice } from './police.js';
import { createCombat, firePlayerBullet, meleeAttack, stepCombat } from './combat.js';
import { currentObjective, exitCar, startMission, tryInteract, updateMission } from './missions.js';
import { clampNumber, circlesOverlap, distanceBetween } from './util.js';

export const STEP = 1 / 60;

export const EVENT_SHOT = 1;
export const EVENT_PUNCH = 2;
export const EVENT_PICKUP = 4;
export const EVENT_CRASH = 8;
export const EVENT_MISSION = 16;
export const EVENT_DIED = 32;
export const EVENT_BUSTED = 64;
export const EVENT_ENEMY_SHOT = 128;
export const EVENT_VAULT = 256;
export const EVENT_STEAL = 512;
export const EVENT_MISSION_COMPLETE = 1024;

const ACTION_INTERACT_BIT = 4;
const ACTION_PUNCH_BIT = 8;

export function createWorld(seed) {
  const rng = createRng(seed);
  const city = buildCity(rng);
  const state = {
    seed,
    rng,
    city,
    player: null,
    playerCar: null,
    traffic: null,
    police: null,
    combat: null,
    pickups: [],
    crates: [],
    particles: [],
    wanted: 0,
    money: MONEY_START,
    kills: 0,
    missionsDone: 0,
    missionIndex: 0,
    mission: null,
    storyComplete: false,
    time: 0,
    playTime: 0,
    camera: { x: 0, y: 0 },
    shake: 0,
    banner: null,
    gunCooldown: 0,
    punchCooldown: 0,
    lastShotCrimeAt: -100,
    over: false,
    overReason: '',
  };
  resetWorld(state);
  return { state, reset: () => resetWorld(state), step: (input, dt) => stepWorld(state, input, dt) };
}

export function resetWorld(state) {
  const city = state.city;
  const home = city.landmarks.safehouse;
  state.player = {
    x: home.x,
    y: home.y + 40,
    angle: -Math.PI / 2,
    aimAngle: 0,
    hp: PLAYER.maxHealth,
    ammo: PLAYER.startAmmo,
    inCar: false,
    car: null,
    invuln: 0,
  };
  state.playerCar = null;
  state.traffic = createTraffic(state.rng, city);
  state.police = createPolice();
  state.combat = createCombat();
  state.pickups = [];
  state.crates = [];
  state.particles = [];
  state.wanted = 0;
  state.money = MONEY_START;
  state.kills = 0;
  state.missionsDone = 0;
  state.missionIndex = 0;
  state.storyComplete = false;
  state.time = 0;
  state.playTime = 0;
  state.camera = { x: state.player.x, y: state.player.y };
  state.shake = 0;
  state.banner = null;
  state.gunCooldown = 0;
  state.punchCooldown = 0;
  state.lastShotCrimeAt = -100;
  state.over = false;
  state.overReason = '';
  scatterPickups(state);
  startMission(state, 0);
}

function scatterPickups(state) {
  const kinds = [];
  for (let i = 0; i < PICKUPS.cash.count; i += 1) kinds.push('cash');
  for (let i = 0; i < PICKUPS.health.count; i += 1) kinds.push('health');
  for (let i = 0; i < PICKUPS.ammo.count; i += 1) kinds.push('ammo');
  for (const kind of kinds) {
    const spot = state.city.randomStreetPoint(state.rng);
    state.pickups.push({ kind, x: spot.x, y: spot.y, bob: state.rng.range(0, Math.PI * 2) });
  }
}

function stepWorld(state, input, dt) {
  let events = 0;
  const player = state.player;
  state.time += dt;
  state.playTime += dt;
  player.invuln = Math.max(0, player.invuln - dt);
  if (state.banner) state.banner.t += dt;

  // --- Player: on foot or behind the wheel. ---
  if (player.inCar && player.car) {
    events |= stepDriving(state, input, dt);
  } else {
    events |= stepOnFoot(state, input, dt);
  }

  // --- The city lives around the player. ---
  stepTraffic(state.traffic, state.city, state.rng, dt);
  const policeEvents = stepPolice(state, dt);
  if (policeEvents.busted) events |= EVENT_BUSTED;
  if (policeEvents.rammed) events |= EVENT_CRASH;
  const combatEvents = stepCombat(state, dt);
  if (combatEvents.enemyShots > 0) events |= EVENT_ENEMY_SHOT;

  // Keep the streets full: a stolen traffic car is replaced by a fresh one.
  while (state.traffic.cars.length < TRAFFIC_CARS) {
    const spot = state.city.randomStreetPoint(state.rng);
    const node = state.city.nearestNode(spot.x, spot.y);
    const next = state.city.nodeNeighbours(node.ix, node.iy)[0];
    const at = state.city.nodePoint(node.ix, node.iy);
    state.traffic.cars.push({
      kind: 'traffic',
      x: at.x, y: at.y,
      angle: Math.atan2(state.city.nodePoint(next.ix, next.iy).y - at.y, state.city.nodePoint(next.ix, next.iy).x - at.x),
      speed: 150, cruise: 150,
      color: '#d9d9d9', model: 'sedan',
      ix: node.ix, iy: node.iy, fromIx: node.ix, fromIy: node.iy,
      nextIx: next.ix, nextIy: next.iy, wait: 0, wobble: 0,
    });
  }

  // --- Pickups. ---
  for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
    const pickup = state.pickups[i];
    pickup.bob += dt * 3;
    if (distanceBetween(player.x, player.y, pickup.x, pickup.y) < 28) {
      if (pickup.kind === 'cash') state.money += PICKUPS.cash.value;
      else if (pickup.kind === 'health') player.hp = Math.min(PLAYER.maxHealth, player.hp + PICKUPS.health.heal);
      else player.ammo = Math.min(PLAYER.maxAmmo, player.ammo + PICKUPS.ammo.amount);
      state.pickups.splice(i, 1);
      events |= EVENT_PICKUP;
      addPickupBurst(state, pickup.x, pickup.y, pickup.kind);
    }
  }

  // --- Missions advance from whatever the player did. ---
  const before = state.missionsDone;
  const missionResult = updateMission(state);
  if (missionResult === 'complete') events |= EVENT_MISSION_COMPLETE;
  else if (missionResult === 'advanced' || state.missionsDone > before) events |= EVENT_MISSION;

  // --- Particles and camera. ---
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.max(0, 1 - 2.5 * dt);
    p.vy *= Math.max(0, 1 - 2.5 * dt);
    if (p.life <= 0) state.particles.splice(i, 1);
  }
  const lookAhead = player.inCar && player.car ? 0.3 : 0.12;
  const targetX = player.x + Math.cos(player.angle) * (player.inCar ? player.car.speed * lookAhead : 0);
  const targetY = player.y + Math.sin(player.angle) * (player.inCar ? player.car.speed * lookAhead : 0);
  state.camera.x += (targetX - state.camera.x) * Math.min(1, 5 * dt);
  state.camera.y += (targetY - state.camera.y) * Math.min(1, 5 * dt);
  state.shake = Math.max(0, state.shake - dt * 26);

  if (player.hp <= 0 && !state.over) {
    state.over = true;
    state.overReason = 'wasted';
    events |= EVENT_DIED;
  }
  return events;
}

function stepOnFoot(state, input, dt) {
  let events = 0;
  const player = state.player;
  const speed = input.running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  player.x += input.mx * speed * dt;
  player.y += input.my * speed * dt;
  if (input.mx !== 0 || input.my !== 0) {
    player.angle = Math.atan2(input.my, input.mx);
  }
  player.aimAngle = Math.atan2(input.aimY - player.y, input.aimX - player.x);
  state.city.resolveCircle(player, PLAYER.radius);

  // A moving traffic car that clips the player hurts.
  for (const car of state.traffic.cars) {
    if (circlesOverlap(player.x, player.y, PLAYER.radius, car.x, car.y, 20)) {
      const pushAngle = Math.atan2(player.y - car.y, player.x - car.x);
      player.x += Math.cos(pushAngle) * 26 * dt * 10;
      player.y += Math.sin(pushAngle) * 26 * dt * 10;
      if (car.speed > 150 && player.invuln <= 0) {
        player.hp -= 15;
        player.invuln = 0.8;
        state.shake = Math.min(10, state.shake + 4);
        events |= EVENT_CRASH;
      }
    }
  }

  if (input.actions & ACTION_INTERACT_BIT) {
    const result = tryInteract(state);
    if (result === 'steal') events |= EVENT_STEAL;
    else if (result === 'crate') events |= EVENT_PICKUP;
    else if (result === 'vault') events |= EVENT_VAULT;
    else if (result === 'enter') events |= EVENT_PICKUP;
  }
  if (input.actions & ACTION_PUNCH_BIT) {
    const result = meleeAttack(state);
    if (result.hits > 0) events |= EVENT_PUNCH;
  }
  if (input.shooting) {
    if (firePlayerBullet(state, player.aimAngle)) {
      events |= EVENT_SHOT;
      if (state.time - state.lastShotCrimeAt > 6) {
        state.lastShotCrimeAt = state.time;
        addWanted(state, WANTED.shoot);
      }
    }
  }
  return events;
}

function stepDriving(state, input, dt) {
  let events = 0;
  const player = state.player;
  const car = player.car;

  if (input.throttle > 0) {
    car.speed = Math.min(CAR.maxSpeed, car.speed + CAR.accel * dt);
  } else if (input.throttle < 0) {
    if (car.speed > 30) car.speed = Math.max(0, car.speed - CAR.brake * dt);
    else car.speed = Math.max(-CAR.maxReverse, car.speed - CAR.reverseAccel * dt);
  } else {
    car.speed -= car.speed * CAR.drag * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  const steerAuthority = clampNumber(Math.abs(car.speed) / 130, 0.35, 1) * (car.speed >= 0 ? 1 : -1);
  car.angle += input.steer * CAR.turnRate * steerAuthority * dt;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.aimAngle = car.angle;

  // Hard cornering kicks up tyre smoke.
  if (Math.abs(input.steer) > 0.5 && Math.abs(car.speed) > 300 && state.rng.chance(0.5)) {
    state.particles.push({
      kind: 'smoke',
      x: car.x - Math.cos(car.angle) * 20, y: car.y - Math.sin(car.angle) * 20,
      vx: state.rng.range(-20, 20), vy: state.rng.range(-20, 20),
      life: 0.5, maxLife: 0.5, size: 7, color: '#cfc9bb',
    });
  }

  // Walls: a fast hit is a crash, a slow one just scrapes.
  if (state.city.resolveCircle(car, 20)) {
    if (Math.abs(car.speed) > 130) {
      car.speed *= 0.45;
      state.shake = Math.min(14, state.shake + 7);
      events |= EVENT_CRASH;
      addCrashSparks(state, car.x, car.y);
    } else {
      car.speed *= 0.6;
    }
  }

  // Traffic: shove, slow down, and apologise with a crash sound.
  for (const other of state.traffic.cars) {
    if (circlesOverlap(car.x, car.y, 22, other.x, other.y, 22)) {
      const pushAngle = Math.atan2(other.y - car.y, other.x - car.x);
      const overlap = 44 - distanceBetween(car.x, car.y, other.x, other.y);
      other.x += Math.cos(pushAngle) * overlap * 0.6;
      other.y += Math.sin(pushAngle) * overlap * 0.6;
      other.wait = 0.5;
      if (Math.abs(car.speed) > 120) {
        car.speed *= 0.6;
        state.shake = Math.min(12, state.shake + 5);
        events |= EVENT_CRASH;
      } else {
        car.speed *= 0.9;
      }
    }
  }

  // Pedestrians: hitting one at speed is a crime, and it shows. A slow
  // side-swipe while turning just shoves them aside — no harm, no foul.
  for (const ped of state.traffic.peds) {
    if (ped.down > 0) continue;
    if (circlesOverlap(car.x, car.y, 22, ped.x, ped.y, 10)) {
      const toPedX = ped.x - car.x;
      const toPedY = ped.y - car.y;
      const pedDist = Math.hypot(toPedX, toPedY) || 1;
      const inFront = (toPedX * Math.cos(car.angle) + toPedY * Math.sin(car.angle)) / pedDist;
      if (Math.abs(car.speed) > 150 && inFront > 0.3) {
        ped.down = 2.5;
        ped.panic = 5;
        addWanted(state, WANTED.hitPedestrian);
        car.speed *= 0.85;
        state.shake = Math.min(10, state.shake + 4);
        events |= EVENT_CRASH;
      } else {
        const pushAngle = Math.atan2(ped.y - car.y, ped.x - car.x);
        ped.x += Math.cos(pushAngle) * 40 * dt;
        ped.y += Math.sin(pushAngle) * 40 * dt;
      }
    }
  }

  // Police cruisers can ram the player's car too: the cruiser gives way,
  // the player's car just loses a little speed — the hero keeps the road.
  for (const copCar of state.police.cars) {
    if (circlesOverlap(car.x, car.y, 22, copCar.x, copCar.y, 22)) {
      const pushAngle = Math.atan2(copCar.y - car.y, copCar.x - car.x);
      const overlap = 44 - distanceBetween(car.x, car.y, copCar.x, copCar.y);
      copCar.x += Math.cos(pushAngle) * overlap * 0.7;
      copCar.y += Math.sin(pushAngle) * overlap * 0.7;
      car.speed *= 0.98;
      copCar.speed *= 0.7;
    }
  }

  if (input.actions & ACTION_INTERACT_BIT) {
    exitCar(state);
  }
  return events;
}

function addPickupBurst(state, x, y, kind) {
  const color = kind === 'cash' ? '#f2c94c' : kind === 'health' ? '#6ac76a' : '#e8a13d';
  for (let i = 0; i < 8; i += 1) {
    state.particles.push({
      kind: 'spark', x, y,
      vx: state.rng.range(-120, 120), vy: state.rng.range(-120, 120),
      life: 0.4, maxLife: 0.4, size: 3, color,
    });
  }
}

function addCrashSparks(state, x, y) {
  for (let i = 0; i < 8; i += 1) {
    state.particles.push({
      kind: 'spark', x, y,
      vx: state.rng.range(-180, 180), vy: state.rng.range(-180, 180),
      life: 0.35, maxLife: 0.35, size: 3, color: '#ffd94d',
    });
  }
}

/** Put the player back on their feet at the Safehouse after a death or bust. */
export function respawnPlayer(state, reason) {
  const home = state.city.landmarks.safehouse;
  const player = state.player;
  if (player.inCar && player.car) {
    player.car.x = home.x + 60;
    player.car.y = home.y + 60;
    player.car.speed = 0;
    player.car.angle = 0;
  }
  player.x = home.x;
  player.y = home.y + 40;
  player.hp = PLAYER.maxHealth;
  player.inCar = false;
  player.car = null;
  player.invuln = 2;
  state.wanted = 0;
  state.police.cars = [];
  state.police.cops = [];
  state.police.bustProgress = 0;
  state.camera.x = player.x;
  state.camera.y = player.y;
  if (reason === 'wasted') {
    state.money = Math.floor(state.money * 0.9);
    state.banner = { title: 'WASTED', sub: 'Mara wakes up at the Safehouse. The city keeps 10% of your cash.', t: 0, duration: 4 };
  } else {
    state.money = Math.max(0, state.money - 150);
    state.banner = { title: 'BUSTED', sub: 'The cops took $150 in fines. Mara walks free — for now.', t: 0, duration: 4 };
  }
  state.over = false;
  state.overReason = '';
}

/** A plain snapshot for localStorage saves. */
export function saveSnapshot(state) {
  return {
    seed: state.seed,
    money: state.money,
    missionIndex: state.missionIndex,
    missionsDone: state.missionsDone,
    storyComplete: state.storyComplete,
    kills: state.kills,
    hp: Math.max(1, Math.round(state.player.hp)),
    ammo: state.player.ammo,
    x: Math.round(state.player.x),
    y: Math.round(state.player.y),
    playTime: Math.round(state.playTime),
  };
}

export function applySave(state, save) {
  resetWorld(state);
  state.money = save.money ?? MONEY_START;
  state.kills = save.kills ?? 0;
  state.missionsDone = save.missionsDone ?? 0;
  state.storyComplete = !!save.storyComplete;
  state.player.hp = save.hp ?? PLAYER.maxHealth;
  state.player.ammo = save.ammo ?? PLAYER.startAmmo;
  state.player.x = save.x ?? state.player.x;
  state.player.y = save.y ?? state.player.y;
  state.playTime = save.playTime ?? 0;
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
  const index = state.storyComplete ? 99 : (save.missionIndex ?? 0);
  startMission(state, index);
}
