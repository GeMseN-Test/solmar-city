// missions.js — Story missions M1–M5 for Solmar City.
//
// The mission list is a plain mutable array: missions2/3/4 append
// M6–M12 to it at import time, so the story grows without this file
// ever changing. Every objective kind the game knows is handled in
// updateMission(): steal, reach, collect, wanted, lose, defeat, board,
// interact, escape.
//
// Defeat objectives count kills since the mission started
// (state.mission.killsAtStart). Dead enemies are swept and counted by
// world.step, never by combat — this module only reads the counter.
//
// Event bitmask shared by world / missions / main:
export const EV = {
  SHOT: 1,
  PUNCH: 2,
  PICKUP: 4,
  CRASH: 8,
  MISSION: 16,
  DIED: 32,
  BUSTED: 64,
  ENEMY_SHOT: 128,
  VAULT: 256,
  STEAL: 512,
  MISSION_COMPLETE: 1024,
};

import { spawnGang } from './combat.js';
import { nearestTrafficCar } from './traffic.js';
import { nearestBoat, boardBoat, exitBoat } from './boats.js';

// ------------------------------------------------------------------
// Mission definitions (M1–M5, the original Solmar story arc)
// ------------------------------------------------------------------

export const MISSIONS = [
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    briefing: 'Ray needs wheels. Steal a car off the street and bring it to his garage.',
    reward: 200,
    objectives: [
      { kind: 'steal', text: 'Steal a car' },
      { kind: 'reach', key: 'garage', text: "Drive it to Ray's Garage" },
    ],
  },
  {
    id: 'harbor-run',
    title: 'Harbor Run',
    briefing: 'Smuggled crates are sitting on the docks. Grab them and run them to the marina.',
    reward: 400,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach the Solmar Docks' },
      { kind: 'collect', count: 3, text: 'Grab 3 crates' },
      { kind: 'reach', key: 'marina', text: 'Deliver to the Solmar Marina' },
    ],
  },
  {
    id: 'heat-wave',
    title: 'Heat Wave',
    briefing: 'The Vipers want you hot. Stir up 2 stars of heat, then shake the cops and go cold.',
    reward: 600,
    objectives: [
      { kind: 'reach', key: 'turf', text: "Reach the Vipers' Turf" },
      { kind: 'wanted', level: 2, text: 'Get 2 stars of heat' },
      { kind: 'lose', text: 'Lose the cops (0 stars)' },
    ],
  },
  {
    id: 'turf-war',
    title: 'Turf War',
    briefing: "The Vipers jumped Ray's crew. Take the turf back, then get home safe.",
    reward: 800,
    objectives: [
      { kind: 'reach', key: 'turf', text: "Reach the Vipers' Turf" },
      { kind: 'defeat', count: 4, text: 'Defeat 4 Vipers' },
      { kind: 'reach', key: 'safehouse', text: "Escape to Mara's Safehouse" },
    ],
  },
  {
    id: 'solmar-score',
    title: 'The Solmar Score',
    briefing: 'The big one. Hit the Grand Solmar Bank vault, then vanish before the city wakes up.',
    reward: 1500,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Reach the Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault' },
      { kind: 'escape', key: 'safehouse', text: "Escape to Mara's Safehouse" },
    ],
  },
];

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

export function landmarkFor(state, key) {
  if (!state || !state.city || !state.city.landmarks) return null;
  return state.city.landmarks[key] || null;
}

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function firstReachDef(def) {
  return def.objectives.find((o) => o.kind === 'reach') || null;
}

// Spawn the gang for a defeat objective around the first reach
// landmark of the mission (M4: 4 Vipers at the turf). Guarded so a
// mission can never spawn its gang twice.
export function spawnDefeatGang(state, def) {
  const m = state.mission;
  if (!m || m.gangSpawned) return;
  const defeat = def.objectives.find((o) => o.kind === 'defeat');
  if (!defeat) return;
  const reach = firstReachDef(def);
  const lm = reach ? landmarkFor(state, reach.key) : null;
  if (!lm) return;
  spawnGang(state, lm.x, lm.y, defeat.count);
  m.gangSpawned = true;
}

