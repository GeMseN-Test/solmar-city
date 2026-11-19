// Small math + formatting helpers shared by the whole game.
// No state here, just pure functions, so any module can import
// them without worrying about load order.

export const TAU = Math.PI * 2;

export function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Move `value` toward `target` by at most `delta`; never overshoots.
export function approach(value, target, delta) {
  if (value < target) return Math.min(value + delta, target);
  if (value > target) return Math.max(value - delta, target);
  return value;
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

// Shortest signed turn from angle `a` to angle `b`, in (-PI, PI].
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

// Any angle folded back into (-PI, PI].
export function normalizeAngle(a) {
  let n = a % TAU;
  if (n > Math.PI) n -= TAU;
  if (n <= -Math.PI) n += TAU;
  return n;
}

export function clampAngle(a) {
  return normalizeAngle(a);
}

// Turn `angle` toward `target` by at most `maxStep` radians,
// taking the short way around the circle.
export function turnToward(angle, target, maxStep) {
  const d = angleDiff(angle, target);
  if (d > maxStep) return angle + maxStep;
  if (d < -maxStep) return angle - maxStep;
  return target;
}

// "$1,234" — money always prints with thousands separators.
export function formatMoney(n) {
  const v = Math.round(n);
  return '$' + Math.abs(v).toLocaleString('en-US');
}

// Seconds of play time as "2:05".
export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ':' + String(s).padStart(2, '0');
}
