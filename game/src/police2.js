// police2.js — deeper police AI: roadblocks (3+ stars) + heli (4-5 stars).
import { clamp } from './util.js';

export function createPolice2() {
  return { roadblocks: [], heli: null, roadblockCooldown: 0 };
}

export function heliSpotlight(state) {
  const p2 = state.police2;
  if (!p2 || !p2.heli) return null;
  const p = state.player;
  if (!p) return null;
  return { x: p.x, y: p.y, r: 130 };
}

function makeRoadblockCar(state, x, y, angle) {
  return {
    kind: 'police', x, y, angle, speed: 0, cruise: 0,
    color: '#1c2733', model: 'police', roadblock: true, radius: 16,
  };
}

export function stepPolice2(state, dt) {
  const p2 = state.police2;
  if (!p2) return;
  const p = state.player;
  if (!p) return;
  const wanted = clamp(state.wanted || 0, 0, 5);
  p2.roadblockCooldown = Math.max(0, (p2.roadblockCooldown || 0) - dt);

  // Roadblocks at 3+ stars: 2 parked cruisers across the road ahead.
  if (wanted >= 3) {
    if (p2.roadblocks.length === 0 && p2.roadblockCooldown <= 0) {
      // 300 ahead: inside the camera view (half-height 400), so the
      // player sees the block coming instead of driving into it blind.
      const ahead = 300;
      const ax = p.x + Math.cos(p.angle) * ahead;
      const ay = p.y + Math.sin(p.angle) * ahead;
      const perp = p.angle + Math.PI / 2;
      const off = 34;
      const c1 = makeRoadblockCar(state, ax + Math.cos(perp) * off, ay + Math.sin(perp) * off, p.angle + Math.PI / 2);
      const c2 = makeRoadblockCar(state, ax - Math.cos(perp) * off, ay - Math.sin(perp) * off, p.angle + Math.PI / 2);
      p2.roadblocks = [c1, c2];
      if (state.police) {
        state.police.cars.push(c1, c2);
      }
    }
    // Keep roadblocks glued to their spot (stepPolice skips moving them).
    for (const c of p2.roadblocks) c.speed = 0;
  } else if (p2.roadblocks.length > 0) {
    if (state.police) {
      state.police.cars = state.police.cars.filter((c) => !c.roadblock);
    }
    p2.roadblocks = [];
    p2.roadblockCooldown = 5;
  }

  // Helicopter at 4-5 stars: hovers above the player, spotlight below.
  if (wanted >= 4) {
    if (!p2.heli) {
      p2.heli = { x: p.x, y: p.y - 40, angle: 0, rotor: 0 };
    }
    p2.heli.x = p.x;
    p2.heli.y = p.y - 40;
    p2.heli.rotor += dt * 20;
    p2.heli.angle += dt * 0.5;
  } else if (wanted === 0) {
    p2.heli = null;
  } else if (p2.heli) {
    // 1-3 stars: heli drifts away and despawns.
    p2.heli.y -= dt * 120;
    p2.heli.rotor += dt * 20;
    if (p2.heli.y < p.y - 500) p2.heli = null;
  }
}

export function clearPolice2(state) {
  const p2 = state.police2;
  if (!p2) return;
  if (state.police) state.police.cars = state.police.cars.filter((c) => !c.roadblock);
  p2.roadblocks = [];
  p2.heli = null;
}
export default createPolice2;
