// Solmar City map: a road grid, 62 buildings, 3 parks, 8 landmarks
// and the harbor sea strip at the bottom. Everything is derived from
// the seeded RNG, so the same seed always builds the same city.

import {
  WORLD_W,
  WORLD_H,
  SEA_TOP,
  ROAD_X,
  ROAD_Y,
  ROAD_WIDTH,
  NODE_COUNT_X,
  NODE_COUNT_Y,
} from './config.js';
import { clamp } from './util.js';

const HALF_ROAD = ROAD_WIDTH / 2;

export const LANDMARK_DEFS = [
  { key: 'garage', name: "Ray's Garage", x: 700, y: 830 },
  { key: 'safehouse', name: "Mara's Safehouse", x: 1420, y: 1190 },
  { key: 'bank', name: 'Grand Solmar Bank', x: 1800, y: 1190 },
  { key: 'turf', name: "Vipers' Turf", x: 700, y: 1790 },
  { key: 'docks', name: 'Solmar Docks', x: 360, y: 130 },
  { key: 'marina', name: 'Solmar Marina', x: 2520, y: 1930 },
  { key: 'radio', name: 'Solmar Radio', x: 2520, y: 130 },
  { key: 'island', name: 'Gull Island', x: 1440, y: 2130 },
];

const BUILDING_COLORS = [
  '#8d7d6b', '#7d7468', '#9a8a76', '#6f7d8a', '#8a7d8f',
  '#a08b6d', '#77816f', '#93827a', '#7a6f5e', '#8f8578',
];

const PARK_NAMES = ['Palm Court Park', 'Solmar Green', 'Harbor View Park'];

