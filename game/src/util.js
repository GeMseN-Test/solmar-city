// util.js — small math + formatting helpers shared by every module.
// No game state lives here, only pure functions, so any file can import
// these without creating a dependency cycle.

// Clamp a number into [min, max].
export function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

// Linear interpolation between a and b by t (0..1).
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Euclidean distance between two points.
export function dist(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

// Squared distance (cheaper when only comparing).
export function distSq(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

// Shortest signed angle from a to b, in (-PI, PI].
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

// Move angle `a` toward `b` by at most `step` radians.
export function turnToward(a, b, step) {
  const d = angleDiff(a, b);
  if (Math.abs(d) <= step) return b;
  return a + Math.sign(d) * step;
}

// Normalize any angle into (-PI, PI].
export function wrapAngle(a) {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r <= -Math.PI) r += Math.PI * 2;
  return r;
}

// True when point (x, y) is inside the circle around (cx, cy).
export function inCircle(x, y, cx, cy, r) {
  return distSq(x, y, cx, cy) <= r * r;
}

// Format seconds as "HH:MM:SS" — used by the Grand Prix countdown HUD.
export function formatHMS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

// Format seconds as "M:SS" — used by the save-game info line.
export function formatMS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// Format a money amount with thousands separators: 1234567 -> "$1,234,567".
export function formatMoney(n) {
  const v = Math.round(n);
  return '$' + Math.abs(v).toLocaleString('en-US');
}

// Signed money, e.g. "+$25" / "-$40".
export function formatMoneySigned(n) {
  return (n >= 0 ? '+' : '-') + formatMoney(Math.abs(n)).slice(0);
}

// Pick the element of `list` closest to (x, y); null when empty.
export function nearestOf(list, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const item of list) {
    const d = distSq(x, y, item.x, item.y);
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  return best;
}

// Move a point by (angle, speed) — returns [x, y] as a fresh array.
export function stepForward(x, y, angle, speed) {
  return [x + Math.cos(angle) * speed, y + Math.sin(angle) * speed];
}

// Ease-out factor for timers: 1 at t=0 falling to 0 at t=1.
export function easeOut(t) {
  return 1 - t * t;
}

// Random helpers that do NOT need a seeded RNG (UI sparkle only).
export function randRange(min, max) {
  return min + Math.random() * (max - min);
}

export function randInt(min, max) {
  return Math.floor(randRange(min, max + 1));
}

export default {
  clamp,
  lerp,
  dist,
  distSq,
  angleDiff,
  turnToward,
  wrapAngle,
  inCircle,
  formatHMS,
  formatMS,
  formatMoney,
  nearestOf,
};
