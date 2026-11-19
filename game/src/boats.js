// boats.js — drivable boats in the harbor water (sea strip y > 2100).
// 6 boats: 3 classic moorings + red speedboat + white yacht + yellow jetski.
// E boards a nearby boat on foot; E again steps ashore on the beach.
// Clamp touches POSITION ONLY — never speed (cutting speed was a bug).
import { BOAT_BASE_SPEED } from './config.js';
import { dist } from './util.js';

const SEA = { xMin: 16, xMax: 2864, yMin: 2116, yMax: 2144 };
const BOARD_RANGE = 70;

export function isSailable(x, y) {
  return x > SEA.xMin && x < SEA.xMax && y > SEA.yMin && y < SEA.yMax;
}

export function createBoats(rng) {
  // Moored facing EAST (angle 0) so the first throttle push moves forward.
  const defs = [
    { x: 2440, y: 2132, color: '#f2f2f2', name: 'Skiff', topSpeed: BOAT_BASE_SPEED },
    { x: 2560, y: 2142, color: '#ff8c2e', name: 'Runabout', topSpeed: BOAT_BASE_SPEED },
    { x: 2660, y: 2126, color: '#2e7dff', name: 'Cuddy', topSpeed: BOAT_BASE_SPEED },
    { x: 1500, y: 2135, color: '#e33b2f', name: 'Speedboat', topSpeed: Math.round(BOAT_BASE_SPEED * 1.45) },
    { x: 700, y: 2130, color: '#ffffff', name: 'Yacht', topSpeed: Math.round(BOAT_BASE_SPEED * 0.85) },
    { x: 1100, y: 2138, color: '#ffd21f', name: 'Jetski', topSpeed: Math.round(BOAT_BASE_SPEED * 1.6) },
  ];
  return defs.map((d) => ({
    kind: 'boat', x: d.x, y: d.y, angle: 0, speed: 0,
    color: d.color, name: d.name, topSpeed: d.topSpeed, inUse: false,
    wake: 0,
  }));
}

export function nearestBoat(state, x, y) {
  // Called as nearestBoat(state) or nearestBoat(state, x, y).
  const px = x != null ? x : (state.player ? state.player.x : 0);
  const py = y != null ? y : (state.player ? state.player.y : 0);
  const boats = state.boats || [];
  let best = null;
  let bestD = BOARD_RANGE;
  for (const b of boats) {
    if (b.inUse) continue;
    const d = dist(px, py, b.x, b.y);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

export function boardBoat(state, boat) {
  if (!boat) return false;
  const p = state.player;
  if (!p) return false;
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

export function exitBoat(state) {
  const p = state.player;
  if (!p || !p.inBoat || !p.boat) return false;
  const boat = p.boat;
  // Step ashore 50px north of the boat, onto the beach.
  p.x = boat.x;
  p.y = boat.y - 50;
  p.inBoat = false;
  p.boat = null;
  boat.inUse = false;
  boat.speed = 0;
  return true;
}

export function stepBoating(state, input, dt) {
  const p = state.player;
  const boat = p && p.boat;
  if (!p || !boat) return;
  // Substep large dt so physics stays stable.
  let remaining = dt;
  while (remaining > 0) {
    const h = Math.min(remaining, 0.05);
    remaining -= h;
    const throttle = (input && input.throttle) || 0;
    const steer = (input && input.steer) || 0;
    const accel = 300;
    if (throttle > 0) boat.speed += accel * throttle * h;
    else if (throttle < 0) boat.speed += accel * 0.6 * throttle * h;
    else boat.speed *= Math.max(0, 1 - 0.6 * h);
    // Wide turns, slower than cars.
    const turn = 1.6 * steer * h * Math.max(0.35, Math.min(1, Math.abs(boat.speed) / 120));
    boat.angle += turn * (boat.speed >= 0 ? 1 : -1);
    // Clamp SPEED to the boat's top speed (reverse half).
    if (boat.speed > boat.topSpeed) boat.speed = boat.topSpeed;
    if (boat.speed < -boat.topSpeed * 0.5) boat.speed = -boat.topSpeed * 0.5;
    boat.x += Math.cos(boat.angle) * boat.speed * h;
    boat.y += Math.sin(boat.angle) * boat.speed * h;
    // Clamp POSITION only — never touch speed here.
    if (boat.x < SEA.xMin) boat.x = SEA.xMin;
    if (boat.x > SEA.xMax) boat.x = SEA.xMax;
    if (boat.y < SEA.yMin) boat.y = SEA.yMin;
    if (boat.y > SEA.yMax) boat.y = SEA.yMax;
    boat.wake = Math.abs(boat.speed) > 40 ? 1 : 0;
    p.x = boat.x;
    p.y = boat.y;
    p.angle = boat.angle;
  }
}

export function boatSpeedKnots(boat) {
  return Math.round(Math.abs(boat.speed || 0) * 0.18);
}
export default createBoats;
