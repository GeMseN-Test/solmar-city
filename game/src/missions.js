// Story missions M1-M5 + the mission engine every later chapter uses.
// Objective kinds: steal, reach, collect, wanted, lose, defeat, board,
// interact, escape. A defeat objective spawns its gang around the
// mission's FIRST reach landmark when the mission starts (M7's Static
// Boys at the radio tower, M8's guards at the bank, and so on).
import { boardBoat, exitBoat, nearestBoat } from './boats.js';
import { spawnGang } from './combat.js';
import { addWanted } from './police.js';
import { nearestTrafficCar } from './traffic.js';
import { dist } from './util.js';

export const MISSIONS = [
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    briefing: "Ray needs a ride. Steal any car on the street and bring it to his garage.",
    reward: 250,
    objectives: [
      { kind: 'steal', text: 'Steal a car' },
      { kind: 'reach', key: 'garage', text: "Reach Ray's Garage" },
    ],
  },
  {
    id: 'harbor-run',
    title: 'Harbor Run',
    briefing: 'Crates washed up at the docks. Grab three and run them to the marina.',
    reward: 400,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach Solmar Docks' },
      { kind: 'collect', key: 'docks', count: 3, text: 'Grab 3 crates at the docks' },
      { kind: 'reach', key: 'marina', text: 'Reach Solmar Marina' },
    ],
  },
  {
    id: 'heat-wave',
    title: 'Heat Wave',
    briefing: 'Hit the bank vault, then shake the heat and get home clean.',
    reward: 600,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Reach Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', level: 2, text: 'Grab the vault (2 stars)' },
      { kind: 'lose', text: 'Lose the cops' },
      { kind: 'reach', key: 'safehouse', text: "Reach Mara's Safehouse" },
    ],
  },
  {
    id: 'turf-war',
    title: 'Turf War',
    briefing: 'The Vipers are pushing into Mara\'s turf. Clear them out, then report back.',
    reward: 800,
    objectives: [
      { kind: 'reach', key: 'turf', text: "Reach Vipers' Turf" },
      { kind: 'defeat', count: 4, text: 'Defeat 4 Vipers' },
      { kind: 'reach', key: 'safehouse', text: "Reach Mara's Safehouse" },
    ],
  },
  {
    id: 'solmar-score',
    title: 'The Solmar Score',
    briefing: 'The big one: empty the bank vault, drop the guards, and vanish.',
    reward: 2500,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Reach Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', level: 4, text: 'Grab the vault (4 stars)' },
      { kind: 'defeat', count: 4, text: 'Defeat 4 guards' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to the Safehouse' },
      { kind: 'reach', key: 'garage', text: "Reach Ray's Garage" },
    ],
  },
];

function firstReachLandmark(state, def) {
  for (const obj of def.objectives) {
    if (obj.kind === 'reach' && obj.key && state.city.landmarks[obj.key]) {
      return state.city.landmarks[obj.key];
    }
  }
  return null;
}

function defeatObjective(def) {
  for (const obj of def.objectives) {
    if (obj.kind === 'defeat') return obj;
  }
  return null;
}

function collectObjective(def) {
  for (const obj of def.objectives) {
    if (obj.kind === 'collect') return obj;
  }
  return null;
}

// Start mission `index` (0-based). Spawns the gang for defeat
// missions and the crates for collect missions. Idempotent per index:
// calling it twice for the same mission just restarts it cleanly.
export function startMission(state, index) {
  const def = MISSIONS[index];
  if (!def) return false;
  state.missionIndex = index;
  state.mission = def;
  state.missionStep = 0;
  state.killsAtStart = state.kills;
  state.missionFlags = { vault: false };
  state.missionStartedInCar = !!state.player.inCar;
  state.missionCrates = [];
  const collect = collectObjective(def);
  if (collect) {
    const lm = (collect.key && state.city.landmarks[collect.key]) || firstReachLandmark(state, def);
    const cx = lm ? lm.x : state.player.x;
    const cy = lm ? lm.y : state.player.y;
    for (let i = 0; i < collect.count; i++) {
      state.missionCrates.push({
        x: cx + (state.rng ? state.rng.range(-70, 70) : (i - 1) * 50),
        y: cy + (state.rng ? state.rng.range(-70, 70) : 40),
        taken: false,
      });
    }
  }
  const defeat = defeatObjective(def);
  if (defeat) {
    const lm = firstReachLandmark(state, def);
    if (lm) spawnGang(state, lm.x, lm.y, defeat.count);
  }
  return true;
}

export function startNextMission(state) {
  if (state.missionIndex + 1 >= MISSIONS.length) return false;
  return startMission(state, state.missionIndex + 1);
}

export function currentObjective(state) {
  if (!state.mission) return null;
  return state.mission.objectives[state.missionStep] || null;
}

