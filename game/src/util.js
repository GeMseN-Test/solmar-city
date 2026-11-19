// util.js — small math + formatting helpers shared by every module.

export const TAU = Math.PI * 2;

export function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

export function clamp01(v) {
  return clamp(v, 0, 1);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function dist2(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

export function angleDiff(a, b) {
  // Shortest signed turn from a to b, in (-PI, PI].
  return wrapAngle(b - a);
}

export function moveTowardsAngle(angle, target, maxStep) {
  const d = angleDiff(angle, target);
  if (Math.abs(d) <= maxStep) return target;
  return wrapAngle(angle + Math.sign(d) * maxStep);
}

export function formatMoney(n) {
  const v = Math.round(n || 0);
  const sign = v < 0 ? '-' : '';
  const digits = String(Math.abs(v)).split('');
  const out = [];
  while (digits.length > 3) {
    out.unshift(digits.splice(-3).join(''));
  }
  out.unshift(digits.join(''));
  return sign + out.join(',');
}

export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ':' + String(s).padStart(2, '0');
}
