// The police: wanted stars, cop cruisers, foot cops, ramming and
// busting. Crimes add stars (stealing a car, shooting, hitting a
// pedestrian); stars decay after a quiet spell. At 3+ stars the
// roadblocks from police2.js join the chase.
import { CAR, WANTED } from './config.js';
import { clamp, dist } from './util.js';

export function createPolice() {
  return {
    cars: [],
    cops: [],
    wanted: 0,
    wantedTimer: 0,
    decayTimer: 0,
    bustTimer: 0,
    spawnCooldown: 0,
  };
}

export function addWanted(state, n) {
  const pol = state.police;
  pol.wanted = clamp(pol.wanted + n, 0, WANTED.max);
  pol.wantedTimer = 0;
  pol.decayTimer = 0;
}

export function setWanted(state, n) {
  const pol = state.police;
  pol.wanted = clamp(n, 0, WANTED.max);
  pol.wantedTimer = 0;
  pol.decayTimer = 0;
}

// Park a cruiser somewhere on a road near the player, facing the road.
function spawnCopCar(state) {
  const p = state.player;
  const city = state.city;
  const rng = state.rng;
  const spot = city.randomStreetPoint(rng);
  // Nudge the spawn toward the player's neighborhood so the chase
  // actually arrives, but not on top of them.
  const x = clamp(spot.x + (p.x - spot.x) * 0.25, 40, 2840);
  const y = clamp(spot.y + (p.y - spot.y) * 0.25, 40, 1980);
  const car = {
    kind: 'police',
    x, y,
    angle: Math.atan2(p.y - y, p.x - x),
    speed: 0,
    cruise: 430,
    color: '#1a1a2e',
    model: 'sedan',
    ramCooldown: 0,
    roadblock: false,
  };
  state.police.cars.push(car);
  return car;
}

function spawnFootCop(state) {
  const p = state.player;
  const rng = state.rng;
  const a = rng.range(0, Math.PI * 2);
  const r = rng.range(260, 420);
  state.police.cops.push({
    x: clamp(p.x + Math.cos(a) * r, 30, 2850),
    y: clamp(p.y + Math.sin(a) * r, 30, 1990),
    angle: a,
    speed: rng.range(185, 215),
    shirt: '#1a2a6a',
    skin: '#c98d5f',
    bustHold: 0,
  });
}

// Returns an events bitmask (BUSTED = 64, CRASH = 8 on a hard ram).
export function stepPolice(state, dt) {
  let events = 0;
  const pol = state.police;
  const p = state.player;
  const rng = state.rng;

  // Quiet spell: stars tick down one at a time.
  if (pol.wanted > 0) {
    pol.wantedTimer += dt;
    if (pol.wantedTimer >= WANTED.decayDelay) {
      pol.decayTimer += dt;
      if (pol.decayTimer >= WANTED.decayEvery) {
        pol.decayTimer = 0;
        pol.wanted -= 1;
        if (pol.wanted === 0) pol.wantedTimer = 0;
      }
    }
  }

  // No heat, no heat: the street empties out.
  if (pol.wanted === 0) {
    if (pol.cars.length || pol.cops.length) {
      pol.cars = pol.cars.filter((c) => c.roadblock);
      pol.cops = [];
      pol.bustTimer = 0;
    }
    return events;
  }

  // Keep the chase staffed: one cruiser per star (max 3) + foot cops.
  pol.spawnCooldown -= dt;
  const wantCars = Math.min(3, pol.wanted);
  const drivingCars = pol.cars.filter((c) => !c.roadblock).length;
  if (pol.spawnCooldown <= 0) {
    if (drivingCars < wantCars) spawnCopCar(state);
    if (pol.cops.length < pol.wanted) spawnFootCop(state);
    pol.spawnCooldown = 1.6;
  }

  // Cruisers chase and ram. A ram hurts and shoves the player's car.
  for (const car of pol.cars) {
    if (car.roadblock) continue;
    if (car.ramCooldown > 0) car.ramCooldown -= dt;
    const d = dist(car.x, car.y, p.x, p.y);
    const want = Math.atan2(p.y - car.y, p.x - car.x);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += clamp(diff, -2.6 * dt, 2.6 * dt);
    const target = d > 700 ? 520 : 430;
    car.speed += (target - car.speed) * Math.min(1, dt * 1.2);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (d < 46 && car.ramCooldown <= 0) {
      car.ramCooldown = 0.9;
      car.speed *= 0.3;
      events |= 8;
      if (p.invuln <= 0) {
        p.hp -= 9;
        p.invuln = 0.6;
      }
      if (p.inCar && p.car) {
        p.car.speed *= 0.55;
        p.car.x += Math.cos(car.angle) * 26;
        p.car.y += Math.sin(car.angle) * 26;
      } else {
        p.x += Math.cos(car.angle) * 30;
        p.y += Math.sin(car.angle) * 30;
        const fixed = state.city.resolveCircle(p.x, p.y, 11);
        p.x = fixed.x;
        p.y = fixed.y;
      }
    }
  }

  // Foot cops chase on foot; standing on the player long enough busts.
  let touching = false;
  for (const cop of pol.cops) {
    const d = dist(cop.x, cop.y, p.x, p.y);
    if (d < WANTED.copChaseRadius) {
      const a = Math.atan2(p.y - cop.y, p.x - cop.x);
      cop.angle = a;
      cop.x += Math.cos(a) * cop.speed * dt;
      cop.y += Math.sin(a) * cop.speed * dt;
      const fixed = state.city.resolveCircle(cop.x, cop.y, 9);
      cop.x = fixed.x;
      cop.y = fixed.y;
    }
    if (d < 30 && !p.inCar) touching = true;
  }
  if (touching) {
    pol.bustTimer += dt;
    if (pol.bustTimer >= WANTED.bustSeconds) {
      events |= 64;
      pol.bustTimer = 0;
    }
  } else {
    pol.bustTimer = Math.max(0, pol.bustTimer - dt * 2);
  }
  return events;
}
