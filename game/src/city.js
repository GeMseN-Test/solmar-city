// The city itself: road grid, buildings, parks, landmarks, and the
// geometry queries every other module uses (is this a road? is this
// inside a building? push this circle out of the walls?).
import { BEACH_TOP, GRID_PITCH, ROAD_WIDTH, ROAD_XS, ROAD_YS, SEA_TOP, WORLD_H, WORLD_W } from './config.js';
import { clamp, dist } from './util.js';

export const LANDMARKS = {
  garage: { key: 'garage', x: 700, y: 830, name: "Ray's Garage" },
  safehouse: { key: 'safehouse', x: 1420, y: 1190, name: "Mara's Safehouse" },
  bank: { key: 'bank', x: 1800, y: 1190, name: 'Grand Solmar Bank' },
  turf: { key: 'turf', x: 700, y: 1790, name: "Vipers' Turf" },
  docks: { key: 'docks', x: 360, y: 130, name: 'Solmar Docks' },
  marina: { key: 'marina', x: 2520, y: 1930, name: 'Solmar Marina' },
  radio: { key: 'radio', x: 2520, y: 130, name: 'Solmar Radio' },
  island: { key: 'island', x: 1440, y: 2130, name: 'Gull Island' },
};

const ROOF_COLORS = ['#8a6f5c', '#6f7d8c', '#97714f', '#7d8a6a', '#a08a7a', '#5f7484'];

function nearRoadLine(v, lines) {
  for (const line of lines) {
    if (Math.abs(v - line) <= ROAD_WIDTH / 2) return true;
  }
  return false;
}

