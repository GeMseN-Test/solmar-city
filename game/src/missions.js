// Solmar City — story missions M1–M5 (v1) + mission engine.
//
// Every mission is a list of small steps ("objectives"). Each step uses
// one of the proven kinds: steal, reach, collect, wanted, lose, defeat,
// board, interact, escape. The engine only watches the world and ticks
// steps off as they happen — it never teleports or cheats for the player.
//
// Money: M1 $200, M2 $400, M3 $600, M4 $800, M5 $3,500.
// M1..M5 pay $5,500 in total; with the $50 starting cash the story so
// far is worth $5,550 before the v2 missions begin.

import * as Boats from './boats.js';
import * as Traffic from './traffic.js';
import * as Combat from './combat.js';

// Spawn a gang for a "defeat" step. spawnGang is a module function in
// combat.js — NOT a method on the combat object (probed live: the object
// returned by createCombat() is just { bullets, enemies }).
function spawnGangAt(state, x, y, count) {
  if (typeof Combat.spawnGang === 'function') {
    Combat.spawnGang(state, x, y, count);
    return true;
  }
  if (state.combat && typeof state.combat.spawnGang === 'function') {
    state.combat.spawnGang(state, x, y, count);
    return true;
  }
  return false;
}

// How close the player must be to a landmark for a "reach" step.
export const REACH_RADIUS = 90;
// How close the player must be to grab a crate / use the vault.
export const INTERACT_RADIUS = 60;
// How close the player must be to a car to steal or enter it.
export const STEAL_RADIUS = 80;

// ---------------------------------------------------------------------------
// M1–M5 — the original five story missions.
// ---------------------------------------------------------------------------

export const MISSIONS = [
  {
    id: 'M1',
    title: 'Hot Wheels',
    briefing:
      "Ray needs wheels. Steal any car off the street, then bring it to Ray's Garage.",
    reward: 200,
    objectives: [
      { kind: 'steal', text: 'Steal a car' },
      { kind: 'reach', key: 'garage', text: "Reach Ray's Garage" },
    ],
  },
  {
    id: 'M2',
    title: 'Harbor Run',
    briefing:
      'Crates went missing at the Docks. Head down there, grab 3 crates, then drop them at the Marina.',
    reward: 400,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach Solmar Docks' },
      { kind: 'collect', count: 3, text: 'Grab 3 crates at the Docks' },
      { kind: 'reach', key: 'marina', text: 'Reach Solmar Marina' },
    ],
  },
  {
    id: 'M3',
    title: 'Heat Wave',
    briefing:
      'The cops need to learn your name. Raise your wanted level to 2 stars, then shake them off completely.',
    reward: 600,
    objectives: [
      { kind: 'wanted', level: 2, text: 'Raise wanted level to 2 stars' },
      { kind: 'lose', text: 'Lose the cops (0 stars)' },
    ],
  },
  {
    id: 'M4',
    title: 'Turf War',
    briefing:
      "The Vipers are pushing into your turf. Go to Vipers' Turf, put down 4 of them, then get back to the Safehouse.",
    reward: 800,
    objectives: [
      { kind: 'reach', key: 'turf', text: "Reach Vipers' Turf" },
      { kind: 'defeat', count: 4, text: 'Defeat 4 Vipers' },
      { kind: 'reach', key: 'safehouse', text: "Reach Mara's Safehouse" },
    ],
  },
  {
    id: 'M5',
    title: 'The Solmar Score',
    briefing:
      'The big one. Get to the Grand Solmar Bank, grab the vault, then escape to the Safehouse with the cops on your tail.',
    reward: 3500,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Reach Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault (4 stars!)' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to the Safehouse' },
    ],
  },
];

// Add a mission definition if it is not already registered.
// Idempotent — calling it twice with the same id does nothing.
export function registerMission(def) {
  if (!def || !def.id) return false;
  if (MISSIONS.some((m) => m.id === def.id)) return false;
  MISSIONS.push(def);
  return true;
}

