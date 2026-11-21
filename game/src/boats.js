// boats.js — drivable boats in the harbor sea strip (y > 2100).
// 6 boats: 3 moored originals + red speedboat + white yacht + yellow jetski.
// E boards a nearby boat on foot; E again steps ashore on the beach.

import { BOAT } from './config.js';
import { clamp, normalizeAngle, angleDiff } from './util.js';

export const SEA = { xMin: 16, xMax: 2864, yMin: 2116, yMax: 2144 };

const BOAT_DEFS = [
  { x: 2440, y: 2132, color: '#f2f2f2', name: 'Harbor Skiff', mult: 1.0 },
  { x: 2560, y: 2142, color: '#e8821e', name: 'Sunset Runner', mult: 1.0 },
  { x: 2660, y: 2126, color: '#2e6fd8', name: 'Bluefin', mult: 1.0 },
  { x: 1500, y: 2135, color: '#d8232a', name: 'Scarlet Speedboat', mult: 1.45 },
  { x: 700, y: 2130, color: '#ffffff', name: 'Grand Yacht', mult: 0.85 },
  { x: 1100, y: 2138, color: '#f5d90a', name: 'Yellow Jetski', mult: 1.6 },
];

export function isSailable(x, y) {
  return x > SEA.xMin && x < SEA.xMax && y > SEA.yMin && y < SEA.yMax;
}

export function createBoats(rng) {
  // rng is accepted for API compatibility; moorings are fixed by design.
  void rng;
  return BOAT_DEFS.map((d) => ({
    kind: 'boat',
    x: d.x,
    y: d.y,
    angle: 0, // moored facing east so the first throttle push moves forward
    speed: 0,
    color: d.color,
    name: d.name,
    topSpeed: BOAT.baseTopSpeed * d.mult,
    speedMult: d.mult,
    inUse: false,
    wake: 0,
  }));
}

export function nearestBoat(state, x, y) {
  const boats = state.boats || [];
  let best = null;
  let bestD = 70;
  for (const b of boats) {
    if (b.inUse) continue;
    const dx = b.x - x;
    const dy = b.y - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

export function boardBoat(state, boat) {
  const p = state.player;
  if (!p || !boat) return false;
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
  const total = Math.max(0.001, dt || 0.016);
  const n = Math.max(1, Math.ceil(total / 0.05));
  const sub = total / n;
  for (let i = 0; i < n; i += 1) stepBoatingOnce(state, input, sub);
}

function stepBoatingOnce(state, input, step) {
  const p = state.player;
  if (!p || !p.inBoat || !p.boat) return;
  const boat = p.boat;
  const throttle = input.throttle !== undefined ? input.throttle : (input.my ? -input.my : 0);
  const steer = input.steer !== undefined ? input.steer : (input.mx || 0);
  // Slower accel than cars, wide turns.
  boat.speed += throttle * BOAT.accel * step;
  boat.speed -= boat.speed * BOAT.drag * step;
  boat.speed = clamp(boat.speed, -boat.topSpeed * 0.4, boat.topSpeed);
  const turn = steer * BOAT.turnRate * 0.55 * step * (boat.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(boat.speed) / 60 + 0.2);
  boat.angle = normalizeAngle(boat.angle + turn);
  boat.x += Math.cos(boat.angle) * boat.speed * step;
  boat.y += Math.sin(boat.angle) * boat.speed * step;
  // Clamp to the sea strip — position only, never cut speed (old bug).
  boat.x = clamp(boat.x, SEA.xMin + 1, SEA.xMax - 1);
  boat.y = clamp(boat.y, SEA.yMin + 1, SEA.yMax - 1);
  boat.wake = Math.min(1, Math.abs(boat.speed) / boat.topSpeed);
  p.x = boat.x;
  p.y = boat.y;
  p.angle = boat.angle;
  // Keep the player's aim facing the boat's heading while sailing.
  p.aimAngle = boat.angle;
  void angleDiff;
}

export function boatSpeedKnots(boat) {
  if (!boat) return 0;
  return Math.round(Math.abs(boat.speed) * 0.18);
}

export default { createBoats, nearestBoat, boardBoat, exitBoat, stepBoating, isSailable, SEA };
