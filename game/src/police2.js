// police2.js — Deeper SCPD police AI: roadblocks at 3+ stars and a
// police helicopter at 4–5 stars.
// Roadblocks: 2 parked cruisers across the road ahead of the player,
// pushed into state.police.cars with roadblock: true (stepPolice skips
// moving them); removed below 3 stars. Heli: hovers above the player
// with a spotlight circle (r 130) on the ground; visual only, gone at
// 0 stars.

export const ROADBLOCK_STARS = 3;
export const HELI_STARS = 4;
export const SPOTLIGHT_RADIUS = 130;

export function createPolice2() {
  return { roadblocks: [], heli: null, roadblockCooldown: 0 };
}

export function heliSpotlight(state) {
  if (!state || !state.police2 || !state.police2.heli) return null;
  const p = state.player;
  if (!p) return null;
  return { x: p.x, y: p.y, r: SPOTLIGHT_RADIUS };
}

function placeRoadblocks(state) {
  const p = state.player;
  const police = state.police;
  const police2 = state.police2;
  if (!police || !police2) return;
  // Two cruisers parked across the road ahead of the player.
  const ahead = 320;
  const dirX = Math.cos(p.angle);
  const dirY = Math.sin(p.angle);
  const cx = p.x + dirX * ahead;
  const cy = p.y + dirY * ahead;
  const perpX = -dirY;
  const perpY = dirX;
  const offsets = [-42, 42];
  for (let i = 0; i < offsets.length; i++) {
    const off = offsets[i];
    const cruiser = {
      kind: 'police',
      dept: 'SCPD',
      x: cx + perpX * off,
      y: cy + perpY * off,
      angle: p.angle + Math.PI / 2,
      speed: 0,
      cruise: 0,
      color: '#1c2733',
      model: 'sedan',
      roadblock: true,
      siren: true,
    };
    police.cars.push(cruiser);
    police2.roadblocks.push(cruiser);
  }
}

function clearRoadblocks(state) {
  const police = state.police;
  const police2 = state.police2;
  if (!police2) return;
  if (police && police.cars) {
    police.cars = police.cars.filter((c) => !c.roadblock);
  }
  police2.roadblocks = [];
}

export function stepPolice2(state, dt) {
  if (!state || !state.police2 || !state.player) return;
  const police2 = state.police2;
  const police = state.police;
  const wanted = police ? police.wanted : 0;
  police2.roadblockCooldown -= dt;
  // Roadblocks at 3+ stars.
  if (wanted >= ROADBLOCK_STARS) {
    if (police2.roadblocks.length === 0 && police2.roadblockCooldown <= 0) {
      placeRoadblocks(state);
      police2.roadblockCooldown = 9;
    }
  } else if (police2.roadblocks.length > 0) {
    clearRoadblocks(state);
  }
  // Helicopter at 4–5 stars, gone at 0.
  if (wanted >= HELI_STARS) {
    if (!police2.heli) {
      police2.heli = {
        x: state.player.x,
        y: state.player.y - 60,
        angle: 0,
        rotor: 0,
      };
    }
    const heli = police2.heli;
    heli.rotor += dt * 28;
    // Ease toward hovering right above the player.
    heli.x += (state.player.x - heli.x) * Math.min(1, 2.5 * dt);
    heli.y += (state.player.y - 70 - heli.y) * Math.min(1, 2.5 * dt);
    heli.angle += dt * 0.4;
  } else if (police2.heli) {
    police2.heli = null;
  }
}

export function roadblockCount(state) {
  if (!state || !state.police2) return 0;
  return state.police2.roadblocks.length;
}

export default createPolice2;
