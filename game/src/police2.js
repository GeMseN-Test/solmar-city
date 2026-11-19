// Deeper police AI: roadblocks and the helicopter.
//
// At 3+ stars, two parked cruisers block the road ahead of the
// player. They are pushed into state.police.cars with
// roadblock: true — stepPolice never moves them — and they are
// pulled out again below 3 stars. At 4–5 stars a helicopter
// hovers over the player with a spotlight on the ground; it
// despawns when the heat hits zero. The heli is visual only:
// it never shoots, it never busts.

import { clamp } from './util.js';

export function createPolice2() {
  return {
    roadblocks: [],
    heli: null,
    roadblockCooldown: 0,
  };
}

export function heliSpotlight(state) {
  const p2 = state.police2;
  if (!p2 || !p2.heli) return null;
  return { x: state.player.x, y: state.player.y, r: 130 };
}

function removeRoadblocks(state) {
  const p2 = state.police2;
  if (!p2) return;
  if (state.police) {
    state.police.cars = state.police.cars.filter((c) => !c.roadblock);
  }
  p2.roadblocks = [];
}

function spawnRoadblocks(state) {
  const p2 = state.police2;
  const p = state.player;
  // Two cruisers across the road ahead of the player, parked
  // nose-to-tail across the lane, 300px up the road.
  const ahead = 300;
  const ax = p.x + Math.cos(p.angle) * ahead;
  const ay = p.y + Math.sin(p.angle) * ahead;
  const px = -Math.sin(p.angle);
  const py = Math.cos(p.angle);
  const across = p.angle + Math.PI / 2;
  for (const side of [-1, 1]) {
    const car = {
      kind: 'police',
      x: ax + px * 38 * side,
      y: ay + py * 38 * side,
      angle: across,
      speed: 0,
      color: '#20262e',
      roadblock: true,
      ramCooldown: 0,
    };
    p2.roadblocks.push(car);
    if (state.police) state.police.cars.push(car);
  }
  p2.roadblockCooldown = 5;
}

export function stepPolice2(state, dt) {
  const p2 = state.police2;
  const p = state.player;
  if (!p2 || !p) return;
  const wanted = state.wanted || 0;
  if (p2.roadblockCooldown > 0) p2.roadblockCooldown -= dt;

  // Roadblocks live only at 3+ stars.
  if (wanted >= 3) {
    if (p2.roadblocks.length === 0 && p2.roadblockCooldown <= 0) {
      spawnRoadblocks(state);
    }
  } else if (p2.roadblocks.length > 0) {
    removeRoadblocks(state);
  }

  // The helicopter shows up at 4–5 stars and stays until the
  // heat is fully gone.
  if (wanted >= 4) {
    if (!p2.heli) {
      p2.heli = { x: p.x, y: p.y - 200, angle: 0, rotor: 0 };
    }
  } else if (wanted === 0) {
    p2.heli = null;
  }
  if (p2.heli) {
    const heli = p2.heli;
    const k = clamp(dt * 1.8, 0, 1);
    heli.x += (p.x - heli.x) * k;
    heli.y += (p.y - 60 - heli.y) * k;
    heli.angle += dt * 0.3;
    heli.rotor += dt * 22;
  }
}

export function clearPolice2(state) {
  if (!state.police2) return;
  removeRoadblocks(state);
  state.police2.heli = null;
  state.police2.roadblockCooldown = 0;
}
