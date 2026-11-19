// city.js — builds Solmar City: road grid, 62 buildings, 3 parks,
// 8 landmarks, and the geometry helpers (roads, nodes, collisions).

import {
  WORLD_W,
  WORLD_H,
  SEA_TOP,
  GRID_PITCH,
  ROAD_X0,
  ROAD_Y0,
  ROAD_COUNT_X,
  ROAD_COUNT_Y,
  ROAD_WIDTH,
} from './config.js';

const ROAD_XS = [];
for (let i = 0; i < ROAD_COUNT_X; i++) ROAD_XS.push(ROAD_X0 + i * GRID_PITCH);
const ROAD_YS = [];
for (let j = 0; j < ROAD_COUNT_Y; j++) ROAD_YS.push(ROAD_Y0 + j * GRID_PITCH);

const BUILDING_COLORS = [
  '#3a4a5a', '#4a3a5a', '#5a3a3a', '#2e4a3a',
  '#54452e', '#37474f', '#4a3728', '#33506b',
];

function nearestLine(value, lines) {
  let best = lines[0];
  let bestD = Math.abs(value - lines[0]);
  for (let i = 1; i < lines.length; i++) {
    const d = Math.abs(value - lines[i]);
    if (d < bestD) {
      bestD = d;
      best = lines[i];
    }
  }
  return best;
}

