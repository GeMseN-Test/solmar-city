// util.js — small pure math / formatting helpers.
// NOTE: pick() and randRange() live in random.js, NOT here.
export function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distSq(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

export function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

export function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function angleDiff(a, b) {
  return normalizeAngle(b - a);
}

export function formatMoney(n) {
  const v = Math.round(n);
  return '$' + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + String(r).padStart(2, '0');
}

export function formatClock(seconds) {
  return formatTime(seconds);
}

export function kmh(speedPxPerSec) {
  // Rough world scale: 1 px ~ 0.12 m, so px/s * 0.432 ~= km/h.
  return Math.round(speedPxPerSec * 0.432);
}

export function lerpAngle(a, b, t) {
  return a + angleDiff(a, b) * t;
}
