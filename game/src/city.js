// Solmar City itself: the road grid, the buildings, the parks and
// the eight landmarks the missions point at.
//
// The map is a grid of roads — 8 vertical lines, 6 horizontal —
// with a block of buildings between every four neighbouring roads.
// Everything is placed from the seeded rng, so one seed always
// builds the same city.

import {
  WORLD_W,
  WORLD_H,
  SEA_TOP,
  BEACH_TOP,
  GRID_PITCH,
  ROAD_WIDTH,
  ROAD_XS,
  ROAD_YS,
} from './config.js';
import { clamp } from './util.js';

const HALF_ROAD = ROAD_WIDTH / 2;

const LANDMARKS = {
  garage: { key: 'garage', x: 700, y: 830, name: "Ray's Garage" },
  safehouse: { key: 'safehouse', x: 1420, y: 1190, name: "Mara's Safehouse" },
  bank: { key: 'bank', x: 1800, y: 1190, name: 'Grand Solmar Bank' },
  turf: { key: 'turf', x: 700, y: 1790, name: "Vipers' Turf" },
  docks: { key: 'docks', x: 360, y: 130, name: 'Solmar Docks' },
  marina: { key: 'marina', x: 2520, y: 1930, name: 'Solmar Marina' },
  radio: { key: 'radio', x: 2520, y: 130, name: 'Solmar Radio' },
  island: { key: 'island', x: 1440, y: 2130, name: 'Gull Island' },
};

const BUILDING_COLORS = [
  '#8a7f72', '#7d7468', '#97897a', '#6f7d84', '#84755e',
  '#9c8f80', '#74655a', '#8d8578', '#7a6f63', '#a08b74',
];

const PARK_NAMES = ['Palm Court Park', 'Harbor Green', 'Sunset Plaza'];

function rectsOverlap(a, b, gap) {
  return (
    Math.abs(a.x - b.x) * 2 < a.w + b.w + gap * 2 &&
    Math.abs(a.y - b.y) * 2 < a.h + b.h + gap * 2
  );
}

function nearLandmark(x, y, clear) {
  for (const key of Object.keys(LANDMARKS)) {
    const lm = LANDMARKS[key];
    const dx = x - lm.x;
    const dy = y - lm.y;
    if (dx * dx + dy * dy < clear * clear) return true;
  }
  return false;
}

