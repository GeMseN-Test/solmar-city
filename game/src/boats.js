// Drivable boats in the harbor sea (the strip y > 2100 along the
// bottom of the map). E boards a nearby boat on foot; E again steps
// ashore on the beach. Boats are slower to accelerate than cars and
// turn wide, with a wake behind them. Player state: `player.inBoat`,
// `player.boat`.
import { BOAT, SEA_TOP, WORLD_W } from './config.js';
import { angleDiff, clamp, dist } from './util.js';

const BOARD_RANGE = 70;

const MOORINGS = [
  { x: 2440, y: 2132, angle: 0.1, color: '#e8e8e8', name: 'White runabout', speedMul: 1.0 },
  { x: 2560, y: 2142, angle: -0.1, color: '#e07b2a', name: 'Orange skiff', speedMul: 1.0 },
  { x: 2660, y: 2126, angle: 0.2, color: '#3a7bd5', name: 'Blue cruiser', speedMul: 1.0 },
  { x: 1500, y: 2135, angle: 0.05, color: '#d23b2e', name: 'Red speedboat', speedMul: 1.45 },
  { x: 700, y: 2130, angle: -0.05, color: '#f2f2f2', name: 'White yacht', speedMul: 0.85 },
  { x: 1100, y: 2138, angle: 0.15, color: '#f5d020', name: 'Yellow jetski', speedMul: 1.6 },
];

export function createBoats(rng) {
  return MOORINGS.map((m) => ({
    kind: 'boat',
    x: m.x + (rng ? rng.range(-6, 6) : 0),
    y: m.y + (rng ? rng.range(-4, 4) : 0),
    angle: m.angle,
    speed: 0,
    color: m.color,
    name: m.name,
    speedMul: m.speedMul,
    inUse: false,
    wake: 0,
  }));
}

// Strict sea bounds: the boat may only ever sail inside this strip.
export function isSailable(x, y) {
  return x > 16 && x < WORLD_W - 16 && y > SEA_TOP + 16 && y < SEA_TOP + 44;
}

export function nearestBoat(state, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const boat of state.boats) {
    if (boat.inUse) continue;
    const d = dist(x, y, boat.x, boat.y);
    if (d < bestD) { bestD = d; best = boat; }
  }
  if (best && bestD <= BOARD_RANGE) return best;
  return null;
}

export function boardBoat(state, boat) {
  const p = state.player;
  p.inBoat = true;
  p.boat = boat;
  p.inCar = false;
  p.car = null;
  boat.inUse = true;
  p.x = boat.x;
  p.y = boat.y;
  p.angle = boat.angle;
  boat.speed = 0;
  return true;
}

export function exitBoat(state) {
  const p = state.player;
  const boat = p.boat;
  if (!boat) return false;
  p.inBoat = false;
  p.boat = null;
  boat.inUse = false;
  boat.speed = 0;
  // Step ashore 50px north of the boat, onto the beach.
  p.x = clamp(boat.x, 30, WORLD_W - 30);
  p.y = SEA_TOP - 50;
  p.angle = -Math.PI / 2;
  return true;
}

// Boat physics: slower accel than cars, wide turns, wake particles.
// `input` is the same frame object world.step receives.
export function stepBoating(state, input, dt) {
  const p = state.player;
  const boat = p.boat;
  if (!boat) return;
  const top = BOAT.maxSpeed * boat.speedMul;
  const steer = input.steer || 0;
  const throttle = input.throttle || 0;
  boat.speed += throttle * BOAT.accel * dt;
  if (input.handbrake) boat.speed -= Math.sign(boat.speed) * 500 * dt;
  boat.speed -= boat.speed * BOAT.drag * dt;
  boat.speed = clamp(boat.speed, -top * 0.35, top);
  const moving = Math.abs(boat.speed) > 8;
  if (moving) {
    const turn = steer * BOAT.turnRate * dt * clamp(Math.abs(boat.speed) / 120, 0, 1);
    boat.angle += turn * Math.sign(boat.speed);
  }
  boat.x += Math.cos(boat.angle) * boat.speed * dt;
  boat.y += Math.sin(boat.angle) * boat.speed * dt;
  // Clamp to the sea strip; bump off the edges instead of beaching.
  if (boat.x <= 16) { boat.x = 16; boat.speed *= 0.4; }
  if (boat.x >= WORLD_W - 16) { boat.x = WORLD_W - 16; boat.speed *= 0.4; }
  if (boat.y <= SEA_TOP + 16) { boat.y = SEA_TOP + 16; boat.speed *= 0.4; }
  if (boat.y >= SEA_TOP + 44) { boat.y = SEA_TOP + 44; boat.speed *= 0.4; }
  boat.wake = moving ? Math.min(1, boat.wake + dt * 3) : Math.max(0, boat.wake - dt * 3);
  p.x = boat.x;
  p.y = boat.y;
  p.angle = boat.angle;
}
