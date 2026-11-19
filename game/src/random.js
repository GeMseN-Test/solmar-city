// random.js — small seeded random helpers for Solmar City.
// Everything in the game that must be reproducible from a seed goes
// through here, so a given seed always builds the same city, the same
// traffic and the same coin spots.

// Mulberry32: a tiny fast seeded PRNG. Seed it with any integer and
// it spits out the same stream of numbers in [0, 1) every time.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Build a game RNG from a seed. The result is a callable function
// (call rng() for a float in [0, 1)) that also carries handy methods,
// so callers can use whichever style reads best:
//   rng()            -> float 0..1
//   rng.range(2, 5)  -> float between 2 and 5
//   rng.int(1, 6)    -> whole number 1..6 inclusive
//   rng.pick(list)   -> one random element
//   rng.chance(0.3)  -> true 30% of the time
export function createRng(seed) {
  const next = mulberry32(seed);
  function rng() {
    return next();
  }
  rng.next = next;
  rng.float = function float() {
    return next();
  };
  rng.range = function range(min, max) {
    return min + next() * (max - min);
  };
  rng.int = function int(min, max) {
    return Math.floor(min + next() * (max - min + 1));
  };
  rng.pick = function pick(list) {
    if (!list || list.length === 0) return undefined;
    return list[Math.floor(next() * list.length)];
  };
  rng.chance = function chance(p) {
    return next() < p;
  };
  rng.shuffle = function shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  };
  rng.seed = seed >>> 0;
  return rng;
}

// Standalone helpers for callers that hold a bare rng function
// (for example the one returned by mulberry32) instead of a
// createRng object. Same behaviour as the methods above.
export function randRange(rng, min, max) {
  const f = typeof rng === 'function' ? rng : rng.next;
  return min + f() * (max - min);
}

export function randInt(rng, min, max) {
  const f = typeof rng === 'function' ? rng : rng.next;
  return Math.floor(min + f() * (max - min + 1));
}

export function pick(rng, list) {
  if (!list || list.length === 0) return undefined;
  const f = typeof rng === 'function' ? rng : rng.next;
  return list[Math.floor(f() * list.length)];
}

export function chance(rng, p) {
  const f = typeof rng === 'function' ? rng : rng.next;
  return f() < p;
}

// One random element, plain Math.random version, for cosmetic
// things that do not need to be seeded (screen shake, sparkles).
export function pickPlain(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export default createRng;