function spawnCrates(state, def) {
  const collect = def.objectives.find((o) => o.kind === 'collect');
  if (!collect) return;
  const reach = firstReachDef(def);
  const lm = reach ? landmarkFor(state, reach.key) : null;
  const cx = lm ? lm.x : state.player.x;
  const cy = lm ? lm.y : state.player.y;
  state.crates = [];
  for (let i = 0; i < collect.count; i++) {
    const a = (i / collect.count) * Math.PI * 2 + 0.6;
    const r = 90 + (i % 2) * 55;
    state.crates.push({
      x: Math.max(40, Math.min(2840, cx + Math.cos(a) * r)),
      y: Math.max(40, Math.min(2060, cy + Math.sin(a) * r)),
      taken: false,
    });
  }
}

// ------------------------------------------------------------------
// Lifecycle
// ------------------------------------------------------------------

export function startMission(state, index) {
  const def = MISSIONS[index];
  if (!def) return false;
  state.mission = {
    def,
    index,
    objectiveIndex: 0,
    killsAtStart: state.kills || 0,
    collected: 0,
    vaultDone: false,
    gangSpawned: false,
  };
  state.missionIndex = index;
  state.crates = [];
  spawnCrates(state, def);
  spawnDefeatGang(state, def);
  state.bannerText = def.title + ' — ' + def.briefing;
  state.bannerTimer = 4;
  return true;
}

// Advance the current objective when its condition is met.
// Returns 'advanced', 'complete', or null.
export function updateMission(state) {
  const m = state.mission;
  if (!m) return null;
  const def = m.def;
  const obj = def.objectives[m.objectiveIndex];
  if (!obj) return null;
  const p = state.player;
  let done = false;

  if (obj.kind === 'steal') {
    done = !!p.inCar;
  } else if (obj.kind === 'reach' || obj.kind === 'escape') {
    const lm = landmarkFor(state, obj.key);
    if (lm) done = dist(p.x, p.y, lm.x, lm.y) < 90;
  } else if (obj.kind === 'collect') {
    done = m.collected >= (obj.count || 1);
  } else if (obj.kind === 'wanted') {
    done = (state.wanted || 0) >= (obj.level || 1);
  } else if (obj.kind === 'lose') {
    done = (state.wanted || 0) === 0;
  } else if (obj.kind === 'defeat') {
    done = (state.kills || 0) - m.killsAtStart >= (obj.count || 1);
  } else if (obj.kind === 'board') {
    done = !!p.inBoat;
  } else if (obj.kind === 'interact') {
    done = !!m.vaultDone;
  }

  if (!done) return null;

  m.objectiveIndex += 1;
  if (m.objectiveIndex < def.objectives.length) {
    const next = def.objectives[m.objectiveIndex];
    state.bannerText = 'Objective: ' + next.text;
    state.bannerTimer = 2.5;
    // A defeat objective later in the same mission spawns its gang
    // when it becomes current (e.g. M12 guards after the vault).
    spawnDefeatGang(state, def);
    return 'advanced';
  }

  // Mission complete: pay out, count it, clear the active mission.
  state.money = (state.money || 0) + def.reward;
  state.missionsDone = (state.missionsDone || 0) + 1;
  state.mission = null;
  state.crates = [];
  state.bannerText = 'Mission complete! +$' + def.reward + ' — ' + def.title;
  state.bannerTimer = 4;
  if (state.missionIndex === MISSIONS.length - 1) {
    state.storyComplete = true;
    state.bannerText = 'STORY COMPLETE — You are the King of Solmar! +$' + def.reward;
    state.bannerTimer = 6;
  }
  return 'complete';
}

