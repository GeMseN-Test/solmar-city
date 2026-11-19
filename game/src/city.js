// city.js — Solmar City map: roads, buildings, parks, landmarks.
import { WORLD_W, WORLD_H, SEA_TOP, BEACH_TOP, GRID_PITCH, ROAD_WIDTH } from './config.js';
import { randRange, randInt, pick } from './random.js';

export const ROAD_XS = [180, 540, 900, 1260, 1620, 1980, 2340, 2700];
export const ROAD_YS = [180, 540, 900, 1260, 1620, 1980];

export const LANDMARKS = {
  garage: { key: 'garage', name: "Ray's Garage", x: 700, y: 830 },
  safehouse: { key: 'safehouse', name: "Mara's Safehouse", x: 1420, y: 1190 },
  bank: { key: 'bank', name: 'Grand Solmar Bank', x: 1800, y: 1190 },
  turf: { key: 'turf', name: "Vipers' Turf", x: 700, y: 1790 },
  docks: { key: 'docks', name: 'Solmar Docks', x: 360, y: 130 },
  marina: { key: 'marina', name: 'Solmar Marina', x: 2520, y: 1930 },
  radio: { key: 'radio', name: 'Solmar Radio', x: 2520, y: 130 },
  island: { key: 'island', name: 'Gull Island', x: 1440, y: 2130 },
};

const BUILDING_COLORS = ['#3a4a6b', '#4a3a5e', '#5e4a3a', '#2e4a3f', '#54423a', '#3f4a5e'];

export function isRoad(x, y) {
  const half = ROAD_WIDTH / 2;
  for (const rx of ROAD_XS) {
    if (Math.abs(x - rx) <= half && y >= 120 && y <= 2040) return true;
  }
  for (const ry of ROAD_YS) {
    if (Math.abs(y - ry) <= half && x >= 120 && x <= 2760) return true;
  }
  return false;
}

export function isInSea(x, y) {
  return y > SEA_TOP;
}

export function isBeach(x, y) {
  return y > BEACH_TOP && y <= SEA_TOP;
}