export function buildCity(rng) {
  const buildings = [];
  const parks = [
    { x: 1080, y: 360, w: 300, h: 220 },
    { x: 2160, y: 1080, w: 300, h: 220 },
    { x: 360, y: 1440, w: 300, h: 220 },
  ];

  function clearOfLandmarks(x, y, w, h, pad) {
    for (const key of Object.keys(LANDMARKS)) {
      const lm = LANDMARKS[key];
      if (lm.x > x - pad && lm.x < x + w + pad && lm.y > y - pad && lm.y < y + h + pad) return false;
    }
    return true;
  }

  function clearOfParks(x, y, w, h, pad) {
    for (const p of parks) {
      if (x < p.x + p.w + pad && x + w + pad > p.x && y < p.y + p.h + pad && y + h + pad > p.y) return false;
    }
    return true;
  }

  // Walk the blocks between the roads and drop buildings inside them
  // until we have exactly 62, keeping roads, parks and landmarks clear.
  let guard = 0;
  while (buildings.length < 62 && guard < 4000) {
    guard++;
    const bx = rng.int(0, ROAD_XS.length - 2);
    const by = rng.int(0, ROAD_YS.length - 2);
    const x0 = ROAD_XS[bx] + ROAD_WIDTH / 2 + 14;
    const y0 = ROAD_YS[by] + ROAD_WIDTH / 2 + 14;
    const cellW = GRID_PITCH - ROAD_WIDTH - 28;
    const cellH = GRID_PITCH - ROAD_WIDTH - 28;
    const w = rng.range(90, Math.min(190, cellW));
    const h = rng.range(80, Math.min(170, cellH));
    const x = Math.round(x0 + rng.range(0, Math.max(1, cellW - w)));
    const y = Math.round(y0 + rng.range(0, Math.max(1, cellH - h)));
    if (y + h > BEACH_TOP - 10) continue;
    if (!clearOfLandmarks(x, y, w, h, 90)) continue;
    if (!clearOfParks(x, y, w, h, 30)) continue;
    let overlap = false;
    for (const b of buildings) {
      if (x < b.x + b.w + 18 && x + w + 18 > b.x && y < b.y + b.h + 18 && y + h + 18 > b.y) {
        overlap = true;
        break;
      }
    }
    if (overlap) continue;
    buildings.push({
      x, y, w: Math.round(w), h: Math.round(h),
      color: rng.pick(ROOF_COLORS),
      lit: rng.chance(0.5),
    });
  }

  function isRoad(x, y) {
    if (x < 0 || x > WORLD_W || y < 0 || y > WORLD_H) return false;
    return nearRoadLine(x, ROAD_XS) || nearRoadLine(y, ROAD_YS);
  }

  function pointInBuilding(x, y) {
    for (const b of buildings) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }

  function isInSea(x, y) {
    return y > SEA_TOP;
  }

  function isBeach(x, y) {
    return y > BEACH_TOP && y <= SEA_TOP;
  }

  // Push a circle out of any building it overlaps. Returns a corrected
  // {x, y} (a fresh object) so callers can just assign the result.
  function resolveCircle(x, y, r) {
    let nx = clamp(x, r, WORLD_W - r);
    let ny = clamp(y, r, WORLD_H - r);
    for (const b of buildings) {
      const cx = clamp(nx, b.x, b.x + b.w);
      const cy = clamp(ny, b.y, b.y + b.h);
      const dx = nx - cx;
      const dy = ny - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * r;
        ny = cy + (dy / d) * r;
      } else {
        // Dead center inside the block: shove out the nearest face.
        const left = nx - b.x;
        const right = b.x + b.w - nx;
        const top = ny - b.y;
        const bottom = b.y + b.h - ny;
        const m = Math.min(left, right, top, bottom);
        if (m === left) nx = b.x - r;
        else if (m === right) nx = b.x + b.w + r;
        else if (m === top) ny = b.y - r;
        else ny = b.y + b.h + r;
      }
    }
    return { x: nx, y: ny };
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
    if (Math.abs(x - bestX) <= Math.abs(y - bestY)) return { x: bestX, y: clamp(y, 40, BEACH_TOP - 40) };
    return { x: clamp(x, 40, WORLD_W - 40), y: bestY };
  }

  function nearestNode(x, y) {
    let bi = 0;
    let bj = 0;
    let bd = Infinity;
    for (let i = 0; i < ROAD_XS.length; i++) {
      for (let j = 0; j < ROAD_YS.length; j++) {
        const d = dist(x, y, ROAD_XS[i], ROAD_YS[j]);
        if (d < bd) { bd = d; bi = i; bj = j; }
      }
    }
    return { ix: bi, iy: bj };
  }

  function nodePoint(ix, iy) {
    return { x: ROAD_XS[clamp(ix, 0, ROAD_XS.length - 1)], y: ROAD_YS[clamp(iy, 0, ROAD_YS.length - 1)] };
  }

  function nodeNeighbours(ix, iy) {
    const out = [];
    if (ix > 0) out.push({ ix: ix - 1, iy });
    if (ix < ROAD_XS.length - 1) out.push({ ix: ix + 1, iy });
    if (iy > 0) out.push({ ix, iy: iy - 1 });
    if (iy < ROAD_YS.length - 1) out.push({ ix, iy: iy + 1 });
    return out;
  }

  // A random point on a road: one coordinate snapped to a road line,
  // the other anywhere along it. Street furniture spawns here.
  function randomStreetPoint(rng2) {
    if (rng2.chance(0.5)) {
      return { x: rng2.pick(ROAD_XS) + rng2.range(-20, 20), y: rng2.range(60, BEACH_TOP - 60) };
    }
    return { x: rng2.range(60, WORLD_W - 60), y: rng2.pick(ROAD_YS) + rng2.range(-20, 20) };
  }

  return {
    buildings,
    parks,
    landmarks: LANDMARKS,
    nodeCountX: ROAD_XS.length,
    nodeCountY: ROAD_YS.length,
    isRoad,
    pointInBuilding,
    isInSea,
    isBeach,
    resolveCircle,
    nearestRoadPoint,
    nearestNode,
    nodePoint,
    nodeNeighbours,
    randomStreetPoint,
  };
}
