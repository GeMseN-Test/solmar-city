// traffic.js — ambient cars and pedestrians driving/walking the grid.
// Cars follow road nodes; pedestrians wander the sidewalks.

import { TRAFFIC_CARS, PEDESTRIANS, ROADS_X, ROADS_Y } from './config.js';
import { randRange, randInt, pick } from './random.js';
import { clamp, dist } from './util.js';

export const CAR_MODELS = ['sedan', 'van', 'taxi', 'truck', 'sport'];
const CAR_COLORS = ['#c0392b', '#2980b9', '#f1c40f', '#7f8c8d', '#27ae60', '#8e44ad', '#e67e22', '#ecf0f1', '#2c3e50'];
const TAXI_COLOR = '#f7dc1e';
const SHIRTS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#ecf0f1', '#34495e'];
const SKINS = ['#e8b98a', '#c98d5f', '#8a5a3b', '#f0c8a0', '#a06b42'];

function randomCar(rng, city) {
  const node = city.nearestNode(randRange(rng, 0, 2880), randRange(rng, 0, 2000));
  const model = pick(rng, CAR_MODELS);
  const next = pick(rng, city.nodeNeighbours(node.ix, node.iy)) || { ix: node.ix, iy: node.iy };
  const pt = city.nodePoint(node.ix, node.iy);
  const npt = city.nodePoint(next.ix, next.iy);
  return {
    kind: 'traffic',
    x: pt.x,
    y: pt.y,
    angle: Math.atan2(npt.y - pt.y, npt.x - pt.x),
    speed: 0,
    cruise: randRange(rng, 90, 170),
    color: model === 'taxi' ? TAXI_COLOR : pick(rng, CAR_COLORS),
    model,
    ix: node.ix,
    iy: node.iy,
    fromIx: node.ix,
    fromIy: node.iy,
    nextIx: next.ix,
    nextIy: next.iy,
    wait: 0,
    wobble: randRange(rng, 0, Math.PI * 2),
  };
}

function randomPed(rng, city) {
  const p = city.randomStreetPoint(rng);
  const t = city.randomStreetPoint(rng);
  return {
    x: p.x + randRange(rng, -30, 30),
    y: p.y + randRange(rng, -30, 30),
    angle: randRange(rng, 0, Math.PI * 2),
    speed: randRange(rng, 28, 62),
    shirt: pick(rng, SHIRTS),
    skin: pick(rng, SKINS),
    targetX: t.x,
    targetY: t.y,
    wait: 0,
    down: false,
    panic: 0,
    stepPhase: randRange(rng, 0, Math.PI * 2),
  };
}

export function createTraffic(rng, city) {
  const cars = [];
  for (let i = 0; i < TRAFFIC_CARS; i += 1) cars.push(randomCar(rng, city));
  const peds = [];
  for (let i = 0; i < PEDESTRIANS; i += 1) peds.push(randomPed(rng, city));
  return { cars, peds };
}

export function nearestTrafficCar(traffic, x, y, maxDist) {
  const cars = traffic.cars || [];
  let best = null;
  let bestD = maxDist === undefined ? 90 : maxDist;
  for (const c of cars) {
    const d = dist(c.x, c.y, x, y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function nearestPed(traffic, x, y, maxDist) {
  const peds = traffic.peds || [];
  let best = null;
  let bestD = maxDist === undefined ? 60 : maxDist;
  for (const p of peds) {
    if (p.down) continue;
    const d = dist(p.x, p.y, x, y);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

export function stepTraffic(traffic, city, rng, dt) {
  const total = Math.max(0.001, dt || 0.016);
  const n = Math.max(1, Math.ceil(total / 0.05));
  const sub = total / n;
  for (let i = 0; i < n; i += 1) stepTrafficOnce(traffic, city, rng, sub);
}

function stepTrafficOnce(traffic, city, rng, step) {
  for (const car of traffic.cars) {
    if (car.wait > 0) {
      car.wait -= step;
      continue;
    }
    const target = city.nodePoint(car.nextIx, car.nextIy);
    const dx = target.x - car.x;
    const dy = target.y - car.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += clamp(diff, -2.2 * step, 2.2 * step);
    car.speed += (car.cruise - car.speed) * Math.min(1, 2 * step);
    car.x += Math.cos(car.angle) * car.speed * step;
    car.y += Math.sin(car.angle) * car.speed * step;
    if (d < 14) {
      car.fromIx = car.nextIx;
      car.fromIy = car.nextIy;
      const options = city.nodeNeighbours(car.nextIx, car.nextIy).filter(
        (n) => !(n.ix === car.fromIx && n.iy === car.fromIy) || city.nodeNeighbours(car.nextIx, car.nextIy).length === 1,
      );
      const next = options.length > 0 ? pick(rng, options) : city.nodeNeighbours(car.nextIx, car.nextIy)[0];
      if (next) {
        car.nextIx = next.ix;
        car.nextIy = next.iy;
      }
      if (rng.next() < 0.06) car.wait = randRange(rng, 0.4, 1.4);
    }
    car.x = clamp(car.x, 40, 2840);
    car.y = clamp(car.y, 40, 2000);
  }

  for (const ped of traffic.peds) {
    if (ped.down) continue;
    if (ped.wait > 0) {
      ped.wait -= step;
      continue;
    }
    const speed = ped.panic > 0 ? ped.speed * 2.2 : ped.speed;
    const dx = ped.targetX - ped.x;
    const dy = ped.targetY - ped.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 12) {
      const t = city.randomStreetPoint(rng);
      ped.targetX = t.x;
      ped.targetY = t.y;
      ped.wait = randRange(rng, 0.5, 3);
      continue;
    }
    ped.angle = Math.atan2(dy, dx);
    ped.x += Math.cos(ped.angle) * speed * step;
    ped.y += Math.sin(ped.angle) * speed * step;
    ped.stepPhase += step * 9;
    if (ped.panic > 0) ped.panic -= step;
    ped.x = clamp(ped.x, 40, 2840);
    ped.y = clamp(ped.y, 40, 2000);
  }
  void randInt;
  void ROADS_X;
  void ROADS_Y;
}

export default { createTraffic, stepTraffic, nearestTrafficCar, nearestPed, CAR_MODELS };
