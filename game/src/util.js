// Tiny spatial math every system shares: clamping, distances, and turning
// one heading toward another along the shortest arc. No state, no imports.

export function clampNumber(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerpNumber(a, b, t) {
  return a + (b - a) * t;
}

export function distanceBetween(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

/** Shortest signed turn from angle `from` to angle `to`, in (-PI, PI]. */
export function angleDifference(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff <= -Math.PI) diff += Math.PI * 2;
  return diff;
}

/** Move `from` toward `to` by at most `maxStep` radians, shortest arc. */
export function turnToward(from, to, maxStep) {
  const diff = angleDifference(from, to);
  if (Math.abs(diff) <= maxStep) return to;
  return from + Math.sign(diff) * maxStep;
}

/** True when two circles overlap. */
export function circlesOverlap(ax, ay, ar, bx, by, br) {
  const dx = bx - ax;
  const dy = by - ay;
  const reach = ar + br;
  return dx * dx + dy * dy < reach * reach;
}
