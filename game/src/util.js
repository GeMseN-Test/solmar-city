// Small math + formatting helpers shared by every Solmar City module.
// No game state lives here — just pure functions, so any module can
// import them without creating a dependency tangle.

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
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

// Shortest signed turn from angle `from` to angle `to`, in (-PI, PI].
export function angleDiff(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

export function wrapAngle(a) {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r <= -Math.PI) r += Math.PI * 2;
  return r;
}

export function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

// Move `value` toward `target` by at most `step` per call.
export function moveToward(value, target, step) {
  if (value < target) return Math.min(value + step, target);
  if (value > target) return Math.max(value - step, target);
  return value;
}

// "$1,234" — money always prints with thousands separators.
export function formatMoney(n) {
  const v = Math.round(n);
  const sign = v < 0 ? '-' : '';
  const digits = String(Math.abs(v));
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ',';
    out += digits[i];
  }
  return sign + '$' + out;
}

// Seconds of play time as "m:ss", e.g. 125 -> "2:05".
export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return m + ':' + (rest < 10 ? '0' : '') + rest;
}

// True when point (x, y) sits inside the axis-aligned rect.
export function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

// Push a circle (x, y, r) out of a rect; returns the corrected point
// or null when there is no overlap at all.
export function pushCircleOutOfRect(x, y, r, rect) {
  const cx = clamp(x, rect.x, rect.x + rect.w);
  const cy = clamp(y, rect.y, rect.y + rect.h);
  const dx = x - cx;
  const dy = y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 === 0) {
    // Centre is inside the rect: shove out along the shortest side.
    const left = x - rect.x;
    const right = rect.x + rect.w - x;
    const top = y - rect.y;
    const bottom = rect.y + rect.h - y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) return { x: rect.x - r, y };
    if (m === right) return { x: rect.x + rect.w + r, y };
    if (m === top) return { x, y: rect.y - r };
    return { x, y: rect.y + rect.h + r };
  }
  const d = Math.sqrt(d2);
  const push = (r - d) / d;
  return { x: x + dx * push, y: y + dy * push };
}

// Pick a random element with plain Math.random (cosmetic only).
export function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}
