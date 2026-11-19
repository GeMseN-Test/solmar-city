// police2.js — the deeper police toys: roadblocks at 3+ stars and
// the police helicopter at 4-5 stars. Roadblock cruisers are parked
// across the road ahead of the player and pushed into
// state.police.cars with roadblock: true (stepPolice skips moving
// them); they are pulled out again below 3 stars. The helicopter
// just hovers above the player with a spotlight circle on the
// ground — visual only — and despawns at 0 stars.

import { clamp, dist } from './util.js';

export function createPolice2() {
  return {
    roadblocks: [],
    heli: null,
    roadblockCooldown: 0,
  };
}

// Spotlight circle under the helicopter, or null with no heli.
export function heliSpotlight(state) {
  const heli = state.police2 && state.police2.heli;
  if (!heli) return null;
  return { x: state.player.x, y: state.player.y, r: 130 };
}

function placeRoadblocks(state) {
  const player = state.player;
  const police2 = state.police2;
  const ahead = player.angle;
  // Two cruisers side by side across the road, ~260px ahead.
  const cx = player.x + Math.cos(ahead) * 260;
  const cy = player.y + Math.sin(ahead) * 260;
  const side = ahead + Math.PI / 2;
  const spots = [
    { x: cx + Math.cos(side) * 30, y: cy + Math.sin(side) * 30 },
    { x: cx - Math.cos(side) * 30, y: cy - Math.sin(side) * 30 },
  ];
  for (const spot of spots) {
    const car = {
      kind: 'police',
      x: clamp(spot.x, 40, 2840),
      y: clamp(spot.y, 40, 2060),
      angle: ahead + Math.PI / 2,
      speed: 0,
      cruise: 0,
      color: '#1a1a2e',
      model: 'police',
      roadblock: true,
      ramCooldown: 0,
    };
    police2.roadblocks.push(car);
    if (state.police) state.police.cars.push(car);
  }
}

function removeRoadblocks(state) {
  const police2 = state.police2;
  if (!police2) return;
  if (state.police) {
    state.police.cars = state.police.cars.filter((c) => !c.roadblock);
  }
  police2.roadblocks = [];
}

export function stepPolice2(state, dt) {
  let remaining = dt;
  while (remaining > 0) {
    const chunk = Math.min(remaining, 0.05);
    stepPolice2Once(state, chunk);
    remaining -= chunk;
  }
}

function stepPolice2Once(state, dt) {
  const step = Math.min(dt, 0.05);
  const police2 = state.police2;
  if (!police2) return;
  const player = state.player;
  if (!player) return;
  const wanted = state.wanted || 0;

  if (police2.roadblockCooldown > 0) police2.roadblockCooldown -= step;

  if (wanted >= 3) {
    // Keep exactly two parked cruisers ahead of the player.
    if (police2.roadblocks.length < 2 && police2.roadblockCooldown <= 0) {
      placeRoadblocks(state);
      police2.roadblockCooldown = 4;
    }
    // If the player drove far past them, pull them and re-place
    // ahead on the next cooldown tick.
    if (police2.roadblocks.length > 0) {
      const first = police2.roadblocks[0];
      if (dist(first.x, first.y, player.x, player.y) > 700) {
        removeRoadblocks(state);
        police2.roadblockCooldown = 1.5;
      }
    }
  } else if (police2.roadblocks.length > 0) {
    removeRoadblocks(state);
  }

  if (wanted >= 4) {
    if (!police2.heli) {
      police2.heli = {
        x: player.x,
        y: player.y - 120,
        angle: 0,
        rotor: 0,
      };
    }
    const heli = police2.heli;
    heli.rotor += step * 22;
    heli.angle += step * 0.4;
    // Hover above the player, trailing slightly behind.
    heli.x += (player.x - heli.x) * Math.min(1, 1.8 * step);
    heli.y += (player.y - 90 - heli.y) * Math.min(1, 1.8 * step);
  } else if (wanted === 0 && police2.heli) {
    police2.heli = null;
  } else if (wanted < 4 && police2.heli) {
    // Heat dropped below 4: the heli peels away.
    police2.heli = null;
  }
}

export default createPolice2;
