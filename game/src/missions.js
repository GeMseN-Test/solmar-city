// Solmar City — story missions. The mission list is one array,
// MISSIONS, that starts with the five v1 missions; missions2/3/4
// append M6–M12 to the same array (register calls in world.js).
//
// A mission is { id, title, briefing, reward, objectives }. An
// objective is { kind, text, key?, count?, level? } with kind one of:
// steal, reach, collect, wanted, lose, defeat, board, interact,
// escape. `key` names a landmark for reach / interact objectives.
//
// Runtime state lives in state.mission:
//   { index, objectiveIndex, killsAtStart, collected, interacted,
//     hadWanted }
// updateMission advances objectives and pays out on completion; it
// returns an events bitmask (MISSION_COMPLETE when a mission pays).
// Defeat objectives count kills since the mission started, and the
// gang for that mission spawns at the mission's first reach landmark
// the moment the mission starts.

import { WANTED } from './config.js';
import { dist } from './util.js';
import { spawnGang } from './combat.js';
import { boardBoat, exitBoat, nearestBoat } from './boats.js';
import { nearestTrafficCar } from './traffic.js';
import { LANDMARKS } from './city.js';

export const MISSIONS = [
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    briefing: "Mara needs wheels. Steal any car and bring it to Ray's Garage.",
    reward: 200,
    objectives: [
      { kind: 'steal', text: 'Steal a car' },
      { kind: 'reach', key: 'garage', text: "Bring it to Ray's Garage" },
    ],
  },
  {
    id: 'harbor-run',
    title: 'Harbor Run',
    briefing: 'Crates are waiting at Solmar Docks. Grab three and run them to the garage.',
    reward: 400,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach Solmar Docks' },
      { kind: 'collect', count: 3, text: 'Grab 3 crates' },
      { kind: 'reach', key: 'garage', text: "Deliver to Ray's Garage" },
    ],
  },
  {
    id: 'heat-wave',
    title: 'Heat Wave',
    briefing: 'The Vipers are pushing into Solmar. Go to their turf and send three of them packing.',
    reward: 600,
    objectives: [
      { kind: 'reach', key: 'turf', text: "Reach Vipers' Turf" },
      { kind: 'defeat', count: 3, text: 'Take down 3 Vipers' },
      { kind: 'reach', key: 'safehouse', text: 'Get back to the Safehouse' },
    ],
  },
  {
    id: 'turf-war',
    title: 'Turf War',
    briefing: 'Five Vipers hold the turf. Clear them out, then lay low at the safehouse.',
    reward: 800,
    objectives: [
      { kind: 'reach', key: 'turf', text: "Reach Vipers' Turf" },
      { kind: 'defeat', count: 5, text: 'Take down 5 Vipers' },
      { kind: 'reach', key: 'safehouse', text: 'Lay low at the Safehouse' },
    ],
  },
  {
    id: 'solmar-score',
    title: 'The Solmar Score',
    briefing: 'The Grand Solmar Bank vault is the big one. Grab it, then vanish to the safehouse.',
    reward: 2500,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Reach Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to the Safehouse' },
    ],
  },
];

// Where each defeat mission's gang waits: mission id -> landmark
// key + head count. Falls back to the mission's first reach
// landmark and the defeat objective's count.
const GANG_SPAWNS = {
  'heat-wave': { key: 'turf', count: 3 },
  'turf-war': { key: 'turf', count: 5 },
  'on-air': { key: 'radio', count: 3 },
  'grand-finale': { key: 'bank', count: 6 },
  'night-shift': { key: 'docks', count: 4 },
  'king-of-solmar': { key: 'turf', count: 6 },
  'midnight-run': { key: 'docks', count: 4 },
  'solmar-crown': { key: 'bank', count: 6 },
};

// Append more missions to the shared list. Idempotent: calling it
// twice with the same defs adds nothing the second time.
export function registerMissions(defs) {
  for (const def of defs) {
    if (!MISSIONS.some((m) => m.id === def.id)) MISSIONS.push(def);
  }
}

