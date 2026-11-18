// Small math helpers shared by the world, traffic, boats and combat.

export function clampNumber(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function lerpNumber(a, b, t) {
  return a + (b - a) * t;
}

export function distanceBetween(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function circlesOverlap(x1, y1, r1, x2, y2, r2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const radii = r1 + r2;
  return dx * dx + dy * dy < radii * radii;
}

// Wrap any angle into [-PI, PI].
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Shortest signed turn from angle a to angle b, in [-PI, PI].
export function angleDifference(a, b) {
  return wrapAngle(b - a);
}

// Move current toward target by at most maxStep, along the shortest arc.
export function turnToward(current, target, maxStep) {
  const d = angleDifference(current, target);
  if (Math.abs(d) <= maxStep) return wrapAngle(target);
  return wrapAngle(current + Math.sign(d) * maxStep);
}
