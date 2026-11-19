// Drivable boats in the harbor water (the sea strip, y > 2100).
// Six hulls moored along the shore. E boards a nearby boat on
// foot; E again steps ashore on the beach. Boats are slower to get
// going than cars and turn wide, and they stay in the sea: the
// clamp only ever moves the position, never the speed (clamping
// speed as well used to eat half the speed every frame and the
// boats could barely move).
//
// Player state while aboard: player.inBoat, player.boat.
// Rendering reads state.boats directly.

import { WORLD_W, BOAT_BASE_SPEED, BOAT_ACCEL, SEA_TOP, BEACH_TOP } from './config.js';
import { clamp } from './util.js';

// The sea the boats may sail in: x 16..2864, y 2116..2144.
export const SEA_MIN_X = 16;
export const SEA_MAX_X = WORLD_W - 16;
export const SEA_MIN_Y = SEA_TOP + 16;
export const SEA_MAX_Y = SEA_TOP + 44;

const MOORINGS = [
  { x: 2440, y: 2132, color: '#f2f2ee', name: 'Skiff', speedMul: 1.0, length: 64, width: 26 },
  { x: 2560, y: 2142, color: '#ff7a1a', name: 'Skiff', speedMul: 1.0, length: 64, width: 26 },
  { x: 2660, y: 2126, color: '#2f7fe0', name: 'Skiff', speedMul: 1.0, length: 64, width: 26 },
  { x: 1500, y: 2135, color: '#e03232', name: 'Speedboat', speedMul: 1.45, length: 72, width: 26 },
  { x: 700, y: 2130, color: '#f5f5f0', name: 'Yacht', speedMul: 0.85, length: 96, width: 34 },
  { x: 1100, y: 2138, color: '#ffd60a', name: 'Jetski', speedMul: 1.6, length: 44, width: 20 },
];

export { MOORINGS };

export const BOARD_RANGE = 70;

export function createBoats(rng) {
  void rng;
  return MOORINGS.map((m) => ({
    kind: 'boat',
    x: m.x,
    y: m.y,
    // Moored facing east, out to sea, so the first throttle press
    // moves the boat instead of grinding it against the beach.
    angle: 0,
    speed: 0,
    color: m.color,
    name: m.name,
    speedMul: m.speedMul,
    topSpeed: BOAT_BASE_SPEED * m.speedMul,
    length: m.length,
    width: m.width,
    inUse: false,
    wake: [],
  }));
}

// Strictly inside the sailable strip.
export function isSailable(x, y) {
  return x > SEA_MIN_X && x < SEA_MAX_X && y > SEA_MIN_Y && y < SEA_MAX_Y;
}

// Nearest boat within boarding range of (x, y) — or of the player
// when no point is given — else null.
export function nearestBoat(state, x, y) {
  const px = x !== undefined ? x : state.player.x;
  const py = y !== undefined ? y : state.player.y;
  let best = null;
  let bestD = BOARD_RANGE;
  for (const boat of state.boats) {
    if (boat.inUse) continue;
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

// Step ashore 50px north of the boat, onto the beach.
export function exitBoat(state) {
  const p = state.player;
  const boat = p.boat;
  if (!boat) return false;
  p.x = boat.x;
  p.y = Math.min(boat.y - 50, BEACH_TOP + 40);
  p.inBoat = false;
  p.boat = null;
  boat.inUse = false;
  boat.speed = 0;
  return true;
}

// Boat physics: slow accel, wide turns, wake behind the hull.
// input is the frame input ({ steer, throttle } in -1..1).
// Large dt is split into small steps so a hitch never teleports
// the boat through the sea wall.
export function stepBoating(state, input, dt) {
  const p = state.player;
  const boat = p.boat;
  if (!boat) return;
  let remaining = dt;
  while (remaining > 0) {
    const h = Math.min(remaining, 1 / 30);
    remaining -= h;
    const steer = input.steer || 0;
    const throttle = input.throttle || 0;

    boat.speed += throttle * BOAT_ACCEL * h;
    // Gentle water drag, then the hull's own top speed.
    boat.speed *= Math.max(0, 1 - 0.45 * h);
    boat.speed = clamp(boat.speed, -boat.topSpeed * 0.4, boat.topSpeed);

    // Wide turns: the rudder only bites once the boat is moving,
    // and never as sharply as a car's steering.
    const bite = clamp(Math.abs(boat.speed) / boat.topSpeed, 0.12, 1);
    const turn = 1.35 * bite * (boat.speed < 0 ? -1 : 1);
    boat.angle += steer * turn * h;

    boat.x += Math.cos(boat.angle) * boat.speed * h;
    boat.y += Math.sin(boat.angle) * boat.speed * h;

    // Clamp position to the sea, one pixel inside the strict
    // isSailable edge so a boat resting on the border still
    // counts as sailable. Speed is left alone on purpose.
    boat.x = clamp(boat.x, SEA_MIN_X + 1, SEA_MAX_X - 1);
    boat.y = clamp(boat.y, SEA_MIN_Y + 1, SEA_MAX_Y - 1);

    if (Math.abs(boat.speed) > 60) {
      boat.wake.push({
        x: boat.x - Math.cos(boat.angle) * (boat.length / 2),
        y: boat.y - Math.sin(boat.angle) * (boat.length / 2),
        life: 0.9,
      });
      if (boat.wake.length > 40) boat.wake.shift();
    }
    for (let i = boat.wake.length - 1; i >= 0; i -= 1) {
      boat.wake[i].life -= h;
      if (boat.wake[i].life <= 0) boat.wake.splice(i, 1);
    }
  }
  p.x = boat.x;
  p.y = boat.y;
  p.angle = boat.angle;
  p.speed = boat.speed;
}
