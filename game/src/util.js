// util.js — small pure helpers shared by the game modules.
// pick / randRange also live here (flexible signatures) so callers that
// import them from util.js keep working; random.js exports the same
// names for rng-object callers.

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

export function dist2(x1, y1, x2, y2) {
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
  const v = Math.round(n || 0);
  return '$' + v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (v) => (v < 10 ? '0' : '') + v;
  return pad(h) + ':' + pad(m) + ':' + pad(r);
}

// pick: pick(rng, arr) with an rng object, or pick(arr) with Math.random.
export function pick(a, b) {
  if (Array.isArray(a)) {
    if (a.length === 0) return undefined;
    return a[Math.floor(Math.random() * a.length)];
  }
  const arr = b;
  if (!arr || arr.length === 0) return undefined;
  const r = a && typeof a.next === 'function' ? a.next() : Math.random();
  return arr[Math.floor(r * arr.length)];
}

// randRange: randRange(rng, min, max) or randRange(min, max).
export function randRange(a, b, c) {
  if (typeof c === 'number') {
    const r = a && typeof a.next === 'function' ? a.next() : Math.random();
    return b + r * (c - b);
  }
  return a + Math.random() * (b - a);
}

export function randInt(a, b, c) {
  if (typeof c === 'number') {
    const r = a && typeof a.next === 'function' ? a.next() : Math.random();
    const lo = Math.ceil(b);
    const hi = Math.floor(c);
    return lo + Math.floor(r * (hi - lo + 1));
  }
  const lo = Math.ceil(a);
  const hi = Math.floor(b);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

export function weightedPick(rng, entries) {
  let total = 0;
  for (const e of entries) total += e.weight || 1;
  const r = (rng && typeof rng.next === 'function' ? rng.next() : Math.random()) * total;
  let acc = 0;
  for (const e of entries) {
    acc += e.weight || 1;
    if (r < acc) return e.value !== undefined ? e.value : e;
  }
  const last = entries[entries.length - 1];
  return last ? (last.value !== undefined ? last.value : last) : undefined;
}

export function moveTowards(x, y, tx, ty, maxStep) {
  const dx = tx - x;
  const dy = ty - y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= maxStep || d === 0) return { x: tx, y: ty, arrived: true };
  const s = maxStep / d;
  return { x: x + dx * s, y: y + dy * s, arrived: false };
}
