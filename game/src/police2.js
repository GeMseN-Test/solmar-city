// Deeper police AI for Solmar City: roadblocks at 3+ stars and a
// police helicopter at 4-5 stars. This module only READS the wanted
// level — world.js owns stars and decay. Roadblock cruisers are
// pushed into state.police.cars too (with roadblock: true) so the
// renderer and the collision code see them; stepPolice skips moving
// them. The helicopter is visual only: it hovers above the player
// with a spotlight circle on the ground.

import { clamp } from './util.js';

export function createPolice2() {
  return {
    roadblocks: [],
    heli: null,
    roadblockCooldown: 0,
  };
}

// Spotlight circle on the ground under the helicopter, or null when
// there is no helicopter in the air.
export function heliSpotlight(state) {
  if (!state.police2 || !state.police2.heli) return null;
  return { x: state.player.x, y: state.player.y, r: 130 };
}

function spawnRoadblocks(state) {
  const p = state.player;
  const city = state.city;
  const police = state.police;
  // Two cruisers parked across the road ahead of the player, one on
  // each side of the centre line, noses pointing at the player.
  const ahead = city.nearestRoadPoint(
    p.x + Math.cos(p.angle) * 230,
    p.y + Math.sin(p.angle) * 230,
  );
  const fx = Math.cos(p.angle);
  const fy = Math.sin(p.angle);
  const px = -fy;
  const py = fx;
  const made = [];
  for (const side of [-1, 1]) {
    const car = {
      kind: 'police',
      x: ahead.x + px * 26 * side,
      y: ahead.y + py * 26 * side,
      angle: Math.atan2(p.y - ahead.y, p.x - ahead.x),
      speed: 0,
      cruise: 0,
      color: '#20242e',
      model: 'cruiser',
      roadblock: true,
    };
    state.police2.roadblocks.push(car);
    if (police) police.cars.push(car);
    made.push(car);
  }
  return made;
}

function clearRoadblocks(state) {
  if (state.police2.roadblocks.length === 0) return;
  const gone = new Set(state.police2.roadblocks);
  if (state.police) {
    state.police.cars = state.police.cars.filter((c) => !gone.has(c));
  }
  state.police2.roadblocks = [];
}

// One tick. Roadblocks appear at 3+ stars and vanish below 3; the
// helicopter appears at 4-5 stars and is gone at 0 (and below 4).
export function stepPolice2(state, dt) {
  const p2 = state.police2;
  const p = state.player;
  if (!p2 || !p) return;
  const wanted = typeof state.wanted === 'number' ? state.wanted : 0;
  p2.roadblockCooldown = Math.max(0, p2.roadblockCooldown - dt);

  if (wanted >= 3) {
    if (p2.roadblocks.length === 0 && p2.roadblockCooldown <= 0) {
      spawnRoadblocks(state);
      p2.roadblockCooldown = 6;
    }
  } else {
    clearRoadblocks(state);
  }

  if (wanted >= 4) {
    if (!p2.heli) {
      p2.heli = { x: p.x, y: p.y - 40, angle: 0, rotor: 0 };
    }
    // Hover above the player, drifting after them, rotor spinning.
    p2.heli.x += clamp(p.x - p2.heli.x, -260 * dt, 260 * dt);
    p2.heli.y += clamp(p.y - 30 - p2.heli.y, -260 * dt, 260 * dt);
    p2.heli.rotor += dt * 28;
    p2.heli.angle += dt * 0.4;
  } else if (p2.heli) {
    p2.heli = null;
  }
}

export default createPolice2;