// ---------------------------------------------------------------------------
// Small helpers.
// ---------------------------------------------------------------------------

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

// Landmark lookup: state.city.landmarks[key] -> { x, y, name }.
export function landmark(state, key) {
  if (!state || !state.city || !state.city.landmarks) return null;
  const lm = state.city.landmarks[key];
  if (!lm) return null;
  return {
    x: lm.x,
    y: lm.y,
    name: lm.name || lm.label || key,
    key,
  };
}

// First "reach" step of a mission — where its gang spawns.
function firstReachLandmark(def) {
  if (!def || !Array.isArray(def.objectives)) return null;
  const step = def.objectives.find((o) => o.kind === 'reach');
  return step ? step.key : null;
}

// ---------------------------------------------------------------------------
// Mission lifecycle.
// ---------------------------------------------------------------------------

// Start mission `index` (0-based into MISSIONS). Resets progress, spawns
// the gang for a "defeat" step around the first reach landmark, and drops
// crates for a "collect" step around that same landmark.
export function startMission(state, index) {
  if (!state || index < 0 || index >= MISSIONS.length) return null;
  const def = MISSIONS[index];
  state.missionIndex = index;
  state.mission = {
    def,
    objectiveIndex: 0,
    killsAtStart: state.kills || 0,
    cratesCollected: 0,
    stoleCar: false,
    startedAt: state.playTime || 0,
  };

  // Gang for a defeat step: spawn around the first reach landmark.
  const defeat = def.objectives.find((o) => o.kind === 'defeat');
  if (defeat) {
    const key = firstReachLandmark(def);
    const lm = key ? landmark(state, key) : null;
    const cx = lm ? lm.x : state.player.x;
    const cy = lm ? lm.y : state.player.y;
    spawnGangAt(state, cx, cy, defeat.count || 3);
  }

  // Crates for a collect step: drop them near the first reach landmark.
  const collect = def.objectives.find((o) => o.kind === 'collect');
  if (collect) {
    const key = firstReachLandmark(def);
    const lm = key ? landmark(state, key) : null;
    const cx = lm ? lm.x : state.player.x;
    const cy = lm ? lm.y : state.player.y;
    const n = collect.count || 3;
    state.crates = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      state.crates.push({
        x: cx + Math.cos(a) * 70,
        y: cy + Math.sin(a) * 70,
        taken: false,
      });
    }
  }

  return state.mission;
}

// The objective the player is working on right now, or null.
export function currentObjective(state) {
  if (!state || !state.mission) return null;
  const def = state.mission.def;
  if (state.mission.objectiveIndex >= def.objectives.length) return null;
  return def.objectives[state.mission.objectiveIndex];
}

// Where the current objective points on the map (landmark or crate),
// or null when the step has no fixed place.
export function missionMarker(state) {
  const obj = currentObjective(state);
  if (!obj) return null;
  if (obj.kind === 'reach' || obj.kind === 'escape' || obj.kind === 'interact') {
    return landmark(state, obj.key);
  }
  if (obj.kind === 'board') {
    // Point at the docks / marina edge — the boats are in the sea below.
    return landmark(state, 'docks');
  }
  if (obj.kind === 'defeat') {
    const key = firstReachLandmark(state.mission.def);
    return key ? landmark(state, key) : null;
  }
  if (obj.kind === 'collect') {
    const crate = (state.crates || []).find((c) => !c.taken);
    if (crate) return { x: crate.x, y: crate.y, name: 'Crate', key: 'crate' };
    const key = firstReachLandmark(state.mission.def);
    return key ? landmark(state, key) : null;
  }
  return null;
}