export function currentObjective(state) {
  const m = state.mission;
  if (!m) return null;
  return m.def.objectives[m.objectiveIndex] || null;
}

// Where the player should go right now: a landmark, a crate, a boat,
// or a stealable car — whatever the current objective points at.
export function missionMarker(state) {
  const m = state.mission;
  if (!m) return null;
  const obj = m.def.objectives[m.objectiveIndex];
  if (!obj) return null;

  if (obj.kind === 'reach' || obj.kind === 'escape' || obj.kind === 'interact') {
    return landmarkFor(state, obj.key);
  }
  if (obj.kind === 'defeat') {
    const reach = firstReachDef(m.def);
    return reach ? landmarkFor(state, reach.key) : null;
  }
  if (obj.kind === 'collect') {
    const crate = (state.crates || []).find((c) => !c.taken);
    return crate ? { x: crate.x, y: crate.y, name: 'Crate' } : null;
  }
  if (obj.kind === 'board') {
    const boat = nearestBoat(state, state.player.x, state.player.y);
    if (boat) return { x: boat.x, y: boat.y, name: 'Boat' };
    const lm = landmarkFor(state, 'docks');
    return lm;
  }
  if (obj.kind === 'steal') {
    const car = nearestStealableCar(state);
    return car ? { x: car.x, y: car.y, name: 'Car' } : null;
  }
  return null;
}

export function nearestStealableCar(state) {
  if (!state.traffic || !state.player) return null;
  const car = nearestTrafficCar(state.traffic, state.player.x, state.player.y, 400);
  return car || null;
}

export function exitCar(state) {
  const p = state.player;
  if (!p.inCar || !p.car) return;
  const car = p.car;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  p.angle = car.angle;
  p.inCar = false;
  p.car = null;
  car.speed = 0;
  if (state.traffic && state.traffic.cars) state.traffic.cars.push(car);
}

// The E key. Returns an events bitmask (EV.STEAL / EV.VAULT / EV.PICKUP).
// Boat boarding is checked BEFORE cars, so E on the docks boards a
// boat instead of stealing the nearest parked car.
export function tryInteract(state) {
  const p = state.player;
  let events = 0;

  // In a boat: step ashore onto the beach.
  if (p.inBoat) {
    exitBoat(state);
    return events;
  }

  // On foot near a moored boat: board it.
  const boat = nearestBoat(state, p.x, p.y);
  if (boat && !p.inCar) {
    boardBoat(state, boat);
    return events;
  }

  // In a car: get out.
  if (p.inCar) {
    exitCar(state);
    return events;
  }

  // Near a mission crate: grab it.
  const crate = (state.crates || []).find((c) => !c.taken && dist(p.x, p.y, c.x, c.y) < 46);
  if (crate) {
    crate.taken = true;
    if (state.mission) state.mission.collected += 1;
    return events | EV.PICKUP;
  }

  // At the bank with a vault objective: grab the vault, 4 stars.
  const obj = currentObjective(state);
  const bank = landmarkFor(state, 'bank');
  if (obj && obj.kind === 'interact' && bank && dist(p.x, p.y, bank.x, bank.y) < 110) {
    if (state.mission) state.mission.vaultDone = true;
    state.wanted = 4;
    state.crimeTimer = 0;
    state.money = (state.money || 0) + 500;
    return events | EV.VAULT;
  }

  // Near a traffic car: steal it. Wanted +1.
  const car = nearestStealableCar(state);
  if (car && dist(p.x, p.y, car.x, car.y) < 70) {
    const idx = state.traffic.cars.indexOf(car);
    if (idx >= 0) state.traffic.cars.splice(idx, 1);
    p.inCar = true;
    p.car = car;
    car.speed = 0;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    state.wanted = Math.min(5, (state.wanted || 0) + 1);
    state.crimeTimer = 0;
    return events | EV.STEAL;
  }

  return events;
}
