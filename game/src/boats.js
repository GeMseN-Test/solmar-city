// Boats on Solmar City's harbor: three speedboats moored in the sea strip
// along the south edge, free for Mara to take. Walk up to one on the beach
// and press E to board; steer it like a car, only slower and wider, and
// press E again to step ashore. Boats never touch the roads or the
// buildings — the sea is their road, so they clamp to the water instead
// of the city's collision solver.

import { SEA_TOP, WORLD } from './config.js';
import { clampNumber } from './util.js';

// The water the boats may sail in: the sea strip, with a margin so the
// hull never beards the beach.
const SEA_MIN_Y = SEA_TOP + 18;
const SEA_MAX_Y = WORLD.height - 18;
const SEA_MIN_X = 20;
const SEA_MAX_X = WORLD.width - 20;

// Boat handling: gentler than a car, with a long, wide turn.
const BOAT = {
  accel: 300,
  maxSpeed: 340,
  reverseAccel: 160,
  maxReverse: 110,
  turnRate: 1.6,
  drag: 0.35,
};

const BOAT_SPOTS = [
  { x: 2440, y: 2132, color: '#e8e8e8', angle: 0.15 },
  { x: 2560, y: 2142, color: '#f0b070', angle: -0.1 },
  { x: 2660, y: 2126, color: '#a0c4e8', angle: 0.2 },
];

/** Three moored boats, placed from the spec's fixed spots. */
export function createBoats() {
  return BOAT_SPOTS.map((spot) => ({
    kind: 'boat',
    x: spot.x,
    y: spot.y,
    angle: spot.angle,
    speed: 0,
    color: spot.color,
    inUse: false,
  }));
}

/** The nearest free boat within boarding range of a point, or null. */
export function nearestBoat(state, x, y, radius = 64) {
  let best = null;
  let bestD = radius;
  for (const boat of state.boats) {
    if (boat.inUse) continue;
    const d = Math.hypot(x - boat.x, y - boat.y);
    if (d < bestD) {
      bestD = d;
      best = boat;
    }
  }
  return best;
}

/** Put the player at the helm of a boat. */
export function boardBoat(state, boat) {
  const player = state.player;
  boat.inUse = true;
  player.inBoat = true;
  player.boat = boat;
  player.inCar = false;
  player.car = null;
  player.x = boat.x;
  player.y = boat.y;
  player.angle = boat.angle;
  return boat;
}

/** Step ashore: the player lands on the beach just north of the boat. */
export function exitBoat(state) {
  const player = state.player;
  if (!player.inBoat || !player.boat) return;
  const boat = player.boat;
  boat.inUse = false;
  boat.speed = 0;
  player.inBoat = false;
  player.boat = null;
  player.x = boat.x;
  player.y = SEA_TOP - 18;
  player.angle = boat.angle;
  state.city.resolveCircle(player, 11);
}

/** True when a point is in the sailable sea strip. */
export function isSailable(x, y) {
  return x >= SEA_MIN_X && x <= SEA_MAX_X && y >= SEA_MIN_Y && y <= SEA_MAX_Y;
}

/**
 * One fixed step of boating: throttle, steering and drag, then clamp to
 * the sea. E steps ashore. Returns an event bitmask (0 when uneventful).
 */
export function stepBoating(state, input, dt) {
  const player = state.player;
  const boat = player.boat;
  if (!boat) return 0;

  if (input.throttle > 0) {
    boat.speed = Math.min(BOAT.maxSpeed, boat.speed + BOAT.accel * dt);
  } else if (input.throttle < 0) {
    if (boat.speed > 20) boat.speed = Math.max(0, boat.speed - BOAT.accel * 1.4 * dt);
    else boat.speed = Math.max(-BOAT.maxReverse, boat.speed - BOAT.reverseAccel * dt);
  } else {
    boat.speed -= boat.speed * BOAT.drag * dt;
    if (Math.abs(boat.speed) < 4) boat.speed = 0;
  }
  const authority = clampNumber(Math.abs(boat.speed) / 90, 0.3, 1) * (boat.speed >= 0 ? 1 : -1);
  boat.angle += input.steer * BOAT.turnRate * authority * dt;
  boat.x += Math.cos(boat.angle) * boat.speed * dt;
  boat.y += Math.sin(boat.angle) * boat.speed * dt;
  // The sea is a walled garden: bump the edges, never leave them.
  if (boat.x < SEA_MIN_X) { boat.x = SEA_MIN_X; boat.speed *= 0.5; }
  if (boat.x > SEA_MAX_X) { boat.x = SEA_MAX_X; boat.speed *= 0.5; }
  if (boat.y < SEA_MIN_Y) { boat.y = SEA_MIN_Y; boat.speed *= 0.5; }
  if (boat.y > SEA_MAX_Y) { boat.y = SEA_MAX_Y; boat.speed *= 0.5; }
  player.x = boat.x;
  player.y = boat.y;
  player.angle = boat.angle;
  player.aimAngle = boat.angle;

  // A fast boat throws a white wake behind it.
  if (Math.abs(boat.speed) > 120 && state.rng.chance(0.6)) {
    state.particles.push({
      kind: 'smoke',
      x: boat.x - Math.cos(boat.angle) * 26 + state.rng.range(-8, 8),
      y: boat.y - Math.sin(boat.angle) * 26 + state.rng.range(-8, 8),
      vx: state.rng.range(-15, 15),
      vy: state.rng.range(-15, 15),
      life: 0.6,
      maxLife: 0.6,
      size: 6,
      color: '#e8f4f8',
    });
  }

  if (input.actions & 4) {
    exitBoat(state);
  }
  return 0;
}
