// The police: cruisers that chase and ram, and foot cops who
// bust the player on foot.
//
// Wanted stars are READ-ONLY here. The decay timer lives in
// world.stepWanted alone — this module used to decay too, and the
// stars melted twice as fast as the spec says. Nothing in this
// file ever writes state.wanted.
//
// stepPolice returns an events bitmask: CRASH (8) when a cruiser
// rams the player's car, BUSTED (64) when foot cops hold the
// player for bustSeconds.

import { CAR, WANTED, WORLD_W, WORLD_H } from './config.js';
import { angleTo, clamp, dist } from './util.js';

export const POLICE_EVENTS = { CRASH: 8, BUSTED: 64 };

const MAX_CRUISERS = 4;
const MAX_FOOT_COPS = 2;
const BUST_RANGE = 44;
const RAM_RANGE = 46;
const RAM_COOLDOWN = 0.8;

export function createPolice() {
  return {
    cars: [],
    footCops: [],
    bustTimer: 0,
    spawnTimer: 0,
  };
}

export function clearPolice(state) {
  if (!state.police) return;
  state.police.cars = [];
  state.police.footCops = [];
  state.police.bustTimer = 0;
}

function spawnCruiser(state, rng) {
  const p = state.player;
  const city = state.city;
  const roll = rng ? () => (typeof rng === 'function' ? rng() : rng.next()) : Math.random;
  // Appear on a road a few hundred px away — close enough to be
  // a threat, far enough not to spawn on top of the player.
  let x = p.x + 400;
  let y = p.y;
  for (let tries = 0; tries < 8; tries += 1) {
    const a = roll() * Math.PI * 2;
    const d = 350 + roll() * 200;
    const cand = city ? city.nearestRoadPoint(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d) : null;
    if (cand) {
      x = cand.x;
      y = cand.y;
      break;
    }
    x = clamp(p.x + Math.cos(a) * d, 40, WORLD_W - 40);
    y = clamp(p.y + Math.sin(a) * d, 40, WORLD_H - 40);
  }
  return {
    kind: 'police',
    x,
    y,
    angle: angleTo(x, y, p.x, p.y),
    speed: 0,
    color: '#20262e',
    roadblock: false,
    ramCooldown: 0,
  };
}

function spawnFootCop(state) {
  const p = state.player;
  const a = Math.random() * Math.PI * 2;
  const spot = state.city
    ? state.city.nearestRoadPoint(p.x + Math.cos(a) * 250, p.y + Math.sin(a) * 250)
    : { x: p.x + 250, y: p.y };
  return {
    x: spot.x,
    y: spot.y,
    angle: angleTo(spot.x, spot.y, p.x, p.y),
    speed: 205,
    shirt: '#20262e',
    skin: '#e8b98a',
  };
}

export function stepPolice(state, dt) {
  const police = state.police;
  const p = state.player;
  if (!police || !p) return 0;
  let events = 0;
  const wanted = state.wanted || 0;

  // No heat: the street empties. Roadblock cruisers are
  // police2's to remove, so only the chasing cars go here.
  if (wanted <= 0) {
    police.cars = police.cars.filter((c) => c.roadblock);
    police.footCops = [];
    police.bustTimer = 0;
    return 0;
  }

  let remaining = dt;
  while (remaining > 0) {
    const h = Math.min(remaining, 1 / 30);
    remaining -= h;

    // Keep the chase stocked: up to one cruiser per star, max 4.
    const chasing = police.cars.filter((c) => !c.roadblock);
    const wantCruisers = Math.min(wanted, MAX_CRUISERS);
    if (chasing.length < wantCruisers) {
      police.spawnTimer -= h;
      if (police.spawnTimer <= 0) {
        police.cars.push(spawnCruiser(state, state.rng));
        police.spawnTimer = 1.2;
      }
    }

    // Foot cops only matter while the player is on foot.
    const wantCops = p.inCar || p.inBoat ? 0 : Math.min(wanted, MAX_FOOT_COPS);
    while (police.footCops.length < wantCops) {
      police.footCops.push(spawnFootCop(state));
    }
    if (police.footCops.length > wantCops) {
      police.footCops.length = wantCops;
    }

    const city = state.city;
    for (const car of police.cars) {
      if (car.roadblock) continue; // police2 owns these; never move them.
      if (car.ramCooldown > 0) car.ramCooldown -= h;
      const d = dist(car.x, car.y, p.x, p.y);
      // A cruiser that has caught an on-foot player holds its
      // ground instead of circling past them forever.
      if (!p.inCar && !p.inBoat && d < 70) {
        car.speed = 0;
        continue;
      }
      if (d > 1500) {
        const fresh = spawnCruiser(state, state.rng);
        car.x = fresh.x;
        car.y = fresh.y;
        car.angle = fresh.angle;
        car.speed = 0;
        continue;
      }
      const wantAngle = angleTo(car.x, car.y, p.x, p.y);
      let diff = wantAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += clamp(diff, -3.2 * h, 3.2 * h);
      const topSpeed = Math.min(380 + wanted * 30, 540);
      car.speed = Math.min(topSpeed, car.speed + 420 * h);
      car.x += Math.cos(car.angle) * car.speed * h;
      car.y += Math.sin(car.angle) * car.speed * h;
      if (city) city.resolveCircle(car, 22);
      // Ram: a cruiser touching the player's car hurts.
      if (p.inCar && d < RAM_RANGE && car.ramCooldown <= 0) {
        p.hp -= CAR.ramDamage;
        car.ramCooldown = RAM_COOLDOWN;
        car.speed *= 0.4;
        events |= POLICE_EVENTS.CRASH;
      }
    }

    // Foot cops close in; held close for bustSeconds = BUSTED.
    let held = false;
    for (const cop of police.footCops) {
      const d = dist(cop.x, cop.y, p.x, p.y);
      if (d > BUST_RANGE) {
        const a = angleTo(cop.x, cop.y, p.x, p.y);
        cop.angle = a;
        cop.x += Math.cos(a) * cop.speed * h;
        cop.y += Math.sin(a) * cop.speed * h;
        if (city) city.resolveCircle(cop, 11);
      } else {
        held = true;
      }
    }
    if (held && !p.inCar && !p.inBoat) {
      police.bustTimer += h;
      if (police.bustTimer >= WANTED.bustSeconds) {
        police.bustTimer = 0;
        events |= POLICE_EVENTS.BUSTED;
      }
    } else {
      police.bustTimer = Math.max(0, police.bustTimer - h * 2);
    }
  }
  return events;
}
