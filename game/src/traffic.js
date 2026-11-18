// Traffic: the cars driving the road grid and the pedestrians on the
// sidewalks. Cars hop from one road node to the next; pedestrians walk
// from one random street point to another and wait a while at each end.
import { PEDESTRIANS, TRAFFIC_CARS } from './config.js';

const CAR_COLORS = ['#7a8fe8', '#e8e8e8', '#e88a3d', '#5ab85a', '#f2c93d', '#c9c9c9', '#e85d75', '#3dd9c4'];
const MODELS = ['sedan', 'van', 'taxi', 'truck', 'sport'];
const SHIRTS = ['#e86a6a', '#e8e8e8', '#6ae88a', '#c98ae8', '#6aa8e8', '#e8d26a', '#e8a06a'];
const SKINS = ['#f0c8a0', '#c98a5a', '#8a5a3a', '#e8b88a'];

// Pick a neighbouring node, preferring not to U-turn back the way we came.
function pickNextNode(rng, city, ix, iy, fromIx, fromIy) {
  const options = city.nodeNeighbours(ix, iy);
  const forward = options.filter((n) => !(n.ix === fromIx && n.iy === fromIy));
  const pool = forward.length > 0 ? forward : options;
  return rng.pick(pool);
}

export function createTraffic(rng, city) {
  const cars = [];
  for (let i = 0; i < TRAFFIC_CARS; i++) {
    const ix = rng.int(0, 8);
    const iy = rng.int(0, 6);
    const next = pickNextNode(rng, city, ix, iy, -1, -1);
    const from = city.nodePoint(ix, iy);
    const to = city.nodePoint(next.ix, next.iy);
    const cruise = rng.range(90, 145);
    cars.push({
      kind: 'traffic',
      x: from.x,
      y: from.y,
      angle: Math.atan2(to.y - from.y, to.x - from.x),
      speed: cruise * rng.range(0.9, 1),
      cruise,
      color: rng.pick(CAR_COLORS),
      model: rng.pick(MODELS),
      ix,
      iy,
      fromIx: ix,
      fromIy: iy,
      nextIx: next.ix,
      nextIy: next.iy,
      wait: rng.range(0, 1),
      wobble: rng.range(0, Math.PI * 2),
    });
  }
  const peds = [];
  for (let i = 0; i < PEDESTRIANS; i++) {
    const at = city.randomStreetPoint(rng);
    const target = city.randomStreetPoint(rng);
    peds.push({
      x: at.x,
      y: at.y,
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(22, 42),
      shirt: rng.pick(SHIRTS),
      skin: rng.pick(SKINS),
      targetX: target.x,
      targetY: target.y,
      wait: rng.range(0, 2),
      down: 0,
      panic: 0,
      stepPhase: rng.range(0, Math.PI * 2),
    });
  }
  return { cars, peds };
}

export function nearestTrafficCar(traffic, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of traffic.cars) {
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  return best;
}

export function stepTraffic(traffic, city, rng, dt) {
  if (!(dt > 0)) return;
  for (const car of traffic.cars) {
    if (car.wait > 0) {
      car.wait -= dt;
      continue;
    }
    const target = city.nodePoint(car.nextIx, car.nextIy);
    const dx = target.x - car.x;
    const dy = target.y - car.y;
    const dist = Math.hypot(dx, dy);
    const step = car.cruise * dt;
    car.angle = Math.atan2(dy, dx);
    if (dist <= step + 4) {
      // Reached the node: roll on to the next leg.
      car.ix = car.nextIx;
      car.iy = car.nextIy;
      car.x = target.x;
      car.y = target.y;
      const next = pickNextNode(rng, city, car.ix, car.iy, car.fromIx, car.fromIy);
      car.fromIx = car.ix;
      car.fromIy = car.iy;
      car.nextIx = next.ix;
      car.nextIy = next.iy;
      if (rng.chance(0.12)) car.wait = rng.range(0.5, 2);
    } else {
      car.x += (dx / dist) * step;
      car.y += (dy / dist) * step;
      car.speed = car.cruise;
    }
    car.wobble += dt * 2;
  }

  for (const ped of traffic.peds) {
    if (ped.down > 0) {
      // Knocked down: stays on the ground until the timer runs out.
      ped.down -= dt;
      continue;
    }
    if (ped.wait > 0) {
      ped.wait -= dt;
      continue;
    }
    if (ped.panic > 0) ped.panic -= dt;
    const dx = ped.targetX - ped.x;
    const dy = ped.targetY - ped.y;
    const dist = Math.hypot(dx, dy);
    const speed = ped.panic > 0 ? ped.speed * 1.9 : ped.speed;
    const step = speed * dt;
    if (dist <= step + 2) {
      const target = city.randomStreetPoint(rng);
      ped.targetX = target.x;
      ped.targetY = target.y;
      ped.wait = rng.range(0.5, 2.5);
    } else {
      ped.angle = Math.atan2(dy, dx);
      ped.x += (dx / dist) * step;
      ped.y += (dy / dist) * step;
      ped.stepPhase += dt * 8;
    }
  }

  // Cars do not drive through each other: a car closing on the one ahead
  // eases off instead of overlapping it.
  for (let i = 0; i < traffic.cars.length; i++) {
    for (let j = i + 1; j < traffic.cars.length; j++) {
      const a = traffic.cars[i];
      const b = traffic.cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d < 46 && d > 0.01) {
        const push = (46 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
}
