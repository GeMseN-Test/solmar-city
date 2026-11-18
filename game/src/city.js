// Solmar City's map: a sun-soaked coastal grid city, generated from a seed.
// Roads form the grid, blocks between them hold pastel buildings and parks,
// the sea laps the south edge, and six named landmarks anchor the story.
//
// Everything the other systems need to ask the map is here: is this point a
// road, is it inside a building, where is the nearest intersection, and how
// does a circle (a walker, a car) slide out of a wall.

import { BEACH_TOP, COLORS, GRID, ROAD_X, ROAD_Y, SEA_TOP, WORLD } from './config.js';
import { clampNumber } from './util.js';

const HALF_ROAD = GRID.roadWidth / 2;

export function buildCity(rng) {
  const buildings = [];
  const parks = [];

  // Landmark blocks, keyed by column/row of the block grid, so the story
  // always finds the same places: garage, safehouse, bank, turf.
  const landmarkBlocks = {
    '1,1': 'garage',
    '3,2': 'safehouse',
    '4,2': 'bank',
    '1,4': 'turf',
  };

  for (let col = 0; col < ROAD_X.length - 1; col += 1) {
    for (let row = 0; row < ROAD_Y.length - 1; row += 1) {
      const bx = ROAD_X[col] + HALF_ROAD + 6;
      const by = ROAD_Y[row] + HALF_ROAD + 6;
      const bw = ROAD_X[col + 1] - HALF_ROAD - 6 - bx;
      const bh = ROAD_Y[row + 1] - HALF_ROAD - 6 - by;
      const landmarkKey = landmarkBlocks[`${col},${row}`];
      if (landmarkKey) {
        buildings.push(makeLandmarkBuilding(bx, by, bw, bh, landmarkKey));
        continue;
      }
      if (rng.chance(0.18)) {
        parks.push(makePark(rng, bx, by, bw, bh));
        continue;
      }
      const count = rng.int(1, 3);
      for (let n = 0; n < count; n += 1) {
        const w = rng.range(86, 128);
        const h = rng.range(66, 108);
        const x = bx + rng.range(8, Math.max(9, bw - w - 8));
        const y = by + rng.range(8, Math.max(9, bh - h - 8));
        const colorIndex = rng.int(0, COLORS.buildingRoofs.length - 1);
        buildings.push({
          x, y, w, h,
          roof: COLORS.buildingRoofs[colorIndex],
          wall: COLORS.buildingWalls[colorIndex],
          floors: rng.int(1, 4),
          landmark: null,
        });
      }
    }
  }

  const landmarks = {
    garage: { key: 'garage', name: "Ray's Garage", x: 700, y: 830, r: 80, color: '#f0b070' },
    safehouse: { key: 'safehouse', name: "Mara's Safehouse", x: 1420, y: 1190, r: 80, color: '#9ad0c8' },
    bank: { key: 'bank', name: 'Grand Solmar Bank', x: 1800, y: 1190, r: 80, color: '#e8d29a' },
    turf: { key: 'turf', name: "Vipers' Turf — Old Town", x: 700, y: 1790, r: 80, color: '#d8a0d0' },
    docks: { key: 'docks', name: 'Solmar Docks', x: 360, y: 130, r: 70, color: '#a0c4e8' },
    marina: { key: 'marina', name: 'Solmar Marina', x: 2520, y: 1930, r: 70, color: '#2f9fc2' },
    radio: { key: 'radio', name: 'Solmar Radio', x: 2520, y: 130, r: 70, color: '#e8a13d' },
    island: { key: 'island', name: 'Gull Island', x: 1440, y: 2130, r: 70, color: '#f2c94c' },
  };

  const city = {
    buildings,
    parks,
    landmarks,
    nodeCountX: ROAD_X.length,
    nodeCountY: ROAD_Y.length,
  };

  return Object.assign(city, {
    isRoad,
    pointInBuilding,
    nearestRoadPoint,
    nearestNode,
    nodePoint,
    nodeNeighbours,
    randomStreetPoint,
    resolveCircle,
    isInSea,
  });

  function makeLandmarkBuilding(bx, by, bw, bh, key) {
    const w = Math.min(bw - 40, 170);
    const h = Math.min(bh - 40, 120);
    const colors = { garage: 5, safehouse: 6, bank: 2, turf: 4 };
    const index = colors[key] ?? 0;
    return {
      x: bx + (bw - w) / 2,
      y: by + (bh - h) / 2,
      w, h,
      roof: COLORS.buildingRoofs[index],
      wall: COLORS.buildingWalls[index],
      floors: 2,
      landmark: key,
    };
  }

  function makePark(rngSource, bx, by, bw, bh) {
    const trees = [];
    const treeCount = rngSource.int(6, 10);
    for (let i = 0; i < treeCount; i += 1) {
      trees.push({
        x: bx + rngSource.range(16, bw - 16),
        y: by + rngSource.range(16, bh - 16),
        r: rngSource.range(9, 15),
      });
    }
    return { x: bx, y: by, w: bw, h: bh, trees };
  }

  function isRoad(x, y) {
    for (let i = 0; i < ROAD_X.length; i += 1) {
      if (Math.abs(x - ROAD_X[i]) <= HALF_ROAD) return true;
    }
    for (let j = 0; j < ROAD_Y.length; j += 1) {
      if (Math.abs(y - ROAD_Y[j]) <= HALF_ROAD) return true;
    }
    return false;
  }

  function pointInBuilding(x, y, pad = 0) {
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      if (x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad) return b;
    }
    return null;
  }

  function nearestRoadPoint(x, y) {
    let bestX = ROAD_X[0];
    for (let i = 1; i < ROAD_X.length; i += 1) {
      if (Math.abs(x - ROAD_X[i]) < Math.abs(x - bestX)) bestX = ROAD_X[i];
    }
    let bestY = ROAD_Y[0];
    for (let j = 1; j < ROAD_Y.length; j += 1) {
      if (Math.abs(y - ROAD_Y[j]) < Math.abs(y - bestY)) bestY = ROAD_Y[j];
    }
    const alongVertical = Math.abs(x - bestX);
    const alongHorizontal = Math.abs(y - bestY);
    if (alongVertical <= alongHorizontal) return { x: bestX, y: clampNumber(y, 0, WORLD.height) };
    return { x: clampNumber(x, 0, WORLD.width), y: bestY };
  }

  function nodePoint(ix, iy) {
    return { x: ROAD_X[ix], y: ROAD_Y[iy] };
  }

  function nearestNode(x, y) {
    let bestIx = 0;
    let bestIy = 0;
    let best = Infinity;
    for (let ix = 0; ix < ROAD_X.length; ix += 1) {
      for (let iy = 0; iy < ROAD_Y.length; iy += 1) {
        const dx = x - ROAD_X[ix];
        const dy = y - ROAD_Y[iy];
        const d = dx * dx + dy * dy;
        if (d < best) {
          best = d;
          bestIx = ix;
          bestIy = iy;
        }
      }
    }
    return { ix: bestIx, iy: bestIy, x: ROAD_X[bestIx], y: ROAD_Y[bestIy] };
  }

  function nodeNeighbours(ix, iy) {
    const out = [];
    if (ix > 0) out.push({ ix: ix - 1, iy });
    if (ix < ROAD_X.length - 1) out.push({ ix: ix + 1, iy });
    if (iy > 0) out.push({ ix, iy: iy - 1 });
    if (iy < ROAD_Y.length - 1) out.push({ ix, iy: iy + 1 });
    return out;
  }

  function randomStreetPoint(rngSource) {
    if (rngSource.chance(0.5)) {
      return { x: rngSource.pick(ROAD_X), y: rngSource.range(60, WORLD.height - 120) };
    }
    return { x: rngSource.range(60, WORLD.width - 60), y: rngSource.pick(ROAD_Y) };
  }

  function isInSea(x, y) {
    return y >= SEA_TOP;
  }

  // Push a circle (walker or car centre) out of buildings, the sea and the
  // map edge. Returns true when anything pushed back.
  function resolveCircle(body, radius) {
    let hit = false;
    body.x = clampNumber(body.x, 16 + radius, WORLD.width - 16 - radius);
    body.y = clampNumber(body.y, 16 + radius, WORLD.height - 16 - radius);
    if (body.y + radius > SEA_TOP) {
      body.y = SEA_TOP - radius;
      hit = true;
    }
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      const nearX = clampNumber(body.x, b.x, b.x + b.w);
      const nearY = clampNumber(body.y, b.y, b.y + b.h);
      const dx = body.x - nearX;
      const dy = body.y - nearY;
      const d2 = dx * dx + dy * dy;
      if (d2 >= radius * radius) continue;
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        body.x = nearX + (dx / d) * radius;
        body.y = nearY + (dy / d) * radius;
      } else {
        // Dead centre of a wall: shove out along the thinnest side.
        const left = body.x - b.x;
        const right = b.x + b.w - body.x;
        const top = body.y - b.y;
        const bottom = b.y + b.h - body.y;
        const smallest = Math.min(left, right, top, bottom);
        if (smallest === left) body.x = b.x - radius;
        else if (smallest === right) body.x = b.x + b.w + radius;
        else if (smallest === top) body.y = b.y - radius;
        else body.y = b.y + b.h + radius;
      }
    }
    return hit;
  }
}
