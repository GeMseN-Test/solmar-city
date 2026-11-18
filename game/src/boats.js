// Drivable boats in the harbor water (the sea strip, y past 2100).
// E boards a nearby boat on foot; E again steps ashore on the beach.
// Boats are slower to get going than cars and turn wide, and they stay
// inside the sea: x 16..2864, y 2116..2144.
import { clampNumber } from './util.js';

const SEA = { minX: 16, maxX: 2864, minY: 2116, maxY: 2144 };
const BOARD_RANGE = 64;

// The five moorings. The red speedboat is the fastest hull in the city;
// the white yacht is slow and stately.
const BOAT_DEFS = [
  { x: 2440, y: 2132, angle: 0.15, color: '#e8e8e8', top: 320 },
  { x: 2560, y: 2142, angle: -0.1, color: '#f0b070', top: 320 },
  { x: 2660, y: 2126, angle: 0.2, color: '#a0c4e8', top: 320 },
  { x: 1500, y: 2135, angle: -0.05, color: '#e84a4a', top: 460 },
  { x: 700, y: 2130, angle: 0.1, color: '#f2f2f2', top: 250 },
];

export function createBoats(rng) {
  return BOAT_DEFS.map((def) => ({
    kind: 'boat',
    x: def.x,
    y: def.y,
    angle: def.angle,
    speed: 0,
    color: def.color,
    inUse: false,
    top: def.top,
    wakeTimer: 0,
  }));
}

export function isSailable(x, y) {
  return x > SEA.minX && x < SEA.maxX && y > SEA.minY && y < SEA.maxY;
}

// Nearest free boat within boarding range of (x, y), or null.
export function nearestBoat(state, x, y) {
  let best = null;
  let bestD = BOARD_RANGE;
  for (const boat of state.boats) {
    if (boat.inUse) continue;
    const d = Math.hypot(boat.x - x, boat.y - y);
    if (d < bestD) {
      best = boat;
      bestD = d;
    }
  }
  return best;
}

export function boardBoat(state, boat) {
  const player = state.player;
  player.x = boat.x;
  player.y = boat.y;
  player.angle = boat.angle;
  player.inBoat = true;
  player.boat = boat;
  boat.inUse = true;
  boat.speed = 0;
}

// Step ashore: 50px north of the boat, onto the beach.
export function exitBoat(state) {
  const player = state.player;
  const boat = player.boat;
  if (!boat) {
    player.inBoat = false;
    return;
  }
  player.x = boat.x;
  player.y = boat.y - 50;
  player.inBoat = false;
  player.boat = null;
  boat.inUse = false;
  boat.speed = 0;
}

// Boat physics: gentle accel, wide turns, clamped to the sea strip.
// input is the same frame input the world hands around.
export function stepBoating(state, input, dt) {
  const player = state.player;
  const boat = player.boat;
  if (!boat) return;
  // Defensive: a caller that passes a partial input must not NaN the boat.
  const throttle = input.throttle || 0;
  const steer = input.steer || 0;
  const accel = boat.top * 0.9;
  const drag = 0.9;
  boat.speed += throttle * accel * dt;
  boat.speed -= boat.speed * drag * dt;
  boat.speed = clampNumber(boat.speed, -boat.top * 0.4, boat.top);
  const turnRate = 1.7 * clampNumber(Math.abs(boat.speed) / boat.top, 0, 1);
  boat.angle += steer * turnRate * dt * (boat.speed < 0 ? -1 : 1);
  boat.x += Math.cos(boat.angle) * boat.speed * dt;
  boat.y += Math.sin(boat.angle) * boat.speed * dt;
  boat.x = clampNumber(boat.x, SEA.minX + 1, SEA.maxX - 1);
  boat.y = clampNumber(boat.y, SEA.minY + 1, SEA.maxY - 1);
  player.x = boat.x;
  player.y = boat.y;
  player.angle = boat.angle;
  // Wake spray while moving fast.
  boat.wakeTimer -= dt;
  if (Math.abs(boat.speed) > 90 && boat.wakeTimer <= 0) {
    state.particles.push({
      x: boat.x - Math.cos(boat.angle) * 22,
      y: boat.y - Math.sin(boat.angle) * 12,
      vx: 0,
      vy: 0,
      life: 0.6,
      size: 5,
      color: '#dff4fa',
    });
    boat.wakeTimer = 0.09;
  }
}