export function buildCity(rng) {
  const next = typeof rng === 'function' ? rng : rng.next.bind(rng);
  const range = (min, max) => min + next() * (max - min);
  const int = (min, max) => min + Math.floor(next() * (max - min + 1));

  // Blocks sit between neighbouring road lines: 7 columns x 5 rows.
  const blocks = [];
  for (let i = 0; i < ROAD_XS.length - 1; i += 1) {
    for (let j = 0; j < ROAD_YS.length - 1; j += 1) {
      blocks.push({
        x0: ROAD_XS[i] + HALF_ROAD,
        x1: ROAD_XS[i + 1] - HALF_ROAD,
        y0: ROAD_YS[j] + HALF_ROAD,
        y1: ROAD_YS[j + 1] - HALF_ROAD,
        ci: i,
        cj: j,
      });
    }
  }

  // Three blocks become parks (never a block holding a landmark).
  const parkBlocks = [];
  const landmarkBlocks = new Set();
  for (const key of Object.keys(LANDMARKS)) {
    const lm = LANDMARKS[key];
    for (const b of blocks) {
      if (lm.x > b.x0 && lm.x < b.x1 && lm.y > b.y0 && lm.y < b.y1) {
        landmarkBlocks.add(b.ci + ':' + b.cj);
      }
    }
  }
  const parkCandidates = blocks.filter((b) => !landmarkBlocks.has(b.ci + ':' + b.cj));
  while (parkBlocks.length < 3 && parkCandidates.length > 0) {
    const pick = parkCandidates.splice(int(0, parkCandidates.length - 1), 1)[0];
    parkBlocks.push(pick);
  }
  const parkKeys = new Set(parkBlocks.map((b) => b.ci + ':' + b.cj));
  const parks = parkBlocks.map((b, i) => ({
    x: (b.x0 + b.x1) / 2,
    y: (b.y0 + b.y1) / 2,
    w: b.x1 - b.x0,
    h: b.y1 - b.y0,
    name: PARK_NAMES[i % PARK_NAMES.length],
  }));

  // Two buildings per block, split down the middle, each tucked
  // into its own half so neighbours never overlap.
  const buildings = [];
  for (const b of blocks) {
    if (parkKeys.has(b.ci + ':' + b.cj)) continue;
    const vertical = next() < 0.5;
    for (let half = 0; half < 2; half += 1) {
      let x0;
      let x1;
      let y0;
      let y1;
      if (vertical) {
        const mid = (b.x0 + b.x1) / 2;
        x0 = half === 0 ? b.x0 : mid;
        x1 = half === 0 ? mid : b.x1;
        y0 = b.y0;
        y1 = b.y1;
      } else {
        const mid = (b.y0 + b.y1) / 2;
        x0 = b.x0;
        x1 = b.x1;
        y0 = half === 0 ? b.y0 : mid;
        y1 = half === 0 ? mid : b.y1;
      }
      const w = Math.min(range(90, 150), x1 - x0 - 24);
      const h = Math.min(range(80, 140), y1 - y0 - 24);
      if (w < 60 || h < 50) continue;
      const x = range(x0 + 12 + w / 2, x1 - 12 - w / 2);
      const y = range(y0 + 12 + h / 2, y1 - 12 - h / 2);
      if (nearLandmark(x, y, 175)) continue;
      buildings.push({
        x,
        y,
        w,
        h,
        color: BUILDING_COLORS[int(0, BUILDING_COLORS.length - 1)],
      });
    }
  }

  // Top the count up to exactly 62 with spare buildings dropped
  // into whatever gaps are left.
  let guard = 0;
  while (buildings.length < 62 && guard < 400) {
    guard += 1;
    const b = blocks[int(0, blocks.length - 1)];
    if (parkKeys.has(b.ci + ':' + b.cj)) continue;
    const w = range(80, 140);
    const h = range(70, 130);
    const x = range(b.x0 + 12 + w / 2, b.x1 - 12 - w / 2);
    const y = range(b.y0 + 12 + h / 2, b.y1 - 12 - h / 2);
    if (nearLandmark(x, y, 175)) continue;
    const cand = { x, y, w, h, color: BUILDING_COLORS[int(0, BUILDING_COLORS.length - 1)] };
    if (buildings.some((o) => rectsOverlap(o, cand, 12))) continue;
    buildings.push(cand);
  }
  buildings.length = Math.min(buildings.length, 62);

  function pointInBuilding(x, y) {
    for (const b of buildings) {
      if (Math.abs(x - b.x) <= b.w / 2 && Math.abs(y - b.y) <= b.h / 2) return true;
    }
    return false;
  }

  function buildingAt(x, y) {
    for (const b of buildings) {
      if (Math.abs(x - b.x) <= b.w / 2 && Math.abs(y - b.y) <= b.h / 2) return b;
    }
    return null;
  }

  // Push a circle out of every building it overlaps, along the
  // shortest way out. Position only — never touches speed.
  function resolveCircle(a, b, c) {
    let x;
    let y;
    let r;
    let target = null;
    if (typeof a === 'object' && a !== null) {
      target = a;
      x = a.x;
      y = a.y;
      r = b;
    } else {
      x = a;
      y = b;
      r = c;
    }
    for (let pass = 0; pass < 2; pass += 1) {
      for (const bd of buildings) {
        const hw = bd.w / 2;
        const hh = bd.h / 2;
        const dx = x - bd.x;
        const dy = y - bd.y;
        if (Math.abs(dx) > hw + r || Math.abs(dy) > hh + r) continue;
        const px = hw + r - Math.abs(dx);
        const py = hh + r - Math.abs(dy);
        if (px <= 0 || py <= 0) continue;
        if (px < py) {
          x = bd.x + (dx >= 0 ? hw + r : -(hw + r));
        } else {
          y = bd.y + (dy >= 0 ? hh + r : -(hh + r));
        }
      }
    }
    if (target) {
      target.x = x;
      target.y = y;
      return target;
    }
    return { x, y };
  }

  function isRoad(x, y) {
    for (const rx of ROAD_XS) {
      if (Math.abs(x - rx) <= HALF_ROAD) return true;
    }
    for (const ry of ROAD_YS) {
      if (Math.abs(y - ry) <= HALF_ROAD) return true;
    }
    return false;
  }

  function isInSea(x, y) {
    return y > SEA_TOP;
  }

  function isOnBeach(x, y) {
    return y > BEACH_TOP && y <= SEA_TOP;
  }

  function nearestRoadPoint(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const rx of ROAD_XS) {
      const d = Math.abs(x - rx);
      if (d < bestD) {
        bestD = d;
        best = { x: rx, y: clamp(y, 40, WORLD_H - 40) };
      }
    }
    for (const ry of ROAD_YS) {
      const d = Math.abs(y - ry);
      if (d < bestD) {
        bestD = d;
        best = { x: clamp(x, 40, WORLD_W - 40), y: ry };
      }
    }
    return best;
  }

  function nodePoint(ix, iy) {
    return { x: ROAD_XS[clamp(ix, 0, ROAD_XS.length - 1)], y: ROAD_YS[clamp(iy, 0, ROAD_YS.length - 1)] };
  }

  function nearestNode(x, y) {
    const ix = clamp(Math.round((x - ROAD_XS[0]) / GRID_PITCH), 0, ROAD_XS.length - 1);
    const iy = clamp(Math.round((y - ROAD_YS[0]) / GRID_PITCH), 0, ROAD_YS.length - 1);
    return { ix, iy };
  }

  function nodeNeighbours(ix, iy) {
    const out = [];
    if (ix > 0) out.push({ ix: ix - 1, iy });
    if (ix < ROAD_XS.length - 1) out.push({ ix: ix + 1, iy });
    if (iy > 0) out.push({ ix, iy: iy - 1 });
    if (iy < ROAD_YS.length - 1) out.push({ ix, iy: iy + 1 });
    return out;
  }

  // A point on a road: one coordinate snapped to a road line,
  // the other anywhere along it.
  function randomStreetPoint(r) {
    const roll = typeof r === 'function' ? r : r.next.bind(r);
    if (roll() < 0.5) {
      const rx = ROAD_XS[Math.floor(roll() * ROAD_XS.length)];
      return { x: rx, y: 60 + roll() * 1940 };
    }
    const ry = ROAD_YS[Math.floor(roll() * ROAD_YS.length)];
    return { x: 60 + roll() * 2760, y: ry };
  }

  return {
    buildings,
    parks,
    landmarks: LANDMARKS,
    landmarkList: Object.keys(LANDMARKS).map((k) => LANDMARKS[k]),
    nodeCountX: ROAD_XS.length,
    nodeCountY: ROAD_YS.length,
    isRoad,
    pointInBuilding,
    buildingAt,
    nearestRoadPoint,
    nearestNode,
    nodePoint,
    nodeNeighbours,
    randomStreetPoint,
    resolveCircle,
    isInSea,
    isOnBeach,
  };
}