// Progress text for the HUD, e.g. "Defeat 4 Vipers (2/4)".
export function objectiveProgress(state) {
  const obj = currentObjective(state);
  if (!obj || !state.mission) return '';
  if (obj.kind === 'defeat') {
    const done = Math.min(
      (state.kills || 0) - (state.mission.killsAtStart || 0),
      obj.count || 0,
    );
    return ` (${Math.max(0, done)}/${obj.count || 0})`;
  }
  if (obj.kind === 'collect') {
    return ` (${state.mission.cratesCollected || 0}/${obj.count || 0})`;
  }
  return '';
}

// Finish the current objective. Returns the event bits for the caller.
// When the last objective is done the mission pays out.
export function completeObjective(state) {
  if (!state || !state.mission) return 0;
  const mission = state.mission;
  const def = mission.def;
  mission.objectiveIndex += 1;
  // 16 = MISSION (objective advanced / mission finished — see world.js).
  let events = 16;
  if (mission.objectiveIndex >= def.objectives.length) {
    state.money = (state.money || 0) + (def.reward || 0);
    state.missionsDone = (state.missionsDone || 0) + 1;
    state.mission = null;
    state.missionIndex = (state.missionIndex || 0) + 1;
    if (state.missionIndex >= MISSIONS.length) {
      state.storyComplete = true;
    }
    // 1024 = MISSION_COMPLETE.
    events |= 1024;
  }
  return events;
}

// Check the current objective against the world. Called every step.
// Returns event bits (16 on advance, 1024 on mission complete).
export function updateMission(state) {
  if (!state || !state.mission) return 0;
  const obj = currentObjective(state);
  if (!obj) return 0;
  const p = state.player;
  if (!p) return 0;

  switch (obj.kind) {
    case 'reach':
    case 'escape': {
      const lm = landmark(state, obj.key);
      if (lm && dist(p.x, p.y, lm.x, lm.y) < REACH_RADIUS) {
        return completeObjective(state);
      }
      return 0;
    }
    case 'board': {
      if (p.inBoat) return completeObjective(state);
      return 0;
    }
    case 'steal': {
      if (state.mission.stoleCar) return completeObjective(state);
      return 0;
    }
    case 'collect': {
      if ((state.mission.cratesCollected || 0) >= (obj.count || 0)) {
        return completeObjective(state);
      }
      return 0;
    }
    case 'wanted': {
      if ((state.wanted || 0) >= (obj.level || 1)) {
        return completeObjective(state);
      }
      return 0;
    }
    case 'lose': {
      if ((state.wanted || 0) <= 0) return completeObjective(state);
      return 0;
    }
    case 'defeat': {
      const done = (state.kills || 0) - (state.mission.killsAtStart || 0);
      if (done >= (obj.count || 0)) return completeObjective(state);
      return 0;
    }
    case 'interact': {
      // Only finished by tryInteract (the vault grab), never by proximity.
      return 0;
    }
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Cars: stealing, entering, exiting.
// ---------------------------------------------------------------------------

// Nearest car the player could steal / enter, within STEAL_RADIUS.
// Returns { car, parked } or null.
export function nearestStealableCar(state) {
  if (!state || !state.player) return null;
  const p = state.player;
  let best = null;
  let bestD = STEAL_RADIUS;

  const traffic = state.traffic;
  if (traffic && Array.isArray(traffic.cars)) {
    for (const car of traffic.cars) {
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = { car, parked: false };
      }
    }
  }
  const parked = state.parkedCars || [];
  for (const car of parked) {
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = { car, parked: true };
    }
  }
  return best;
}

// Get out of the car. The car stays behind as a parked car the player
// can climb back into later (for free — it is already theirs).
export function exitCar(state) {
  const p = state.player;
  if (!p || !p.inCar || !p.car) return false;
  const car = p.car;
  car.speed = 0;
  car.vx = 0;
  car.vy = 0;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  p.angle = car.angle;
  if (!Array.isArray(state.parkedCars)) state.parkedCars = [];
  state.parkedCars.push(car);
  p.inCar = false;
  p.car = null;
  return true;
}

