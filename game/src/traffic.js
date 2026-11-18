// traffic.js — the city's moving parts: cars on the roads, people on
// the sidewalks.
//
// Traffic cars drive the road grid node to node (see city.js): each car
// has the intersection it is at, the one it came from, and the one it
// is heading for. At an intersection it picks a new neighbour to drive
// to — never straight back the way it came unless the road ends — and
// sometimes waits a beat, the way real drivers dither at a junction.
// Pedestrians stroll between random street points, wait a while, then
// pick somewhere new; they run when a car gets too close, and they stay
// down a while when one hits them.
//
//   createTraffic(rng, city) -> { cars: [...], peds: [...] }
//   stepTraffic(traffic, city, rng, dt)
//   nearestTrafficCar(traffic, x, y, maxDist) -> car or null
//
// A car: { kind:'traffic', x, y, angle, speed, cruise, color, model,
//   ix, iy, fromIx, fromIy, nextIx, nextIy, wait, wobble }.
// A pedestrian: { x, y, angle, speed, shirt, skin, targetX, targetY,
//   wait, down, panic, stepPhase }.

import { PEDESTRIANS, TRAFFIC_CARS } from './config.js';
import { clampNumber, distanceBetween, turnToward } from './util.js';

const CAR_COLORS = ['#e88a3d', '#3dd9c4', '#e85d75', '#7a8fe8', '#c9c9c9', '#5ab85a', '#e8e8e8'];
const TAXI_COLOR = '#f2c93d';
const MODELS = ['sedan', 'sedan', 'sedan', 'van', 'taxi', 'truck', 'sport'];
const SHIRTS = ['#6aa8e8', '#e86a6a', '#6ae88a', '#e8d26a', '#c98ae8', '#e8e8e8', '#e8a06a'];
const SKINS = ['#c98a5a', '#e8b98a', '#8a5a3a', '#f0c8a0'];

// How fast each model likes to cruise, in px per second.
const MODEL_CRUISE = {
  sedan: [130, 170],
  van: [110, 140],
  taxi: [130, 170],
  truck: [100, 130],
  sport: [170, 205],
};

export function createTraffic(rng, city) {
  const cars = [];
  for (let i = 0; i < TRAFFIC_CARS; i++) {
    cars.push(makeCar(rng, city));
  }
  const peds = [];
  for (let i = 0; i < PEDESTRIANS; i++) {
    peds.push(makePedestrian(rng, city));
  }
  return { cars, peds };
}

function makeCar(rng, city) {
  const model = rng.pick(MODELS);
  const ix = rng.int(0, city.nodeCountX - 1);
  const iy = rng.int(0, city.nodeCountY - 1);
  const from = { ix, iy };
  const next = pickNextNode(rng, city, from, null);
  const start = city.nodePoint(ix, iy);
  const target = city.nodePoint(next.ix, next.iy);
  const [low, high] = MODEL_CRUISE[model] || MODEL_CRUISE.sedan;
  const cruise = rng.range(low, high);
  return {
    kind: 'traffic',
    x: start.x,
    y: start.y,
    angle: Math.atan2(target.y - start.y, target.x - start.x),
    speed: cruise * rng.range(0.8, 1.2),
    cruise,
    color: model === 'taxi' ? TAXI_COLOR : rng.pick(CAR_COLORS),
    model,
    ix,
    iy,
    fromIx: from.ix,
    fromIy: from.iy,
    nextIx: next.ix,
    nextIy: next.iy,
    wait: rng.next() * 1.5,
    wobble: rng.next() * Math.PI * 2,
  };
}

function makePedestrian(rng, city) {
  const spot = city.randomStreetPoint(rng);
  const target = city.randomStreetPoint(rng);
  return {
    x: spot.x,
    y: spot.y,
    angle: rng.next() * Math.PI * 2,
    speed: rng.range(28, 46),
    shirt: rng.pick(SHIRTS),
    skin: rng.pick(SKINS),
    targetX: target.x,
    targetY: target.y,
    wait: rng.next() * 2,
    down: 0,
    panic: 0,
    stepPhase: rng.next() * Math.PI * 2,
  };
}

