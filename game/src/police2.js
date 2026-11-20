// police2.js — deeper SCPD pressure: roadblocks and the helicopter.
// At 3+ stars two parked cruisers block the road ahead of the player
// (they are pushed into state.police.cars with roadblock: true so the
// renderer and collision see them; stepPolice skips moving them).
// At 4–5 stars a helicopter hovers over the player with a spotlight.
// Both vanish when the heat drops (roadblocks below 3, heli at 0).

import { clamp, dist } from './util.js';

export const HELI_SPOTLIGHT_RADIUS = 130;

export function createPolice2() {
  return {
    roadblocks: [],
    heli: null,
    roadblockCooldown: 0,
  };
}

function makeRoadblockCar(x, y, angle) {
  return {
    kind: 'police',
    roadblock: true,
    x, y,
    angle,
    speed: 0,
    cruise: 0,
    color: '#1c1c22',
    model: 'cruiser',
    ix: 0, iy: 0,
    fromIx: 0, fromIy: 0,
    nextIx: 0, nextIy: 0,
    wait: 0,
    wobble: 0,
  };
}

export function stepPolice2(state, dt) {
  const step = dt || 0.016;
  const p2 = state.police2;
  const police = state.police;
  const p = state.player;
  if (!p2 || !p) return;
  const wanted = state.wanted || 0;

  // --- Roadblocks at 3+ stars ----------------------------------------
  if (wanted >= 3) {
    if (p2.roadblocks.length === 0) {
      p2.roadblockCooldown -= step;
      if (p2.roadblockCooldown <= 0) {
        // Block the road ahead of the player: two cruisers side by
        // side, angled across the player's direction of travel.
        const ahead = p.inCar && p.car ? 260 : 200;
        const ax = p.angle != null ? p.angle : 0;
        const cx = p.x + Math.cos(ax) * ahead;
        const cy = p.y + Math.sin(ax) * ahead;
        const perp = ax + Math.PI / 2;
        const off = 34;
        const c1 = makeRoadblockCar(cx + Math.cos(perp) * off, cy + Math.sin(perp) * off, perp);
        const c2 = makeRoadblockCar(cx - Math.cos(perp) * off, cy - Math.sin(perp) * off, perp);
        p2.roadblocks.push(c1, c2);
        if (police && police.cars) police.cars.push(c1, c2);
      }
    } else {
      // Keep the block glued ahead of a moving player.
      const ahead = p.inCar && p.car ? 260 : 200;
      const ax = p.angle != null ? p.angle : 0;
      const cx = p.x + Math.cos(ax) * ahead;
      const cy = p.y + Math.sin(ax) * ahead;
      const perp = ax + Math.PI / 2;
      const off = 34;
      p2.roadblocks[0].x = cx + Math.cos(perp) * off;
      p2.roadblocks[0].y = cy + Math.sin(perp) * off;
      p2.roadblocks[0].angle = perp;
      p2.roadblocks[1].x = cx - Math.cos(perp) * off;
      p2.roadblocks[1].y = cy - Math.sin(perp) * off;
      p2.roadblocks[1].angle = perp;
    }
  } else if (p2.roadblocks.length > 0) {
    // Heat dropped: pull the block off the road.
    if (police && police.cars) {
      for (const rb of p2.roadblocks) {
        const idx = police.cars.indexOf(rb);
        if (idx >= 0) police.cars.splice(idx, 1);
      }
    }
    p2.roadblocks.length = 0;
    p2.roadblockCooldown = 4;
  }

  // --- Helicopter at 4–5 stars ----------------------------------------
  if (wanted >= 4) {
    if (!p2.heli) {
      p2.heli = { x: p.x, y: p.y - 40, angle: 0, rotor: 0 };
    }
    const heli = p2.heli;
    // Ease toward a hover just above the player.
    const tx = p.x;
    const ty = p.y - 30;
    heli.x += (tx - heli.x) * Math.min(1, 2.2 * step);
    heli.y += (ty - heli.y) * Math.min(1, 2.2 * step);
    heli.angle = Math.atan2(p.y - heli.y, p.x - heli.x);
    heli.rotor += step * 22;
  } else if (p2.heli) {
    p2.heli = null;
  }
}

// Spotlight circle on the ground under the heli, or null with no heli.
export function heliSpotlight(state) {
  const heli = state.police2 && state.police2.heli;
  if (!heli) return null;
  const p = state.player;
  return {
    x: p ? p.x : heli.x,
    y: p ? p.y : heli.y,
    r: HELI_SPOTLIGHT_RADIUS,
  };
}

export default {
  createPolice2,
  stepPolice2,
  heliSpotlight,
};