// ---------------------------------------------------------------------------
// Interact (E key). Priority order matters:
//   1. get out of a car / step off a boat
//   2. grab a crate (before stealing — a crate can sit next to a car)
//   3. grab the vault (only when the mission asks for it)
//   4. board a boat
//   5. enter a parked car (free) / steal a traffic car (wanted +1)
// Returns event bits.
// ---------------------------------------------------------------------------

export function tryInteract(state) {
  if (!state || !state.player) return 0;
  const p = state.player;
  let events = 0;

  // 1. Already in a vehicle — get out.
  if (p.inCar) {
    exitCar(state);
    return events;
  }
  if (p.inBoat) {
    if (typeof Boats.exitBoat === 'function') Boats.exitBoat(state);
    return events;
  }

  // 2. Crate right next to the player?
  const crates = state.crates || [];
  for (const crate of crates) {
    if (!crate.taken && dist(p.x, p.y, crate.x, crate.y) < INTERACT_RADIUS) {
      crate.taken = true;
      if (state.mission) {
        state.mission.cratesCollected = (state.mission.cratesCollected || 0) + 1;
      }
      // 4 = PICKUP.
      events |= 4;
      return events;
    }
  }

  // 3. The vault — only when the current step asks for it.
  const obj = currentObjective(state);
  if (obj && obj.kind === 'interact' && obj.key === 'bank') {
    const bank = landmark(state, 'bank');
    if (bank && dist(p.x, p.y, bank.x, bank.y) < 130) {
      state.wanted = 4;
      state.wantedTimer = 0;
      // 256 = VAULT.
      events |= 256;
      events |= completeObjective(state);
      return events;
    }
  }

  // 4. A boat close enough to board?
  if (typeof Boats.nearestBoat === 'function') {
    const boat = Boats.nearestBoat(state, p.x, p.y);
    if (boat && typeof Boats.boardBoat === 'function') {
      Boats.boardBoat(state, boat);
      return events;
    }
  }

  // 5. A car close enough to enter or steal?
  const found = nearestStealableCar(state);
  if (found) {
    const car = found.car;
    if (!found.parked) {
      // Stealing a stranger's car: wanted +1.
      const traffic = state.traffic;
      if (traffic && Array.isArray(traffic.cars)) {
        const ix = traffic.cars.indexOf(car);
        if (ix >= 0) traffic.cars.splice(ix, 1);
      }
      state.wanted = Math.min(5, (state.wanted || 0) + 1);
      state.wantedTimer = 0;
      if (state.mission) state.mission.stoleCar = true;
      // 512 = STEAL.
      events |= 512;
    } else {
      const ix = (state.parkedCars || []).indexOf(car);
      if (ix >= 0) state.parkedCars.splice(ix, 1);
    }
    car.speed = 0;
    car.vx = 0;
    car.vy = 0;
    p.inCar = true;
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    return events;
  }

  return events;
}

// One-line prompt for the bottom of the screen ("E — Board boat").
export function interactPrompt(state) {
  if (!state || !state.player) return '';
  const p = state.player;
  if (p.inCar) return 'E — Get out of the car';
  if (p.inBoat) return 'E — Step ashore';

  const crates = state.crates || [];
  for (const crate of crates) {
    if (!crate.taken && dist(p.x, p.y, crate.x, crate.y) < INTERACT_RADIUS) {
      return 'E — Grab the crate';
    }
  }
  const obj = currentObjective(state);
  if (obj && obj.kind === 'interact' && obj.key === 'bank') {
    const bank = landmark(state, 'bank');
    if (bank && dist(p.x, p.y, bank.x, bank.y) < 130) {
      return 'E — Grab the vault';
    }
  }
  if (typeof Boats.nearestBoat === 'function') {
    if (Boats.nearestBoat(state, p.x, p.y)) return 'E — Board the boat';
  }
  const found = nearestStealableCar(state);
  if (found) return found.parked ? 'E — Get in the car' : 'E — Steal the car';
  return '';
}
