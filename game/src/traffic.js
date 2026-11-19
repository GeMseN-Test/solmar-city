// traffic.js — the other cars on the road and the people on the
// sidewalks. Traffic cars drive from intersection to intersection
// along the street grid; pedestrians stroll to a target, wait a
// while, then stroll somewhere else — and panic-run when a car
// (or the player) comes at them.

import { TRAFFIC_CARS, PEDESTRIANS } from './config.js';
import { clamp, dist } from './util.js';
import { randRange, pick } from './random.js';

export const CAR_MODELS = ['sedan', 'van', 'taxi', 'truck', 'sport'];

const CAR_COLORS = [
  '#c23b2e', '#2e6dc2', '#e8c832', '#3aa655', '#e8e8e8',
  '#7a4fd0', '#d06a2e', '#3aa6a0', '#b8b8b8', '#222831',
];
const SHIRTS = [
  '#e8e8e8', '#3a6dc2', '#c23b2e', '#3aa655', '#e8c832',
  '#7a4fd0', '#d06a2e', '#8a8a8a', '#2a9d8f', '#e76f51',
];
const SKIN_TONES = ['#e8b98a', '#c98d5f', '#8a5a33', '#f0c8a0', '#a06a42'];

function randomNode(rng, city) {
  return {
    ix: Math.floor(rng() * city.nodeCountX),
    iy: Math.floor(rng() * city.nodeCountY),
  };
}

export function createTraffic(rng, city) {
  const cars = [];
  for (let i = 0; i < TRAFFIC_CARS; i++) {
    const from = randomNode(rng, city);
    let next = randomNode(rng, city);
    while (next.ix === from.ix && next.iy === from.iy) {
      next = randomNode(rng, city);
    }
    const fromPt = city.nodePoint(from.ix, from.iy);
    const model = pick(rng, CAR_MODELS);
    const cruise = model === 'sport' ? randRange(rng, 200, 260)
      : model === 'truck' ? randRange(rng, 110, 150)
      : randRange(rng, 140, 200);
    cars.push({
      kind: 'traffic',
      x: fromPt.x + randRange(rng, -20, 20),
      y: fromPt.y + randRange(rng, -20, 20),
      angle: randRange(rng, 0, Math.PI * 2),
      speed: 0,
      cruise,
      color: model === 'taxi' ? '#e8c832' : pick(rng, CAR_COLORS),
      model,
      ix: from.ix,
      iy: from.iy,
      fromIx: from.ix,
      fromIy: from.iy,
      nextIx: next.ix,
      nextIy: next.iy,
      wait: randRange(rng, 0, 1.5),
      wobble: randRange(rng, 0, Math.PI * 2),
    });
  }

  const peds = [];
  for (let i = 0; i < PEDESTRIANS; i++) {
    const pt = city.randomStreetPoint(rng);
    const target = city.randomStreetPoint(rng);
    peds.push({
      x: pt.x + randRange(rng, -30, 30),
      y: pt.y + randRange(rng, -30, 30),
      angle: randRange(rng, 0, Math.PI * 2),
      speed: randRange(rng, 28, 55),
      shirt: pick(rng, SHIRTS),
      skin: pick(rng, SKIN_TONES),
      targetX: target.x,
      targetY: target.y,
      wait: randRange(rng, 0, 3),
      down: false,
      panic: 0,
      stepPhase: randRange(rng, 0, Math.PI * 2),
    });
  }

  return { cars, peds };
}

// Nearest traffic car within maxDist of (x, y), or null.
export function nearestTrafficCar(traffic, x, y, maxDist) {
  const cars = traffic.cars || [];
  let best = null;
  let bestD = maxDist !== undefined ? maxDist : 90;
  for (const car of cars) {
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function pickNextNode(rng, city, car) {
  const options = city.nodeNeighbours(car.nextIx, car.nextIy);
  // Prefer not to U-turn straight back where we came from.
  const forward = options.filter((n) => !(n.ix === car.fromIx && n.iy === car.fromIy));
  const choice = pick(rng, forward.length ? forward : options) || options[0];
  car.fromIx = car.nextIx;
  car.fromIy = car.nextIy;
  car.nextIx = choice.ix;
  car.nextIy = choice.iy;
}

export function stepTraffic(traffic, city, rng, dt) {
  let remaining = dt;
  while (remaining > 0) {
    const chunk = Math.min(remaining, 0.05);
    stepTrafficOnce(traffic, city, rng, chunk);
    remaining -= chunk;
  }
}

function stepTrafficOnce(traffic, city, rng, dt) {
  const step = Math.min(dt, 0.05);
  for (const car of traffic.cars) {
    if (car.wait > 0) {
      car.wait -= step;
      car.speed = Math.max(0, car.speed - 300 * step);
      continue;
    }
    const dest = city.nodePoint(car.nextIx, car.nextIy);
    const d = dist(car.x, car.y, dest.x, dest.y);
    if (d < 14) {
      // Reached the intersection: pause briefly, then pick a road.
      car.ix = car.nextIx;
      car.iy = car.nextIy;
      pickNextNode(rng, city, car);
      if (rng() < 0.3) car.wait = randRange(rng, 0.4, 1.6);
      continue;
    }
    const targetAngle = Math.atan2(dest.y - car.y, dest.x - car.x);
    let diff = targetAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += clamp(diff, -2.2 * step, 2.2 * step);
    car.speed += (car.cruise - car.speed) * Math.min(1, 1.6 * step);
    car.x += Math.cos(car.angle) * car.speed * step;
    car.y += Math.sin(car.angle) * car.speed * step;
    car.wobble += step * 2;
  }

  for (const ped of traffic.peds) {
    if (ped.down) continue;
    if (ped.panic > 0) {
      ped.panic -= step;
      ped.x += Math.cos(ped.angle) * 150 * step;
      ped.y += Math.sin(ped.angle) * 150 * step;
      ped.stepPhase += step * 14;
      continue;
    }
    if (ped.wait > 0) {
      ped.wait -= step;
      continue;
    }
    const d = dist(ped.x, ped.y, ped.targetX, ped.targetY);
    if (d < 16) {
      const target = city.randomStreetPoint(rng);
      ped.targetX = target.x;
      ped.targetY = target.y;
      ped.wait = randRange(rng, 1, 5);
      continue;
    }
    const targetAngle = Math.atan2(ped.targetY - ped.y, ped.targetX - ped.x);
    ped.angle = targetAngle;
    ped.x += Math.cos(targetAngle) * ped.speed * step;
    ped.y += Math.sin(targetAngle) * ped.speed * step;
    ped.stepPhase += step * 7;
    if (city && city.resolveCircle) city.resolveCircle(ped, 8);
    ped.x = clamp(ped.x, 16, 2864);
    ped.y = clamp(ped.y, 16, 2096);
  }
}

export default createTraffic;
