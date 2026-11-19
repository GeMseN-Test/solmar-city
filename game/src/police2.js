// Deeper police AI (v2): roadblocks at 3+ stars, helicopter at 4-5.
// Roadblock cruisers are parked cars pushed into state.police.cars
// with roadblock: true — stepPolice skips moving them. The heli is
// visual only: it hovers above the player with a spotlight circle.
import { clamp } from './util.js';
import { randRange } from './random.js';

const HELI_SPOTLIGHT_R = 130;

export function createPolice2() {
  return {
    roadblocks: [],
    heli: null,
    roadblockCooldown: 0,
  };
}

// Spotlight circle on the ground under the heli, or null.
export function heliSpotlight(state) {
  const heli = state.police2 && state.police2.heli;
  if (!heli) return null;
  return { x: state.player.x, y: state.player.y, r: HELI_SPOTLIGHT_R };
}

export function stepPolice2(state, dt) {
  const p2 = state.police2;
  const p = state.player;
  if (!p2 || !p) return;
  const wanted = state.wanted || 0;
  p2.roadblockCooldown = Math.max(0, p2.roadblockCooldown - dt);

  // --- Roadblocks at 3+ stars ---
  if (wanted >= 3) {
    if (p2.roadblocks.length === 0 && p2.roadblockCooldown <= 0) {
      // Two parked cruisers across the road ahead of the player.
      const ahead = p.angle;
      const ax = Math.cos(ahead);
      const ay = Math.sin(ahead);
      // Perpendicular offset so the pair blocks the lane.
      const px = -ay;
      const py = ax;
      const baseX = p.x + ax * 260;
      const baseY = p.y + ay * 260;
      const placed = [];
      for (const side of [-1, 1]) {
        const car = {
          kind: 'police',
          x: clamp(baseX + px * 34 * side, 40, 2840),
          y: clamp(baseY + py * 34 * side, 40, 2000),
          angle: ahead + Math.PI / 2,
          speed: 0,
          cruise: 0,
          color: '#1c2733',
          model: 'cruiser',
          roadblock: true,
          ramCooldown: 0,
        };
        state.police.cars.push(car);
        placed.push(car);
      }
      p2.roadblocks = placed;
      p2.roadblockCooldown = 6;
    }
  } else if (p2.roadblocks.length > 0) {
    // Below 3 stars: pull the roadblock.
    const set = new Set(p2.roadblocks);
    state.police.cars = state.police.cars.filter((c) => !set.has(c));
    p2.roadblocks = [];
  }

  // --- Helicopter at 4-5 stars ---
  if (wanted >= 4) {
    if (!p2.heli) {
      p2.heli = { x: p.x, y: p.y - 120, angle: 0, rotor: 0 };
    }
    const heli = p2.heli;
    // Hover above the player with a slight lag and bob.
    heli.x += (p.x - heli.x) * Math.min(1, 2.2 * dt);
    heli.y += (p.y - 40 - heli.y) * Math.min(1, 2.2 * dt);
    heli.angle += dt * 0.8;
    heli.rotor += dt * 22;
    // Spotlight follows the player exactly.
    heli.spotX = p.x;
    heli.spotY = p.y;
  } else if (p2.heli) {
    p2.heli = null;
  }

  // At 0 stars everything is gone.
  if (wanted <= 0) {
    if (p2.roadblocks.length > 0) {
      const set = new Set(p2.roadblocks);
      state.police.cars = state.police.cars.filter((c) => !set.has(c));
      p2.roadblocks = [];
    }
    p2.heli = null;
  }
  void randRange;
}

export default createPolice2;