export function buildCity(rng) {
  const buildings = [];
  const parks = [];

  // Pick 3 blocks to be parks (never the blocks holding a landmark).
  const blockCols = ROAD_X.length - 1;
  const blockRows = ROAD_Y.length - 1;
  const landmarkBlocks = new Set();
  for (const lm of LANDMARK_DEFS) {
    const bx = clamp(Math.floor((lm.x - ROAD_X[0]) / 360), 0, blockCols - 1);
    const by = clamp(Math.floor((lm.y - ROAD_Y[0]) / 360), 0, blockRows - 1);
    landmarkBlocks.add(bx + ',' + by);
  }
  const parkBlocks = [];
  while (parkBlocks.length < 3) {
    const bx = rng.int(0, blockCols - 1);
    const by = rng.int(0, blockRows - 1);
    const id = bx + ',' + by;
    if (landmarkBlocks.has(id)) continue;
    if (parkBlocks.includes(id)) continue;
    parkBlocks.push(id);
  }
  const parkSet = new Set(parkBlocks);

  const landmarkClear = (x, y, w, h) => {
    for (const lm of LANDMARK_DEFS) {
      if (lm.x > x - 70 && lm.x < x + w + 70 && lm.y > y - 70 && lm.y < y + h + 70) {
        return false;
      }
    }
    return true;
  };

  // Each block interior is split into a 2x2 slot grid. A building
  // takes one slot, jittered inside it, so neighbours never overlap
  // and streets stay clear. Two passes guarantee exactly 62.
  const slots = [];
  for (let by = 0; by < blockRows; by++) {
    for (let bx = 0; bx < blockCols; bx++) {
      if (parkSet.has(bx + ',' + by)) {
        const px = ROAD_X[bx] + HALF_ROAD + 14;
        const py = ROAD_Y[by] + HALF_ROAD + 14;
        const pw = 360 - ROAD_WIDTH - 28;
        const ph = 360 - ROAD_WIDTH - 28;
        parks.push({
          x: px, y: py, w: pw, h: ph,
          name: PARK_NAMES[parks.length % PARK_NAMES.length],
        });
        continue;
      }
      const baseX = ROAD_X[bx] + HALF_ROAD + 12;
      const baseY = ROAD_Y[by] + HALF_ROAD + 12;
      const slotW = (360 - ROAD_WIDTH - 24) / 2;
      const slotH = (360 - ROAD_WIDTH - 24) / 2;
      for (let sy = 0; sy < 2; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          slots.push({
            x: baseX + sx * slotW,
            y: baseY + sy * slotH,
            w: slotW,
            h: slotH,
          });
        }
      }
    }
  }

  const placeInSlot = (slot) => {
    const w = Math.min(slot.w - 14, rng.float(84, 112));
    const h = Math.min(slot.h - 14, rng.float(78, 108));
    const x = slot.x + (slot.w - w) / 2 + rng.float(-4, 4);
    const y = slot.y + (slot.h - h) / 2 + rng.float(-4, 4);
    if (!landmarkClear(x, y, w, h)) return false;
    buildings.push({
      x, y, w, h,
      color: rng.pick(BUILDING_COLORS),
      floors: rng.int(1, 4),
    });
    return true;
  };

  for (const slot of rng.shuffle(slots)) {
    if (buildings.length >= 62) break;
    if (rng.chance(0.42)) continue;
    placeInSlot(slot);
  }
  for (const slot of slots) {
    if (buildings.length >= 62) break;
    placeInSlot(slot);
  }
  // Last resort (should never trigger): tiny kiosks on the beach edge.
  let kx = 120;
  while (buildings.length < 62) {
    buildings.push({ x: kx, y: 2040, w: 60, h: 40, color: '#8d7d6b', floors: 1 });
    kx += 140;
  }

  const landmarks = {};
  for (const lm of LANDMARK_DEFS) {
    landmarks[lm.key] = { key: lm.key, name: lm.name, x: lm.x, y: lm.y };
  }

  const city = {
    buildings,
    parks,
    landmarks,
    nodeCountX: NODE_COUNT_X,
    nodeCountY: NODE_COUNT_Y,

    isRoad(x, y) {
      for (const rx of ROAD_X) {
        if (Math.abs(x - rx) <= HALF_ROAD && y >= ROAD_Y[0] - HALF_ROAD && y <= ROAD_Y[ROAD_Y.length - 1] + HALF_ROAD) return true;
      }
      for (const ry of ROAD_Y) {
        if (Math.abs(y - ry) <= HALF_ROAD && x >= ROAD_X[0] - HALF_ROAD && x <= ROAD_X[ROAD_X.length - 1] + HALF_ROAD) return true;
      }
      return false;
    },

    pointInBuilding(x, y, r = 0) {
      for (const b of buildings) {
        if (x >= b.x - r && x <= b.x + b.w + r && y >= b.y - r && y <= b.y + b.h + r) return true;
      }
      return false;
    },

    nearestRoadPoint(x, y) {
      let best = null;
      let bestD = Infinity;
      for (const rx of ROAD_X) {
        const cy = clamp(y, ROAD_Y[0], ROAD_Y[ROAD_Y.length - 1]);
        const d = (x - rx) * (x - rx) + (y - cy) * (y - cy);
        if (d < bestD) { bestD = d; best = { x: rx, y: cy }; }
      }
      for (const ry of ROAD_Y) {
        const cx = clamp(x, ROAD_X[0], ROAD_X[ROAD_X.length - 1]);
        const d = (x - cx) * (x - cx) + (y - ry) * (y - ry);
        if (d < bestD) { bestD = d; best = { x: cx, y: ry }; }
      }
      return best;
    },

    nearestNode(x, y) {
      const ix = clamp(Math.round((x - ROAD_X[0]) / 360), 0, NODE_COUNT_X - 1);
      const iy = clamp(Math.round((y - ROAD_Y[0]) / 360), 0, NODE_COUNT_Y - 1);
      return { ix, iy };
    },

    nodePoint(ix, iy) {
      return {
        x: ROAD_X[clamp(ix, 0, NODE_COUNT_X - 1)],
        y: ROAD_Y[clamp(iy, 0, NODE_COUNT_Y - 1)],
      };
    },

    nodeNeighbours(ix, iy) {
      const out = [];
      if (ix > 0) out.push({ ix: ix - 1, iy });
      if (ix < NODE_COUNT_X - 1) out.push({ ix: ix + 1, iy });
      if (iy > 0) out.push({ ix, iy: iy - 1 });
      if (iy < NODE_COUNT_Y - 1) out.push({ ix, iy: iy + 1 });
      return out;
    },

    randomStreetPoint(r) {
      const useRng = r || rng;
      if (useRng.chance(0.5)) {
        return {
          x: useRng.pick(ROAD_X),
          y: useRng.float(ROAD_Y[0], ROAD_Y[ROAD_Y.length - 1]),
        };
      }
      return {
        x: useRng.float(ROAD_X[0], ROAD_X[ROAD_X.length - 1]),
        y: useRng.pick(ROAD_Y),
      };
    },

    // Push a circle out of every building it overlaps. Runs a few
    // passes so corners where two buildings meet resolve cleanly.
    resolveCircle(x, y, r) {
      let px = clamp(x, 0, WORLD_W);
      let py = clamp(y, 0, WORLD_H);
      for (let pass = 0; pass < 3; pass++) {
        let moved = false;
        for (const b of buildings) {
          const cx = clamp(px, b.x, b.x + b.w);
          const cy = clamp(py, b.y, b.y + b.h);
          const dx = px - cx;
          const dy = py - cy;
          const d2 = dx * dx + dy * dy;
          if (d2 >= r * r) continue;
          if (d2 === 0) {
            const left = px - b.x;
            const right = b.x + b.w - px;
            const top = py - b.y;
            const bottom = b.y + b.h - py;
            const m = Math.min(left, right, top, bottom);
            if (m === left) px = b.x - r;
            else if (m === right) px = b.x + b.w + r;
            else if (m === top) py = b.y - r;
            else py = b.y + b.h + r;
          } else {
            const d = Math.sqrt(d2);
            const push = (r - d) / d;
            px += dx * push;
            py += dy * push;
          }
          moved = true;
        }
        if (!moved) break;
      }
      return { x: clamp(px, 0, WORLD_W), y: clamp(py, 0, WORLD_H) };
    },

    isInSea(x, y) {
      return y > SEA_TOP;
    },
  };
  return city;
}

export default buildCity;
