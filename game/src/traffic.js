// Traffic: cars cruising the road grid and pedestrians strolling the
// sidewalks. Cars follow the node graph; pedestrians wander between
// random street points. Nothing here fights the player — collisions
// with the player are world.step's job.
import { PEDESTRIANS, TRAFFIC_CARS } from './config.js';
import { clamp, dist } from './util.js';

export const CAR_MODELS = ['sedan', 'van', 'taxi', 'truck', 'sport'];

const MODEL_COLORS = {
  sedan: ['#b8443a', '#3a6db8', '#c9c9c9', '#4a4a4a', '#7a5a9e'],
  van: ['#d8d8d8', '#5a7a5a', '#8a6f4d'],
  taxi: ['#f5c518'],
  truck: ['#6a7a8a', '#9e6a3a', '#4a6a4a'],
  sport: ['#d21f3c', '#f5a623', '#1f9ed2', '#e8e8e8'],
};

const SHIRTS = ['#d24a4a', '#4a7ad2', '#4ad27a', '#d2a24a', '#9e4ad2', '#4ad2c9', '#e8e8e8', '#333333'];
const SKIN_TONES = ['#e8b98a', '#c98d5f', '#8a5a3b', '#f0c8a0'];

export function createTraffic(rng, city) {
  const cars = [];
  for (let i = 0; i < TRAFFIC_CARS; i++) {
    const ix = rng.int(0, city.nodeCountX - 1);
    const iy = rng.int(0, city.nodeCountY - 1);
    const at = city.nodePoint(ix, iy);
    const neighbours = city.nodeNeighbours(ix, iy);
    const next = rng.pick(neighbours);
    const model = rng.pick(CAR_MODELS);
    const cruise = model === 'sport' ? rng.range(150, 190) : rng.range(95, 140);
    cars.push({
      kind: 'traffic',
      x: at.x + rng.range(-20, 20),
      y: at.y + rng.range(-20, 20),
      angle: rng.range(0, Math.PI * 2),
      speed: cruise,
      cruise,
      color: rng.pick(MODEL_COLORS[model]),
      model,
      ix, iy,
      fromIx: ix, fromIy: iy,
      nextIx: next.ix, nextIy: next.iy,
      wait: 0,
      wobble: rng.range(0, Math.PI * 2),
    });
  }
  const peds = [];
  for (let i = 0; i < PEDESTRIANS; i++) {
    const spot = city.randomStreetPoint(rng);
    const target = city.randomStreetPoint(rng);
    peds.push({
      x: spot.x, y: spot.y,
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(28, 52),
      shirt: rng.pick(SHIRTS),
      skin: rng.pick(SKIN_TONES),
      targetX: target.x, targetY: target.y,
      wait: rng.range(0, 2),
      down: false,
      downTimer: 0,
      panic: false,
      stepPhase: rng.range(0, Math.PI * 2),
    });
  }
  return { cars, peds };
}

export function nearestTrafficCar(traffic, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of traffic.cars) {
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function stepCar(car, city, rng, dt) {
  if (car.wait > 0) {
    car.wait -= dt;
    car.speed = 0;
    return;
  }
  const target = city.nodePoint(car.nextIx, car.nextIy);
  const d = dist(car.x, car.y, target.x, target.y);
  const want = Math.atan2(target.y - car.y, target.x - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += clamp(diff, -2.2 * dt, 2.2 * dt);
  car.speed += (car.cruise - car.speed) * Math.min(1, dt * 1.5);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (d < 26) {
    car.ix = car.nextIx;
    car.iy = car.nextIy;
    car.fromIx = car.ix;
    car.fromIy = car.iy;
    const options = city.nodeNeighbours(car.ix, car.iy);
    const next = rng.pick(options);
    car.nextIx = next.ix;
    car.nextIy = next.iy;
    if (rng.chance(0.18)) car.wait = rng.range(0.5, 2.5);
  }
}

function stepPed(ped, city, rng, dt, player) {
  if (ped.down) {
    ped.downTimer -= dt;
    if (ped.downTimer <= 0) ped.down = false;
    return;
  }
  ped.stepPhase += dt * 6;
  let tx = ped.targetX;
  let ty = ped.targetY;
  let speed = ped.speed;
  if (ped.panic && player) {
    // Run away from the player for a moment.
    const away = Math.atan2(ped.y - player.y, ped.x - player.x);
    tx = ped.x + Math.cos(away) * 120;
    ty = ped.y + Math.sin(away) * 120;
    speed = ped.speed * 2.6;
  }
  if (ped.wait > 0) {
    ped.wait -= dt;
    return;
  }
  const d = dist(ped.x, ped.y, tx, ty);
  if (d < 14) {
    const spot = city.randomStreetPoint(rng);
    ped.targetX = spot.x;
    ped.targetY = spot.y;
    ped.wait = rng.range(0.5, 4);
    return;
  }
  const a = Math.atan2(ty - ped.y, tx - ped.x);
  ped.angle = a;
  ped.x += Math.cos(a) * speed * dt;
  ped.y += Math.sin(a) * speed * dt;
  const fixed = city.resolveCircle(ped.x, ped.y, 8);
  ped.x = fixed.x;
  ped.y = fixed.y;
}

export function stepTraffic(traffic, city, rng, dt, state) {
  for (const car of traffic.cars) stepCar(car, city, rng, dt);
  const player = state ? state.player : null;
  for (const ped of traffic.peds) {
    if (player && player.inCar && player.car) {
      const d = dist(ped.x, ped.y, player.x, player.y);
      ped.panic = d < 170 && Math.abs(player.car.speed) > 120;
    } else {
      ped.panic = false;
    }
    stepPed(ped, city, rng, dt, player);
  }
}
