// Solmar City — the city itself. buildCity(rng) lays out one fixed
// grid (8 vertical roads, 6 horizontal, 360px apart) and fills the
// blocks between them with 62 buildings and 3 parks, all from the
// seeded rng, so a seed always rebuilds the same streets.
//
// The city answers the questions the rest of the game asks: is this
// point on a road, inside a building, or in the sea? Where is the
// nearest road, the nearest intersection, a random street corner?
// And it can push a circle (player, car) out of a building wall.

import {
  WORLD_W, WORLD_H, SEA_TOP, ROAD_X, ROAD_Y, ROAD_HALF,
  NODE_COUNT_X, NODE_COUNT_Y,
} from './config.js';
import { clamp, dist } from './util.js';
import { shuffle } from './random.js';

// The eight places every mission talks about. Fixed coordinates so
// the HUD arrow, the minimap and the mission text all agree.
export const LANDMARKS = {
  garage: { x: 700, y: 830, name: "Ray's Garage" },
  safehouse: { x: 1420, y: 1190, name: "Mara's Safehouse" },
  bank: { x: 1800, y: 1190, name: 'Grand Solmar Bank' },
  turf: { x: 700, y: 1790, name: "Vipers' Turf" },
  docks: { x: 360, y: 130, name: 'Solmar Docks' },
  marina: { x: 2520, y: 1930, name: 'Solmar Marina' },
  radio: { x: 2520, y: 130, name: 'Solmar Radio' },
  island: { x: 1440, y: 2130, name: 'Gull Island' },
};

const BUILDING_COLORS = [
  '#3a3f4a', '#464b58', '#33363f', '#4a4038', '#3d4450',
  '#413a4d', '#37424a', '#4d4436', '#39424e', '#453d33',
];

