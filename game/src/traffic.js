// Traffic: cars driving the road grid + pedestrians on the sidewalks.
// Cars follow node-to-node routes; peds wander between street points.
import { TRAFFIC_CARS, PEDESTRIANS } from './config.js';
import { clamp, dist, turnToward } from './util.js';
import { randRange, randInt, pick } from './random.js';

export const CAR_MODELS = ['sedan', 'van', 'taxi', 'truck', 'sport'];
const CAR_COLORS = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#7f8c8d', '#d35400', '#16a085'];
const PED_SHIRTS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#ecf0f1'];
const PED_SKINS = ['#e8b98a', '#c98d5f', '#8a5a3b', '#f0c8a0', '#a06a42'];

export function createTraffic(rng, city) {
  const cars = [];
  for (let i = 0; i < TRAFFIC_CARS; i++) {
    const ix = randInt(rng, 0, city.nodeCountX - 1);
    const iy = randInt(rng, 0, city.nodeCountY - 1);
    const from = { ix, iy };
    const next = pickNextNode(rng, city, ix, iy);
    const a = city.nodePoint(ix, iy);
    const b = city.nodePoint(next.ix, next.iy);
    const model = pick(rng, CAR_MODELS);
    cars.push({
      kind: 'traffic',
      x: a.x + randRange(rng, -10, 10),
      y: a.y + randRange(rng, -10, 10),
      angle: Math.atan2(b.y - a.y, b.x - a.x),
      speed: 0,
      cruise: randRange(rng, 110, 190) * (model === 'sport' ? 1.25 : model === 'truck' ? 0.8 : 1),
      color: model === 'taxi' ? '#f5c518' : pick(rng, CAR_COLORS),
      model,
      ix,
      iy,
      fromIx: from.ix,
      fromIy: from.iy,
      nextIx: next.ix,
      nextIy: next.iy,
      wait: 0,
      wobble: randRange(rng, 0, Math.PI * 2),
    });
  }

  const peds = [];
  for (let i = 0; i < PEDESTRIANS; i++) {
    const pt = city.randomStreetPoint(rng);
    const target = city.randomStreetPoint(rng);
    peds.push({
      x: pt.x + randRange(rng, -24, 24),
      y: pt.y + randRange(rng, -24, 24),
      angle: randRange(rng, 0, Math.PI * 2),
      speed: randRange(rng, 32, 62),
      shirt: pick(rng, PED_SHIRTS),
      skin: pick(rng, PED_SKINS),
      targetX: target.x,
      targetY: target.y,
      wait: randRange(rng, 0, 2),
      down: false,
      panic: 0,
      stepPhase: randRange(rng, 0, Math.PI * 2),
    });
  }

  return { cars, peds };
}

function pickNextNode(rng, city, ix, iy) {
  const options = city.nodeNeighbours(ix, iy);
  return pick(rng, options);
}

// Advance traffic one frame. `traffic` is the object from createTraffic.
export function stepTraffic(traffic, city, rng, dt) {
  for (const car of traffic.cars) {
    // At an intersection: pick the next leg (never U-turn if avoidable).
    const target = city.nodePoint(car.nextIx, car.nextIy);
    const d = dist(car.x, car.y, target.x, target.y);
    if (d < 14) {
      car.ix = car.nextIx;
      car.iy = car.nextIy;
      const options = city.nodeNeighbours(car.ix, car.iy).filter(
        (n) => !(n.ix === car.fromIx && n.iy === car.fromIy),
      );
      const next = options.length > 0 ? pick(rng, options) : pick(rng, city.nodeNeighbours(car.ix, car.iy));
      car.fromIx = car.ix;
      car.fromIy = car.iy;
      car.nextIx = next.ix;
      car.nextIy = next.iy;
      car.x = target.x;
      car.y = target.y;
    }
    const dest = city.nodePoint(car.nextIx, car.nextIy);
    const want = Math.atan2(dest.y - car.y, dest.x - car.x);
    car.angle = turnToward(car.angle, want, 2.2 * dt);
    // Ease up to cruise speed, with a little wobble so cars feel alive.
    car.speed += (car.cruise - car.speed) * Math.min(1, 1.2 * dt);
    car.wobble += dt * 2;
    const wob = Math.sin(car.wobble) * 0.04;
    car.x += Math.cos(car.angle + wob) * car.speed * dt;
    car.y += Math.sin(car.angle + wob) * car.speed * dt;
  }

  for (const ped of traffic.peds) {
    if (ped.down) continue;
    if (ped.panic > 0) {
      ped.panic -= dt;
      ped.x += Math.cos(ped.angle) * ped.speed * 2.4 * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * 2.4 * dt;
      ped.stepPhase += dt * 14;
      continue;
    }
    if (ped.wait > 0) {
      ped.wait -= dt;
      continue;
    }
    const d = dist(ped.x, ped.y, ped.targetX, ped.targetY);
    if (d < 10) {
      const t = city.randomStreetPoint(rng);
      ped.targetX = t.x + randRange(rng, -24, 24);
      ped.targetY = t.y + randRange(rng, -24, 24);
      ped.wait = randRange(rng, 0.5, 3);
      continue;
    }
    const want = Math.atan2(ped.targetY - ped.y, ped.targetX - ped.x);
    ped.angle = turnToward(ped.angle, want, 6 * dt);
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    ped.stepPhase += dt * 8;
    if (city) city.resolveCircle(ped, 8);
  }
}

// Nearest traffic car within maxDist of (x, y), or null.
export function nearestTrafficCar(traffic, x, y, maxDist) {
  let best = null;
  let bestD = maxDist == null ? Infinity : maxDist;
  for (const car of traffic.cars) {
    const d = dist(car.x, car.y, x, y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export default createTraffic;
