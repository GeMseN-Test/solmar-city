// boats.js — the harbor: drivable boats on the sea strip.
//
// Three boats were moored in the harbor since v2; the retry adds two
// more — a red speedboat mid-harbor and a white yacht out west — so
// there is a reason to shop around before boarding.
//
// A boat is { kind: 'boat', x, y, angle, speed, color, inUse, top }.
// `top` is the boat's top speed: the speedboat is quick, the yacht is
// stately, the rest are ordinary harbor runabouts.
//
// The sea is the strip at the bottom of the map (y 2116..2144, x
// 16..2864). Boats live inside it: isSailable() says whether a point
// is water a boat can sit on, and stepBoating() refuses to let a boat
// leave it — a boat that runs aground just stops.
//
// Boarding: walk up to a moored boat on the beach and press E
// (missions.js tryInteract does the calling). E again steps ashore,
// 50px north of the boat, back on the sand.

import { SEA_TOP, WORLD } from './config.js';
import { distanceBetween } from './util.js';

// How close the player has to be to a boat to board it.
const BOARD_RANGE = 280;

// Boats are slower to get going than cars, and they turn wide.
const BOAT_ACCEL = 300;
const BOAT_REVERSE_ACCEL = 160;
const BOAT_REVERSE_TOP = 120;

// Moorings: three originals plus the retry's speedboat and yacht.
const MOORINGS = [
  { x: 2440, y: 2132, angle: 0.15, color: '#e8e8e8', top: 320 },
  { x: 2560, y: 2142, angle: -0.1, color: '#f0b070', top: 320 },
  { x: 2660, y: 2126, angle: 0.2, color: '#a0c4e8', top: 320 },
  { x: 1500, y: 2135, angle: -0.05, color: '#e84a4a', top: 460 },
  { x: 700, y: 2130, angle: 0.1, color: '#f2f2f2', top: 250 },
];

export function createBoats() {
  return MOORINGS.map((mooring) => ({
    kind: 'boat',
    x: mooring.x,
    y: mooring.y,
    angle: mooring.angle,
    speed: 0,
    color: mooring.color,
    inUse: false,
    top: mooring.top,
  }));
}

// True when (x, y) is open water a boat can sit on: inside the sea
// strip, with a small margin so the hull never clips the beach or the
// edge of the world.
export function isSailable(x, y) {
  return (
    x > 16 &&
    x < WORLD.width - 16 &&
    y > SEA_TOP + 16 &&
    y < WORLD.height - 16
  );
}

// The closest boat to (x, y) that the player could board from there,
// or null when no boat is near enough.
export function nearestBoat(state, x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const boat of state.boats) {
    if (boat.inUse) continue;
    const dist = distanceBetween(x, y, boat.x, boat.y);
    if (dist <= BOARD_RANGE && dist < bestDist) {
      best = boat;
      bestDist = dist;
    }
  }
  return best;
}

// Climb aboard: the player takes the boat's place and heading, and the
// boat is marked taken so nobody else boards it.
export function boardBoat(state, boat) {
  const player = state.player;
  player.x = boat.x;
  player.y = boat.y;
  player.angle = boat.angle;
  player.inBoat = true;
  player.boat = boat;
  boat.inUse = true;
}

// Step ashore: the player climbs out onto the beach just north of the
// boat, and the boat is free again.
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
}

// One step of sailing. The frame input drives the boat: throttle
// (forward/back) and steer (left/right), the same values the car uses.
// The boat gathers speed slowly, turns wider the faster it goes, and
// stops dead when it runs into the edge of the sailable water.
export function stepBoating(state, input, dt) {
  const player = state.player;
  const boat = player.boat;
  if (!boat) return;
  const throttle = Number(input.throttle) || 0;
  const steer = Number(input.steer) || 0;

  if (throttle > 0) {
    boat.speed = Math.min(boat.top, boat.speed + BOAT_ACCEL * throttle * dt);
  } else if (throttle < 0) {
    boat.speed = Math.max(-BOAT_REVERSE_TOP, boat.speed + BOAT_REVERSE_ACCEL * throttle * dt);
  } else if (boat.speed !== 0) {
    // No throttle: the hull drags to a stop.
    const drag = 240 * dt;
    if (Math.abs(boat.speed) <= drag) boat.speed = 0;
    else boat.speed -= Math.sign(boat.speed) * drag;
  }

  // Wide turns: the rudder bites more the faster the boat is going.
  const turnRate = 0.45 + Math.min(Math.abs(boat.speed), 300) * 0.001;
  boat.angle += steer * turnRate * dt;

  const nextX = boat.x + Math.cos(boat.angle) * boat.speed * dt;
  const nextY = boat.y + Math.sin(boat.angle) * boat.speed * dt;
  let blocked = false;
  if (isSailable(nextX, boat.y)) {
    boat.x = nextX;
  } else {
    blocked = true;
  }
  if (isSailable(boat.x, nextY)) {
    boat.y = nextY;
  } else {
    blocked = true;
  }
  // Ran aground: all way is lost, and the boat sits until the player
  // throttles away from the edge.
  if (blocked) boat.speed = 0;

  // The player rides the boat.
  player.x = boat.x;
  player.y = boat.y;
  player.angle = boat.angle;

  // Wake: a little puff of spray off the stern, about once a second
  // while the throttle is open.
  if (throttle !== 0) {
    boat.wakeTimer = (boat.wakeTimer || 0) + dt;
    if (boat.wakeTimer >= 1) {
      boat.wakeTimer = 0;
      const rng = state.rng;
      state.particles.push({
        kind: 'smoke',
        x: boat.x - Math.cos(boat.angle) * 22 + (rng.next() - 0.5) * 8,
        y: boat.y - Math.sin(boat.angle) * 22 + (rng.next() - 0.5) * 8,
        vx: (rng.next() - 0.5) * 16,
        vy: (rng.next() - 0.5) * 16,
        life: 0.6,
        maxLife: 0.6,
        size: 6,
        color: '#e8f4f8',
      });
    }
  }
}