// Start mission `index` for the player. Spawns the gang for defeat
// missions, drops crates for collect missions, resets the per-run
// counters. Safe to call again to restart the same mission.
export function startMission(state, index) {
  const def = MISSIONS[index];
  if (!def) return false;
  state.missionIndex = index;
  state.mission = {
    index,
    objectiveIndex: 0,
    killsAtStart: state.kills,
    collected: 0,
    interacted: false,
    hadWanted: false,
  };
  const defeat = def.objectives.find((o) => o.kind === 'defeat');
  if (defeat) spawnMissionGang(state, def, defeat);
  const collect = def.objectives.find((o) => o.kind === 'collect');
  if (collect) spawnCrates(state, def, collect);
  return true;
}

// Spawn a mission's gang at its first reach landmark.
export function spawnMissionGang(state, def, defeatObj) {
  const firstReach = def.objectives.find((o) => o.kind === 'reach');
  const table = GANG_SPAWNS[def.id];
  const key = (table && table.key) || (firstReach && firstReach.key);
  const spot = (key && LANDMARKS[key]) || { x: 1420, y: 1190 };
  const count = (table && table.count) || defeatObj.count || 3;
  spawnGang(state, spot.x, spot.y, count);
}

// Drop crates near the mission's first reach landmark for a collect
// objective. Crates live in state.crates until grabbed.
function spawnCrates(state, def, collectObj) {
  const firstReach = def.objectives.find((o) => o.kind === 'reach');
  const spot = (firstReach && LANDMARKS[firstReach.key]) || { x: 360, y: 130 };
  state.crates = [];
  const n = collectObj.count || 3;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.5;
    state.crates.push({
      x: spot.x + Math.cos(a) * 70,
      y: spot.y + Math.sin(a) * 70,
      taken: false,
    });
  }
}

// The objective the player is working on right now, or null.
export function currentObjective(state) {
  if (!state.mission) return null;
  const def = MISSIONS[state.mission.index];
  if (!def) return null;
  return def.objectives[state.mission.objectiveIndex] || null;
}

// Where the HUD arrow should point for the current objective, or
// null when the objective has no place (steal, defeat, collect).
export function missionMarker(state) {
  const obj = currentObjective(state);
  if (!obj) return null;
  if (obj.kind === 'reach' || obj.kind === 'interact') {
    return LANDMARKS[obj.key] || null;
  }
  if (obj.kind === 'escape') return LANDMARKS.safehouse;
  if (obj.kind === 'board') {
    // nearestBoat takes (state, x, y) — pass the player's position
    // explicitly; a one-arg call would leave x/y undefined.
    const boat = nearestBoat(state, state.player.x, state.player.y);
    return boat ? { x: boat.x, y: boat.y, name: 'Boat' } : null;
  }
  return null;
}

// Advance the current objective when its condition is met. Returns
// an events bitmask: 0 normally, 1024 (MISSION_COMPLETE) with a
// payout when a mission finishes, plus 16 (MISSION) on each step.
export function updateMission(state) {
  if (!state.mission) return 0;
  const def = MISSIONS[state.mission.index];
  if (!def) return 0;
  const obj = def.objectives[state.mission.objectiveIndex];
  if (!obj) return finishMission(state, def);
  const p = state.player;
  let done = false;

  switch (obj.kind) {
    case 'steal':
      done = !!p.inCar;
      break;
    case 'reach': {
      const spot = LANDMARKS[obj.key];
      if (spot && dist(p.x, p.y, spot.x, spot.y) < 90) done = true;
      break;
    }
    case 'collect':
      done = state.mission.collected >= (obj.count || 1);
      break;
    case 'wanted':
      if (state.wanted >= (obj.level || 1)) {
        state.mission.hadWanted = true;
        done = true;
      }
      break;
    case 'lose':
      if (state.wanted > 0) state.mission.hadWanted = true;
      done = state.mission.hadWanted && state.wanted === 0;
      break;
    case 'defeat':
      done = state.kills - state.mission.killsAtStart >= (obj.count || 1);
      break;
    case 'board':
      done = !!p.inBoat;
      break;
    case 'interact':
      done = !!state.mission.interacted;
      break;
    case 'escape': {
      const home = LANDMARKS.safehouse;
      if (dist(p.x, p.y, home.x, home.y) < 100) done = true;
      break;
    }
    default:
      done = false;
  }

  if (!done) return 0;
  state.mission.objectiveIndex++;
  if (state.mission.objectiveIndex >= def.objectives.length) {
    return finishMission(state, def);
  }
  return 16;
}

