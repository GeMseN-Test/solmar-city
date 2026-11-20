// city.js — Solmar City layout: roads, blocks, buildings, parks and
// the eight named landmarks. Built once per world from a seeded RNG so
// the same seed always grows the same city. The map is 2880x2160 with
// a road grid (pitch 360, width 76) and a sea strip below y = 2100.

import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  SEA_TOP,
  BEACH_TOP,
  GRID_PITCH,
  ROAD_WIDTH,
  ROAD_X,
  ROAD_Y,
  NODE_COUNT_X,
  NODE_COUNT_Y,
} from './config.js';
import { clamp, dist } from './util.js';

// The eight named places every mission, fare and HUD marker refers to.
export const LANDMARK_DEFS = [
  { key: 'garage', name: "Ray's Garage", short: 'Garage', x: 700, y: 830 },
  { key: 'safehouse', name: "Mara's Safehouse", short: 'Safehouse', x: 1420, y: 1190 },
  { key: 'bank', name: 'Grand Solmar Bank', short: 'Bank', x: 1800, y: 1190 },
  { key: 'turf', name: "Vipers' Turf", short: 'Turf', x: 700, y: 1790 },
  { key: 'docks', name: 'Solmar Docks', short: 'Docks', x: 360, y: 130 },
  { key: 'marina', name: 'Solmar Marina', short: 'Marina', x: 2520, y: 1930 },
  { key: 'radio', name: 'Solmar Radio', short: 'Radio', x: 2520, y: 130 },
  { key: 'island', name: 'Gull Island', short: 'Island', x: 1440, y: 2130 },
];

const PALETTE = [
  '#3d4a63', '#4a3a5e', '#5e463a', '#2f4a3d', '#5a4a2f',
  '#414e6b', '#6b4141', '#3a5a6b', '#555a6e', '#6e5a41',
];

// True when (x, y) sits on a road (within half the road width of a
// road centre line), and not in the sea strip.
export function isRoadPoint(x, y) {
  if (y >= BEACH_TOP) return false;
  const half = ROAD_WIDTH / 2;
  for (const rx of ROAD_X) {
    if (Math.abs(x - rx) <= half) return true;
  }
  for (const ry of ROAD_Y) {
    if (Math.abs(y - ry) <= half) return true;
  }
  return false;
}

// True when (x, y) is in the sea (the harbor strip at the bottom).
export function isInSeaPoint(x, y) {
  return y > SEA_TOP;
}

