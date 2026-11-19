// Drivable boats in the harbor water (sea strip y > 2100).
// E boards a nearby boat on foot; E again steps ashore on the beach.
// Boat physics: slower accel than cars, wide turns, wake particles,
// clamped to the sea (x 16..2864, y 2116..2144).
import { clamp, turnToward } from './util.js';
import { BOAT } from './config.js';

const SEA = { minX: 16, maxX: 2864, minY: 2116, maxY: 2144 };
const BOARD_RANGE = 70;
const EXIT_OFFSET = 50; // step ashore this far north of the boat

// Mooring table: x, y, color, kind, top-speed multiplier.
const MOORINGS = [
  { x: 2440, y: 2132, color: '#f2f2f2', kind: 'boat', speedMul: 1.0, name: 'Harbor Runabout' },
  { x: 2560, y: 2142, color: '#e88030', kind: 'boat', speedMul: 1.0, name: 'Sunset Cruiser' },
  { x: 2660, y: 2126, color: '#3a7bd5', kind: 'boat', speedMul: 1.0, name: 'Blue Marlin' },
  { x: 1500, y: 2135, color: '#d53030', kind: 'speedboat', speedMul: 1.45, name: 'Red Speedboat' },
  { x: 700, y: 2130, color: '#f5f5f0', kind: 'yacht', speedMul: 0.85, name: 'White Yacht' },
  { x: 1100, y: 2138, color: '#f5d020', kind: 'jetski', speedMul: 1.6, name: 'Yellow Jetski' },
];

export function createBoats(rng) {
  // rng is accepted for API compatibility; moorings are fixed.
  void rng;
  return MOORINGS.map((m) => ({
    kind: m.kind,
    name: m.name,
    x: m.x,
    y: m.y,
    angle: 0, // moored parallel to the shore (east): W sails along
    // the sea strip at once. Facing north pinned the boat against
    // the strip's north edge, where the clamp halved its speed
    // every frame and it could never get going.
    speed: 0,
    color: m.color,
    speedMul: m.speedMul,
    topSpeed: BOAT.baseTopSpeed * m.speedMul,
    inUse: false,
    wake: 0,
  }));
}

export function boatCount(boats) {
  return boats.length;
}

// Strict sea bounds for sailing.
export function isSailable(x, y) {
  return x > SEA.minX && x < SEA.maxX && y > SEA.minY && y < SEA.maxY;
}

export function isInSeaBounds(x, y) {
  return isSailable(x, y);
}

// Nearest free boat within boarding range of (x, y), or null.
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

// Put the player onto the boat.
export function boardBoat(state, boat) {
  if (!boat) return false;
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
  return true;
}

// Step ashore: player lands 50px north of the boat, on the beach.
export function exitBoat(state) {
  const p = state.player;
  const boat = p.boat;
  if (!boat) return false;
  p.x = boat.x;
  p.y = Math.max(2010, boat.y - EXIT_OFFSET);
  p.inBoat = false;
  p.boat = null;
  boat.inUse = false;
  boat.speed = 0;
  return true;
}

// Boat driving for one frame. input: { steer, throttle } (-1..1).
export function stepBoating(state, input, dt) {
  const p = state.player;
  const boat = p.boat;
  if (!boat) return;
  const steer = (input && input.steer) || 0;
  const throttle = (input && input.throttle) || 0;

  // Wide turns: turn rate scales down as speed rises.
  const turn = BOAT.turnRate * (0.55 + 0.45 * Math.min(1, Math.abs(boat.speed) / boat.topSpeed));
  if (Math.abs(boat.speed) > 4) {
    boat.angle += steer * turn * Math.sign(boat.speed) * dt;
  }

  // Slower accel than cars; gentle water drag.
  boat.speed += throttle * BOAT.accel * dt;
  boat.speed -= boat.speed * 0.35 * dt;
  boat.speed = clamp(boat.speed, -boat.topSpeed * 0.35, boat.topSpeed);

  boat.x += Math.cos(boat.angle) * boat.speed * dt;
  boat.y += Math.sin(boat.angle) * boat.speed * dt;

  // Clamp to the sea strip. The clamp only removes the outward
  // motion: speed is kept, so a boat sliding along an edge keeps
  // its east/west motion instead of stalling (halving speed every
  // frame while touching an edge pinned the boat at ~4 px/s).
  boat.x = clamp(boat.x, SEA.minX, SEA.maxX);
  boat.y = clamp(boat.y, SEA.minY, SEA.maxY);

  // Wake timer for the renderer to draw foam behind fast boats.
  boat.wake = Math.abs(boat.speed) > 60 ? Math.min(1, boat.wake + dt * 3) : Math.max(0, boat.wake - dt * 2);

  // Player rides along.
  p.x = boat.x;
  p.y = boat.y;
  p.angle = boat.angle;
  void turnToward;
}

export default createBoats;
