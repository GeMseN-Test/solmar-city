// General helpers for Solmar City.
// NOTE: pick / randRange / randInt live in random.js, not here.

// Clamp a value into [min, max].
export function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

// Linear interpolation between a and b.
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Euclidean distance between two points.
export function dist(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.hypot(dx, dy);
}

// Squared distance (cheaper when only comparing).
export function distSq(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

// Smallest signed angle difference from a to b, in [-PI, PI].
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Turn `angle` toward `target` by at most `maxStep` radians.
export function turnToward(angle, target, maxStep) {
  const d = angleDiff(angle, target);
  if (Math.abs(d) <= maxStep) return target;
  return angle + Math.sign(d) * maxStep;
}

// Normalize an angle into [-PI, PI].
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Angle from (x1,y1) to (x2,y2).
export function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

// Format an integer with thousands separators: 1234 -> "1,234".
export function formatMoney(n) {
  const v = Math.round(n);
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Format seconds as m:ss — 125 -> "2:05".
export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return m + ':' + String(rest).padStart(2, '0');
}

// Move a point (x,y) by `len` along `angle`.
export function moveAlong(x, y, angle, len) {
  return { x: x + Math.cos(angle) * len, y: y + Math.sin(angle) * len };
}

// True when point (x,y) lies inside the axis-aligned rect.
export function pointInRect(x, y, rx, ry, rw, rh) {
  return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
}

// True when point (x,y) lies inside the circle at (cx,cy) radius r.
export function pointInCircle(x, y, cx, cy, r) {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}
