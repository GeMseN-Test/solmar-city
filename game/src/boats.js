// boats.js — drivable boats in the Solmar harbor.
// Six boats moored in the sea strip (y > 2100). Walk up to one on the
// beach and press E to board; press E again to step ashore. Boats are
// slower to accelerate than cars and turn wide; each hull has its own
// top speed (the yellow jetski is the fastest thing on the water).
// Player state: player.inBoat, player.boat.

import { BOAT, WORLD_WIDTH } from './config.js';
import { clamp, turnToward } from './util.js';

// The six moorings. topSpeed is a multiplier on the base boat speed.
const MOORINGS = [
  { name: 'Harbor Skiff', color: '#f2f2ee', x: 2440, y: 2132, angle: 0, topSpeed: 1.0 },
  { name: 'Sunset Runner', color: '#e88030', x: 2560, y: 2142, angle: 0, topSpeed: 1.0 },
  { name: 'Bluefin', color: '#2f6fd0', x: 2660, y: 2126, angle: 0, topSpeed: 1.0 },
  { name: 'Scarlet Speedboat', color: '#d0342c', x: 1500, y: 2135, angle: 0, topSpeed: 1.45 },
  { name: 'Grand Yacht', color: '#f5f2e8', x: 700, y: 2130, angle: 0, topSpeed: 0.85 },
  { name: 'Yellow Jetski', color: '#f2d32c', x: 1100, y: 2138, angle: 0, topSpeed: 1.6 },
];

export const BOARD_RANGE = BOAT.boardRange || 70;

export function createBoats(rng) {
  // rng is accepted for API compatibility; moorings are fixed so the
  // harbor always looks the same. (rng unused on purpose.)
  void rng;
  return MOORINGS.map((m) => ({
    kind: 'boat',
    name: m.name,
    color: m.color,
    x: m.x,
    y: m.y,
    angle: m.angle,
    speed: 0,
    topSpeed: m.topSpeed,
    inUse: false,
  }));
}

// Strict sea-lane bounds: x in (16, 2864), y in (2116, 2144).
export function isSailable(x, y) {
  return x > BOAT.minX && x < BOAT.maxX && y > BOAT.minY && y < BOAT.maxY;
}

export function isInSeaLane(x, y) {
  return isSailable(x, y);
}

// Nearest free boat within boarding range of (x, y). When x/y are
// omitted the player's position is used. Returns null when none.
export function nearestBoat(state, x, y) {
  const boats = state.boats || [];
  const px = x != null ? x : (state.player ? state.player.x : 0);
  const py = y != null ? y : (state.player ? state.player.y : 0);
  let best = null;
  let bestD = Infinity;
  for (const b of boats) {
    if (b.inUse) continue;
    const dx = b.x - px;
    const dy = b.y - py;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  if (best && bestD <= BOARD_RANGE) return best;
  return null;
}

// Put the player onto the boat: position snaps to the hull, the boat
// becomes in-use, and the player is flagged as boating.
export function boardBoat(state, boat) {
  if (!state || !state.player || !boat) return false;
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

// Step ashore: 50px north of the boat, onto the beach.
export function exitBoat(state) {
  if (!state || !state.player) return false;
  const p = state.player;
  const boat = p.boat;
  if (!p.inBoat || !boat) return false;
  p.x = clamp(boat.x, 40, WORLD_WIDTH - 40);
  p.y = boat.y - 50;
  p.inBoat = false;
  p.boat = null;
  boat.inUse = false;
  boat.speed = 0;
  return true;
}

// Boat physics, one frame. input: { steer, throttle, handbrake }.
// Slow acceleration, wide turns, wake particles behind the hull,
// clamped hard to the sea lane so a boat can never beach itself.
export function stepBoating(state, input, dt) {
  const p = state.player;
  if (!p || !p.inBoat || !p.boat) return;
  const boat = p.boat;
  const step = dt || 0.016;
  const maxSpeed = BOAT.baseMaxSpeed * (boat.topSpeed || 1);
  const throttle = input ? (input.throttle || 0) : 0;
  const steer = input ? (input.steer || 0) : 0;

  // Gentle acceleration; reverse is even slower on water.
  if (throttle > 0) {
    boat.speed += BOAT.baseAccel * throttle * step;
  } else if (throttle < 0) {
    boat.speed += BOAT.baseAccel * 0.45 * throttle * step;
  } else {
    // Water drag bleeds speed when nobody is on the throttle.
    boat.speed -= boat.speed * 0.55 * step;
  }
  if (input && input.handbrake) {
    boat.speed -= boat.speed * 2.2 * step;
  }
  boat.speed = clamp(boat.speed, -maxSpeed * 0.35, maxSpeed);

  // Wide turns: the faster the boat, the lazier the rudder.
  const speedFactor = clamp(Math.abs(boat.speed) / maxSpeed, 0, 1);
  const turn = steer * BOAT.turnRate * 0.45 * (0.35 + 0.65 * speedFactor) * step;
  boat.angle += turn * Math.sign(boat.speed || 1);

  boat.x += Math.cos(boat.angle) * boat.speed * step;
  boat.y += Math.sin(boat.angle) * boat.speed * step;

  // Clamp to the sea lane; bump gently off the edges.
  if (boat.x <= BOAT.minX + 2) { boat.x = BOAT.minX + 2; boat.speed *= 0.6; }
  if (boat.x >= BOAT.maxX - 2) { boat.x = BOAT.maxX - 2; boat.speed *= 0.6; }
  if (boat.y <= BOAT.minY + 2) { boat.y = BOAT.minY + 2; boat.speed *= 0.6; }
  if (boat.y >= BOAT.maxY - 2) { boat.y = BOAT.maxY - 2; boat.speed *= 0.6; }

  // The player rides the hull.
  p.x = boat.x;
  p.y = boat.y;
  p.angle = boat.angle;

  // Wake: white spray particles behind the boat while it moves.
  if (Math.abs(boat.speed) > 40) {
    if (!state.particles) state.particles = [];
    const backX = boat.x - Math.cos(boat.angle) * 24;
    const backY = boat.y - Math.sin(boat.angle) * 24;
    state.particles.push({
      kind: 'wake',
      x: backX + (Math.random() - 0.5) * 18,
      y: backY + (Math.random() - 0.5) * 10,
      life: 0.7,
      maxLife: 0.7,
      size: 5 + Math.random() * 6,
    });
    if (state.particles.length > 400) state.particles.splice(0, state.particles.length - 400);
  }
  void turnToward;
}

export default {
  createBoats,
  nearestBoat,
  boardBoat,
  exitBoat,
  stepBoating,
  isSailable,
};