// Where the HUD arrow + minimap should point for the current step.
export function missionMarker(state) {
  const obj = currentObjective(state);
  if (!obj) return null;
  if (obj.key && state.city.landmarks[obj.key]) return state.city.landmarks[obj.key];
  if (obj.kind === 'steal') {
    const car = nearestStealableCar(state);
    return car ? { x: car.x, y: car.y, name: 'A car' } : null;
  }
  if (obj.kind === 'defeat') {
    return firstReachLandmark(state, state.mission);
  }
  if (obj.kind === 'board') {
    let best = null;
    let bestD = Infinity;
    for (const boat of state.boats) {
      if (boat.inUse) continue;
      const d = dist(state.player.x, state.player.y, boat.x, boat.y);
      if (d < bestD) { bestD = d; best = boat; }
    }
    return best ? { x: best.x, y: best.y, name: best.name } : null;
  }
  if (obj.kind === 'lose') return state.city.landmarks.safehouse;
  return null;
}

export function nearestStealableCar(state) {
  return nearestTrafficCar(state.traffic, state.player.x, state.player.y, 90);
}

export function exitCar(state) {
  const p = state.player;
  const car = p.car;
  if (!car) return false;
  p.inCar = false;
  p.car = null;
  car.speed = 0;
  // Step out to the side of the car.
  p.x = car.x - Math.sin(car.angle) * 30;
  p.y = car.y + Math.cos(car.angle) * 30;
  const fixed = state.city.resolveCircle(p.x, p.y, 11);
  p.x = fixed.x;
  p.y = fixed.y;
  p.angle = car.angle;
  return true;
}

// The E key, in priority order: leave a boat, leave a car, board a
// boat, grab a mission crate, grab the bank vault, steal a car.
// Returns an events bitmask (STEAL 512, VAULT 256, PICKUP 4).
export function tryInteract(state) {
  const p = state.player;
  if (p.inBoat) return exitBoat(state) ? 0 : 0;
  if (p.inCar) return exitCar(state) ? 0 : 0;

  const boat = nearestBoat(state, p.x, p.y);
  if (boat) {
    boardBoat(state, boat);
    return 0;
  }

  // Mission crates (collect objectives): they count, they don't pay —
  // the mission reward is the payout.
  for (const crate of state.missionCrates || []) {
    if (!crate.taken && dist(p.x, p.y, crate.x, crate.y) < 55) {
      crate.taken = true;
      return 4;
    }
  }

  // The bank vault — only when the current objective asks for it.
  const obj = currentObjective(state);
  const bank = state.city.landmarks.bank;
  if (obj && obj.kind === 'interact' && obj.key === 'bank' && dist(p.x, p.y, bank.x, bank.y) < 110) {
    state.missionFlags.vault = true;
    addWanted(state, obj.level || 4);
    return 256;
  }

  // Steal the nearest traffic car.
  const car = nearestStealableCar(state);
  if (car) {
    const idx = state.traffic.cars.indexOf(car);
    if (idx >= 0) state.traffic.cars.splice(idx, 1);
    p.inCar = true;
    p.car = car;
    car.speed = 0;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    addWanted(state, 1);
    return 512;
  }
  return 0;
}

function objectiveDone(state, obj) {
  const p = state.player;
  switch (obj.kind) {
    case 'steal':
      return p.inCar && !state.missionStartedInCar;
    case 'reach': {
      const lm = state.city.landmarks[obj.key];
      return !!lm && dist(p.x, p.y, lm.x, lm.y) < 80;
    }
    case 'collect': {
      let got = 0;
      for (const c of state.missionCrates || []) if (c.taken) got++;
      return got >= (obj.count || 1);
    }
    case 'wanted':
      return state.police.wanted >= (obj.level || 1);
    case 'lose':
      return state.police.wanted === 0;
    case 'defeat':
      return state.kills - state.killsAtStart >= (obj.count || 1);
    case 'board':
      return !!p.inBoat;
    case 'interact':
      return !!state.missionFlags.vault;
    case 'escape': {
      const lm = state.city.landmarks[obj.key];
      return !!lm && dist(p.x, p.y, lm.x, lm.y) < 90;
    }
    default:
      return false;
  }
}

// Advance objectives and pay out finished missions. Returns an events
// bitmask (MISSION 16 on an objective step, MISSION_COMPLETE 1024
// when a mission pays out). The next mission starts immediately.
export function updateMission(state) {
  let events = 0;
  if (!state.mission) return events;
  const obj = currentObjective(state);
  if (!obj) return events;
  if (!objectiveDone(state, obj)) return events;
  state.missionStep += 1;
  events |= 16;
  if (state.missionStep >= state.mission.objectives.length) {
    const reward = state.mission.reward;
    state.money += reward;
    state.missionsDone += 1;
    state.mission = null;
    state.missionCrates = [];
    events |= 1024;
    if (state.missionIndex + 1 >= MISSIONS.length) {
      state.storyComplete = true;
    } else {
      startMission(state, state.missionIndex + 1);
    }
  }
  return events;
}
