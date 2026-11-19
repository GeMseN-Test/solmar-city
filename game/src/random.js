// Seeded RNG for Solmar City — every random draw in the game flows
// through here so a fixed seed always builds the same city, the same
// traffic and the same coin spots. Mulberry32: small, fast, good enough
// for a game, and it never touches Math.random so replays stay stable.

export function createRng(seed) {
  let a = seed >>> 0;
  if (a === 0) a = 0x9e3779b9;
  const rng = {
    seed: a,
    next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    float(min, max) {
      if (max === undefined) {
        max = min === undefined ? 1 : min;
        min = 0;
      }
      return min + rng.next() * (max - min);
    },
    int(min, max) {
      return Math.floor(rng.float(min, max + 1));
    },
    pick(list) {
      return list[Math.floor(rng.next() * list.length)];
    },
    chance(p) {
      return rng.next() < p;
    },
    sign() {
      return rng.next() < 0.5 ? -1 : 1;
    },
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
  };
  return rng;
}

// Turn any string (a seed word, a player name) into a 32-bit seed.
export function seedFromString(text) {
  let h = 2166136261;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// A throwaway RNG for one-off cosmetic draws (particles, flashes)
// that must not disturb the seeded stream.
export function cosmeticRng() {
  return createRng((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
}
