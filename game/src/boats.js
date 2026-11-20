// boats.js — Drivable boats in the harbor water (sea strip y > 2100).
// E boards a nearby boat on foot; E again steps ashore on the beach.
// Boat physics: slower accel than cars, wide turns, wake particles,
// clamped to the sea (x 16..2864, y 2116..2144).

export const SEA_MIN_X = 16;
export const SEA_MAX_X = 2864;
export const SEA_MIN_Y = 2116;
export const SEA_MAX_Y = 2144;
export const BOARD_RANGE = 70;

const MOORINGS = [
  { x: 2440, y: 2132, color: '#f2f2f2', label: 'Marina Cruiser', speedMul: 1.0, kind: 'boat' },
  { x: 2560, y: 2142, color: '#ff8c1a', label: 'Sunset Runabout', speedMul: 1.0, kind: 'boat' },
  { x: 2660, y: 2126, color: '#2e7de8', label: 'Harbor Skiff', speedMul: 1.0, kind: 'boat' },
  { x: 1500, y: 2135, color: '#e8352c', label: 'Scarlet Speedboat', speedMul: 1.45, kind: 'speedboat' },
  { x: 700, y: 2130, color: '#ffffff', label: 'Grand Yacht', speedMul: 0.85, kind: 'yacht' },
  { x: 1100, y: 2138, color: '#ffd21a', label: 'Jet Ski', speedMul: 1.6, kind: 'jetski' },
];

export function isSailable(x, y) {
  return x > SEA_MIN_X && x < SEA_MAX_X && y > SEA_MIN_Y && y < SEA_MAX_Y;
}

export function createBoats(rng) {
  const boats = [];
  for (let i = 0; i < MOORINGS.length; i++) {
    const m = MOORINGS[i];
    const jitter = rng ? (rng() - 0.5) * 8 : 0;
    boats.push({
      kind: m.kind,
      x: m.x + jitter,
      y: m.y,
      angle: -Math.PI / 2 + (rng ? (rng() - 0.5) * 0.2 : 0),
      speed: 0,
      color: m.color,
      label: m.label,
      speedMul: m.speedMul,
      inUse: false,
      wake: [],
    });
  }
  return boats;
}

export function nearestBoat(state, x, y) {
  if (!state || !state.boats) return null;
  let best = null;
  let bestD = BOARD_RANGE;
  for (let i = 0; i < state.boats.length; i++) {
    const b = state.boats[i];
    if (b.inUse) continue;
    const dx = b.x - x;
    const dy = b.y - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

export function boardBoat(state, boat) {
  if (!state || !boat) return false;
  const p = state.player;
  if (!p || p.inBoat || p.inCar) return false;
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
  if (!state || !state.player || !state.player.inBoat) return false;
  const p = state.player;
  const boat = p.boat;
  if (boat) {
    boat.inUse = false;
    boat.speed = 0;
  }
  // Step ashore 50px north of the boat, onto the beach.
  p.x = boat ? boat.x : p.x;
  p.y = (boat ? boat.y : p.y) - 50;
  if (p.y < 2020) p.y = 2020;
  p.inBoat = false;
  p.boat = null;
  p.angle = -Math.PI / 2;
  return true;
}

const BOAT_ACCEL = 260;
const BOAT_BRAKE = 420;
const BOAT_MAX_SPEED = 340;
const BOAT_REVERSE = 120;
const BOAT_TURN = 1.9;
const BOAT_DRAG = 0.4;

export function stepBoating(state, input, dt) {
  if (!state || !state.player || !state.player.inBoat) return;
  const p = state.player;
  const boat = p.boat;
  if (!boat) return;
  const mul = boat.speedMul || 1;
  const maxSpeed = BOAT_MAX_SPEED * mul;
  const steer = (input && typeof input.steer === 'number') ? input.steer : 0;
  const throttle = (input && typeof input.throttle === 'number') ? input.throttle : 0;
  const handbrake = !!(input && input.handbrake);
  let speed = boat.speed || 0;
  if (throttle > 0) speed += BOAT_ACCEL * mul * throttle * dt;
  else if (throttle < 0) speed -= BOAT_BRAKE * -throttle * dt;
  else speed -= Math.sign(speed) * BOAT_DRAG * 120 * dt;
  if (handbrake) speed -= Math.sign(speed) * 500 * dt;
  if (speed > maxSpeed) speed = maxSpeed;
  if (speed < -BOAT_REVERSE) speed = -BOAT_REVERSE;
  if (Math.abs(speed) < 4 && throttle === 0) speed = 0;
  // Wide turns: turn rate scales with speed, weaker than cars.
  const turnAmount = BOAT_TURN * steer * Math.min(1, Math.abs(speed) / 120) * dt;
  boat.angle += turnAmount * Math.sign(speed || 1);
  p.angle = boat.angle;
  const nx = boat.x + Math.cos(boat.angle) * speed * dt;
  const ny = boat.y + Math.sin(boat.angle) * speed * dt;
  boat.x = Math.min(SEA_MAX_X, Math.max(SEA_MIN_X, nx));
  boat.y = Math.min(SEA_MAX_Y, Math.max(SEA_MIN_Y, ny));
  boat.speed = speed;
  p.x = boat.x;
  p.y = boat.y;
  // Wake particles behind the boat when moving.
  if (!boat.wake) boat.wake = [];
  if (Math.abs(speed) > 40) {
    boat.wake.push({
      x: boat.x - Math.cos(boat.angle) * 26,
      y: boat.y - Math.sin(boat.angle) * 26,
      life: 0.9,
      maxLife: 0.9,
    });
  }
  for (let i = boat.wake.length - 1; i >= 0; i--) {
    boat.wake[i].life -= dt;
    if (boat.wake[i].life <= 0) boat.wake.splice(i, 1);
  }
  if (boat.wake.length > 40) boat.wake.splice(0, boat.wake.length - 40);
}

export function boatSpeed(state) {
  if (!state || !state.player || !state.player.boat) return 0;
  return Math.abs(state.player.boat.speed || 0);
}

export default createBoats;
