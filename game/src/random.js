// random.js — deterministic RNG (mulberry32) + random helpers.
// pick / randRange live HERE, not in util.js.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed) {
  const next = mulberry32(seed >>> 0);
  const rng = () => next();
  rng.next = next;
  rng.int = (min, max) => Math.floor(next() * (max - min + 1)) + min;
  rng.range = (min, max) => min + next() * (max - min);
  rng.pick = (arr) => arr[Math.floor(next() * arr.length)];
  rng.chance = (p) => next() < p;
  return rng;
}

// Backwards-friendly alias: rng(seed) returns a plain next() function.
export function rng(seed) {
  return mulberry32(seed >>> 0);
}

export function randRange(rngFn, min, max) {
  const f = typeof rngFn === 'function' ? rngFn : Math.random;
  return min + f() * (max - min);
}

export function randInt(rngFn, min, max) {
  const f = typeof rngFn === 'function' ? rngFn : Math.random;
  return Math.floor(f() * (max - min + 1)) + min;
}

export function pick(rngFn, arr) {
  const f = typeof rngFn === 'function' ? rngFn : Math.random;
  if (!arr || arr.length === 0) return undefined;
  return arr[Math.floor(f() * arr.length)];
}

export function shuffle(rngFn, arr) {
  const f = typeof rngFn === 'function' ? rngFn : Math.random;
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(f() * (i + 1));
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}

export function chance(rngFn, p) {
  const f = typeof rngFn === 'function' ? rngFn : Math.random;
  return f() < p;
}