// Pay out, count the mission done, and clear the active mission.
// Sets storyComplete when the last mission in the list pays.
function finishMission(state, def) {
  state.money += def.reward;
  state.missionsDone++;
  state.missionIndex = state.mission.index + 1;
  state.mission = null;
  if (state.missionIndex >= MISSIONS.length) {
    state.storyComplete = true;
  }
  return 1024;
}

// Nearest car Mara can steal: a parked car first, then a traffic
// car, both within 80px. Returns the car or null.
export function nearestStealableCar(state) {
  const p = state.player;
  let best = null;
  let bestD = 80;
  for (const car of state.parkedCars || []) {
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (state.traffic) {
    const car = nearestTrafficCar(state.traffic, p.x, p.y, bestD);
    if (car) best = car;
  }
  return best;
}

// Step out of the car. The car stays where it is, parked, ready to
// be stolen again.
export function exitCar(state) {
  const p = state.player;
  if (!p.inCar || !p.car) return false;
  const car = p.car;
  car.x = p.x;
  car.y = p.y;
  car.angle = p.angle;
  car.speed = 0;
  car.kind = 'parked';
  state.parkedCars.push(car);
  p.inCar = false;
  p.car = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
  return true;
}

// The E key. Order matters: step ashore from a boat, step out of a
// car, board a nearby boat, steal a nearby car, grab a crate, crack
// the bank vault. Returns an events bitmask.
export function tryInteract(state) {
  const p = state.player;
  let events = 0;

  if (p.inBoat) {
    exitBoat(state);
    return events;
  }
  if (p.inCar) {
    exitCar(state);
    return events;
  }

  const boat = nearestBoat(state, p.x, p.y);
  if (boat) {
    boardBoat(state, boat);
    return events;
  }

  const car = nearestStealableCar(state);
  if (car) {
    if (car.kind === 'parked') {
      const i = state.parkedCars.indexOf(car);
      if (i >= 0) state.parkedCars.splice(i, 1);
    } else if (state.traffic) {
      const i = state.traffic.cars.indexOf(car);
      if (i >= 0) state.traffic.cars.splice(i, 1);
    }
    p.inCar = true;
    p.car = {
      kind: 'car',
      x: car.x,
      y: car.y,
      angle: p.angle,
      speed: 0,
      model: car.model,
      color: car.color,
    };
    p.x = car.x;
    p.y = car.y;
    state.wanted = Math.min(WANTED.max, state.wanted + WANTED.stealCar);
    return events | 512;
  }

  // Grab a mission crate.
  if (state.mission && state.crates) {
    for (const crate of state.crates) {
      if (crate.taken) continue;
      if (dist(p.x, p.y, crate.x, crate.y) < 60) {
        crate.taken = true;
        state.mission.collected++;
        return events | 4;
      }
    }
  }

  // Crack the bank vault (the interact objective). Four stars, and
  // the mission step completes via state.mission.interacted.
  const obj = currentObjective(state);
  if (obj && obj.kind === 'interact' && obj.key === 'bank') {
    const bank = LANDMARKS.bank;
    if (dist(p.x, p.y, bank.x, bank.y) < 90) {
      state.mission.interacted = true;
      state.wanted = Math.max(state.wanted, 4);
      return events | 256;
    }
  }

  return events;
}