// Pick a neighbouring node to drive to next. The car never reverses
// straight back along the road it just came down, unless the junction
// leaves it no other choice.
function pickNextNode(rng, city, from, exclude) {
  const options = city.nodeNeighbours(from.ix, from.iy).filter((node) => {
    return !(exclude && node.ix === exclude.ix && node.iy === exclude.iy);
  });
  const pool = options.length > 0 ? options : city.nodeNeighbours(from.ix, from.iy);
  return rng.pick(pool);
}

export function stepTraffic(traffic, city, rng, dt) {
  for (const car of traffic.cars) stepCar(car, city, rng, dt);
  for (const ped of traffic.peds) stepPedestrian(ped, traffic, city, rng, dt);
}

function stepCar(car, city, rng, dt) {
  car.wobble += dt * 2;
  if (car.wait > 0) {
    car.wait -= dt;
    car.speed = Math.max(0, car.speed - 200 * dt);
    return;
  }
  const target = city.nodePoint(car.nextIx, car.nextIy);
  const dist = distanceBetween(car.x, car.y, target.x, target.y);
  if (dist < 10) {
    // Arrived: the node just left becomes "from", the target becomes
    // home, and a new road is chosen — never straight back the way the
    // car came, unless the junction leaves no other choice.
    const cameFrom = { ix: car.ix, iy: car.iy };
    car.fromIx = car.ix;
    car.fromIy = car.iy;
    car.ix = car.nextIx;
    car.iy = car.nextIy;
    const next = pickNextNode(rng, city, { ix: car.ix, iy: car.iy }, cameFrom);
    car.nextIx = next.ix;
    car.nextIy = next.iy;
    if (rng.chance(0.25)) car.wait = rng.range(0.5, 2);
    return;
  }
  const heading = Math.atan2(target.y - car.y, target.x - car.x);
  car.angle = turnToward(car.angle, heading, 3.5 * dt);
  // Ease toward the cruising speed, faster when far below it.
  const gap = car.cruise - car.speed;
  car.speed = clampNumber(car.speed + clampNumber(gap, -160 * dt, 120 * dt), 0, 260);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

function stepPedestrian(ped, traffic, city, rng, dt) {
  if (ped.down > 0) {
    // Knocked down: stay put until the timer runs out.
    ped.down -= dt;
    return;
  }
  if (ped.panic > 0) ped.panic -= dt;
  if (ped.wait > 0) {
    ped.wait -= dt;
    return;
  }
  // A car bearing down sets them running.
  if (ped.panic <= 0) {
    for (const car of traffic.cars) {
      if (distanceBetween(ped.x, ped.y, car.x, car.y) < 55 && car.speed > 60) {
        ped.panic = 1.5;
        break;
      }
    }
  }
  const pace = ped.speed * (ped.panic > 0 ? 2.4 : 1);
  const dist = distanceBetween(ped.x, ped.y, ped.targetX, ped.targetY);
  if (dist < 12) {
    ped.wait = rng.range(1, 3.5);
    const next = city.randomStreetPoint(rng);
    ped.targetX = next.x;
    ped.targetY = next.y;
    return;
  }
  const heading = Math.atan2(ped.targetY - ped.y, ped.targetX - ped.x);
  ped.angle = turnToward(ped.angle, heading, 6 * dt);
  ped.x += Math.cos(ped.angle) * pace * dt;
  ped.y += Math.sin(ped.angle) * pace * dt;
  ped.stepPhase += dt * pace * 0.22;
}

// The closest traffic car to (x, y) inside maxDist, or null when the
// road is empty that far out.
export function nearestTrafficCar(traffic, x, y, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const car of traffic.cars) {
    const dist = distanceBetween(x, y, car.x, car.y);
    if (dist <= bestDist) {
      best = car;
      bestDist = dist;
    }
  }
  return best;
}
