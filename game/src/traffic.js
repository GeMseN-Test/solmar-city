// traffic.js — ambient traffic and pedestrians for Solmar City.
// 16 cars cruise the road grid (sedan, van, taxi, truck, sport) and
// 34 pedestrians stroll the sidewalks. Cars follow node-to-node routes
// and wait briefly at intersections; peds wander and panic when a car
// or the player barrels past them.

import { TRAFFIC_CARS, PEDESTRIANS } from './config.js';

export const CAR_MODELS = ['sedan', 'van', 'taxi', 'truck', 'sport'];
const CAR_COLORS = [
  '#c0c8d0', '#d0342c', '#2f6fd0', '#e8b13a', '#3a9e6e',
  '#7a4a9e', '#d0d0c8', '#e88030', '#5a6e8a', '#a03a3a',
];
const SHIRTS = [
  '#d0342c', '#2f6fd0', '#3a9e6e', '#e8b13a', '#7a4a9e',
  '#e88030', '#f2f2ee', '#4a9e9e', '#c05a7a', '#6a8a3a',
];
const SKIN_TONES = ['#e8b98a', '#c98d5f', '#8a5a3b', '#f0c8a0', '#6e4426'];

function carSpeedFor(model) {
  switch (model) {
    case 'sport': return 200 + Math.random() * 50;
    case 'truck': return 95 + Math.random() * 25;
    case 'van': return 115 + Math.random() * 25;
    case 'taxi': return 145 + Math.random() * 35;
    default: return 130 + Math.random() * 40;
  }
}

export function createTraffic(rng, city) {
  const rand = rng || { next: Math.random, int: (a, b) => Math.floor(a + Math.random() * (b - a + 1)), pick: (l) => l[Math.floor(Math.random() * l.length)], range: (a, b) => a + Math.random() * (b - a) };
  const cars = [];
  for (let i = 0; i < TRAFFIC_CARS; i++) {
    const ix = rand.int(0, 7);
    const iy = rand.int(0, 5);
    const from = city && city.nodePoint ? city.nodePoint(ix, iy) : { x: 180 + ix * 360, y: 180 + iy * 360 };
    // Pick a neighbouring node as the first destination.
    const dirs = [];
    if (ix > 0) dirs.push([ix - 1, iy]);
    if (ix < 7) dirs.push([ix + 1, iy]);
    if (iy > 0) dirs.push([ix, iy - 1]);
    if (iy < 5) dirs.push([ix, iy + 1]);
    const [nx, ny] = dirs[Math.floor(rand.next() * dirs.length)];
    const to = city && city.nodePoint ? city.nodePoint(nx, ny) : { x: 180 + nx * 360, y: 180 + ny * 360 };
    const model = CAR_MODELS[i % CAR_MODELS.length];
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    cars.push({
      kind: 'traffic',
      x: from.x + (rand.next() - 0.5) * 20,
      y: from.y + (rand.next() - 0.5) * 20,
      angle,
      speed: 0,
      cruise: carSpeedFor(model),
      color: model === 'taxi' ? '#f2c230' : CAR_COLORS[Math.floor(rand.next() * CAR_COLORS.length)],
      model,
      ix, iy,
      fromIx: ix, fromIy: iy,
      nextIx: nx, nextIy: ny,
      wait: rand.next() * 1.5,
      wobble: rand.next() * Math.PI * 2,
    });
  }
  const peds = [];
  for (let i = 0; i < PEDESTRIANS; i++) {
    const p = city && city.randomStreetPoint
      ? city.randomStreetPoint(rand)
      : { x: 200 + rand.next() * 2400, y: 200 + rand.next() * 1700 };
    const tx = p.x + (rand.next() - 0.5) * 300;
    const ty = p.y + (rand.next() - 0.5) * 300;
    peds.push({
      x: p.x,
      y: p.y,
      angle: rand.next() * Math.PI * 2,
      speed: 28 + rand.next() * 26,
      shirt: SHIRTS[Math.floor(rand.next() * SHIRTS.length)],
      skin: SKIN_TONES[Math.floor(rand.next() * SKIN_TONES.length)],
      targetX: tx,
      targetY: ty,
      wait: rand.next() * 2,
      down: false,
      panic: 0,
      stepPhase: rand.next() * Math.PI * 2,
    });
  }
  return { cars, peds };
}