export function buildCity(rng) {
  const rand = rng || { next: Math.random, range: (a, b) => a + Math.random() * (b - a), int: (a, b) => Math.floor(a + Math.random() * (b - a + 1)), pick: (l) => l[Math.floor(Math.random() * l.length)] };

  // Landmarks as a keyed object: city.landmarks.garage.x, etc.
  const landmarks = {};
  for (const def of LANDMARK_DEFS) {
    landmarks[def.key] = { key: def.key, name: def.name, short: def.short, x: def.x, y: def.y };
  }

  // Three parks: green squares carved out of ordinary blocks.
  const parks = [
    { x: 900, y: 540, w: 200, h: 160, name: 'Palm Park' },
    { x: 1980, y: 1260, w: 220, h: 170, name: 'Harbor Green' },
    { x: 1260, y: 1620, w: 190, h: 150, name: 'Sunset Square' },
  ];

  // Buildings fill the blocks between roads. A block spans from one
  // road edge to the next; each block holds one or two buildings with
  // a margin so streets stay walkable. Exactly 62 buildings.
  const buildings = [];
  const halfRoad = ROAD_WIDTH / 2;
  const margin = 26;
  let colorIdx = 0;
  for (let bx = 0; bx < NODE_COUNT_X - 1 && buildings.length < 62; bx++) {
    for (let by = 0; by < NODE_COUNT_Y - 1 && buildings.length < 62; by++) {
      const blockX0 = ROAD_X[bx] + halfRoad + margin;
      const blockX1 = ROAD_X[bx + 1] - halfRoad - margin;
      const blockY0 = ROAD_Y[by] + halfRoad + margin;
      const blockY1 = ROAD_Y[by + 1] - halfRoad - margin;
      const bw = blockX1 - blockX0;
      const bh = blockY1 - blockY0;
      if (bw < 60 || bh < 60) continue;
      // Skip blocks that overlap a park.
      let overlapsPark = false;
      for (const p of parks) {
        if (blockX0 < p.x + p.w / 2 && blockX1 > p.x - p.w / 2 &&
            blockY0 < p.y + p.h / 2 && blockY1 > p.y - p.h / 2) {
          overlapsPark = true;
        }
      }
      if (overlapsPark) continue;
      // Skip the block holding the safehouse plaza so the spawn area
      // stays open, and the bank block so the vault approach is clear.
      if (bx === 3 && by === 3) continue;
      if (bx === 4 && by === 3) continue;
      const two = rand.next() < 0.45 && bw > 170;
      const count = two ? 2 : 1;
      for (let k = 0; k < count && buildings.length < 62; k++) {
        let w, h, x, y;
        if (count === 2) {
          w = Math.floor(bw / 2) - 14;
          h = Math.floor(rand.range(70, Math.min(150, bh - 8)));
          x = blockX0 + k * (bw / 2 + 7);
          y = blockY0 + Math.floor(rand.range(0, Math.max(1, bh - h)));
        } else {
          w = Math.floor(rand.range(90, Math.min(200, bw)));
          h = Math.floor(rand.range(70, Math.min(160, bh)));
          x = blockX0 + Math.floor(rand.range(0, Math.max(1, bw - w)));
          y = blockY0 + Math.floor(rand.range(0, Math.max(1, bh - h)));
        }
        buildings.push({
          x, y, w, h,
          color: PALETTE[colorIdx++ % PALETTE.length],
          height: rand.int(2, 6),
          roof: rand.pick(['#2b3242', '#3a2f2b', '#2f3a2b', '#33302e']),
        });
      }
    }
  }
  // Top up with harbour-side warehouses if the grid pass came short.
  while (buildings.length < 62) {
    const i = buildings.length;
    buildings.push({
      x: 200 + (i % 8) * 300,
      y: 1860 + Math.floor(i / 8) * 60,
      w: 120, h: 60,
      color: '#4a3a2e', height: 2, roof: '#33302e',
    });
  }

  // Grid nodes: the road intersections, indexed ix 0..7, iy 0..5.
  function nodePoint(ix, iy) {
    return { x: ROAD_X[clamp(ix, 0, NODE_COUNT_X - 1)], y: ROAD_Y[clamp(iy, 0, NODE_COUNT_Y - 1)] };
  }

  function nearestNode(x, y) {
    let bestIx = 0;
    let bestIy = 0;
    let bestD = Infinity;
    for (let ix = 0; ix < NODE_COUNT_X; ix++) {
      for (let iy = 0; iy < NODE_COUNT_Y; iy++) {
        const d = dist(x, y, ROAD_X[ix], ROAD_Y[iy]);
        if (d < bestD) {
          bestD = d;
          bestIx = ix;
          bestIy = iy;
        }
      }
    }
    return { ix: bestIx, iy: bestIy, x: ROAD_X[bestIx], y: ROAD_Y[bestIy], dist: bestD };
  }

  function nodeNeighbours(ix, iy) {
    const out = [];
    if (ix > 0) out.push({ ix: ix - 1, iy });
    if (ix < NODE_COUNT_X - 1) out.push({ ix: ix + 1, iy });
    if (iy > 0) out.push({ ix, iy: iy - 1 });
    if (iy < NODE_COUNT_Y - 1) out.push({ ix, iy: iy + 1 });
    return out;
  }

  // Snap any point onto the nearest road centre line.
  function nearestRoadPoint(x, y) {
    if (y >= BEACH_TOP) return { x: clamp(x, 60, WORLD_WIDTH - 60), y: ROAD_Y[ROAD_Y.length - 1] };
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
    // Snap along the closer axis: keep the coordinate that is already
    // nearer to a road line, snap the other one.
    const dx = Math.abs(x - bestX);
    const dy = Math.abs(y - bestY);
    if (dx <= dy) return { x: bestX, y: clamp(y, 60, BEACH_TOP - 40) };
    return { x: clamp(x, 60, WORLD_WIDTH - 60), y: bestY };
  }

  function pointInBuilding(x, y) {
    for (const b of buildings) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }

  // Push a circle (entity with x, y, radius r) out of any building it
  // overlaps. Returns true when a push happened. Callers move the
  // entity, then call this to keep it out of walls.
  function resolveCircle(ent, r) {
    const radius = r || ent.radius || 11;
    let pushed = false;
    for (const b of buildings) {
      const cx = clamp(ent.x, b.x, b.x + b.w);
      const cy = clamp(ent.y, b.y, b.y + b.h);
      const dx = ent.x - cx;
      const dy = ent.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < radius * radius) {
        pushed = true;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          ent.x = cx + (dx / d) * radius;
          ent.y = cy + (dy / d) * radius;
        } else {
          // Dead centre: push out along the smallest penetration axis.
          const left = ent.x - b.x;
          const right = b.x + b.w - ent.x;
          const top = ent.y - b.y;
          const bottom = b.y + b.h - ent.y;
          const m = Math.min(left, right, top, bottom);
          if (m === left) ent.x = b.x - radius;
          else if (m === right) ent.x = b.x + b.w + radius;
          else if (m === top) ent.y = b.y - radius;
          else ent.y = b.y + b.h + radius;
        }
      }
    }
    return pushed;
  }

  // A random point on a road: one coordinate snapped to a road line.
  function randomStreetPoint(r) {
    const rng2 = r || rand;
    const rx = ROAD_X[Math.floor(rng2.next() * ROAD_X.length)];
    const ry = ROAD_Y[Math.floor(rng2.next() * ROAD_Y.length)];
    if (rng2.next() < 0.5) {
      return { x: rx, y: Math.floor(rng2.range(120, BEACH_TOP - 60)) };
    }
    return { x: Math.floor(rng2.range(120, WORLD_WIDTH - 120)), y: ry };
  }

  function isRoad(x, y) {
    return isRoadPoint(x, y);
  }

  function isInSea(x, y) {
    return isInSeaPoint(x, y);
  }

  const city = {
    buildings,
    parks,
    landmarks,
    landmarkList: LANDMARK_DEFS.map((d) => landmarks[d.key]),
    nodeCountX: NODE_COUNT_X,
    nodeCountY: NODE_COUNT_Y,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    isRoad,
    isRoadPoint,
    pointInBuilding,
    nearestRoadPoint,
    nearestNode,
    nodePoint,
    nodeNeighbours,
    randomStreetPoint,
    resolveCircle,
    isInSea,
    isInSeaPoint,
  };
  return city;
}

export default buildCity;
