// random.js — seeded RNG for Solmar City.
// Deterministic: same seed -> same sequence. City, traffic, boats and
// side jobs all draw from one rng so a seed always rebuilds the same map.

export function hashSeed(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return (value >>> 0) || 1;
  }
  const s = String(value ?? 'solmar');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) || 1;
}

export function mulberry32(seed) {
  let a = hashSeed(seed);
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed) {
  const next = mulberry32(seed);
  const rng = {
    seed: hashSeed(seed),
    next,
    range(min, max) {
      return min + next() * (max - min);
    },
    int(min, max) {
      // Inclusive on both ends.
      return Math.floor(min + next() * (max - min + 1));
    },
    pick(list) {
      if (!list || list.length === 0) return undefined;
      return list[Math.floor(next() * list.length)];
    },
    chance(p) {
      return next() < p;
    },
    shuffle(list) {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    },
  };
  return rng;
}
