// util.js — tiny math helpers shared by the whole game.
//
// Nothing here knows about the game itself: these are the same few
// operations every system keeps re-implementing (clamping a number,
// measuring a gap, turning toward a heading). One copy, used everywhere,
// so the behaviour stays identical in every module that needs it.

// Keep value inside [low, high]. Values already inside pass through
// untouched; anything outside is pulled back to the nearest edge.
export function clampNumber(value, low, high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

// Straight-line distance between two points (ax, ay) and (bx, by).
export function distanceBetween(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

// Blend between a and b: t = 0 gives a, t = 1 gives b, 0.5 the middle.
export function lerpNumber(a, b, t) {
  return a + (b - a) * t;
}

// The shortest signed turn from angle `from` to angle `to`, wrapped to
// the range [-PI, PI]. Positive means turning anticlockwise.
export function angleDifference(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

// Move `current` toward `target` by at most `maxStep` radians, taking
// the short way around. Returns the new angle (exactly `target` when
// the gap is smaller than one step).
export function turnToward(current, target, maxStep) {
  const diff = angleDifference(current, target);
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}

// True when two circles touch or overlap: the distance between their
// centres is smaller than the sum of their radii.
export function circlesOverlap(ax, ay, aRadius, bx, by, bRadius) {
  return distanceBetween(ax, ay, bx, by) < aRadius + bRadius;
}
