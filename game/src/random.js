// random.js — Solmar City's seeded dice.
//
// Every procedural choice in the city (buildings, traffic, coins, gang
// spawn jitter) draws from one of these generators, so the same seed
// always grows the same city. The generator is mulberry32: small, fast,
// and good enough for a game — it is NOT for security or gambling.
//
// A generator is a plain object with five helpers:
//
//   next()        -> a float in [0, 1)
//   range(a, b)   -> a float in [a, b)
//   int(a, b)     -> a whole number in [a, b], both ends included
//   pick(list)    -> one element of list, picked at random
//   chance(p)     -> true with probability p (p in [0, 1])
//
// Create one per world with createRng(seed). Two generators made from
// the same seed produce the same sequence, call for call.

export function createRng(seed) {
  // Keep the state as an unsigned 32-bit integer. A seed of 0 would
  // freeze some generators, so fold it into a nonzero starting value.
  let state = (seed >>> 0) || 0x9e3779b9;

  function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function range(min, max) {
    return min + next() * (max - min);
  }

  function int(min, max) {
    // +1 makes the top end reachable: int(1, 6) can roll a 6.
    return Math.floor(min + next() * (max - min + 1));
  }

  function pick(list) {
    if (!list || list.length === 0) return undefined;
    return list[int(0, list.length - 1)];
  }

  function chance(probability) {
    return next() < probability;
  }

  return { next, range, int, pick, chance };
}
