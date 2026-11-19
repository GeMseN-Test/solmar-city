// Seeded RNG for Solmar City — deterministic world generation.
// mulberry32: small, fast, good enough for a game city layout.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Create an RNG from any seed (number or string).
export function createRng(seed) {
  if (typeof seed === 'string') {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    seed = h >>> 0;
  }
  if (!Number.isFinite(seed)) seed = (Math.random() * 0xffffffff) >>> 0;
  return mulberry32(seed >>> 0);
}

// Pick one element from a non-empty array, using the given rng.
export function pick(rng, arr) {
  if (!arr || arr.length === 0) return undefined;
  const i = Math.floor(rng() * arr.length);
  return arr[i];
}

// Random float in [min, max).
export function randRange(rng, min, max) {
  return min + rng() * (max - min);
}

// Random integer in [min, max] inclusive.
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// Random boolean, true with probability p (default 0.5).
export function chance(rng, p = 0.5) {
  return rng() < p;
}

// Shuffle a copy of the array (Fisher-Yates).
export function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

// Random element weighted by the parallel weights array.
export function pickWeighted(rng, items, weights) {
  let total = 0;
  for (const w of weights) total += w;
  let roll = rng() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}
