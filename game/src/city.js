// Solmar City map: roads on a 360px grid, 62 buildings, 3 parks,
// 8 named landmarks. Built once per seed from the seeded RNG.
import { ROAD_X, ROAD_Y, ROAD_WIDTH, WORLD_W, WORLD_H, SEA_TOP, BEACH_TOP } from './config.js';
import { randRange, randInt, pick } from './random.js';
import { clamp } from './util.js';

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

const BUILDING_COLORS = ['#8a7f72', '#7d8aa0', '#a08a7d', '#6f7d6a', '#97826b', '#7a6f8a', '#8a8a7a'];
const PARK_NAMES = ['Palm Court Park', 'Sunset Green', 'Harbor View Park'];

// One city block sits between two neighbouring roads; a building is
// placed inside a block with a margin so it never touches a road.
function blockRect(ix, iy) {
  const x0 = ROAD_X[ix] + ROAD_WIDTH / 2 + 24;
  const y0 = ROAD_Y[iy] + ROAD_WIDTH / 2 + 24;
  const x1 = ROAD_X[ix + 1] - ROAD_WIDTH / 2 - 24;
  const y1 = ROAD_Y[iy + 1] - ROAD_WIDTH / 2 - 24;
  return { x0, y0, x1, y1 };
}

export function buildCity(rng) {
  const buildings = [];
  const parks = [];

  // Parks first: 3 fixed-ish blocks chosen from the grid.
  const parkBlocks = [
    { ix: 1, iy: 1 },
    { ix: 5, iy: 2 },
    { ix: 3, iy: 4 },
  ];
  const parkSet = new Set(parkBlocks.map((p) => p.ix + ',' + p.iy));
  for (let i = 0; i < parkBlocks.length; i++) {
    const b = blockRect(parkBlocks[i].ix, parkBlocks[i].iy);
    parks.push({
      name: PARK_NAMES[i],
      x: (b.x0 + b.x1) / 2,
      y: (b.y0 + b.y1) / 2,
      w: b.x1 - b.x0,
      h: b.y1 - b.y0,
      trees: 8 + randInt(rng, 0, 6),
    });
  }

  // 62 buildings: fill the remaining blocks, 1-2 per block.
  const blockList = [];
  for (let ix = 0; ix < ROAD_X.length - 1; ix++) {
    for (let iy = 0; iy < ROAD_Y.length - 1; iy++) {
      if (parkSet.has(ix + ',' + iy)) continue;
      // Skip the block that holds the safehouse landmark plaza.
      if (ix === 3 && iy === 3) continue;
      blockList.push({ ix, iy });
    }
  }
  let bi = 0;
  while (buildings.length < 62 && blockList.length > 0) {
    const blk = blockList[bi % blockList.length];
    bi++;
    const b = blockRect(blk.ix, blk.iy);
    const bw = b.x1 - b.x0;
    const bh = b.y1 - b.y0;
    const two = buildings.length < 40 && rng() < 0.55 && bw > 170 && bh > 170;
    if (two) {
      const split = rng() < 0.5;
      for (let k = 0; k < 2; k++) {
        let bx, by, w, h;
        if (split) {
          w = bw / 2 - 14;
          h = bh - 16;
          bx = b.x0 + 8 + k * (bw / 2);
          by = b.y0 + 8;
        } else {
          w = bw - 16;
          h = bh / 2 - 14;
          bx = b.x0 + 8;
          by = b.y0 + 8 + k * (bh / 2);
        }
        buildings.push(makeBuilding(rng, bx, by, w, h));
      }
    } else {
      const w = randRange(rng, 90, bw - 16);
      const h = randRange(rng, 80, bh - 16);
      const bx = b.x0 + 8 + randRange(rng, 0, Math.max(0, bw - w - 16));
      const by = b.y0 + 8 + randRange(rng, 0, Math.max(0, bh - h - 16));
      buildings.push(makeBuilding(rng, bx, by, w, h));
    }
  }
  // Safety net: if the loop above ever undershoots, pad with small blocks.
  while (buildings.length < 62) {
    const blk = blockList[buildings.length % blockList.length];
    const b = blockRect(blk.ix, blk.iy);
    buildings.push(makeBuilding(rng, b.x0 + 20, b.y0 + 20, 90, 80));
  }

  const landmarks = {};
  for (const key of Object.keys(LANDMARKS)) {
    landmarks[key] = { ...LANDMARKS[key] };
  }

  const city = {
    buildings,
    parks,
    landmarks,
    nodeCountX: ROAD_X.length,
    nodeCountY: ROAD_Y.length,
    isRoad,
    pointInBuilding,
    nearestRoadPoint,
    nearestNode,
    nodePoint,
    nodeNeighbours,
    randomStreetPoint,
    resolveCircle,
    isInSea,
  };

  function makeBuilding(rng2, x, y, w, h) {
    return {
      x,
      y,
      w: Math.max(50, w),
      h: Math.max(50, h),
      color: pick(rng2, BUILDING_COLORS),
      floors: randInt(rng2, 1, 6),
      roof: pick(rng2, ['flat', 'flat', 'flat', 'pyramid']),
    };
  }

  function isRoad(x, y) {
    if (x < 0 || y < 0 || x > WORLD_W || y > WORLD_H) return false;
    if (y >= BEACH_TOP) return false;
    const half = ROAD_WIDTH / 2;
    for (const rx of ROAD_X) {
      if (Math.abs(x - rx) <= half && y <= ROAD_Y[ROAD_Y.length - 1] + half) return true;
    }
    for (const ry of ROAD_Y) {
      if (Math.abs(y - ry) <= half && x <= ROAD_X[ROAD_X.length - 1] + half) return true;
    }
    return false;
  }

  function pointInBuilding(x, y) {
    for (const b of buildings) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }

  function nearestRoadPoint(x, y) {
    // Snap to the closest road line (vertical or horizontal).
    let bestX = ROAD_X[0];
    let bestD = Infinity;
    for (const rx of ROAD_X) {
      const d = Math.abs(x - rx);
      if (d < bestD) { bestD = d; bestX = rx; }
    }
    let bestY = ROAD_Y[0];
    bestD = Infinity;
    for (const ry of ROAD_Y) {
      const d = Math.abs(y - ry);
      if (d < bestD) { bestD = d; bestY = ry; }
    }
    const dx = Math.abs(x - bestX);
    const dy = Math.abs(y - bestY);
    if (dx <= dy) return { x: bestX, y: clamp(y, ROAD_Y[0], ROAD_Y[ROAD_Y.length - 1]) };
    return { x: clamp(x, ROAD_X[0], ROAD_X[ROAD_X.length - 1]), y: bestY };
  }

  function nearestNode(x, y) {
    let bi2 = 0;
    let bd = Infinity;
    for (let i = 0; i < ROAD_X.length; i++) {
      const d = Math.abs(x - ROAD_X[i]);
      if (d < bd) { bd = d; bi2 = i; }
    }
    let bj = 0;
    bd = Infinity;
    for (let j = 0; j < ROAD_Y.length; j++) {
      const d = Math.abs(y - ROAD_Y[j]);
      if (d < bd) { bd = d; bj = j; }
    }
    return { ix: bi2, iy: bj };
  }

  function nodePoint(ix, iy) {
    return {
      x: ROAD_X[clamp(ix, 0, ROAD_X.length - 1)],
      y: ROAD_Y[clamp(iy, 0, ROAD_Y.length - 1)],
    };
  }

  function nodeNeighbours(ix, iy) {
    const out = [];
    if (ix > 0) out.push({ ix: ix - 1, iy });
    if (ix < ROAD_X.length - 1) out.push({ ix: ix + 1, iy });
    if (iy > 0) out.push({ ix, iy: iy - 1 });
    if (iy < ROAD_Y.length - 1) out.push({ ix, iy: iy + 1 });
    return out;
  }

  // A point on a road: one coordinate snapped to a road line.
  function randomStreetPoint(rng2) {
    if (rng2() < 0.5) {
      const rx = pick(rng2, ROAD_X);
      const y = randRange(rng2, ROAD_Y[0], ROAD_Y[ROAD_Y.length - 1]);
      return { x: rx, y };
    }
    const ry = pick(rng2, ROAD_Y);
    const x = randRange(rng2, ROAD_X[0], ROAD_X[ROAD_X.length - 1]);
    return { x, y: ry };
  }

  // Push a circle (x,y,r) out of every building it overlaps.
  // Returns true if it was moved.
  function resolveCircle(ent, r) {
    let moved = false;
    for (const b of buildings) {
      const cx = clamp(ent.x, b.x, b.x + b.w);
      const cy = clamp(ent.y, b.y, b.y + b.h);
      const dx = ent.x - cx;
      const dy = ent.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          ent.x = cx + (dx / d) * r;
          ent.y = cy + (dy / d) * r;
        } else {
          // Dead centre: push out along the smallest penetration axis.
          const left = ent.x - b.x;
          const right = b.x + b.w - ent.x;
          const top = ent.y - b.y;
          const bottom = b.y + b.h - ent.y;
          const m = Math.min(left, right, top, bottom);
          if (m === left) ent.x = b.x - r;
          else if (m === right) ent.x = b.x + b.w + r;
          else if (m === top) ent.y = b.y - r;
          else ent.y = b.y + b.h + r;
        }
        moved = true;
      }
    }
    ent.x = clamp(ent.x, 8, WORLD_W - 8);
    ent.y = clamp(ent.y, 8, WORLD_H - 8);
    return moved;
  }

  function isInSea(x, y) {
    return y > SEA_TOP;
  }

  return city;
}

export default buildCity;
