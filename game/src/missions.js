// missions.js — Solmar City story missions M1–M5.
// Written from the v2 spec only. Objective kinds: steal, reach, collect,
// wanted, lose, defeat, board, interact, escape.
import { spawnGang } from './combat.js';
import { nearestTrafficCar } from './traffic.js';
import { nearestBoat, boardBoat } from './boats.js';

// Landmark coordinates (same map as city.js).
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

export const REACH_RADIUS = 90;

export const MISSIONS = [
  {
    id: 'M1',
    title: 'First Wheels',
    briefing: 'Mara needs wheels. Steal a car off the street, then bring it to Ray\'s Garage.',
    reward: 200,
    objectives: [
      { kind: 'steal', text: 'Steal a car (E near a car)' },
      { kind: 'reach', key: 'garage', text: "Drive to Ray's Garage" },
    ],
  },
  {
    id: 'M2',
    title: 'Turf Warm-Up',
    briefing: 'The Vipers are pushing into our streets. Go to their turf, teach two of them a lesson, then get back to the safehouse.',
    reward: 400,
    objectives: [
      { kind: 'reach', key: 'turf', text: "Reach Vipers' Turf" },
      { kind: 'defeat', count: 2, text: 'Defeat 2 Vipers' },
      { kind: 'reach', key: 'safehouse', text: "Return to Mara's Safehouse" },
    ],
  },
  {
    id: 'M3',
    title: 'Dockside Errand',
    briefing: 'Three crates washed up at the docks with Mara\'s name on them. Grab them all and bring the haul to the garage.',
    reward: 600,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach Solmar Docks' },
      { kind: 'collect', count: 3, text: 'Collect 3 crates (E near a crate)' },
      { kind: 'reach', key: 'garage', text: "Deliver to Ray's Garage" },
    ],
  },
  {
    id: 'M4',
    title: 'Heat Up',
    briefing: 'Time to make the cops notice you — then make them lose you. Get the heat to 2 stars, shake it off, and lay low at the safehouse.',
    reward: 800,
    objectives: [
      { kind: 'reach', key: 'turf', text: "Reach Vipers' Turf" },
      { kind: 'wanted', level: 2, text: 'Raise your wanted level to 2 stars' },
      { kind: 'lose', text: 'Lose the cops (wanted back to 0)' },
      { kind: 'reach', key: 'safehouse', text: "Lay low at Mara's Safehouse" },
    ],
  },
  {
    id: 'M5',
    title: 'The Big Score',
    briefing: 'Grand Solmar Bank. Grab the vault, handle the guards, and vanish to the safehouse. This one pays.',
    reward: 3500,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Reach Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault (E at the bank)' },
      { kind: 'defeat', count: 4, text: 'Defeat 4 bank guards' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to the safehouse' },
    ],
  },
];

// First reach objective of a mission — where a defeat gang spawns.
export function firstReachLandmark(def) {
  for (const o of def.objectives) {
    if ((o.kind === 'reach' || o.kind === 'escape') && o.key) return o.key;
  }
  return null;
}

export function landmarkOf(state, key) {
  if (state.city && state.city.landmarks && state.city.landmarks[key]) {
    return state.city.landmarks[key];
  }
  return LANDMARKS[key] || null;
}

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function nearLandmark(state, key, radius) {
  const lm = landmarkOf(state, key);
  if (!lm) return false;
  return dist(state.player.x, state.player.y, lm.x, lm.y) <= (radius || REACH_RADIUS);
}

// Spawn the defeat gang for a mission (idempotent per mission start).
export function setupMissionGang(state, def) {
  const defeat = def.objectives.find((o) => o.kind === 'defeat');
  if (!defeat) return;
  if (state.missionGangSpawnedFor === def.id) return;
  const key = firstReachLandmark(def);
  const lm = key ? landmarkOf(state, key) : null;
  const x = lm ? lm.x : state.player.x;
  const y = lm ? lm.y : state.player.y;
  try {
    if (typeof spawnGang === 'function') spawnGang(state, x, y, defeat.count || 1);
  } catch (e) { /* gang spawn is best-effort; mission still runs */ }
  state.missionGangSpawnedFor = def.id;
}

export function startMission(state, index) {
  const def = MISSIONS[index];
  if (!def) return null;
  state.missionIndex = index;
  state.currentMission = def;
  state.missionObjectiveIndex = 0;
  state.killsAtStart = state.kills || 0;
  state.missionCollect = 0;
  state.missionInteracted = false;
  state.missionHadWanted = false;
  state.missionGangSpawnedFor = null;
  setupMissionGang(state, def);
  return def;
}

export function currentObjective(state) {
  const def = state.currentMission || MISSIONS[state.missionIndex];
  if (!def) return null;
  return def.objectives[state.missionObjectiveIndex || 0] || null;
}

export function missionMarker(state) {
  const o = currentObjective(state);
  if (!o) return null;
  if (o.key) {
    const lm = landmarkOf(state, o.key);
    if (lm) return { x: lm.x, y: lm.y, name: lm.name || o.key, kind: o.kind };
  }
  if (o.kind === 'board') return { x: 2500, y: 2120, name: 'Boats', kind: 'board' };
  if (o.kind === 'collect') return { x: 360, y: 130, name: 'Solmar Docks', kind: 'collect' };
  return null;
}

