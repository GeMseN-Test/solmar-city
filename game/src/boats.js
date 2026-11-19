// boats.js — drivable boats in the harbor. Three boats are moored
// near the Marina/Docks, plus a red speedboat, a white yacht and a
// yellow jetski further along the sea strip (y > 2100). Press E on
// foot near a boat to board it; press E again to step ashore on the
// beach. Boats are slower to speed up than cars and turn wide, and
// they leave a wake behind them. They can never leave the sea:
// x stays in (16, 2864), y in (2116, 2144).

import { clamp } from './util.js';

export const SEA_X_MIN = 16;
export const SEA_X_MAX = 2864;
export const SEA_Y_MIN = 2116;
export const SEA_Y_MAX = 2144;

// Base cruising speed; each boat scales it by topSpeedMul.
export const BOAT_BASE_SPEED = 320;

// The six moorings. topSpeed is exact: the speedboat is 1.45x the
// base, the yacht 0.85x, the jetski 1.6x (fastest on the water).
const MOORINGS = [
  { name: 'White Runabout', x: 2440, y: 2132, color: '#f2f2f2', topSpeedMul: 1.0, topSpeed: 320 },
  { name: 'Orange Skiff', x: 2560, y: 2142, color: '#ff8c2a', topSpeedMul: 1.0, topSpeed: 320 },
  { name: 'Blue Cruiser', x: 2660, y: 2126, color: '#2a6cff', topSpeedMul: 1.0, topSpeed: 320 },
  { name: 'Red Speedboat', x: 1500, y: 2135, color: '#e5322a', topSpeedMul: 1.45, topSpeed: 464 },
  { name: 'White Yacht', x: 700, y: 2130, color: '#fafafa', topSpeedMul: 0.85, topSpeed: 272 },
  { name: 'Yellow Jetski', x: 1100, y: 2138, color: '#ffd21f', topSpeedMul: 1.6, topSpeed: 512 },
];

export function isSailable(x, y) {
  return x > SEA_X_MIN && x < SEA_X_MAX && y > SEA_Y_MIN && y < SEA_Y_MAX;
}

export function createBoats(rng) {
  // rng is accepted for symmetry with the other factories; the
  // moorings are fixed so missions can rely on them.
  void rng;
  return MOORINGS.map((m) => ({
    kind: 'boat',
    name: m.name,
    x: m.x,
    y: m.y,
    angle: 0,
    speed: 0,
    color: m.color,
    topSpeed: m.topSpeed,
    topSpeedMul: m.topSpeedMul,
    inUse: false,
    wake: 0,
  }));
}

// Nearest boat within boarding range of (x, y), or null. When x/y
// are left out, the player's position is used (state.player).
export function nearestBoat(state, x, y) {
  const px = x !== undefined ? x : (state.player ? state.player.x : 0);
  const py = y !== undefined ? y : (state.player ? state.player.y : 0);
  const boats = state.boats || [];
  let best = null;
  let bestD = 70;
  for (const boat of boats) {
    const dx = boat.x - px;
    const dy = boat.y - py;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestD) {
      bestD = d;
      best = boat;
    }
  }
  return best;
}

export function boardBoat(state, boat) {
  if (!boat) return false;
  const player = state.player;
  if (!player) return false;
  player.inBoat = true;
  player.boat = boat;
  player.inCar = false;
  player.car = null;
  player.x = boat.x;
  player.y = boat.y;
  player.angle = boat.angle;
  boat.inUse = true;
  boat.speed = 0;
  return true;
}

// Step ashore: the player lands 50px north of the boat, on the beach.
export function exitBoat(state) {
  const player = state.player;
  if (!player || !player.inBoat) return false;
  const boat = player.boat;
  player.inBoat = false;
  player.boat = null;
  if (boat) {
    boat.inUse = false;
    boat.speed = 0;
    player.x = boat.x;
    player.y = boat.y - 50;
  }
  player.x = clamp(player.x, 16, 2864);
  player.y = clamp(player.y, 16, 2096);
  return true;
}

// Boat physics, one frame. input is the plain values object the
// main loop builds each frame: { steer, throttle, handbrake }.
// Boats accelerate gently, turn wide, and drift — they feel heavy
// compared to cars. Position is clamped to the sea; clamping never
// touches the speed (a clamped boat keeps its momentum).
export function stepBoating(state, input, dt) {
  // Substep big frames so a 3s call sails 3s, not one 0.05s frame.
  let remaining = dt;
  while (remaining > 0) {
    const chunk = Math.min(remaining, 0.05);
    stepBoatingOnce(state, input, chunk);
    remaining -= chunk;
  }
}

function stepBoatingOnce(state, input, dt) {
  const player = state.player;
  if (!player || !player.inBoat || !player.boat) return;
  const boat = player.boat;
  const step = Math.min(dt, 0.05);
  const steer = input && input.steer ? input.steer : 0;
  const throttle = input && input.throttle ? input.throttle : 0;

  // Gentle accel, wide turns, a little drag so the boat settles.
  boat.speed += throttle * 260 * step;
  boat.speed -= boat.speed * 0.35 * step;
  if (input && input.handbrake) boat.speed -= boat.speed * 2.2 * step;
  const max = boat.topSpeed || BOAT_BASE_SPEED;
  if (boat.speed > max) boat.speed = max;
  if (boat.speed < -max * 0.35) boat.speed = -max * 0.35;

  const turn = steer * 1.5 * step * (boat.speed >= 0 ? 1 : -1);
  boat.angle += turn * Math.min(1, Math.abs(boat.speed) / 120 + 0.25);

  boat.x += Math.cos(boat.angle) * boat.speed * step;
  boat.y += Math.sin(boat.angle) * boat.speed * step;

  // Clamp to the sea strip — position only, speed untouched.
  if (boat.x < SEA_X_MIN) boat.x = SEA_X_MIN;
  if (boat.x > SEA_X_MAX) boat.x = SEA_X_MAX;
  if (boat.y < SEA_Y_MIN) boat.y = SEA_Y_MIN;
  if (boat.y > SEA_Y_MAX) boat.y = SEA_Y_MAX;

  boat.wake = Math.min(1, Math.abs(boat.speed) / 200);
  player.x = boat.x;
  player.y = boat.y;
  player.angle = boat.angle;
}

export default createBoats;
