// Small math + formatting helpers shared by every Solmar City module.
// Nothing here touches the DOM or the game state — pure functions only.

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function dist2(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

export function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

// Shortest signed turn from `from` to `to`, wrapped to [-PI, PI].
export function angleDiff(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Move `current` toward `target` by at most `maxStep` radians.
export function turnToward(current, target, maxStep) {
  const d = angleDiff(current, target);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}

export function pointInRect(x, y, rx, ry, rw, rh) {
  return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
}

// "$1,234" style money, with thousands separators.
export function formatMoney(n) {
  const v = Math.round(n);
  return '$' + v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Seconds as "m:ss", e.g. 125 -> "2:05".
export function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + String(r).padStart(2, '0');
}
