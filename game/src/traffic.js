// Solmar City's traffic: cars that cruise the road grid and pedestrians
// who stroll the sidewalks. Both are simple and predictable on purpose —
// the grid gives them somewhere sensible to go, and the player reads them
// at a glance as "city life" rather than as obstacles with opinions.
//
// Traffic cars drive from intersection to intersection along the roads.
// Pedestrians pick a nearby sidewalk spot, walk to it, and pick another.

import { TRAFFIC_CARS, PEDESTRIANS } from './config.js';
import { clampNumber, distanceBetween } from './util.js';

const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8c93d', '#7dd93d', '#d9d9d9', '#8a5fd9', '#e88a3d', '#3dd9c4'];
const CAR_MODELS = ['sedan', 'sedan', 'sedan', 'taxi', 'van', 'sport'];
const PED_SHIRTS = ['#e86a6a', '#6aa8e8', '#e8c96a', '#7ac76a', '#c96ad8', '#e8e8e8', '#6ad8c9', '#e89a4d'];
const PED_SKINS = ['#e8b98a', '#c98a5a', '#8a5a3a', '#f2c9a0'];

function pickNextNode(rng, city, ix, iy, fromIx, fromIy) {
  const options = city.nodeNeighbours(ix, iy).filter((n) => !(n.ix === fromIx && n.iy === fromIy));
  const pool = options.length > 0 ? options : city.nodeNeighbours(ix, iy);
  return rng.pick(pool);
}

function makeTrafficCar(rng, city) {
  const node = { ix: rng.int(0, city.nodeCountX - 1), iy: rng.int(0, city.nodeCountY - 1) };
  const from = { ix: node.ix, iy: node.iy };
  const next = pickNextNode(rng, city, node.ix, node.iy, -1, -1);
  const at = city.nodePoint(node.ix, node.iy);
  const model = rng.pick(CAR_MODELS);
  return {
    kind: 'traffic',
    x: at.x,
    y: at.y,
    angle: Math.atan2(city.nodePoint(next.ix, next.iy).y - at.y, city.nodePoint(next.ix, next.iy).x - at.x),
    speed: rng.range(120, 185),
    cruise: rng.range(120, 185),
    color: model === 'taxi' ? '#f2c93d' : rng.pick(CAR_COLORS),
    model,
    ix: node.ix,
    iy: node.iy,
    fromIx: from.ix,
    fromIy: from.iy,
    nextIx: next.ix,
    nextIy: next.iy,
    wait: rng.range(0, 1.5),
    wobble: rng.range(0, Math.PI * 2),
  };
}

function makePedestrian(rng, city) {
  const street = city.randomStreetPoint(rng);
  const target = sidewalkTarget(rng, city);
  return {
    x: street.x + rng.range(-46, 46),
    y: street.y + rng.range(-46, 46),
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(38, 68),
    shirt: rng.pick(PED_SHIRTS),
    skin: rng.pick(PED_SKINS),
    targetX: target.x,
    targetY: target.y,
    wait: 0,
    down: 0,
    panic: 0,
    stepPhase: rng.range(0, Math.PI * 2),
  };
}

// A sidewalk spot: a road point nudged sideways off the asphalt.
function sidewalkTarget(rng, city) {
  const street = city.randomStreetPoint(rng);
  const onVertical = rng.chance(0.5);
  const side = rng.chance(0.5) ? 52 : -52;
  if (onVertical) return { x: street.x + side, y: clampNumber(street.y + rng.range(-160, 160), 40, 2080) };
  return { x: clampNumber(street.x + rng.range(-160, 160), 40, 2840), y: street.y + side };
}

export function createTraffic(rng, city) {
  const cars = [];
  for (let i = 0; i < TRAFFIC_CARS; i += 1) cars.push(makeTrafficCar(rng, city));
  const peds = [];
  for (let i = 0; i < PEDESTRIANS; i += 1) peds.push(makePedestrian(rng, city));
  return { cars, peds };
}

export function stepTraffic(traffic, city, rng, dt) {
  for (const car of traffic.cars) {
    if (car.wait > 0) {
      car.wait -= dt;
      continue;
    }
    const target = city.nodePoint(car.nextIx, car.nextIy);
    const dx = target.x - car.x;
    const dy = target.y - car.y;
    const dist = Math.hypot(dx, dy);
    const wantedAngle = Math.atan2(dy, dx);
    let turn = wantedAngle - car.angle;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    car.angle += clampNumber(turn, -2.4 * dt, 2.4 * dt);
    const slowNearNode = dist < 90 ? 0.55 : 1;
    const speed = car.cruise * slowNearNode;
    car.x += Math.cos(car.angle) * speed * dt;
    car.y += Math.sin(car.angle) * speed * dt;
    if (dist < 14) {
      const arrived = { ix: car.nextIx, iy: car.nextIy };
      const next = pickNextNode(rng, city, arrived.ix, arrived.iy, car.ix, car.iy);
      car.fromIx = car.ix;
      car.fromIy = car.iy;
      car.ix = arrived.ix;
      car.iy = arrived.iy;
      car.nextIx = next.ix;
      car.nextIy = next.iy;
      if (rng.chance(0.22)) car.wait = rng.range(0.8, 2.2);
    }
  }

  for (const ped of traffic.peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      continue;
    }
    if (ped.wait > 0) {
      ped.wait -= dt;
      continue;
    }
    const speed = ped.panic > 0 ? ped.speed * 2.1 : ped.speed;
    const dx = ped.targetX - ped.x;
    const dy = ped.targetY - ped.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 12) {
      const target = sidewalkTarget(rng, city);
      ped.targetX = target.x;
      ped.targetY = target.y;
      if (rng.chance(0.3)) ped.wait = rng.range(1, 4);
      continue;
    }
    const wantedAngle = Math.atan2(dy, dx);
    ped.angle = wantedAngle;
    ped.x += Math.cos(wantedAngle) * speed * dt;
    ped.y += Math.sin(wantedAngle) * speed * dt;
    ped.stepPhase += dt * (ped.panic > 0 ? 14 : 8);
    if (ped.panic > 0) ped.panic -= dt;
    city.resolveCircle(ped, 9);
  }
}

/** The nearest traffic car within `radius` of a point, or null. */
export function nearestTrafficCar(traffic, x, y, radius) {
  let best = null;
  let bestD = radius;
  for (const car of traffic.cars) {
    const d = distanceBetween(x, y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}
