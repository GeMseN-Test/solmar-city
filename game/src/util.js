// Solmar City — small math and formatting helpers shared by every
// module. Nothing here knows about the game; it is pure arithmetic
// and text so any module can use it without pulling in the world.

export const TAU = Math.PI * 2;

// Keep v between lo and hi.
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Slide from a to b by t (0 -> a, 1 -> b).
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Straight-line distance between two points.
export function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

// Squared distance — cheaper when only comparing which is nearer.
export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

// Angle from (ax, ay) to (bx, by), in radians.
export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// Smallest signed turn from angle a to angle b, in (-PI, PI].
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

// Wrap any angle into (-PI, PI].
export function normalizeAngle(a) {
  let r = a % TAU;
  if (r > Math.PI) r -= TAU;
  if (r <= -Math.PI) r += TAU;
  return r;
}

// Turn current towards target by at most maxStep radians.
export function turnTowards(current, target, maxStep) {
  const d = angleDiff(current, target);
  if (d > maxStep) return current + maxStep;
  if (d < -maxStep) return current - maxStep;
  return target;
}

// "$1,234" — money with thousands separators, no decimals.
export function formatMoney(n) {
  const v = Math.round(n);
  return '$' + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// "2:05" — seconds as minutes:seconds, for the play-time readout.
export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ':' + String(s).padStart(2, '0');
}

// "6:00:00" — the Grand Prix countdown as hours:minutes:seconds.
export function formatCountdown(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h + ':' + pad(m) + ':' + pad(s);
}
