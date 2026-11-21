// police.js — SCPD cruisers and foot cops: chase, ram, bust.
// state.police = { cars, cops, bustTimer, spawnCooldown, siren }.
// There is NO `wanted` field here on purpose: wanted lives ONLY in
// state.wanted, and world.js syncs it before calling stepPolice.
// police.js NEVER decays wanted — decay happens only in world.stepWanted.

import { WANTED } from './config.js';
import { randRange } from './random.js';
import { clamp, dist } from './util.js';

export const BUSTED_EVENT = 64;

export function createPolice() {
  return {
    cars: [],
    cops: [],
    bustTimer: 0,
    spawnCooldown: 0,
    siren: false,
  };
}

function spawnCruiser(state, rng, nearX, nearY) {
  const city = state.city;
  let x = nearX + 500;
  let y = nearY;
  if (city && city.nearestRoadPoint) {
    const pt = city.nearestRoadPoint(x, y);
    x = pt.x;
    y = pt.y;
  }
  return {
    kind: 'police',
    x,
    y,
    angle: 0,
    speed: 0,
    roadblock: false,
    color: '#1c2733',
    sirenPhase: rng ? randRange(rng, 0, Math.PI * 2) : 0,
  };
}

function spawnCop(state, rng, nearX, nearY) {
  return {
    kind: 'cop',
    x: nearX + (rng ? randRange(rng, -260, 260) : 200),
    y: nearY + (rng ? randRange(rng, -260, 260) : 200),
    angle: 0,
    speed: 200,
    shirt: '#1c2733',
    skin: '#e8b98a',
  };
}

export function stepPolice(state, dt) {
  const total = Math.max(0.001, dt || 0.016);
  const n = Math.max(1, Math.ceil(total / 0.05));
  const sub = total / n;
  let events = 0;
  for (let i = 0; i < n; i += 1) events |= stepPoliceOnce(state, sub);
  return events;
}

function stepPoliceOnce(state, step) {
  const police = state.police;
  const p = state.player;
  if (!police || !p) return 0;
  const wanted = state.wanted || 0;
  const rng = state.rng;

  police.siren = wanted > 0;

  // Spawn: cruisers up to wanted, foot cops from 2 stars up.
  police.spawnCooldown -= step;
  if (wanted > 0 && police.spawnCooldown <= 0) {
    police.spawnCooldown = 2;
    const cruisers = police.cars.filter((c) => !c.roadblock).length;
    if (cruisers < Math.min(wanted, 3)) {
      police.cars.push(spawnCruiser(state, rng, p.x, p.y));
    }
    if (wanted >= 2 && police.cops.length < wanted - 1) {
      police.cops.push(spawnCop(state, rng, p.x, p.y));
    }
  }

  // Despawn everything when the heat is off.
  if (wanted === 0) {
    police.cars = police.cars.filter((c) => c.roadblock);
    police.cops = [];
    police.bustTimer = 0;
    return 0;
  }

  let events = 0;

  // Cruisers chase the player; roadblock cars stay parked.
  for (const car of police.cars) {
    if (car.roadblock) continue;
    const d = dist(car.x, car.y, p.x, p.y);
    const wantAngle = Math.atan2(p.y - car.y, p.x - car.x);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const topSpeed = 400 + wanted * 22;
    car.speed += (topSpeed - car.speed) * Math.min(1, 1.5 * step);
    car.angle += clamp(diff, -2.4 * step, 2.4 * step);
    car.x += Math.cos(car.angle) * car.speed * step;
    car.y += Math.sin(car.angle) * car.speed * step;
    car.sirenPhase += step * 6;
    // Ram: bump the player when a cruiser touches them.
    if (d < 34 && (!p.invuln || p.invuln <= 0) && !p.inBoat) {
      p.hp = Math.max(0, (p.hp || 100) - 9);
      p.invuln = 0.6;
    }
    car.x = clamp(car.x, 20, 2860);
    car.y = clamp(car.y, 20, 2080);
  }

  // Foot cops run at the player; hold on and the bust timer fills.
  let copTouching = false;
  for (const cop of police.cops) {
    const d = dist(cop.x, cop.y, p.x, p.y);
    if (d > WANTED.copChaseRadius) {
      // Too far: walk back toward the player slowly, or stand.
      cop.x += Math.cos(Math.atan2(p.y - cop.y, p.x - cop.x)) * cop.speed * 0.4 * step;
      cop.y += Math.sin(Math.atan2(p.y - cop.y, p.x - cop.x)) * cop.speed * 0.4 * step;
      continue;
    }
    const a = Math.atan2(p.y - cop.y, p.x - cop.x);
    cop.angle = a;
    cop.x += Math.cos(a) * cop.speed * step;
    cop.y += Math.sin(a) * cop.speed * step;
    if (d < 26 && !p.inBoat && !p.inCar) copTouching = true;
    cop.x = clamp(cop.x, 20, 2860);
    cop.y = clamp(cop.y, 20, 2080);
  }

  if (copTouching) {
    police.bustTimer += step;
    if (police.bustTimer >= WANTED.bustSeconds) {
      police.bustTimer = 0;
      state.busted = true;
      events |= BUSTED_EVENT;
    }
  } else {
    police.bustTimer = Math.max(0, police.bustTimer - step * 2);
  }

  return events;
}

export default { createPolice, stepPolice, BUSTED_EVENT };