function objectiveDone(state, o) {
  const p = state.player;
  const wanted = state.police ? state.police.wanted : 0;
  switch (o.kind) {
    case 'steal':
      return !!p.inCar;
    case 'reach':
    case 'escape':
      return nearLandmark(state, o.key);
    case 'collect':
      return (state.missionCollect || 0) >= (o.count || 1);
    case 'wanted':
      return wanted >= (o.level || 1);
    case 'lose':
      if (wanted > 0) state.missionHadWanted = true;
      return !!state.missionHadWanted && wanted === 0;
    case 'defeat':
      return (state.kills || 0) - (state.killsAtStart || 0) >= (o.count || 1);
    case 'board':
      return !!p.inBoat;
    case 'interact':
      return !!state.missionInteracted;
    default:
      return false;
  }
}

// Advance objectives; pay out on completion.
// Returns 'objective', 'complete', or null.
export function updateMission(state) {
  const def = state.currentMission || MISSIONS[state.missionIndex];
  if (!def) return null;
  let advanced = false;
  while (true) {
    const o = def.objectives[state.missionObjectiveIndex || 0];
    if (!o) break;
    if (!objectiveDone(state, o)) break;
    state.missionObjectiveIndex = (state.missionObjectiveIndex || 0) + 1;
    advanced = true;
    const next = def.objectives[state.missionObjectiveIndex];
    if (next && next.kind === 'lose') state.missionHadWanted = false;
    if (state.missionObjectiveIndex >= def.objectives.length) {
      state.money = (state.money || 0) + def.reward;
      state.missionsDone = (state.missionsDone || 0) + 1;
      const wasLast = state.missionIndex >= MISSIONS.length - 1;
      if (wasLast) state.storyComplete = true;
      // Back to -1 so main.js startMissionIfNeeded() auto-starts the next
      // mission (startMission spawns the defeat gang + resets killsAtStart).
      // Leaving missionIndex at +1 would skip startMission and soft-lock
      // every later defeat objective: no gang ever spawns for it.
      state.missionIndex = -1;
      state.currentMission = null;
      state.missionObjectiveIndex = 0;
      state.missionInteracted = false;
      return 'complete';
    }
  }
  return advanced ? 'objective' : null;
}

// Leave the player's car where it stands.
export function exitCar(state) {
  const p = state.player;
  if (!p.inCar || !p.car) return false;
  p.inCar = false;
  p.x = p.car.x + 34;
  p.y = p.car.y;
  p.car = null;
  return true;
}

// Nearest car the player could steal (traffic car).
export function nearestStealableCar(state) {
  if (!state.traffic) return null;
  try {
    if (typeof nearestTrafficCar === 'function') {
      return nearestTrafficCar(state.traffic, state.player.x, state.player.y, 70);
    }
  } catch (e) { /* fall through */ }
  let best = null;
  let bestD = 70;
  for (const c of state.traffic.cars || []) {
    const d = dist(state.player.x, state.player.y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function nearestCrate(state, maxDist) {
  let best = null;
  let bestD = maxDist || 60;
  for (const c of state.crates || []) {
    if (c.taken) continue;
    const d = dist(state.player.x, state.player.y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

// E key: steal car / board boat / grab crate / grab vault / exit car.
// Returns an event tag: 'steal' | 'board' | 'crate' | 'vault' | 'exit' | 'exitBoat' | null.
// NOTE: the vault pays nothing instantly — the reward comes when the
// mission completes. Wanted jumps to 4 stars on a vault grab.
export function tryInteract(state) {
  const p = state.player;
  if (!p) return null;

  if (p.inCar) {
    exitCar(state);
    return 'exit';
  }
  if (p.inBoat) return 'exitBoat';

  // Vault grab: at the bank during an interact objective.
  const o = currentObjective(state);
  if (o && o.kind === 'interact' && o.key === 'bank' && nearLandmark(state, 'bank', 110)) {
    state.missionInteracted = true;
    if (state.police) {
      state.police.wanted = 4;
      if (typeof state.police.resetWantedTimer === 'function') state.police.resetWantedTimer();
    }
    return 'vault';
  }

  // Crate grab.
  const crate = nearestCrate(state, 60);
  if (crate) {
    crate.taken = true;
    state.missionCollect = (state.missionCollect || 0) + 1;
    return 'crate';
  }

  // Board a nearby boat (before cars — docks are by the water).
  try {
    const boat = typeof nearestBoat === 'function'
      ? nearestBoat(state, p.x, p.y) : null;
    if (boat) {
      boardBoat(state, boat);
      return 'board';
    }
  } catch (e) { /* no boats in this state */ }

  // Steal a nearby car: wanted +1.
  const car = nearestStealableCar(state);
  if (car) {
    p.inCar = true;
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    if (state.police) {
      state.police.wanted = Math.min(5, (state.police.wanted || 0) + 1);
      if (typeof state.police.resetWantedTimer === 'function') state.police.resetWantedTimer();
    }
    return 'steal';
  }
  return null;
}
