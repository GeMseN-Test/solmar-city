// Traffic: the cars cruising the road grid and the pedestrians
// wandering the sidewalks. Cars follow the road nodes — they pick
// a neighbouring junction each time they arrive at one — so they
// never cut across blocks. Pedestrians stroll between random
// street points.

import { TRAFFIC_CARS, PEDESTRIANS, WORLD_W, WORLD_H } from './config.js';

export const CAR_MODELS = ['sedan', 'van', 'taxi', 'truck', 'sport'];

const MODEL_SPEED = {
  sedan: 150,
  van: 130,
  taxi: 165,
  truck: 110,
  sport: 190,
};

const MODEL_COLORS = {
  sedan: ['#c23b2e', '#2e6fc2', '#d8d8d8', '#3a3a3a', '#7a4a9e'],
  van: ['#e8e8e8', '#5a6b7a', '#b8a06a'],
  taxi: ['#f5c518'],
  truck: ['#4a7a3a', '#8a6a3a', '#5a5a5a'],
  sport: ['#e03232', '#ffd60a', '#2f7fe0', '#111111'],
};

const SHIRTS = ['#e8e8e8', '#c23b2e', '#2e6fc2', '#3a9e4a', '#e0a02e', '#7a4a9e', '#2e9e9e', '#d86a9e'];
const SKINS = ['#e8b98a', '#c98d5f', '#8a5a3b', '#f0c8a0'];

function draw(rng) {
  if (typeof rng === 'function') return rng();
  if (rng && typeof rng.next === 'function') return rng.next();
  return Math.random();
}

function makeCar(rng, city) {
  const node = city.nearestNode(
    180 + draw(rng) * (WORLD_W - 360),
    180 + draw(rng) * (WORLD_H - 360),
  );
  const neighbours = city.nodeNeighbours(node.ix, node.iy);
  const next = neighbours[Math.floor(draw(rng) * neighbours.length)];
  const model = CAR_MODELS[Math.floor(draw(rng) * CAR_MODELS.length)];
  const colors = MODEL_COLORS[model];
  const point = city.nodePoint(node.ix, node.iy);
  const target = city.nodePoint(next.ix, next.iy);
  return {
    kind: 'traffic',
    x: point.x,
    y: point.y,
    angle: Math.atan2(target.y - point.y, target.x - point.x),
    speed: 0,
    cruise: MODEL_SPEED[model] * (0.85 + draw(rng) * 0.3),
    color: colors[Math.floor(draw(rng) * colors.length)],
    model,
    ix: node.ix,
    iy: node.iy,
    fromIx: node.ix,
    fromIy: node.iy,
    nextIx: next.ix,
    nextIy: next.iy,
    wait: draw(rng) * 1.5,
    wobble: draw(rng) * Math.PI * 2,
  };
}

function makePed(rng, city) {
  const at = city.randomStreetPoint(rng);
  const to = city.randomStreetPoint(rng);
  return {
    x: at.x,
    y: at.y,
    angle: Math.atan2(to.y - at.y, to.x - at.x),
    speed: 42 + draw(rng) * 38,
    shirt: SHIRTS[Math.floor(draw(rng) * SHIRTS.length)],
    skin: SKINS[Math.floor(draw(rng) * SKINS.length)],
    targetX: to.x,
    targetY: to.y,
    wait: 0,
    down: false,
    panic: false,
    stepPhase: draw(rng) * Math.PI * 2,
  };
}

export function createTraffic(rng, city) {
  const cars = [];
  for (let i = 0; i < TRAFFIC_CARS; i += 1) cars.push(makeCar(rng, city));
  const peds = [];
  for (let i = 0; i < PEDESTRIANS; i += 1) peds.push(makePed(rng, city));
  return { cars, peds };
}

function stepCar(car, city, rng, h) {
  if (car.wait > 0) {
    car.wait -= h;
    car.speed = 0;
    return;
  }
  const target = city.nodePoint(car.nextIx, car.nextIy);
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const wantAngle = Math.atan2(dy, dx);
  // Ease the nose toward the road ahead, then roll.
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.4 * h, Math.min(2.4 * h, diff));
  car.wobble += h * 2;
  const wob = Math.sin(car.wobble) * 0.05;
  car.speed = car.cruise;
  car.x += Math.cos(car.angle + wob) * car.speed * h;
  car.y += Math.sin(car.angle + wob) * car.speed * h;
  if (d < 14) {
    car.fromIx = car.ix;
    car.fromIy = car.iy;
    car.ix = car.nextIx;
    car.iy = car.nextIy;
    const options = city.nodeNeighbours(car.ix, car.iy);
    const next = options[Math.floor(draw(rng) * options.length)];
    car.nextIx = next.ix;
    car.nextIy = next.iy;
    const np = city.nodePoint(next.ix, next.iy);
    car.angle = Math.atan2(np.y - car.y, np.x - car.x);
    car.x = city.nodePoint(car.ix, car.iy).x;
    car.y = city.nodePoint(car.ix, car.iy).y;
    if (draw(rng) < 0.18) car.wait = 0.5 + draw(rng) * 1.2;
  }
}

function stepPed(ped, city, rng, h) {
  if (ped.wait > 0) {
    ped.wait -= h;
    return;
  }
  const dx = ped.targetX - ped.x;
  const dy = ped.targetY - ped.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 10) {
    if (draw(rng) < 0.25) {
      ped.wait = 1 + draw(rng) * 3;
      return;
    }
    const to = city.randomStreetPoint(rng);
    ped.targetX = to.x;
    ped.targetY = to.y;
    return;
  }
  ped.angle = Math.atan2(dy, dx);
  ped.x += Math.cos(ped.angle) * ped.speed * h;
  ped.y += Math.sin(ped.angle) * ped.speed * h;
  ped.stepPhase += h * ped.speed * 0.09;
}

// Move every car and pedestrian one frame. Large dt is split so
// a hitch never teleports a car past a junction.
export function stepTraffic(traffic, city, rng, dt) {
  let remaining = dt;
  while (remaining > 0) {
    const h = Math.min(remaining, 1 / 30);
    remaining -= h;
    for (const car of traffic.cars) stepCar(car, city, rng, h);
    for (const ped of traffic.peds) {
      if (!ped.down) stepPed(ped, city, rng, h);
    }
  }
}

// Nearest traffic car within maxDist of (x, y), or null.
export function nearestTrafficCar(traffic, x, y, maxDist) {
  const limit = maxDist !== undefined ? maxDist : 80;
  let best = null;
  let bestD = limit;
  for (const car of traffic.cars) {
    const dx = car.x - x;
    const dy = car.y - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}
