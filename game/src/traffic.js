// traffic.js — Street traffic: 16 cars + 34 pedestrians.
// Car models: sedan, van, taxi, truck, sport. Cars follow the road
// grid node to node; pedestrians wander the sidewalks and panic when
// the player drives at them.

export const TRAFFIC_CARS = 16;
export const PEDESTRIANS = 34;
export const CAR_MODELS = ['sedan', 'van', 'taxi', 'truck', 'sport'];

const CAR_COLORS = [
  '#c0392b', '#2980b9', '#f1c40f', '#ecf0f1', '#2c3e50', '#8e44ad',
  '#16a085', '#d35400', '#7f8c8d', '#27ae60', '#e67e22', '#34495e',
];
const PED_SHIRTS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c',
  '#e67e22', '#95a5a6', '#d35400', '#2980b9',
];
const PED_SKINS = ['#e8b98a', '#c98d5f', '#8a5a3b', '#f0c8a0'];

export function createTraffic(rng, city) {
  const rand = rng || Math.random;
  const traffic = { cars: [], peds: [] };
  for (let i = 0; i < TRAFFIC_CARS; i++) {
    const model = CAR_MODELS[i % CAR_MODELS.length];
    const color = model === 'taxi' ? '#f1c40f' : CAR_COLORS[i % CAR_COLORS.length];
    let x = 180 + rand() * 2520;
    let y = 180 + rand() * 1800;
    let ix = 0;
    let iy = 0;
    if (city && city.nearestNode) {
      const node = city.nearestNode(x, y);
      ix = node.ix;
      iy = node.iy;
      if (city.nodePoint) {
        const pt = city.nodePoint(ix, iy);
        x = pt.x;
        y = pt.y;
      }
    }
    const cruise = model === 'sport' ? 200 + rand() * 60 : model === 'truck' ? 110 + rand() * 30 : 140 + rand() * 50;
    traffic.cars.push({
      kind: 'traffic',
      x,
      y,
      angle: (Math.floor(rand() * 4) * Math.PI) / 2,
      speed: 0,
      cruise,
      color,
      model,
      ix,
      iy,
      fromIx: ix,
      fromIy: iy,
      nextIx: ix,
      nextIy: iy,
      wait: rand() * 2,
      wobble: (rand() - 0.5) * 14,
    });
  }
  for (let i = 0; i < PEDESTRIANS; i++) {
    let x = 180 + rand() * 2520;
    let y = 180 + rand() * 1800;
    if (city && city.randomStreetPoint) {
      const pt = city.randomStreetPoint(rand);
      x = pt.x + (rand() - 0.5) * 60;
      y = pt.y + (rand() - 0.5) * 60;
    }
    traffic.peds.push({
      x,
      y,
      angle: rand() * Math.PI * 2,
      speed: 28 + rand() * 30,
      shirt: PED_SHIRTS[i % PED_SHIRTS.length],
      skin: PED_SKINS[i % PED_SKINS.length],
      targetX: x,
      targetY: y,
      wait: rand() * 3,
      down: false,
      panic: 0,
      stepPhase: rand() * Math.PI * 2,
    });
  }
  return traffic;
}

function pickNextNode(car, city, rng) {
  if (!city || !city.nodeNeighbours || !city.nodePoint) return null;
  const neighbours = city.nodeNeighbours(car.ix, car.iy);
  if (!neighbours || neighbours.length === 0) return null;
  const next = neighbours[Math.floor(rng() * neighbours.length)];
  return next;
}

export function stepTraffic(traffic, city, rng, dt) {
  if (!traffic) return;
  const rand = rng || Math.random;
  for (const car of traffic.cars) {
    if (car.wait > 0) {
      car.wait -= dt;
      car.speed = Math.max(0, car.speed - 300 * dt);
      continue;
    }
    if (car.nextIx === car.ix && car.nextIy === car.iy) {
      const next = pickNextNode(car, city, rand);
      if (!next) {
        car.wait = 1;
        continue;
      }
      car.fromIx = car.ix;
      car.fromIy = car.iy;
      car.nextIx = next.ix;
      car.nextIy = next.iy;
    }
    let tx = car.x;
    let ty = car.y;
    if (city && city.nodePoint) {
      const pt = city.nodePoint(car.nextIx, car.nextIy);
      tx = pt.x;
      ty = pt.y;
    }
    const dx = tx - car.x;
    const dy = ty - car.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const targetAngle = Math.atan2(dy, dx);
    let diff = targetAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
    if (dist < 12) {
      car.ix = car.nextIx;
      car.iy = car.nextIy;
      car.wait = rand() < 0.12 ? 1 + rand() * 2 : 0;
      continue;
    }
    car.speed += (car.cruise - car.speed) * Math.min(1, 1.5 * dt);
    // Keep a little lateral offset so two-way traffic does not overlap.
    const px = -Math.sin(car.angle) * car.wobble;
    const py = Math.cos(car.angle) * car.wobble;
    car.x += Math.cos(car.angle) * car.speed * dt + px * dt * 0.2;
    car.y += Math.sin(car.angle) * car.speed * dt + py * dt * 0.2;
  }
  for (const ped of traffic.peds) {
    if (ped.down) {
      ped.wait -= dt;
      if (ped.wait <= 0) {
        ped.down = false;
        ped.wait = 0;
      }
      continue;
    }
    if (ped.panic > 0) ped.panic -= dt;
    const speed = ped.panic > 0 ? ped.speed * 2.4 : ped.speed;
    const dx = ped.targetX - ped.x;
    const dy = ped.targetY - ped.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 10) {
      ped.wait -= dt;
      if (ped.wait <= 0) {
        let nx = ped.x + (rand() - 0.5) * 320;
        let ny = ped.y + (rand() - 0.5) * 320;
        nx = Math.max(120, Math.min(2760, nx));
        ny = Math.max(120, Math.min(2000, ny));
        ped.targetX = nx;
        ped.targetY = ny;
        ped.wait = 1 + rand() * 4;
      }
      continue;
    }
    ped.angle = Math.atan2(dy, dx);
    let nx = ped.x + Math.cos(ped.angle) * speed * dt;
    let ny = ped.y + Math.sin(ped.angle) * speed * dt;
    if (city && city.resolveCircle) {
      const out = city.resolveCircle(nx, ny, 8);
      nx = out.x;
      ny = out.y;
    }
    ped.x = nx;
    ped.y = ny;
    ped.stepPhase += dt * 8;
  }
}

export function nearestTrafficCar(traffic, x, y, maxDist) {
  if (!traffic) return null;
  const limit = maxDist || 80;
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

export function panicNear(traffic, x, y, radius) {
  if (!traffic) return;
  for (const ped of traffic.peds) {
    if (ped.down) continue;
    const dx = ped.x - x;
    const dy = ped.y - y;
    if (dx * dx + dy * dy < radius * radius) ped.panic = 1.2;
  }
}

export default createTraffic;
