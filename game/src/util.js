// util.js — tiny math + formatting helpers shared by every module.
// No game state lives here, just pure functions.

// Keep a number between min and max.
export function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

// Slide from a to b by t (t = 0 gives a, t = 1 gives b).
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Straight-line distance between two points.
export function dist(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

// Distance between two objects that both have x and y.
export function distTo(a, b) {
  return dist(a.x, a.y, b.x, b.y);
}

// Angle (radians) from point a to point b.
export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// Smallest signed turn from angle a to angle b, in (-PI, PI].
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

// Wrap any angle into (-PI, PI].
export function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

// Move angle `from` toward angle `to` by at most `maxStep` radians.
export function turnToward(from, to, maxStep) {
  const d = angleDiff(from, to);
  if (d > maxStep) return from + maxStep;
  if (d < -maxStep) return from - maxStep;
  return to;
}

// Money as "$1,234" — thousands separators, no decimals.
export function formatMoney(n) {
  const v = Math.floor(n);
  return '$' + v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Seconds as "2:05" (minutes:seconds, zero-padded seconds).
export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ':' + (s < 10 ? '0' + s : '' + s);
}

// True when point (x, y) sits inside the circle around (cx, cy).
export function inCircle(x, y, cx, cy, r) {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

// Pick a random point on a circle of radius r around (cx, cy).
// rng is any function returning [0, 1).
export function randomPointOnCircle(rng, cx, cy, r) {
  const a = rng() * Math.PI * 2;
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
}

export default clamp;
