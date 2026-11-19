// Traffic for Solmar City: 16 cars driving the road grid and 34
// pedestrians strolling the streets. Cars follow grid nodes — pick a
// neighbouring node, drive to it, pick again — so they always stay on
// roads and never cut through buildings. Pedestrians pick random
// street points and walk to them, panicking (running) when a car or a
// gunshot gets too close.

import { TRAFFIC_CARS, PEDESTRIANS } from './config.js';
import { clamp, dist, wrapAngle, angleDiff } from './util.js';

export const CAR_MODELS = ['sedan', 'van', 'taxi', 'truck', 'sport'];

const CAR_COLORS = [
  '#c23b2e', '#2e6fc2', '#d8a72e', '#3f8f5f', '#7a4fa3',
  '#c2c2c2', '#2e2e2e', '#d86a2e', '#4fa3a3', '#a3b82e',
];

const SHIRT_COLORS = [
  '#d84f4f', '#4f7dd8', '#4fd88a', '#d8c84f', '#8a4fd8',
  '#d88a4f', '#4fd8d8', '#e2e2e2', '#3a3a3a', '#d84f9e',
];

const SKIN_TONES = ['#e8b98d', '#c98d5f', '#8d5a3b', '#f0c8a0', '#a06a42'];

function randomCar(rng, city) {
  const node = {
    ix: rng.int(0, city.nodeCountX - 1),
    iy: rng.int(0, city.nodeCountY - 1),
  };
  const pt = city.nodePoint(node.ix, node.iy);
  const neighbours = city.nodeNeighbours(node.ix, node.iy);
  const next = rng.pick(neighbours);
  const model = rng.pick(CAR_MODELS);
  const cruise = model === 'sport' ? rng.float(150, 190)
    : model === 'truck' ? rng.float(80, 105)
    : rng.float(105, 145);
  return {
    kind: 'traffic',
    x: pt.x + rng.float(-14, 14),
    y: pt.y + rng.float(-14, 14),
    angle: Math.atan2(
      city.nodePoint(next.ix, next.iy).y - pt.y,
      city.nodePoint(next.ix, next.iy).x - pt.x,
    ),
    speed: cruise * rng.float(0.7, 1),
    cruise,
    color: model === 'taxi' ? '#f2c230' : rng.pick(CAR_COLORS),
    model,
    ix: node.ix,
    iy: node.iy,
    fromIx: node.ix,
    fromIy: node.iy,
    nextIx: next.ix,
    nextIy: next.iy,
    wait: 0,
    wobble: rng.float(0, Math.PI * 2),
  };
}

function randomPed(rng, city) {
  const pt = city.randomStreetPoint(rng);
  const target = city.randomStreetPoint(rng);
  return {
    x: pt.x + rng.float(-24, 24),
    y: pt.y + rng.float(-24, 24),
    angle: rng.float(0, Math.PI * 2),
    speed: rng.float(28, 55),
    shirt: rng.pick(SHIRT_COLORS),
    skin: rng.pick(SKIN_TONES),
    targetX: target.x,
    targetY: target.y,
    wait: rng.float(0, 2),
    down: false,
    panic: 0,
    stepPhase: rng.float(0, Math.PI * 2),
  };
}

export function createTraffic(rng, city) {
  const cars = [];
  const peds = [];
  for (let i = 0; i < TRAFFIC_CARS; i++) cars.push(randomCar(rng, city));
  for (let i = 0; i < PEDESTRIANS; i++) peds.push(randomPed(rng, city));
  return { cars, peds };
}

export function nearestTrafficCar(traffic, x, y, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of traffic.cars) {
    const dx = car.x - x;
    const dy = car.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD) {
      bestD = d2;
      best = car;
    }
  }
  return best;
}

function stepCar(car, city, rng, dt) {
  if (car.wait > 0) {
    car.wait -= dt;
    return;
  }
  const target = city.nodePoint(car.nextIx, car.nextIy);
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const d = Math.hypot(dx, dy);
  if (d < 12) {
    // Reached the node: continue to a new neighbour (never U-turn
    // straight back unless it is the only way out).
    const options = city.nodeNeighbours(car.nextIx, car.nextIy)
      .filter((n) => !(n.ix === car.fromIx && n.iy === car.fromIy));
    const pool = options.length > 0
      ? options
      : city.nodeNeighbours(car.nextIx, car.nextIy);
    const next = rng.pick(pool);
    car.fromIx = car.nextIx;
    car.fromIy = car.nextIy;
    car.nextIx = next.ix;
    car.nextIy = next.iy;
    if (rng.chance(0.08)) car.wait = rng.float(0.5, 1.5);
    return;
  }
  const wantAngle = Math.atan2(dy, dx);
  const turn = clamp(angleDiff(car.angle, wantAngle), -2.2 * dt, 2.2 * dt);
  car.angle = wrapAngle(car.angle + turn);
  car.speed += (car.cruise - car.speed) * Math.min(1, dt * 0.8);
  // A gentle wobble keeps cars off the exact centre line.
  car.wobble += dt * 0.7;
  const lateral = Math.sin(car.wobble) * 6;
  const px = -Math.sin(car.angle);
  const py = Math.cos(car.angle);
  car.x += Math.cos(car.angle) * car.speed * dt + px * lateral * dt;
  car.y += Math.sin(car.angle) * car.speed * dt + py * lateral * dt;
}

function stepPed(ped, city, rng, dt, danger) {
  if (ped.down) return;
  ped.stepPhase += dt * 6;
  if (danger) ped.panic = Math.max(ped.panic, 2.5);
  if (ped.panic > 0) ped.panic -= dt;
  if (ped.wait > 0) {
    ped.wait -= dt;
    return;
  }
  const d = dist(ped.x, ped.y, ped.targetX, ped.targetY);
  if (d < 10) {
    const next = city.randomStreetPoint(rng);
    ped.targetX = next.x;
    ped.targetY = next.y;
    ped.wait = rng.float(0, 3);
    return;
  }
  const speed = ped.panic > 0 ? ped.speed * 2.6 : ped.speed;
  const wantAngle = Math.atan2(ped.targetY - ped.y, ped.targetX - ped.x);
  ped.angle = wrapAngle(ped.angle + clamp(angleDiff(ped.angle, wantAngle), -3 * dt, 3 * dt));
  ped.x += Math.cos(ped.angle) * speed * dt;
  ped.y += Math.sin(ped.angle) * speed * dt;
  const fixed = city.resolveCircle(ped.x, ped.y, 8);
  ped.x = fixed.x;
  ped.y = clamp(fixed.y, 0, 2010);
}

// One traffic tick. `danger` is an optional {x, y} point (a gunshot,
// a speeding car) that makes nearby pedestrians panic and run.
export function stepTraffic(traffic, city, rng, dt, danger) {
  for (const car of traffic.cars) stepCar(car, city, rng, dt);
  for (const ped of traffic.peds) {
    const nearDanger = danger && dist(ped.x, ped.y, danger.x, danger.y) < 260;
    stepPed(ped, city, rng, dt, nearDanger);
  }
}

export default createTraffic;
