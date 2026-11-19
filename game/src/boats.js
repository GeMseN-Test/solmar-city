// boats.js — drivable boats in the harbor sea strip (y 2116..2144).
// 6 boats moored near the Marina / Docks. E boards a nearby boat on
// foot; E again steps ashore on the beach. Slower accel than cars,
// wide turns, wake particles, clamped to the sea.

import { clamp } from './util.js';

export const SEA_MIN_X = 16;
export const SEA_MAX_X = 2864;
export const SEA_MIN_Y = 2116;
export const SEA_MAX_Y = 2144;
export const BOAT_BASE_SPEED = 300;
export const BOARD_RANGE = 70;

const MOORINGS = [
  { x: 2440, y: 2132, color: '#f2f2f2', name: 'Harbor Skiff', speedMul: 1.0 },
  { x: 2560, y: 2142, color: '#e67e22', name: 'Sunset Runner', speedMul: 1.0 },
  { x: 2660, y: 2126, color: '#2980b9', name: 'Blue Marlin', speedMul: 1.0 },
  { x: 1500, y: 2135, color: '#c0392b', name: 'Crimson Speedboat', speedMul: 1.45 },
  { x: 700, y: 2130, color: '#f8f8f8', name: 'Grand Yacht', speedMul: 0.85 },
  { x: 1100, y: 2138, color: '#f1c40f', name: 'Banana Jetski', speedMul: 1.6 },
];

export function createBoats(rng) {
  return MOORINGS.map((m) => ({
    kind: 'boat',
    name: m.name,
    x: m.x,
    y: m.y,
    angle: -Math.PI / 2 + (rng ? rng.range(-0.05, 0.05) : 0),
    speed: 0,
    color: m.color,
    speedMul: m.speedMul,
    topSpeed: BOAT_BASE_SPEED * m.speedMul,
    inUse: false,
    wake: [],
  }));
}

export function isSailable(x, y) {
  return x > SEA_MIN_X && x < SEA_MAX_X && y > SEA_MIN_Y && y < SEA_MAX_Y;
}

export function nearestBoat(state, x, y) {
  const boats = state.boats || [];
  let best = null;
  let bestD = BOARD_RANGE;
  for (const b of boats) {
    if (b.inUse) continue;
    const d = Math.hypot(b.x - x, b.y - y);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

export function boardBoat(state, boat) {
  if (!boat) return false;
  const p = state.player;
  p.x = boat.x;
  p.y = boat.y;
  p.angle = boat.angle;
  p.inBoat = true;
  p.boat = boat;
  boat.inUse = true;
  boat.speed = 0;
  return true;
}

export function exitBoat(state) {
  const p = state.player;
  const boat = p.boat;
  if (!boat) return false;
  p.x = boat.x;
  p.y = boat.y - 50;
  p.angle = -Math.PI / 2;
  p.inBoat = false;
  p.boat = null;
  boat.inUse = false;
  boat.speed = 0;
  return true;
}

export function stepBoating(state, input, dt) {
  const p = state.player;
  const boat = p.boat;
  if (!boat || !p.inBoat) return;
  const steer = input.steer || 0;
  const throttle = input.throttle || 0;
  const top = boat.topSpeed || BOAT_BASE_SPEED;

  // Slower accel than cars; reverse is lazier still.
  const accel = 260;
  if (throttle > 0) {
    boat.speed += accel * throttle * dt;
  } else if (throttle < 0) {
    boat.speed += accel * 0.55 * throttle * dt;
  } else {
    boat.speed -= boat.speed * 0.9 * dt;
  }
  // Water drag.
  boat.speed -= boat.speed * 0.35 * dt;
  boat.speed = clamp(boat.speed, -top * 0.4, top);

  // Wide turns: turn rate grows with speed but stays lazy.
  const speedNorm = Math.abs(boat.speed) / top;
  const turn = 1.5 * speedNorm * steer * dt * Math.sign(boat.speed || 1);
  boat.angle += turn;

  const nx = boat.x + Math.cos(boat.angle) * boat.speed * dt;
  const ny = boat.y + Math.sin(boat.angle) * boat.speed * dt;
  boat.x = clamp(nx, SEA_MIN_X, SEA_MAX_X);
  boat.y = clamp(ny, SEA_MIN_Y, SEA_MAX_Y);
  if (boat.x !== nx || boat.y !== ny) boat.speed *= 0.6;

  // Wake particles at the stern while moving.
  if (Math.abs(boat.speed) > 40) {
    const bx = boat.x - Math.cos(boat.angle) * 22;
    const by = boat.y - Math.sin(boat.angle) * 22;
    boat.wake.push({ x: bx, y: by, life: 0.9 });
  }
  for (let i = boat.wake.length - 1; i >= 0; i--) {
    boat.wake[i].life -= dt;
    if (boat.wake[i].life <= 0) boat.wake.splice(i, 1);
  }
  if (boat.wake.length > 48) boat.wake.splice(0, boat.wake.length - 48);

  // The player rides the boat.
  p.x = boat.x;
  p.y = boat.y;
  p.angle = boat.angle;
}