export function buildCity(rng) {
  const landmarks = {
    garage: { key: 'garage', name: "Ray's Garage", x: 700, y: 830 },
    safehouse: { key: 'safehouse', name: "Mara's Safehouse", x: 1420, y: 1190 },
    bank: { key: 'bank', name: 'Grand Solmar Bank', x: 1800, y: 1190 },
    turf: { key: 'turf', name: "Vipers' Turf", x: 700, y: 1790 },
    docks: { key: 'docks', name: 'Solmar Docks', x: 360, y: 130 },
    marina: { key: 'marina', name: 'Solmar Marina', x: 2520, y: 1930 },
    radio: { key: 'radio', name: 'Solmar Radio', x: 2520, y: 130 },
    island: { key: 'island', name: 'Gull Island', x: 1440, y: 2130 },
  };
  const landmarkPoints = Object.values(landmarks);

  // 3 parks, each centred in its own block between roads.
  const blockXs = [];
  for (let i = 0; i < ROAD_COUNT_X - 1; i++) blockXs.push(i);
  const blockYs = [];
  for (let j = 0; j < ROAD_COUNT_Y - 1; j++) blockYs.push(j);
  const blockPairs = [];
  for (const bi of blockXs) {
    for (const bj of blockYs) blockPairs.push([bi, bj]);
  }
  const shuffledBlocks = rng.shuffle(blockPairs);
  const parks = [];
  for (let k = 0; k < 3; k++) {
    const [bi, bj] = shuffledBlocks[k];
    const cx = ROAD_XS[bi] + GRID_PITCH / 2;
    const cy = ROAD_YS[bj] + GRID_PITCH / 2;
    parks.push({ x: cx, y: cy, w: 210, h: 170 });
  }

  function clearOfLandmark(x, y, w, h) {
    for (const lm of landmarkPoints) {
      if (Math.abs(lm.x - x) < w / 2 + 80 && Math.abs(lm.y - y) < h / 2 + 80) {
        return false;
      }
    }
    return true;
  }

  function clearOfParks(x, y, w, h) {
    for (const p of parks) {
      if (Math.abs(p.x - x) < (p.w + w) / 2 + 10 && Math.abs(p.y - y) < (p.h + h) / 2 + 10) {
        return false;
      }
    }
    return true;
  }

  function overlapsBuildings(buildings, x, y, w, h) {
    for (const b of buildings) {
      if (Math.abs(b.x - x) < (b.w + w) / 2 + 12 && Math.abs(b.y - y) < (b.h + h) / 2 + 12) {
        return true;
      }
    }
    return false;
  }

  // 62 buildings, one or two per block, never on a landmark or a park.
  const buildings = [];
  let guard = 0;
  while (buildings.length < 62 && guard < 4000) {
    guard++;
    const bi = rng.int(0, ROAD_COUNT_X - 2);
    const bj = rng.int(0, ROAD_COUNT_Y - 2);
    const x0 = ROAD_XS[bi] + ROAD_WIDTH / 2 + 10;
    const x1 = ROAD_XS[bi + 1] - ROAD_WIDTH / 2 - 10;
    const y0 = ROAD_YS[bj] + ROAD_WIDTH / 2 + 10;
    const y1 = ROAD_YS[bj + 1] - ROAD_WIDTH / 2 - 10;
    const w = rng.range(70, 120);
    const h = rng.range(60, 110);
    const x = rng.range(x0 + w / 2, x1 - w / 2);
    const y = rng.range(y0 + h / 2, y1 - h / 2);
    if (!clearOfLandmark(x, y, w, h)) continue;
    if (!clearOfParks(x, y, w, h)) continue;
    if (overlapsBuildings(buildings, x, y, w, h)) continue;
    buildings.push({
      x,
      y,
      w,
      h,
      color: rng.pick(BUILDING_COLORS),
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

  function resolveCircle(x, y, r) {
    let px = x;
    let py = y;
    for (let pass = 0; pass < 3; pass++) {
      for (const b of buildings) {
        const hw = b.w / 2;
        const hh = b.h / 2;
        const cx = Math.max(b.x - hw, Math.min(px, b.x + hw));
        const cy = Math.max(b.y - hh, Math.min(py, b.y + hh));
        let dx = px - cx;
        let dy = py - cy;
        let d = Math.hypot(dx, dy);
        if (d >= r) continue;
        if (d < 0.001) {
          // Centre is inside the building: push out along the shallow axis.
          const pushX = hw + r - Math.abs(px - b.x);
          const pushY = hh + r - Math.abs(py - b.y);
          if (pushX < pushY) {
            px = b.x + (px >= b.x ? hw + r : -hw - r);
          } else {
            py = b.y + (py >= b.y ? hh + r : -hh - r);
          }
          continue;
        }
        dx /= d;
        dy /= d;
        px = cx + dx * r;
        py = cy + dy * r;
      }
    }
    if (px < r) px = r;
    if (px > WORLD_W - r) px = WORLD_W - r;
    if (py < r) py = r;
    if (py > WORLD_H - r) py = WORLD_H - r;
    return { x: px, y: py };
  }

  function nearestRoadPoint(x, y) {
    const rx = nearestLine(x, ROAD_XS);
    const ry = nearestLine(y, ROAD_YS);
    const vert = { x: rx, y: Math.max(0, Math.min(WORLD_H, y)) };
    const horiz = { x: Math.max(0, Math.min(WORLD_W, x)), y: ry };
    const dv = Math.abs(x - rx);
    const dh = Math.abs(y - ry);
    return dv <= dh ? vert : horiz;
  }

  function nearestNode(x, y) {
    const ix = Math.max(0, Math.min(ROAD_COUNT_X - 1, Math.round((x - ROAD_X0) / GRID_PITCH)));
    const iy = Math.max(0, Math.min(ROAD_COUNT_Y - 1, Math.round((y - ROAD_Y0) / GRID_PITCH)));
    return { ix, iy };
  }

  function nodePoint(ix, iy) {
    return { x: ROAD_X0 + ix * GRID_PITCH, y: ROAD_Y0 + iy * GRID_PITCH };
  }

  function nodeNeighbours(ix, iy) {
    const out = [];
    if (ix > 0) out.push({ ix: ix - 1, iy });
    if (ix < ROAD_COUNT_X - 1) out.push({ ix: ix + 1, iy });
    if (iy > 0) out.push({ ix, iy: iy - 1 });
    if (iy < ROAD_COUNT_Y - 1) out.push({ ix, iy: iy + 1 });
    return out;
  }

  function randomStreetPoint(r) {
    const useRng = r || rng;
    if (useRng.chance(0.5)) {
      const rx = useRng.pick(ROAD_XS);
      return { x: rx + useRng.range(-20, 20), y: useRng.range(40, 2000) };
    }
    const ry = useRng.pick(ROAD_YS);
    return { x: useRng.range(40, 2840), y: ry + useRng.range(-20, 20) };
  }

  function isInSea(x, y) {
    return y > SEA_TOP;
  }

  return {
    buildings,
    parks,
    landmarks,
    nodeCountX: ROAD_COUNT_X,
    nodeCountY: ROAD_COUNT_Y,
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
