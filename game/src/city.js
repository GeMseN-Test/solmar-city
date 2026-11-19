// city.js — the map of Solmar City: streets, buildings, parks and
// the named landmarks missions point at. Built once per seed from the
// RNG, so the same seed always gives the same city.

import {
  WORLD_W,
  WORLD_H,
  SEA_TOP,
  GRID_PITCH,
  ROAD_X0,
  ROAD_Y0,
  ROAD_X1,
  ROAD_Y1,
  ROAD_WIDTH,
  NODE_COUNT_X,
  NODE_COUNT_Y,
} from './config.js';
import { clamp, dist } from './util.js';

export const ROAD_XS = [];
for (let x = ROAD_X0; x <= ROAD_X1; x += GRID_PITCH) ROAD_XS.push(x);
export const ROAD_YS = [];
for (let y = ROAD_Y0; y <= ROAD_Y1; y += GRID_PITCH) ROAD_YS.push(y);

// Named places. Missions, fares and the HUD all point at these.
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

const BUILDING_COLORS = [
  '#8d7d6b', '#7d8a99', '#9c8a7a', '#6f7f8c',
  '#a08b74', '#857a6e', '#74808f', '#93806e',
];

function nearestLine(value, lines) {
  let best = lines[0];
  let bestD = Math.abs(value - lines[0]);
  for (const line of lines) {
    const d = Math.abs(value - line);
    if (d < bestD) {
      bestD = d;
      best = line;
    }
  }
  return best;
}

