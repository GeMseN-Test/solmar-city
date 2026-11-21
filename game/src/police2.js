// police2.js — deeper SCPD pressure: roadblocks at 3+ stars and a
// police helicopter with a spotlight at 4–5 stars.
// state.police2 = { roadblocks: [], heli: null, roadblockCooldown: 0 }.
// Roadblock cruisers are pushed into state.police.cars with
// roadblock: true (stepPolice skips moving them) and removed below 3.

import { randRange } from './random.js';
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
  const p = state.player;
  if (!p2 || !p2.heli || !p) return null;
  return { x: p.x, y: p.y, r: 130 };
}

function clearRoadblocks(state) {
  const p2 = state.police2;
  if (!p2) return;
  if (state.police && state.police.cars) {
    state.police.cars = state.police.cars.filter((c) => !c.roadblock);
  }
  p2.roadblocks = [];
}

function placeRoadblocks(state) {
  const p2 = state.police2;
  const p = state.player;
  const city = state.city;
  if (!p2 || !p) return;
  // Two parked cruisers across the road ahead of the player.
  const ahead = 300;
  const ax = p.x + Math.cos(p.angle || 0) * ahead;
  const ay = p.y + Math.sin(p.angle || 0) * ahead;
  const spots = [
    { x: ax, y: ay - 34 },
    { x: ax, y: ay + 34 },
  ];
  for (const s of spots) {
    let x = s.x;
    let y = s.y;
    if (city && city.nearestRoadPoint) {
      const pt = city.nearestRoadPoint(x, y);
      x = pt.x;
      y = pt.y;
    }
    const car = {
      kind: 'police',
      x: clamp(x, 40, 2840),
      y: clamp(y, 40, 2000),
      angle: (p.angle || 0) + Math.PI / 2,
      speed: 0,
      roadblock: true,
      color: '#1c2733',
      sirenPhase: 0,
    };
    p2.roadblocks.push(car);
    if (state.police && state.police.cars) state.police.cars.push(car);
  }
}

export function stepPolice2(state, dt) {
  const total = Math.max(0.001, dt || 0.016);
  const n = Math.max(1, Math.ceil(total / 0.05));
  const sub = total / n;
  for (let i = 0; i < n; i += 1) stepPolice2Once(state, sub);
}

function stepPolice2Once(state, step) {
  const p2 = state.police2;
  const p = state.player;
  if (!p2 || !p) return;
  const wanted = state.wanted || 0;
  p2.roadblockCooldown -= step;

  // Roadblocks at 3+ stars, gone below 3.
  if (wanted >= 3) {
    if (p2.roadblocks.length === 0 && p2.roadblockCooldown <= 0) {
      placeRoadblocks(state);
      p2.roadblockCooldown = 6;
    }
    // Re-place if the player drove far away from the block.
    if (p2.roadblocks.length > 0) {
      const b = p2.roadblocks[0];
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      if (dx * dx + dy * dy > 900 * 900 && p2.roadblockCooldown <= 0) {
        clearRoadblocks(state);
        placeRoadblocks(state);
        p2.roadblockCooldown = 6;
      }
    }
  } else if (p2.roadblocks.length > 0) {
    clearRoadblocks(state);
  }

  // Helicopter at 4–5 stars, hovering above the player. Gone at 0.
  if (wanted >= 4) {
    if (!p2.heli) {
      p2.heli = { x: p.x, y: p.y - 120, angle: 0, rotor: 0 };
    }
    p2.heli.x += (p.x - p2.heli.x) * Math.min(1, 2.2 * step);
    p2.heli.y += (p.y - 90 - p2.heli.y) * Math.min(1, 2.2 * step);
    p2.heli.angle = Math.atan2(p.y - p2.heli.y, p.x - p2.heli.x);
    p2.heli.rotor += step * 28;
  } else if (p2.heli) {
    p2.heli = null;
  }
  void randRange;
}

export default { createPolice2, stepPolice2, heliSpotlight };
