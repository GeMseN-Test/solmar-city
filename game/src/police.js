// police.js — police cruisers + foot cops, chase / ram / bust.
// READ-ONLY on wanted level: wanted decay lives in world.step ONLY
// (a past build decayed in both places and stars fell twice as fast).
import { COP_CHASE_RADIUS, BUST_SECONDS, WANTED_MAX } from './config.js';
import { randRange } from './random.js';
import { dist, angleTo, normalizeAngle, clamp } from './util.js';

export function createPolice() {
  return {
    cars: [],
    cops: [],
    bustTimer: 0,
    spawnTimer: 0,
    siren: false,
  };
}

export function wantedLevel(state) {
  return state.wanted || 0;
}

export function addWanted(state, n) {
  state.wanted = clamp((state.wanted || 0) + n, 0, WANTED_MAX);
  state.wantedTimer = 0;
  return state.wanted;
}

export function spawnPoliceCar(state, x, y) {
  const police = state.police || (state.police = createPolice());
  const car = {
    kind: 'police', x, y, angle: 0, speed: 0,
    cruise: 300, color: '#1c2733', model: 'police',
    roadblock: false, radius: 16,
  };
  police.cars.push(car);
  return car;
}

export function stepPolice(state, dt) {
  const police = state.police;
  if (!police) return;
  const p = state.player;
  if (!p) return;
  const wanted = state.wanted || 0;
  police.siren = wanted > 0;
  let remaining = dt;
  while (remaining > 0) {
    const h = Math.min(remaining, 0.05);
    remaining -= h;
    // Keep enough cruisers for the wanted level (1 per star, max 4).
    const wantCars = Math.min(4, wanted);
    const activeCars = police.cars.filter((c) => !c.roadblock);
    if (activeCars.length < wantCars && police.spawnTimer <= 0) {
      const a = randRange(Math.random, 0, Math.PI * 2);
      spawnPoliceCar(state, p.x + Math.cos(a) * 700, p.y + Math.sin(a) * 700);
      police.spawnTimer = 3;
    }
    police.spawnTimer = Math.max(0, police.spawnTimer - h);
    // Drop extra cruisers when wanted falls.
    while (police.cars.filter((c) => !c.roadblock).length > wantCars) {
      const idx = police.cars.findIndex((c) => !c.roadblock);
      if (idx < 0) break;
      police.cars.splice(idx, 1);
    }
    if (wanted === 0) {
      police.bustTimer = 0;
      for (const car of police.cars) {
        if (car.roadblock) continue;
        car.speed *= Math.max(0, 1 - 2 * h);
      }
      continue;
    }
    // Chase the player.
    let touching = false;
    for (const car of police.cars) {
      if (car.roadblock) continue; // roadblocks never move (police2 owns them)
      const d = dist(car.x, car.y, p.x, p.y);
      if (d > COP_CHASE_RADIUS * 1.5 && d > 300) {
        // Teleport closer if hopelessly far — keeps the chase alive.
        const a = randRange(Math.random, 0, Math.PI * 2);
        car.x = p.x + Math.cos(a) * 600;
        car.y = p.y + Math.sin(a) * 600;
        car.speed = 0;
      }
      const want = angleTo(car.x, car.y, p.x, p.y);
      car.angle += normalizeAngle(want - car.angle) * Math.min(1, 3.5 * h);
      const targetSpeed = 260 + wanted * 25;
      car.speed += (targetSpeed - car.speed) * Math.min(1, 1.5 * h);
      car.x += Math.cos(car.angle) * car.speed * h;
      car.y += Math.sin(car.angle) * car.speed * h;
      if (d < 26) {
        touching = true;
        // Ram: shove + damage the player (on foot or in a car).
        if (p.hp > 0) {
          p.hp -= 18 * h * 4;
          state.lastRamAt = state.playTime || 0;
        }
      }
    }
    // Bust: a cop sitting on the player on foot for BUST_SECONDS.
    if (touching && !p.inCar && !p.inBoat && p.hp > 0) {
      police.bustTimer += h;
      if (police.bustTimer >= BUST_SECONDS) {
        police.bustTimer = 0;
        state.busted = true;
      }
    } else {
      police.bustTimer = Math.max(0, police.bustTimer - h * 2);
    }
  }
}

export function clearPolice(state) {
  const police = state.police;
  if (!police) return;
  police.cars = [];
  police.cops = [];
  police.bustTimer = 0;
}
export default createPolice;
