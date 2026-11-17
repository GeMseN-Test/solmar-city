// A small seeded random source for Solmar City. The same seed always deals
// the same city, the same traffic and the same screenshot scenes, so a pose
// taken today renders exactly the same frame tomorrow.
//
// The generator is a xorshift-style walk over a 32-bit state, written out
// longhand here so the shape of the stream is easy to follow: scramble the
// state, fold it, and scale the top bits into [0, 1).
export function createRng(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  function next() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    // Fold the scrambled state once more so neighbouring outputs diverge.
    let folded = state ^ (state >>> 11);
    folded = Math.imul(folded, 0x85ebca6b) >>> 0;
    folded = (folded ^ (folded >>> 13)) >>> 0;
    return folded / 4294967296;
  }
  return {
    next,
    /** A float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** An integer in [min, max] inclusive. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** One element of a non-empty array, uniformly. */
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    /** True with probability p (0 to 1). */
    chance(p) {
      return next() < p;
    },
  };
}