export function buildCity(rng) {
  const next = typeof rng === 'function' ? rng : rng.next.bind(rng);
  const range = (a, b) => a + next() * (b - a);
  const pickOne = (list) => list[Math.floor(next() * list.length)];

  // Three green parks tucked into blocks between roads.
  const parks = [
    { name: 'Palm Park', x: 900, y: 360, w: 200, h: 140 },
    { name: 'Harbor Green', x: 1980, y: 1440, w: 220, h: 150 },
    { name: 'Sunset Square', x: 540, y: 1440, w: 180, h: 130 },
  ];

  // Buildings fill the blocks between roads. Each block holds one
  // or two buildings; we keep generating candidates in a shuffled
  // block order until we have exactly 62, skipping anything that
  // would sit on a road, a park or a landmark.
  const blocks = [];
  for (let bx = 0; bx < NODE_COUNT_X - 1; bx++) {
    for (let by = 0; by < NODE_COUNT_Y - 1; by++) {
      blocks.push({ bx, by });
    }
  }
  for (let i = blocks.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const tmp = blocks[i];
    blocks[i] = blocks[j];
    blocks[j] = tmp;
  }

  const landmarks = Object.values(LANDMARKS);
  const buildings = [];
  let bi = 0;
  while (buildings.length < 62 && bi < blocks.length * 3) {
    const block = blocks[bi % blocks.length];
    bi++;
    const x0 = ROAD_XS[block.bx] + ROAD_WIDTH / 2 + 24;
    const x1 = ROAD_XS[block.bx + 1] - ROAD_WIDTH / 2 - 24;
    const y0 = ROAD_YS[block.by] + ROAD_WIDTH / 2 + 24;
    const y1 = ROAD_YS[block.by + 1] - ROAD_WIDTH / 2 - 24;
    if (x1 - x0 < 90 || y1 - y0 < 70) continue;
    const w = range(80, Math.min(190, x1 - x0));
    const h = range(60, Math.min(150, y1 - y0));
    const x = range(x0 + w / 2, x1 - w / 2);
    const y = range(y0 + h / 2, y1 - h / 2);
    let clash = false;
    for (const p of parks) {
      if (x + w / 2 > p.x - p.w / 2 - 10 && x - w / 2 < p.x + p.w / 2 + 10 &&
          y + h / 2 > p.y - p.h / 2 - 10 && y - h / 2 < p.y + p.h / 2 + 10) {
        clash = true;
        break;
      }
    }
    if (clash) continue;
    for (const lm of landmarks) {
      if (lm.y > SEA_TOP) continue;
      if (dist(x, y, lm.x, lm.y) < 190) {
        clash = true;
        break;
      }
    }
    if (clash) continue;
    for (const b of buildings) {
      if (Math.abs(x - b.x) < (w + b.w) / 2 + 12 &&
          Math.abs(y - b.y) < (h + b.h) / 2 + 12) {
        clash = true;
        break;
      }
    }
    if (clash) continue;
    buildings.push({
      x, y, w, h,
      color: pickOne(BUILDING_COLORS),
      roof: pickOne(['#5d6b7a', '#6e5a4e', '#4e5d4a', '#7a6a55']),
    });
  }
  // Extremely defensive: if the shuffle above ever fell short,
  // top the list up with small blocks along the top rows.
  while (buildings.length < 62) {
    const n = buildings.length;
    buildings.push({
      x: 360 + (n % 7) * 360, y: 360 + Math.floor(n / 7) * 360,
      w: 90, h: 70, color: '#8d7d6b', roof: '#5d6b7a',
    });
  }

  function isRoad(x, y) {
    for (const rx of ROAD_XS) {
      if (Math.abs(x - rx) <= ROAD_WIDTH / 2) return true;
    }
    for (const ry of ROAD_YS) {
      if (Math.abs(y - ry) <= ROAD_WIDTH / 2) return true;
    }
    return false;
  }

  function pointInBuilding(x, y) {
    for (const b of buildings) {
      if (Math.abs(x - b.x) <= b.w / 2 && Math.abs(y - b.y) <= b.h / 2) {
        return b;
      }
    }
    return null;
  }

  function isInSea(x, y) {
    return y > SEA_TOP;
  }

  // Push a circle out of every building it overlaps, and clamp it
  // inside the world. Called as resolveCircle(entity, radius) where
  // entity has x/y, or as resolveCircle(x, y, radius) which returns
  // a fresh {x, y}. Returns the entity (or the new point).
  function resolveCircle(a, b, c) {
    let ent;
    let r;
    if (typeof a === 'object' && a !== null) {
      ent = a;
      r = typeof b === 'number' ? b : 11;
    } else {
      ent = { x: a, y: b };
      r = typeof c === 'number' ? c : 11;
    }
    for (const bld of buildings) {
      const dx = ent.x - bld.x;
      const dy = ent.y - bld.y;
      const px = bld.w / 2 + r - Math.abs(dx);
      const py = bld.h / 2 + r - Math.abs(dy);
      if (px > 0 && py > 0) {
        if (px < py) ent.x = bld.x + (dx >= 0 ? px : -px);
        else ent.y = bld.y + (dy >= 0 ? py : -py);
      }
    }
    ent.x = clamp(ent.x, 16, WORLD_W - 16);
    ent.y = clamp(ent.y, 16, WORLD_H - 16);
    return ent;
  }

  function nearestRoadPoint(x, y) {
    const rx = nearestLine(x, ROAD_XS);
    const ry = nearestLine(y, ROAD_YS);
    // Snap to whichever road line is closer.
    if (Math.abs(x - rx) <= Math.abs(y - ry)) return { x: rx, y };
    return { x, y: ry };
  }

  function nearestNode(x, y) {
    let bestIx = 0;
    let bestIy = 0;
    let bestD = Infinity;
    for (let ix = 0; ix < NODE_COUNT_X; ix++) {
      for (let iy = 0; iy < NODE_COUNT_Y; iy++) {
        const d = dist(x, y, ROAD_XS[ix], ROAD_YS[iy]);
        if (d < bestD) {
          bestD = d;
          bestIx = ix;
          bestIy = iy;
        }
      }
    }
    return { ix: bestIx, iy: bestIy };
  }

  function nodePoint(ix, iy) {
    return {
      x: ROAD_XS[clamp(ix, 0, NODE_COUNT_X - 1)],
      y: ROAD_YS[clamp(iy, 0, NODE_COUNT_Y - 1)],
    };
  }

  function nodeNeighbours(ix, iy) {
    const out = [];
    if (ix > 0) out.push({ ix: ix - 1, iy });
    if (ix < NODE_COUNT_X - 1) out.push({ ix: ix + 1, iy });
    if (iy > 0) out.push({ ix, iy: iy - 1 });
    if (iy < NODE_COUNT_Y - 1) out.push({ ix, iy: iy + 1 });
    return out;
  }

  // A random point on a road: pick a random road line, then a random
  // spot along it. One coordinate is always snapped to the road.
  function randomStreetPoint(rngArg) {
    const f = rngArg
      ? (typeof rngArg === 'function' ? rngArg : rngArg.next.bind(rngArg))
      : next;
    if (f() < 0.5) {
      return {
        x: ROAD_XS[Math.floor(f() * ROAD_XS.length)],
        y: ROAD_Y0 + f() * (ROAD_Y1 - ROAD_Y0),
      };
    }
    return {
      x: ROAD_X0 + f() * (ROAD_X1 - ROAD_X0),
      y: ROAD_YS[Math.floor(f() * ROAD_YS.length)],
    };
  }

  return {
    buildings,
    parks,
    landmarks: LANDMARKS,
    landmarkList: landmarks,
    nodeCountX: NODE_COUNT_X,
    nodeCountY: NODE_COUNT_Y,
    roadXs: ROAD_XS,
    roadYs: ROAD_YS,
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
}

export default buildCity;