export function buildCity(rng) {
  const rand = typeof rng === 'function' ? rng : Math.random;
  const buildings = [];
  const parks = [];
  // One building per city block (between roads), skipping landmark blocks.
  const taken = new Set();
  const landmarkBlocks = new Set();
  for (const lm of Object.values(LANDMARKS)) {
    if (lm.y > SEA_TOP) continue;
    landmarkBlocks.add(Math.floor(lm.x / GRID_PITCH) + ':' + Math.floor(lm.y / GRID_PITCH));
  }
  for (let bx = 0; bx < 7; bx++) {
    for (let by = 0; by < 5; by++) {
      const key = bx + ':' + by;
      if (landmarkBlocks.has(key)) continue;
      if (rand() < 0.12) {
        parks.push({
          x: ROAD_XS[bx] + GRID_PITCH / 2, y: ROAD_YS[by] + GRID_PITCH / 2,
          w: 220, h: 180,
        });
        continue;
      }
      const cx = ROAD_XS[bx] + GRID_PITCH / 2;
      const cy = ROAD_YS[by] + GRID_PITCH / 2;
      const w = randRange(rand, 120, 210);
      const h = randRange(rand, 110, 190);
      buildings.push({
        x: cx - w / 2, y: cy - h / 2, w, h,
        color: pick(rand, BUILDING_COLORS),
        height: randInt(rand, 1, 4),
      });
      taken.add(key);
    }
  }
  // Top up to exactly 62 buildings with extra infill blocks.
  let guard = 0;
  while (buildings.length < 62 && guard++ < 400) {
    const bx = randInt(rand, 0, 6);
    const by = randInt(rand, 0, 4);
    const key = bx + ':' + by + ':' + buildings.length;
    if (taken.has(key)) continue;
    taken.add(key);
    const cx = ROAD_XS[bx] + GRID_PITCH / 2 + randRange(rand, -60, 60);
    const cy = ROAD_YS[by] + GRID_PITCH / 2 + randRange(rand, -60, 60);
    const w = randRange(rand, 70, 130);
    const h = randRange(rand, 60, 120);
    buildings.push({ x: cx - w / 2, y: cy - h / 2, w, h, color: pick(rand, BUILDING_COLORS), height: randInt(rand, 1, 3) });
  }
  while (parks.length < 3) {
    parks.push({ x: randRange(rand, 300, 2500), y: randRange(rand, 300, 1800), w: 200, h: 160 });
  }

  function pointInBuilding(x, y, pad) {
    const p = pad || 0;
    for (const b of buildings) {
      if (x > b.x - p && x < b.x + b.w + p && y > b.y - p && y < b.y + b.h + p) return b;
    }
    return null;
  }

  function nearestRoadPoint(x, y) {
    let bestX = ROAD_XS[0];
    let bestD = Infinity;
    for (const rx of ROAD_XS) {
      const d = Math.abs(x - rx);
      if (d < bestD) { bestD = d; bestX = rx; }
    }
    let bestY = ROAD_YS[0];
    bestD = Infinity;
    for (const ry of ROAD_YS) {
      const d = Math.abs(y - ry);
      if (d < bestD) { bestD = d; bestY = ry; }
    }
    // Snap to whichever road line is closer.
    if (Math.abs(x - bestX) <= Math.abs(y - bestY)) return { x: bestX, y: Math.max(180, Math.min(1980, y)) };
    return { x: Math.max(180, Math.min(2700, x)), y: bestY };
  }

  function randomStreetPoint(rngFn) {
    const r = typeof rngFn === 'function' ? rngFn : rand;
    if (r() < 0.5) {
      return { x: pick(r, ROAD_XS), y: randRange(r, 180, 1980) };
    }
    return { x: randRange(r, 180, 2700), y: pick(r, ROAD_YS) };
  }

  function nodePoint(ix, iy) {
    return { x: ROAD_XS[ix], y: ROAD_YS[iy] };
  }

  function nearestNode(x, y) {
    let bi = 0;
    let bj = 0;
    let best = Infinity;
    for (let i = 0; i < ROAD_XS.length; i++) {
      for (let j = 0; j < ROAD_YS.length; j++) {
        const dx = x - ROAD_XS[i];
        const dy = y - ROAD_YS[j];
        const d = dx * dx + dy * dy;
        if (d < best) { best = d; bi = i; bj = j; }
      }
    }
    return { ix: bi, iy: bj };
  }

  function nodeNeighbours(ix, iy) {
    const out = [];
    if (ix > 0) out.push({ ix: ix - 1, iy });
    if (ix < ROAD_XS.length - 1) out.push({ ix: ix + 1, iy });
    if (iy > 0) out.push({ ix, iy: iy - 1 });
    if (iy < ROAD_YS.length - 1) out.push({ ix, iy: iy + 1 });
    return out;
  }

  // Push a circle (entity with x,y,r) out of buildings and world bounds.
  function resolveCircle(ent) {
    const r = ent.r || ent.radius || 11;
    for (const b of buildings) {
      const cx = Math.max(b.x, Math.min(ent.x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(ent.y, b.y + b.h));
      const dx = ent.x - cx;
      const dy = ent.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 > 0.01) {
          const d = Math.sqrt(d2);
          ent.x = cx + (dx / d) * r;
          ent.y = cy + (dy / d) * r;
        } else {
          ent.y = b.y - r;
        }
      }
    }
    ent.x = Math.max(r, Math.min(WORLD_W - r, ent.x));
    ent.y = Math.max(r, Math.min(WORLD_H - r, ent.y));
    return ent;
  }

  const city = {
    buildings, parks,
    landmarks: LANDMARKS,
    nodeCountX: ROAD_XS.length,
    nodeCountY: ROAD_YS.length,
    roadXs: ROAD_XS, roadYs: ROAD_YS,
    isRoad, pointInBuilding, nearestRoadPoint, nearestNode,
    nodePoint, nodeNeighbours, randomStreetPoint, resolveCircle, isInSea, isBeach,
  };
  return city;
}

export function landmark(city, key) {
  return city.landmarks[key] || LANDMARKS[key] || null;
}
export default buildCity;
