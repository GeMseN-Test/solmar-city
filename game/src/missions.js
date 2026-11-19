// missions.js — Solmar City story missions M1–M5 + the mission engine.
// Written from the v2 spec only. Objective kinds: steal, reach, collect,
// wanted, lose, defeat, board, interact, escape. The engine never
// auto-starts the next mission: main.js starts it on MISSION_COMPLETE.

import { spawnGang } from './combat.js';
import { nearestTrafficCar } from './traffic.js';
import { boardBoat, exitBoat, nearestBoat } from './boats.js';

export const EV_STEAL = 512;
export const EV_VAULT = 256;
export const EV_PICKUP = 4;
export const EV_MISSION = 16;
export const EV_MISSION_COMPLETE = 1024;

const REACH_RADIUS = 90;
const INTERACT_RADIUS = 70;
const CRATE_RADIUS = 48;
const VAULT_RADIUS = 110;

// ---------------------------------------------------------------------------
// M1–M5 — the original five story missions.
// ---------------------------------------------------------------------------

export const MISSIONS = [
  {
    id: 'm1-hot-wheels',
    title: 'Hot Wheels',
    briefing: 'Mara needs wheels. Steal a car, then bring it to Ray.',
    reward: 200,
    objectives: [
      { kind: 'steal', text: 'Steal a car (walk up to one, press E)' },
      { kind: 'reach', key: 'garage', text: "Drive to Ray's Garage" },
    ],
  },
  {
    id: 'm2-harbor-run',
    title: 'Harbor Run',
    briefing: 'Crates are waiting at the Docks. Grab them, run them to the Marina.',
    reward: 400,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Go to the Solmar Docks' },
      { kind: 'collect', count: 3, text: 'Grab 3 crates (press E next to one)' },
      { kind: 'reach', key: 'marina', text: 'Deliver the crates to the Marina' },
    ],
  },
  {
    id: 'm3-heat-wave',
    title: 'Heat Wave',
    briefing: 'The Vipers are talking. Shut three of them up, then shake the cops.',
    reward: 600,
    objectives: [
      { kind: 'reach', key: 'turf', text: "Go to the Vipers' Turf" },
      { kind: 'defeat', count: 3, text: 'Defeat 3 Vipers' },
      { kind: 'lose', text: 'Lose the cops (get back to 0 stars)' },
      { kind: 'reach', key: 'safehouse', text: "Get back to Mara's Safehouse" },
    ],
  },
  {
    id: 'm4-turf-war',
    title: 'Turf War',
    briefing: 'Take the Turf back. Four Vipers stand between you and Ray.',
    reward: 800,
    objectives: [
      { kind: 'reach', key: 'turf', text: "Go to the Vipers' Turf" },
      { kind: 'defeat', count: 4, text: 'Defeat 4 Vipers' },
      { kind: 'reach', key: 'garage', text: "Return to Ray's Garage" },
    ],
  },
  {
    id: 'm5-solmar-score',
    title: 'The Solmar Score',
    briefing: 'The big one. Hit the Grand Solmar Bank vault, then vanish.',
    reward: 3500,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Go to the Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault (press E at the bank)' },
      { kind: 'escape', key: 'safehouse', text: "Escape to Mara's Safehouse" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function landmark(state, key) {
  if (!state.city || !state.city.landmarks) return null;
  return state.city.landmarks[key] || null;
}

// First reach objective of a mission definition (gang spawn anchor).
function firstReachLandmark(state, def) {
  for (const obj of def.objectives) {
    if (obj.kind === 'reach' && obj.key) {
      const lm = landmark(state, obj.key);
      if (lm) return lm;
    }
  }
  return null;
}

// Spawn the gang for a mission's defeat objective, around the first
// reach landmark. Shared by startMission and by missions2 setupV2Mission.
export function spawnMissionGang(state, def) {
  const defeat = def.objectives.find((o) => o.kind === 'defeat');
  if (!defeat) return;
  const lm = firstReachLandmark(state, def);
  if (!lm) return;
  spawnGang(state, lm.x, lm.y, defeat.count || 1);
}

// Lay out crates for a collect objective around the first reach landmark.
function spawnCrates(state, def) {
  const collect = def.objectives.find((o) => o.kind === 'collect');
  if (!collect) return;
  const lm = firstReachLandmark(state, def);
  if (!lm) return;
  const spots = [
    [0, -70], [64, -20], [-64, -20], [0, 70],
    [64, 60], [-64, 60], [110, 0], [-110, 0],
  ];
  const n = collect.count || 3;
  state.crates = [];
  for (let i = 0; i < n; i++) {
    const s = spots[i % spots.length];
    state.crates.push({ x: lm.x + s[0], y: lm.y + s[1], taken: false });
  }
}

// ---------------------------------------------------------------------------
// Mission lifecycle
// ---------------------------------------------------------------------------

export function startMission(state, index) {
  const def = MISSIONS[index];
  if (!def) return false;
  state.missionIndex = index;
  state.mission = {
    index,
    objectiveIndex: 0,
    killsAtStart: state.kills || 0,
    vaultGrabbed: false,
    interacted: false,
    done: false,
  };
  state.crates = [];
  spawnCrates(state, def);
  spawnMissionGang(state, def);
  return true;
}

export function currentObjective(state) {
  if (!state.mission || state.mission.done) return null;
  const def = MISSIONS[state.mission.index];
  if (!def) return null;
  return def.objectives[state.mission.objectiveIndex] || null;
}

export function currentMissionDef(state) {
  if (!state.mission) return null;
  return MISSIONS[state.mission.index] || null;
}

// Where the player should go next: a landmark, a boat, or null.
export function missionMarker(state) {
  const obj = currentObjective(state);
  if (!obj) return null;
  if (obj.kind === 'reach' || obj.kind === 'escape' || obj.kind === 'interact') {
    return landmark(state, obj.key);
  }
  if (obj.kind === 'board') {
    const boat = nearestBoat(state, state.player.x, state.player.y);
    if (boat) return { x: boat.x, y: boat.y, name: 'Boat' };
    if (state.boats && state.boats.length) {
      const b = state.boats[0];
      return { x: b.x, y: b.y, name: 'Boat' };
    }
    return null;
  }
  if (obj.kind === 'defeat') {
    const lm = firstReachLandmark(state, currentMissionDef(state));
    return lm;
  }
  return null;
}

function objectiveDone(state, obj) {
  const p = state.player;
  switch (obj.kind) {
    case 'steal':
      return !!p.inCar;
    case 'reach':
    case 'escape': {
      const lm = landmark(state, obj.key);
      if (!lm) return false;
      const r = obj.radius || REACH_RADIUS;
      return dist(p.x, p.y, lm.x, lm.y) < r;
    }
    case 'collect': {
      const taken = (state.crates || []).filter((c) => c.taken).length;
      return taken >= (obj.count || 1);
    }
    case 'defeat': {
      const kills = (state.kills || 0) - (state.mission.killsAtStart || 0);
      return kills >= (obj.count || 1);
    }
    case 'board':
      return !!p.inBoat;
    case 'interact':
      return !!(state.mission && (state.mission.vaultGrabbed || state.mission.interacted));
    case 'wanted':
      return (state.wanted || 0) >= (obj.level || 1);
    case 'lose':
      return (state.wanted || 0) === 0;
    default:
      return false;
  }
}

// Advance objectives, pay the reward on completion. Returns an event
// bitmask: EV_MISSION (16) when an objective completes,
// EV_MISSION_COMPLETE (1024) when the whole mission completes.
// NEVER starts the next mission — main.js does that on MISSION_COMPLETE.
export function updateMission(state) {
  if (!state.mission || state.mission.done) return 0;
  const def = MISSIONS[state.mission.index];
  if (!def) return 0;
  const obj = def.objectives[state.mission.objectiveIndex];
  if (!obj) return 0;
  if (!objectiveDone(state, obj)) return 0;

  state.mission.objectiveIndex += 1;
  if (state.mission.objectiveIndex < def.objectives.length) {
    return EV_MISSION;
  }

  // Mission complete.
  state.money = (state.money || 0) + def.reward;
  state.missionsDone = (state.missionsDone || 0) + 1;
  const isLast = state.mission.index >= MISSIONS.length - 1;
  state.mission.done = true;
  state.banner = {
    text: def.title + ' — $' + def.reward.toLocaleString('en-US'),
    sub: isLast ? 'STORY COMPLETE — Solmar is yours, Mara.' : 'Mission complete',
    timer: 3.2,
    story: isLast,
  };
  if (isLast) state.storyComplete = true;
  state.mission = null;
  state.crates = [];
  return EV_MISSION_COMPLETE;
}

// ---------------------------------------------------------------------------
// Interaction (E key)
// Order matters: exit vehicle first, then crates, then the vault, then
// boats, then cars. A crate parked next to a car must stay reachable.
// ---------------------------------------------------------------------------

export function tryInteract(state) {
  const p = state.player;

  // On a boat: step ashore.
  if (p.inBoat) {
    exitBoat(state);
    return 0;
  }
  // In a car: get out, the car stays parked where it is.
  if (p.inCar) {
    exitCar(state);
    return 0;
  }

  // Grab a mission crate.
  const obj = currentObjective(state);
  if (obj && obj.kind === 'collect' && state.crates) {
    let best = null;
    let bestD = CRATE_RADIUS;
    for (const c of state.crates) {
      if (c.taken) continue;
      const d = dist(p.x, p.y, c.x, c.y);
      if (d < bestD) {
        best = c;
        bestD = d;
      }
    }
    if (best) {
      best.taken = true;
      return EV_PICKUP;
    }
  }

  // Grab the bank vault (4 stars, NO instant money — the payout
  // only lands when the mission completes).
  if (obj && obj.kind === 'interact' && obj.key === 'bank') {
    const bank = landmark(state, 'bank');
    if (bank && dist(p.x, p.y, bank.x, bank.y) < VAULT_RADIUS) {
      if (state.mission) state.mission.vaultGrabbed = true;
      state.wanted = 4;
      return EV_VAULT;
    }
  }

  // Board a nearby boat.
  const boat = nearestBoat(state, p.x, p.y);
  if (boat) {
    boardBoat(state, boat);
    return 0;
  }

  // Climb back into a car we already stole (free, it is ours now).
  if (state.parkedCars) {
    let best = null;
    let bestD = INTERACT_RADIUS;
    for (const car of state.parkedCars) {
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < bestD) {
        best = car;
        bestD = d;
      }
    }
    if (best) {
      const i = state.parkedCars.indexOf(best);
      state.parkedCars.splice(i, 1);
      enterCar(state, best);
      return 0;
    }
  }

  // Steal a traffic car (wanted +1).
  const car = state.traffic
    ? nearestTrafficCar(state.traffic, p.x, p.y, INTERACT_RADIUS)
    : null;
  if (car) {
    const i = state.traffic.cars.indexOf(car);
    if (i >= 0) state.traffic.cars.splice(i, 1);
    enterCar(state, car);
    state.wanted = Math.min(5, (state.wanted || 0) + 1);
    return EV_STEAL;
  }

  return 0;
}

function enterCar(state, car) {
  const p = state.player;
  p.inCar = true;
  p.car = car;
  car.speed = 0;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.aimAngle = car.angle;
}

export function exitCar(state) {
  const p = state.player;
  const car = p.car;
  if (!car) {
    p.inCar = false;
    return;
  }
  // Step out to the left side of the car.
  const nx = -Math.sin(car.angle);
  const ny = Math.cos(car.angle);
  p.x = car.x + nx * 34;
  p.y = car.y + ny * 34;
  p.angle = car.angle;
  p.aimAngle = car.angle;
  p.inCar = false;
  p.car = null;
  car.speed = 0;
  if (!state.parkedCars) state.parkedCars = [];
  state.parkedCars.push(car);
}

// Nearest car the player could steal or re-enter, for the HUD prompt.
export function nearestStealableCar(state) {
  const p = state.player;
  let best = null;
  let bestD = 85;
  if (state.parkedCars) {
    for (const car of state.parkedCars) {
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < bestD) {
        best = { car, kind: 'parked' };
        bestD = d;
      }
    }
  }
  if (state.traffic) {
    const car = nearestTrafficCar(state.traffic, p.x, p.y, 85);
    if (car) {
      const d = dist(p.x, p.y, car.x, car.y);
      if (!best || d < bestD) best = { car, kind: 'traffic' };
    }
  }
  return best;
}