// Pick the next node for a car that just arrived: any neighbour other
// than the one it came from (no U-turns unless it is a dead end).
function chooseNext(ix, iy, fromIx, fromIy, rand) {
  const options = [];
  if (ix > 0 && !(fromIx === ix - 1 && fromIy === iy)) options.push([ix - 1, iy]);
  if (ix < 7 && !(fromIx === ix + 1 && fromIy === iy)) options.push([ix + 1, iy]);
  if (iy > 0 && !(fromIx === ix && fromIy === iy - 1)) options.push([ix, iy - 1]);
  if (iy < 5 && !(fromIx === ix && fromIy === iy + 1)) options.push([ix, iy + 1]);
  if (options.length === 0) return [fromIx, fromIy];
  return options[Math.floor(rand.next() * options.length)];
}

export function stepTraffic(traffic, city, rng, dt) {
  const step = dt || 0.016;
  const rand = rng || { next: Math.random };
  if (!traffic) return;

  for (const car of traffic.cars || []) {
    const target = city && city.nodePoint
      ? city.nodePoint(car.nextIx, car.nextIy)
      : { x: 180 + car.nextIx * 360, y: 180 + car.nextIy * 360 };
    const dx = target.x - car.x;
    const dy = target.y - car.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (car.wait > 0) {
      car.wait -= step;
      car.speed = Math.max(0, car.speed - 300 * step);
    } else if (d < 14) {
      // Arrived: pick the next leg, pause briefly at the junction.
      car.ix = car.nextIx;
      car.iy = car.nextIy;
      const [nx, ny] = chooseNext(car.nextIx, car.nextIy, car.fromIx, car.fromIy, rand);
      car.fromIx = car.ix;
      car.fromIy = car.iy;
      car.nextIx = nx;
      car.nextIy = ny;
      car.wait = 0.25 + rand.next() * 1.25;
    } else {
      const want = Math.atan2(dy, dx);
      let diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turn = Math.max(-2.4 * step, Math.min(2.4 * step, diff));
      car.angle += turn;
      // Ease into the cruise speed, slow down for sharp turns.
      const targetSpeed = car.cruise * (Math.abs(diff) > 0.6 ? 0.45 : 1);
      if (car.speed < targetSpeed) car.speed = Math.min(targetSpeed, car.speed + 220 * step);
      else car.speed = Math.max(targetSpeed, car.speed - 320 * step);
      car.x += Math.cos(car.angle) * car.speed * step;
      car.y += Math.sin(car.angle) * car.speed * step;
    }
    car.wobble += step * 2;
  }

  for (const ped of traffic.peds || []) {
    if (ped.down) continue;
    if (ped.panic > 0) ped.panic -= step;
    if (ped.wait > 0) {
      ped.wait -= step;
      continue;
    }
    const dx = ped.targetX - ped.x;
    const dy = ped.targetY - ped.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 10) {
      // Pick a new nearby stroll target and pause a moment.
      ped.targetX = ped.x + (rand.next() - 0.5) * 420;
      ped.targetY = ped.y + (rand.next() - 0.5) * 420;
      ped.targetX = Math.max(60, Math.min(2820, ped.targetX));
      ped.targetY = Math.max(60, Math.min(2000, ped.targetY));
      ped.wait = 0.5 + rand.next() * 2.5;
      continue;
    }
    const want = Math.atan2(dy, dx);
    ped.angle = want;
    const speed = ped.speed * (ped.panic > 0 ? 2.4 : 1);
    ped.x += Math.cos(ped.angle) * speed * step;
    ped.y += Math.sin(ped.angle) * speed * step;
    ped.stepPhase += step * (ped.panic > 0 ? 14 : 7);
    if (city && city.resolveCircle) city.resolveCircle(ped, 9);
  }
}

// Nearest traffic car within maxDist of (x, y), or null.
export function nearestTrafficCar(traffic, x, y, maxDist) {
  if (!traffic || !traffic.cars) return null;
  const limit = maxDist != null ? maxDist : 90;
  let best = null;
  let bestD = Infinity;
  for (const car of traffic.cars) {
    const dx = car.x - x;
    const dy = car.y - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestD && d <= limit) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export default {
  createTraffic,
  stepTraffic,
  nearestTrafficCar,
};
