// traffic.js — ambient traffic cars + pedestrians on the road grid.
import { TRAFFIC_CARS, PEDESTRIANS } from './config.js';
import { randRange, randInt, pick } from './random.js';
import { dist, angleTo, normalizeAngle } from './util.js';

export const CAR_MODELS = ['sedan', 'van', 'taxi', 'truck', 'sport'];
const CAR_COLORS = ['#c0392b', '#2980b9', '#f1c40f', '#7f8c8d', '#27ae60', '#8e44ad', '#e67e22', '#ecf0f1', '#2c3e50'];
const SHIRTS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#fd79a8'];
const SKINS = ['#e8b98a', '#c98d5f', '#8a5a3b', '#f0c8a0'];

export function createTraffic(rng, city) {
  const rand = typeof rng === 'function' ? rng : Math.random;
  const cars = [];
  for (let i = 0; i < TRAFFIC_CARS; i++) {
    const pt = city.randomStreetPoint(rand);
    const node = city.nearestNode(pt.x, pt.y);
    const model = pick(rand, CAR_MODELS);
    cars.push({
      kind: 'traffic', x: pt.x, y: pt.y,
      angle: pick(rand, [0, Math.PI / 2, Math.PI, -Math.PI / 2]),
      speed: 0,
      cruise: randRange(rand, 90, model === 'sport' ? 210 : 160),
      color: model === 'taxi' ? '#f1c40f' : pick(rand, CAR_COLORS),
      model,
      ix: node.ix, iy: node.iy,
      fromIx: node.ix, fromIy: node.iy,
      nextIx: node.ix, nextIy: node.iy,
      wait: randRange(rand, 0, 1),
      wobble: randRange(rand, 0, Math.PI * 2),
      radius: 16,
    });
  }
  const peds = [];
  for (let i = 0; i < PEDESTRIANS; i++) {
    const pt = city.randomStreetPoint(rand);
    peds.push({
      x: pt.x + randRange(rand, -30, 30), y: pt.y + randRange(rand, -30, 30),
      angle: randRange(rand, 0, Math.PI * 2),
      speed: randRange(rand, 30, 70),
      shirt: pick(rand, SHIRTS),
      skin: pick(rand, SKINS),
      targetX: pt.x, targetY: pt.y,
      wait: randRange(rand, 0, 2),
      down: false, panic: 0, stepPhase: randRange(rand, 0, Math.PI * 2),
    });
  }
  return { cars, peds };
}

function pickNextNode(trafficCar, city, rand) {
  const options = city.nodeNeighbours(trafficCar.nextIx, trafficCar.nextIy);
  const next = pick(rand, options);
  trafficCar.fromIx = trafficCar.nextIx;
  trafficCar.fromIy = trafficCar.nextIy;
  trafficCar.nextIx = next.ix;
  trafficCar.nextIy = next.iy;
}

export function stepTraffic(traffic, city, rng, dt) {
  const rand = typeof rng === 'function' ? rng : Math.random;
  let remaining = dt;
  while (remaining > 0) {
    const h = Math.min(remaining, 0.05);
    remaining -= h;
    for (const car of traffic.cars) {
      if (car.wait > 0) { car.wait -= h; continue; }
      const target = city.nodePoint(car.nextIx, car.nextIy);
      const d = dist(car.x, car.y, target.x, target.y);
      if (d < 12) {
        pickNextNode(car, city, rand);
        continue;
      }
      const want = angleTo(car.x, car.y, target.x, target.y);
      car.angle += normalizeAngle(want - car.angle) * Math.min(1, 4 * h);
      car.speed += (car.cruise - car.speed) * Math.min(1, 1.2 * h);
      car.x += Math.cos(car.angle) * car.speed * h;
      car.y += Math.sin(car.angle) * car.speed * h;
    }
    for (const ped of traffic.peds) {
      if (ped.down) continue;
      if (ped.panic > 0) ped.panic -= h;
      if (ped.wait > 0) { ped.wait -= h; continue; }
      const d = dist(ped.x, ped.y, ped.targetX, ped.targetY);
      if (d < 10) {
        const pt = city.randomStreetPoint(rand);
        ped.targetX = pt.x;
        ped.targetY = pt.y;
        ped.wait = randRange(rand, 0.5, 3);
        continue;
      }
      const sp = ped.speed * (ped.panic > 0 ? 2.2 : 1);
      ped.angle = angleTo(ped.x, ped.y, ped.targetX, ped.targetY);
      ped.x += Math.cos(ped.angle) * sp * h;
      ped.y += Math.sin(ped.angle) * sp * h;
      ped.stepPhase += h * 8;
    }
  }
}

export function nearestTrafficCar(traffic, x, y, maxDist) {
  const limit = maxDist != null ? maxDist : 60;
  let best = null;
  let bestD = limit;
  for (const car of traffic.cars) {
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function nearestPed(traffic, x, y, maxDist) {
  const limit = maxDist != null ? maxDist : 60;
  let best = null;
  let bestD = limit;
  for (const ped of traffic.peds) {
    if (ped.down) continue;
    const d = dist(x, y, ped.x, ped.y);
    if (d < bestD) { bestD = d; best = ped; }
  }
  return best;
}
export default createTraffic;
