// city.js — Solmar City map: roads, buildings, parks, landmarks.
// The city is a grid: roads every 360px, buildings fill the blocks
// between roads, the sea strip (y > 2100) is the harbor at the bottom.

import { WORLD_WIDTH, WORLD_HEIGHT, SEA_TOP, ROADS_X, ROADS_Y, ROAD_WIDTH, GRID_PITCH } from './config.js';
import { randRange, randInt, pick } from './random.js';
import { clamp } from './util.js';

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

const BUILDING_COLORS = ['#8a7f74', '#7d7468', '#96897a', '#6f7d8a', '#8a6f5c', '#5c6b7a', '#a08b6d', '#746a80'];
const PARK_NAMES = ['Palm Court Park', 'Harbor Green', 'Sunset Plaza'];

export function isInSea(x, y) {
  return y > SEA_TOP;
}

export function buildCity(rng) {
  const landmarks = {};
  for (const def of LANDMARK_DEFS) {
    landmarks[def.key] = { key: def.key, name: def.name, x: def.x, y: def.y };
  }

  // Three parks sit on whole blocks so the map breathes.
  const parkCells = [
    { cx: 2, cy: 1 },
    { cx: 5, cy: 3 },
    { cx: 1, cy: 4 },
  ];
  const parks = parkCells.map((c, i) => {
    const x0 = ROADS_X[c.cx] + ROAD_WIDTH / 2 + 8;
    const x1 = ROADS_X[c.cx + 1] - ROAD_WIDTH / 2 - 8;
    const y0 = ROADS_Y[c.cy] + ROAD_WIDTH / 2 + 8;
    const y1 = ROADS_Y[c.cy + 1] - ROAD_WIDTH / 2 - 8;
    return {
      name: PARK_NAMES[i % PARK_NAMES.length],
      x: (x0 + x1) / 2,
      y: (y0 + y1) / 2,
      w: x1 - x0,
      h: y1 - y0,
    };
  });

  function nearLandmark(x, y, pad) {
    for (const def of LANDMARK_DEFS) {
      const dx = x - def.x;
      const dy = y - def.y;
      if (dx * dx + dy * dy < pad * pad) return true;
    }
    return false;
  }

  function insidePark(x, y, w, h) {
    for (const p of parks) {
      if (x - w / 2 < p.x + p.w / 2 && x + w / 2 > p.x - p.w / 2 &&
          y - h / 2 < p.y + p.h / 2 && y + h / 2 > p.y - p.h / 2) return true;
    }
    return false;
  }

  const buildings = [];
  let guard = 0;
  while (buildings.length < 62 && guard < 4000) {
    guard += 1;
    const cx = randInt(rng, 0, ROADS_X.length - 2);
    const cy = randInt(rng, 0, ROADS_Y.length - 2);
    const x0 = ROADS_X[cx] + ROAD_WIDTH / 2 + 10;
    const x1 = ROADS_X[cx + 1] - ROAD_WIDTH / 2 - 10;
    const y0 = ROADS_Y[cy] + ROAD_WIDTH / 2 + 10;
    const y1 = ROADS_Y[cy + 1] - ROAD_WIDTH / 2 - 10;
    if (x1 - x0 < 90 || y1 - y0 < 90) continue;
    const w = randRange(rng, 70, Math.min(190, x1 - x0));
    const h = randRange(rng, 60, Math.min(170, y1 - y0));
    const x = randRange(rng, x0 + w / 2, x1 - w / 2);
    const y = randRange(rng, y0 + h / 2, y1 - h / 2);
    if (nearLandmark(x, y, 150)) continue;
    if (insidePark(x, y, w, h)) continue;
    let overlap = false;
    for (const b of buildings) {
      if (Math.abs(b.x - x) < (b.w + w) / 2 + 12 && Math.abs(b.y - y) < (b.h + h) / 2 + 12) {
        overlap = true;
        break;
      }
    }
    if (overlap) continue;
    buildings.push({
      x, y, w, h,
      color: pick(rng, BUILDING_COLORS),
      height: randRange(rng, 18, 64),
      kind: rng.next() < 0.12 ? 'tower' : 'block',
    });
  }

  const nodeCountX = ROADS_X.length;
  const nodeCountY = ROADS_Y.length;

  function isRoad(x, y) {
    if (x < 0 || y < 0 || x > WORLD_WIDTH || y > WORLD_HEIGHT) return false;
    for (const rx of ROADS_X) {
      if (Math.abs(x - rx) <= ROAD_WIDTH / 2) return true;
    }
    for (const ry of ROADS_Y) {
      if (Math.abs(y - ry) <= ROAD_WIDTH / 2) return true;
    }
    return false;
  }

  function pointInBuilding(x, y) {
    for (const b of buildings) {
      if (Math.abs(x - b.x) <= b.w / 2 && Math.abs(y - b.y) <= b.h / 2) return b;
    }
    return null;
  }

  function nearestRoadX(x) {
    let best = ROADS_X[0];
    let bestD = Math.abs(x - best);
    for (const rx of ROADS_X) {
      const d = Math.abs(x - rx);
      if (d < bestD) { bestD = d; best = rx; }
    }
    return best;
  }

  function nearestRoadY(y) {
    let best = ROADS_Y[0];
    let bestD = Math.abs(y - best);
    for (const ry of ROADS_Y) {
      const d = Math.abs(y - ry);
      if (d < bestD) { bestD = d; best = ry; }
    }
    return best;
  }

  function nearestRoadPoint(x, y) {
    const dx = Math.abs(x - nearestRoadX(x));
    const dy = Math.abs(y - nearestRoadY(y));
    if (dx <= dy) return { x: nearestRoadX(x), y: clamp(y, 0, WORLD_HEIGHT) };
    return { x: clamp(x, 0, WORLD_WIDTH), y: nearestRoadY(y) };
  }

  function nodePoint(ix, iy) {
    const cx = clamp(ix, 0, nodeCountX - 1);
    const cy = clamp(iy, 0, nodeCountY - 1);
    return { x: ROADS_X[cx], y: ROADS_Y[cy] };
  }

  function nearestNode(x, y) {
    let bestIx = 0;
    let bestIy = 0;
    let bestD = Infinity;
    for (let ix = 0; ix < nodeCountX; ix += 1) {
      for (let iy = 0; iy < nodeCountY; iy += 1) {
        const dx = ROADS_X[ix] - x;
        const dy = ROADS_Y[iy] - y;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; bestIx = ix; bestIy = iy; }
      }
    }
    return { ix: bestIx, iy: bestIy };
  }

  function nodeNeighbours(ix, iy) {
    const out = [];
    if (ix > 0) out.push({ ix: ix - 1, iy });
    if (ix < nodeCountX - 1) out.push({ ix: ix + 1, iy });
    if (iy > 0) out.push({ ix, iy: iy - 1 });
    if (iy < nodeCountY - 1) out.push({ ix, iy: iy + 1 });
    return out;
  }

  function randomStreetPoint(r) {
    // One coordinate snapped to a road line, the other anywhere along it.
    if (r.next() < 0.5) {
      const rx = pick(r, ROADS_X);
      return { x: rx + randRange(r, -ROAD_WIDTH / 2 + 8, ROAD_WIDTH / 2 - 8), y: randRange(r, 60, 2000) };
    }
    const ry = pick(r, ROADS_Y);
    return { x: randRange(r, 60, 2820), y: ry + randRange(r, -ROAD_WIDTH / 2 + 8, ROAD_WIDTH / 2 - 8) };
  }

  // Push a circle out of every building it overlaps. Accepts either
  // resolveCircle(x, y, r) or resolveCircle(entity, r) / resolveCircle(entity).
  function resolveCircle(a, b, c) {
    let x;
    let y;
    let r;
    let entity = null;
    if (typeof a === 'object' && a !== null) {
      entity = a;
      x = a.x;
      y = a.y;
      r = typeof b === 'number' ? b : (a.radius || 12);
    } else {
      x = a;
      y = b;
      r = typeof c === 'number' ? c : 12;
    }
    for (const bd of buildings) {
      const hw = bd.w / 2 + r;
      const hh = bd.h / 2 + r;
      const dx = x - bd.x;
      const dy = y - bd.y;
      if (Math.abs(dx) < hw && Math.abs(dy) < hh) {
        const px = hw - Math.abs(dx);
        const py = hh - Math.abs(dy);
        if (px < py) x = bd.x + (dx >= 0 ? hw : -hw);
        else y = bd.y + (dy >= 0 ? hh : -hh);
      }
    }
    x = clamp(x, 12, WORLD_WIDTH - 12);
    y = clamp(y, 12, WORLD_HEIGHT - 12);
    if (entity) {
      entity.x = x;
      entity.y = y;
      return entity;
    }
    return { x, y };
  }

  const city = {
    buildings,
    parks,
    landmarks,
    nodeCountX,
    nodeCountY,
    isRoad,
    pointInBuilding,
    nearestRoadPoint,
    nearestNode,
    nodePoint,
    nodeNeighbours,
    randomStreetPoint,
    resolveCircle,
    isInSea,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    seaTop: SEA_TOP,
    gridPitch: GRID_PITCH,
  };
  return city;
}

export default buildCity;
