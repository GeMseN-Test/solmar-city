// Deeper police AI, layered on top of police.js:
//   - roadblocks at 3+ stars: two parked cruisers across the road
//     ahead of the player (they sit in state.police.cars with
//     roadblock: true, and stepPolice leaves parked cars alone);
//   - a police helicopter at 4-5 stars that hovers over the player
//     with a spotlight circle on the ground. Visual pressure only —
//     it never shoots.
import { clamp, dist } from './util.js';

export function createPolice2() {
  return { roadblocks: [], heli: null, roadblockCooldown: 0 };
}

// Where the spotlight falls, or null when there is no helicopter.
export function heliSpotlight(state) {
  const heli = state.police2.heli;
  if (!heli) return null;
  return { x: state.player.x, y: state.player.y, r: 130 };
}

export function stepPolice2(state, dt) {
  const p2 = state.police2;
  const pol = state.police;
  const p = state.player;
  if (p2.roadblockCooldown > 0) p2.roadblockCooldown -= dt;

  // --- Roadblocks -------------------------------------------------
  if (pol.wanted >= 3) {
    if (p2.roadblocks.length === 0 && p2.roadblockCooldown <= 0) {
      // Two cruisers parked across the road ahead of the player.
      const fx = Math.cos(p.angle);
      const fy = Math.sin(p.angle);
      const ax = p.x + fx * 230;
      const ay = p.y + fy * 230;
      const px = -fy;
      const py = fx;
      const blockAngle = p.angle + Math.PI / 2;
      for (const side of [-42, 42]) {
        const car = {
          kind: 'police',
          x: clamp(ax + px * side, 40, 2840),
          y: clamp(ay + py * side, 40, 1980),
          angle: blockAngle,
          speed: 0,
          cruise: 0,
          color: '#1a1a2e',
          model: 'sedan',
          ramCooldown: 0,
          roadblock: true,
        };
        pol.cars.push(car);
        p2.roadblocks.push(car);
      }
      p2.roadblockCooldown = 6;
    }
  } else if (p2.roadblocks.length > 0) {
    // Heat dropped: the blockade pulls away.
    pol.cars = pol.cars.filter((c) => !c.roadblock);
    p2.roadblocks = [];
    p2.roadblockCooldown = 4;
  }

  // --- Helicopter -------------------------------------------------
  if (pol.wanted >= 4) {
    if (!p2.heli) {
      p2.heli = { x: p.x, y: p.y - 160, angle: 0, rotor: 0 };
    }
    const heli = p2.heli;
    heli.rotor += dt * 22;
    // Ease toward a hover right above the player.
    heli.x += (p.x - heli.x) * Math.min(1, dt * 1.4);
    heli.y += (p.y - 40 - heli.y) * Math.min(1, dt * 1.4);
    heli.angle += dt * 0.4;
  } else if (p2.heli) {
    p2.heli = null;
  }
}
