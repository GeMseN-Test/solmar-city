// traffic.js — ambient traffic cars (16) and pedestrians (34).
// Cars drive node to node on the road grid; peds walk between random
// street points and hurry when panicked.

import { TRAFFIC_CARS, PEDESTRIANS } from './config.js';
import { clamp } from './util.js';

export const CAR_MODELS = ['sedan', 'van', 'taxi', 'truck', 'sport'];

const CAR_COLORS = [
  '#c0392b', '#2980b9', '#27ae60', '#f39c12',
  '#8e44ad', '#ecf0f1', '#2c3e50', '#e67e22',
];

const SHIRTS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6',
  '#1abc9c', '#e67e22', '#ecf0f1', '#fd79a8', '#00cec9',
];

const SKIN_TONES = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

export function createTraffic(rng, city) {
  const cars = [];
  for (let i = 0; i < TRAFFIC_CARS; i++) {
    const ix = rng.int(0, city.nodeCountX - 1);
    const iy = rng.int(0, city.nodeCountY - 1);
    const nb = city.nodeNeighbours(ix, iy);
    const next = nb.length ? rng.pick(nb) : { ix, iy };
    const pt = city.nodePoint(ix, iy);
    const model = rng.pick(CAR_MODELS);
    cars.push({
      kind: 'traffic',
      x: pt.x + rng.range(-8, 8),
      y: pt.y + rng.range(-8, 8),
      angle: rng.range(0, Math.PI * 2),
      speed: 0,
      cruise: rng.range(110, 175),
      color: model === 'taxi' ? '#f1c40f' : rng.pick(CAR_COLORS),
      model,
      ix,
      iy,
      fromIx: ix,
      fromIy: iy,
      nextIx: next.ix,
      nextIy: next.iy,
      wait: rng.range(0, 1.5),
      wobble: rng.range(0, Math.PI * 2),
    });
  }

  const peds = [];
  for (let i = 0; i < PEDESTRIANS; i++) {
    const pt = city.randomStreetPoint(rng);
    const target = city.randomStreetPoint(rng);
    peds.push({
      x: pt.x,
      y: pt.y,
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(28, 55),
      shirt: rng.pick(SHIRTS),
      skin: rng.pick(SKIN_TONES),
      targetX: target.x,
      targetY: target.y,
      wait: rng.range(0, 2),
      down: false,
      panic: 0,
      stepPhase: rng.range(0, Math.PI * 2),
    });
  }
  return { cars, peds };
}

export function nearestTrafficCar(traffic, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const c of traffic.cars) {
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export function stepTraffic(traffic, city, rng, dt) {
  for (const car of traffic.cars) {
    if (car.wait > 0) {
      car.wait -= dt;
      car.speed = 0;
      continue;
    }
    const dest = city.nodePoint(car.nextIx, car.nextIy);
    const dx = dest.x - car.x;
    const dy = dest.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d < 14) {
      // Arrived at the node: pick the next leg (no U-turn if avoidable).
      car.fromIx = car.ix;
      car.fromIy = car.iy;
      car.ix = car.nextIx;
      car.iy = car.nextIy;
      const options = city
        .nodeNeighbours(car.ix, car.iy)
        .filter((n) => !(n.ix === car.fromIx && n.iy === car.fromIy));
      const next = options.length
        ? rng.pick(options)
        : rng.pick(city.nodeNeighbours(car.ix, car.iy));
      if (next) {
        car.nextIx = next.ix;
        car.nextIy = next.iy;
      }
      if (rng.chance(0.12)) car.wait = rng.range(0.5, 2.5);
      continue;
    }
    const targetAngle = Math.atan2(dy, dx);
    car.wobble += dt * 1.7;
    const wob = Math.sin(car.wobble) * 0.05;
    let diff = targetAngle + wob - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    car.speed += (car.cruise - car.speed) * Math.min(1, 1.6 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
  }

  for (const ped of traffic.peds) {
    if (ped.down) continue;
    if (ped.panic > 0) ped.panic -= dt;
    if (ped.wait > 0) {
      ped.wait -= dt;
      continue;
    }
    const dx = ped.targetX - ped.x;
    const dy = ped.targetY - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 10) {
      const t = city.randomStreetPoint(rng);
      ped.targetX = t.x;
      ped.targetY = t.y;
      ped.wait = rng.range(0.5, 3);
      continue;
    }
    const sp = ped.speed * (ped.panic > 0 ? 1.9 : 1);
    ped.angle = Math.atan2(dy, dx);
    ped.x += Math.cos(ped.angle) * sp * dt;
    ped.y += Math.sin(ped.angle) * sp * dt;
    ped.stepPhase += dt * (sp / 14);
  }
}
