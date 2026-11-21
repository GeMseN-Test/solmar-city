// random.js — seeded RNG for Solmar City.
// createRng(seed) returns an OBJECT with a .next() method (not a function).
// mulberry32 is intentionally NOT exported: callers use createRng only.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed) {
  const nextFn = mulberry32(typeof seed === 'number' ? seed : 1);
  let calls = 0;
  const rng = {
    seed: (seed >>> 0) || 1,
    next() {
      calls += 1;
      return nextFn();
    },
    nextInt(min, max) {
      const lo = Math.ceil(min);
      const hi = Math.floor(max);
      return lo + Math.floor(rng.next() * (hi - lo + 1));
    },
    range(min, max) {
      return min + rng.next() * (max - min);
    },
    pick(arr) {
      if (!arr || arr.length === 0) return undefined;
      return arr[Math.floor(rng.next() * arr.length)];
    },
    chance(p) {
      return rng.next() < p;
    },
    get calls() {
      return calls;
    },
  };
  return rng;
}

// Standalone helpers that take an rng object ({ next() }) as first arg.
// Traffic / sidejobs import these from here.
export function randRange(rng, min, max) {
  if (rng && typeof rng.next === 'function') {
    return min + rng.next() * (max - min);
  }
  return min + Math.random() * (max - min);
}

export function randInt(rng, min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  const r = rng && typeof rng.next === 'function' ? rng.next() : Math.random();
  return lo + Math.floor(r * (hi - lo + 1));
}

export function pick(rng, arr) {
  if (Array.isArray(rng)) {
    // pick(array) — no rng given, fall back to Math.random.
    const list = rng;
    if (list.length === 0) return undefined;
    return list[Math.floor(Math.random() * list.length)];
  }
  if (!arr || arr.length === 0) return undefined;
  const r = rng && typeof rng.next === 'function' ? rng.next() : Math.random();
  return arr[Math.floor(r * arr.length)];
}

export function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const r = rng && typeof rng.next === 'function' ? rng.next() : Math.random();
    const j = Math.floor(r * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
