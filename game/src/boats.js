// Drivable boats in the harbor sea strip (y > 2100). Six boats are
// moored along the beach; E boards one on foot, E again steps ashore.
// Boats are slower to get going than cars and turn wide, and each
// hull has its own top speed — the yellow jetski is the fastest thing
// on the water. Position is clamped to the sea only; speed is never
// cut by the clamp (that bug beached boats in an earlier attempt).

import { SEA_TOP, WORLD_W } from './config.js';
import { clamp, wrapAngle } from './util.js';

// The sea lane boats may sail in: x 16..2864, y 2116..2144.
export const SEA_MIN_X = 16;
export const SEA_MAX_X = 2864;
export const SEA_MIN_Y = 2116;
export const SEA_MAX_Y = 2144;

const BASE_TOP_SPEED = 320;
const BOARD_RANGE = 80;

const MOORINGS = [
  { x: 2440, y: 2132, color: '#f2f2f2', name: 'Skiff', speedMul: 1 },
  { x: 2560, y: 2142, color: '#e8822e', name: 'Runabout', speedMul: 1 },
  { x: 2660, y: 2126, color: '#3e6fd8', name: 'Cuddy', speedMul: 1 },
  { x: 1500, y: 2135, color: '#d8382e', name: 'Speedboat', speedMul: 1.45 },
  { x: 700, y: 2130, color: '#f2f2f2', name: 'Yacht', speedMul: 0.85 },
  { x: 1100, y: 2138, color: '#f2d32e', name: 'Jetski', speedMul: 1.6 },
];

export function createBoats(rng) {
  void rng;
  return MOORINGS.map((m) => ({
    kind: 'boat',
    x: m.x,
    y: m.y,
    angle: -Math.PI / 2,
    speed: 0,
    color: m.color,
    name: m.name,
    topSpeed: Math.round(BASE_TOP_SPEED * m.speedMul),
    inUse: false,
  }));
}

// Strict: a point is sailable only inside the sea lane.
export function isSailable(x, y) {
  return x > SEA_MIN_X && x < SEA_MAX_X && y > SEA_MIN_Y && y < SEA_MAX_Y;
}

// Nearest boat within boarding range of (x, y). When x/y are omitted
// the player's position is used.
export function nearestBoat(state, x, y) {
  const px = x !== undefined ? x : state.player.x;
  const py = y !== undefined ? y : state.player.y;
  let best = null;
  let bestD = BOARD_RANGE * BOARD_RANGE;
  for (const boat of state.boats) {
    if (boat.inUse) continue;
    const dx = boat.x - px;
    const dy = boat.y - py;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD) {
      bestD = d2;
      best = boat;
    }
  }
  return best;
}

export function boardBoat(state, boat) {
  const p = state.player;
  p.x = boat.x;
  p.y = boat.y;
  p.angle = boat.angle;
  p.inBoat = true;
  p.boat = boat;
  p.inCar = false;
  p.car = null;
  boat.inUse = true;
  boat.speed = 0;
}

// Step ashore on the beach, 50px north of the boat.
export function exitBoat(state) {
  const p = state.player;
  const boat = p.boat;
  if (!boat) {
    p.inBoat = false;
    return;
  }
  p.x = boat.x;
  p.y = boat.y - 50;
  p.angle = -Math.PI / 2;
  p.inBoat = false;
  p.boat = null;
  boat.inUse = false;
  boat.speed = 0;
}

// Boat physics, one tick. Slower accel than cars, wide turns, wake
// particles behind the hull. The sea clamp touches POSITION only —
// speed keeps its value so a boat pushed against the edge can still
// turn away instead of stalling dead.
export function stepBoating(state, input, dt) {
  const p = state.player;
  const boat = p.boat;
  if (!boat) return;
  const steer = input.steer || 0;
  const throttle = input.throttle || 0;
  const accel = 260;
  const drag = 0.45;

  boat.speed += throttle * accel * dt;
  boat.speed -= boat.speed * drag * dt;
  boat.speed = clamp(boat.speed, -boat.topSpeed * 0.35, boat.topSpeed);

  // Wide turns: turn rate grows with speed but stays lazy.
  const turnAuthority = clamp(Math.abs(boat.speed) / boat.topSpeed, 0, 1);
  const turn = steer * 1.5 * turnAuthority * (boat.speed >= 0 ? 1 : -1);
  boat.angle = wrapAngle(boat.angle + turn * dt);

  boat.x += Math.cos(boat.angle) * boat.speed * dt;
  boat.y += Math.sin(boat.angle) * boat.speed * dt;

  // Clamp position to the sea lane. Speed is intentionally untouched.
  boat.x = clamp(boat.x, SEA_MIN_X, SEA_MAX_X);
  boat.y = clamp(boat.y, SEA_MIN_Y, SEA_MAX_Y);

  p.x = boat.x;
  p.y = boat.y;
  p.angle = boat.angle;

  // Wake: a fading foam trail while moving. world.js renders
  // state.particles; here we only append when the array exists.
  if (state.particles && Math.abs(boat.speed) > 60) {
    const backX = boat.x - Math.cos(boat.angle) * 26;
    const backY = boat.y - Math.sin(boat.angle) * 26;
    const spread = (Math.random() - 0.5) * 14;
    state.particles.push({
      x: backX - Math.sin(boat.angle) * spread,
      y: backY + Math.cos(boat.angle) * spread,
      vx: -Math.cos(boat.angle) * boat.speed * 0.25,
      vy: -Math.sin(boat.angle) * boat.speed * 0.25,
      life: 0.7,
      maxLife: 0.7,
      size: 5 + Math.random() * 5,
      color: '#cfe8f2',
      kind: 'wake',
    });
  }
}

export { SEA_TOP, WORLD_W };
