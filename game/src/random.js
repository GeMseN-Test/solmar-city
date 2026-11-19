// Seeded random helpers for Solmar City.
//
// Everything random in the game flows through one small deterministic
// generator (mulberry32): same seed, same city, same traffic, same
// coins. The generator is a callable function — rng() rolls one float
// in [0, 1) — with the usual helpers hanging off it, so callers can
// use whichever shape reads best: rng.next(), rng.range(a, b),
// rng.pick(list), or the plain module functions below.

function draw(rng) {
  if (typeof rng === 'function') return rng();
  if (rng && typeof rng.next === 'function') return rng.next();
  return Math.random();
}

export function createRng(seed = 1) {
  const startSeed = (seed >>> 0) || 1;
  let s = startSeed;

  function next() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // The generator itself is callable: rng() is one float in [0, 1).
  function rng() {
    return next();
  }
  rng.next = next;
  rng.seed = startSeed;
  rng.range = (min, max) => min + next() * (max - min);
  rng.int = (min, max) => min + Math.floor(next() * (max - min + 1));
  rng.pick = (list) => list[Math.floor(next() * list.length)];
  rng.chance = (p) => next() < p;
  rng.sign = () => (next() < 0.5 ? -1 : 1);
  rng.shuffle = (list) => {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  };
  return rng;
}

// Same generator under its classic name.
export function mulberry32(seed = 1) {
  return createRng(seed);
}

export function createRandom(seed = 1) {
  return createRng(seed);
}

// Plain helpers that take any rng (a createRng result, a bare
// function, or nothing at all — then Math.random fills in).

export function randRange(rng, min, max) {
  return min + draw(rng) * (max - min);
}

export function randInt(rng, min, max) {
  return min + Math.floor(draw(rng) * (max - min + 1));
}

export function pick(rng, list) {
  return list[Math.floor(draw(rng) * list.length)];
}

export function chance(rng, p) {
  return draw(rng) < p;
}

export function shuffle(rng, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(draw(rng) * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
