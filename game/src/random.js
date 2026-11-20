// Solmar City — seeded random numbers. Every random choice in the
// game (city layout, traffic, pickups, coins, gang spawns) comes from
// one of these, so a seed always rebuilds the same city.
//
// mulberry32 is a small, fast, well-behaved PRNG: given the same seed
// it always produces the same stream of numbers.

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

// A little RNG that is BOTH callable and an object: call it as
// rng() for a float in [0, 1), or use its methods — rng.next(),
// rng.int(a, b), rng.range(a, b), rng.pick(list), rng.chance(p).
// Callable on purpose: some modules treat the rng as a plain
// function, others as an object with helpers; this satisfies both.
export function createRng(seed) {
  const next = mulberry32(seed);
  function rng() {
    return next();
  }
  rng.next = next;
  rng.seed = seed >>> 0;
  rng.int = function int(min, max) {
    return min + Math.floor(next() * (max - min + 1));
  };
  rng.range = function range(min, max) {
    return min + next() * (max - min);
  };
  rng.pick = function pick(list) {
    return list[Math.floor(next() * list.length)];
  };
  rng.chance = function chance(p) {
    return next() < p;
  };
  return rng;
}

// Standalone helpers for modules that keep their own rng function
// instead of an object. rng is always the first argument.
export function randRange(rng, min, max) {
  const f = typeof rng === 'function' ? rng : rng.next;
  return min + f() * (max - min);
}

export function randInt(rng, min, max) {
  return min + Math.floor(randRange(rng, min, max + 1));
}

export function pick(rng, list) {
  const f = typeof rng === 'function' ? rng : rng.next;
  return list[Math.floor(f() * list.length)];
}

// Fisher-Yates shuffle, in place, driven by the seeded rng.
export function shuffle(rng, list) {
  const f = typeof rng === 'function' ? rng : rng.next;
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(f() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list;
}