// Does rect r cover landmark point p (with a little margin)?
function coversLandmark(r, margin) {
  for (const key of Object.keys(LANDMARKS)) {
    const p = LANDMARKS[key];
    if (p.x > r.x - margin && p.x < r.x + r.w + margin
      && p.y > r.y - margin && p.y < r.y + r.h + margin) {
      return true;
    }
  }
  return false;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x
    && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function buildCity(rng) {
  // Blocks are the rectangles between neighbouring roads:
  // 7 columns x 5 rows = 35 blocks.
  const blocks = [];
  for (let bx = 0; bx < NODE_COUNT_X - 1; bx++) {
    for (let by = 0; by < NODE_COUNT_Y - 1; by++) {
      blocks.push({
        x0: ROAD_X[bx] + ROAD_HALF + 10,
        y0: ROAD_Y[by] + ROAD_HALF + 10,
        x1: ROAD_X[bx + 1] - ROAD_HALF - 10,
        y1: ROAD_Y[by + 1] - ROAD_HALF - 10,
      });
    }
  }

  // Three blocks become parks (open ground, no buildings).
  const order = shuffle(rng, blocks.map((b, i) => i));
  const parkIdx = new Set(order.slice(0, 3));
  const parks = order.slice(0, 3).map((i) => {
    const b = blocks[i];
    return { x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 };
  });

  // 62 buildings: 30 street blocks get 2 each, 2 get 1 each.
  // (35 blocks - 3 parks = 32 buildable blocks; 30*2 + 2*1 = 62.)
  const buildable = order.slice(3);
  const buildings = [];
  buildable.forEach((bi, n) => {
    const b = blocks[bi];
    const count = n < 30 ? 2 : 1;
    if (count === 1) {
      const w = 70 + rng.range(0, 90);
      const h = 70 + rng.range(0, 90);
      const r = placeInBlock(rng, b, w, h, buildings);
      if (r) buildings.push(r);
      return;
    }
    // Two buildings: split the block in half so they never overlap.
    const vertical = rng.next() < 0.5;
    const halves = vertical
      ? [
        { x0: b.x0, y0: b.y0, x1: (b.x0 + b.x1) / 2 - 6, y1: b.y1 },
        { x0: (b.x0 + b.x1) / 2 + 6, y0: b.y0, x1: b.x1, y1: b.y1 },
      ]
      : [
        { x0: b.x0, y0: b.y0, x1: b.x1, y1: (b.y0 + b.y1) / 2 - 6 },
        { x0: b.x0, y0: (b.y0 + b.y1) / 2 + 6, x1: b.x1, y1: b.y1 },
      ];
    for (const half of halves) {
      const w = 60 + rng.range(0, Math.max(10, half.x1 - half.x0 - 70));
      const h = 60 + rng.range(0, Math.max(10, half.y1 - half.y0 - 70));
      const r = placeInBlock(rng, half, w, h, buildings);
      if (r) buildings.push(r);
    }
  });

  // Guarantee the count: if a placement was refused (landmark in the
  // way), top up with small buildings tucked into free corners.
  let guard = 0;
  while (buildings.length < 62 && guard < 200) {
    guard++;
    const b = blocks[buildable[guard % buildable.length]];
    const w = 60 + rng.range(0, 60);
    const h = 60 + rng.range(0, 60);
    const r = placeInBlock(rng, b, w, h, buildings, 2);
    if (r) buildings.push(r);
  }
  buildings.length = Math.min(buildings.length, 62);

  return {
    buildings,
    parks,
    landmarks: LANDMARKS,
    nodeCountX: NODE_COUNT_X,
    nodeCountY: NODE_COUNT_Y,
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

  // Try a few random spots inside block b for a w x h building that
  // avoids landmarks and other buildings. Returns the rect or null.
  function placeInBlock(r, block, w, h, others, tries) {
    const attempts = tries || 8;
    for (let t = 0; t < attempts; t++) {
      const maxX = Math.max(block.x0, block.x1 - w);
      const maxY = Math.max(block.y0, block.y1 - h);
      const rect = {
        x: block.x0 + r.range(0, Math.max(0, maxX - block.x0)),
        y: block.y0 + r.range(0, Math.max(0, maxY - block.y0)),
        w: Math.min(w, block.x1 - block.x0),
        h: Math.min(h, block.y1 - block.y0),
        color: r.pick(BUILDING_COLORS),
      };
      if (coversLandmark(rect, 30)) continue;
      if (others.some((o) => rectsOverlap(rect, o))) continue;
      return rect;
    }
    return null;
  }

  // True when (x, y) sits on a road (within half the road width of a
  // road line, inside the grid's span).
  function isRoad(x, y) {
    for (const rx of ROAD_X) {
      if (Math.abs(x - rx) <= ROAD_HALF && y >= ROAD_Y[0] - ROAD_HALF
        && y <= ROAD_Y[ROAD_Y.length - 1] + ROAD_HALF) return true;
    }
    for (const ry of ROAD_Y) {
      if (Math.abs(y - ry) <= ROAD_HALF && x >= ROAD_X[0] - ROAD_HALF
        && x <= ROAD_X[ROAD_X.length - 1] + ROAD_HALF) return true;
    }
    return false;
  }

  function pointInBuilding(x, y) {
    for (const b of buildings) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        return b;
      }
    }
    return null;
  }

  // Closest point on the road network to (x, y).
  function nearestRoadPoint(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const rx of ROAD_X) {
      const py = clamp(y, ROAD_Y[0], ROAD_Y[ROAD_Y.length - 1]);
      const d = dist(x, y, rx, py);
      if (d < bestD) { bestD = d; best = { x: rx, y: py }; }
    }
    for (const ry of ROAD_Y) {
      const px = clamp(x, ROAD_X[0], ROAD_X[ROAD_X.length - 1]);
      const d = dist(x, y, px, ry);
      if (d < bestD) { bestD = d; best = { x: px, y: ry }; }
    }
    return best;
  }

  // Nearest intersection indices { ix, iy }.
  function nearestNode(x, y) {
    const ix = clamp(Math.round((x - ROAD_X[0]) / 360), 0, NODE_COUNT_X - 1);
    const iy = clamp(Math.round((y - ROAD_Y[0]) / 360), 0, NODE_COUNT_Y - 1);
    return { ix, iy };
  }

  function nodePoint(ix, iy) {
    return { x: ROAD_X[ix], y: ROAD_Y[iy] };
  }

  // Intersections one step away (up/down/left/right, inside the grid).
  function nodeNeighbours(ix, iy) {
    const out = [];
    if (ix > 0) out.push({ ix: ix - 1, iy });
    if (ix < NODE_COUNT_X - 1) out.push({ ix: ix + 1, iy });
    if (iy > 0) out.push({ ix, iy: iy - 1 });
    if (iy < NODE_COUNT_Y - 1) out.push({ ix, iy: iy + 1 });
    return out;
  }

  // A random point on a road: pick a road line, a spot along it, and
  // a small sideways offset so things do not all sit dead-centre.
  function randomStreetPoint(r) {
    if (r.next() < 0.5) {
      const rx = r.pick(ROAD_X);
      const y = r.range(ROAD_Y[0], ROAD_Y[ROAD_Y.length - 1]);
      return { x: rx + r.range(-20, 20), y };
    }
    const ry = r.pick(ROAD_Y);
    const x = r.range(ROAD_X[0], ROAD_X[ROAD_X.length - 1]);
    return { x, y: ry + r.range(-20, 20) };
  }

  // Push a circle out of any building it overlaps and keep it inside
  // the world. Two call shapes, both used across the codebase:
  //   resolveCircle(entity) — entity { x, y, radius }, moved in place.
  //   resolveCircle(x, y, radius) — returns a fresh { x, y }.
  // Either way the returned value is the resolved position.
  function resolveCircle(ent, y, radius) {
    let target;
    let r;
    if (typeof ent === 'number') {
      target = { x: ent, y: y || 0 };
      r = radius || 12;
    } else {
      target = ent;
      r = ent.radius || ent.r || 12;
    }
    for (const b of buildings) {
      const cx = clamp(target.x, b.x, b.x + b.w);
      const cy = clamp(target.y, b.y, b.y + b.h);
      const dx = target.x - cx;
      const dy = target.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 === 0) {
        // Dead centre: shove out through the nearest wall.
        const left = target.x - b.x;
        const right = b.x + b.w - target.x;
        const top = target.y - b.y;
        const bottom = b.y + b.h - target.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) target.x = b.x - r;
        else if (m === right) target.x = b.x + b.w + r;
        else if (m === top) target.y = b.y - r;
        else target.y = b.y + b.h + r;
        continue;
      }
      const d = Math.sqrt(d2);
      const push = (r - d) / d;
      target.x += dx * push;
      target.y += dy * push;
    }
    target.x = clamp(target.x, 16, WORLD_W - 16);
    target.y = clamp(target.y, 16, WORLD_H - 16);
    return target;
  }

  // The sea is everything below y 2100.
  function isInSea(x, y) {
    return y > SEA_TOP;
  }
}
