// random.js — seeded deterministic RNG for Solmar City.
// Every random choice in the world (city layout, traffic, coins, gang
// spawns) flows through this one generator so a seed replays the same
// city. Mulberry32: small, fast, good enough for a game world.

export function createRng(seed) {
  // Normalize the seed to a uint32. Strings are hashed, numbers are
  // masked, missing seeds fall back to a fixed default so a world is
  // always reproducible unless the caller passes Date.now().
  let a = 0;
  if (typeof seed === 'string') {
    for (let i = 0; i < seed.length; i++) {
      a = (a * 31 + seed.charCodeAt(i)) >>> 0;
    }
  } else if (typeof seed === 'number' && Number.isFinite(seed)) {
    a = seed >>> 0;
  } else {
    a = 0x9e3779b9;
  }
  if (a === 0) a = 0x9e3779b9;

  const rng = {
    seed: a,
    // Next float in [0, 1).
    next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    // Float in [min, max).
    range(min, max) {
      return min + (max - min) * rng.next();
    },
    // Integer in [min, max] inclusive.
    int(min, max) {
      return Math.floor(rng.range(min, max + 1));
    },
    // One element of an array (undefined for an empty array).
    pick(list) {
      if (!list || list.length === 0) return undefined;
      return list[Math.floor(rng.next() * list.length)];
    },
    // True with probability p (0..1).
    chance(p) {
      return rng.next() < p;
    },
    // -1 or +1 with equal odds.
    sign() {
      return rng.next() < 0.5 ? -1 : 1;
    },
    // Fisher-Yates shuffle, returns a new array.
    shuffle(list) {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    },
    // A random angle in radians, 0..2PI.
    angle() {
      return rng.next() * Math.PI * 2;
    },
    // Gaussian-ish value in [-1, 1] (average of three uniforms).
    bell() {
      return (rng.next() + rng.next() + rng.next()) / 1.5 - 1;
    },
  };
  return rng;
}

// Convenience one-liner: a throwaway RNG from any seed value.
export function rngFrom(seed) {
  return createRng(seed);
}

// Default export for callers that import the module as a whole.
export default createRng;
