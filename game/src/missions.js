// Solmar City — story missions M1–M5.
// Written from v2-spec.md only. A mission is a list of small objectives;
// the player finishes them in order, gets paid, and the next mission
// unlocks. Kinds: steal / reach / collect / wanted / lose / defeat /
// board / interact / escape. Defeat counts kills since the mission
// started; dead enemies are removed and counted by world.step, never here.
import { spawnGang } from './combat.js';
import { nearestBoat, boardBoat, exitBoat } from './boats.js';

export const MISSIONS = [
  {
    id: 'M1',
    title: 'Hot Wheels',
    briefing: 'Steal a car off the street, then bring it to Ray\u2019s Garage.',
    reward: 200,
    objectives: [
      { kind: 'steal', text: 'Steal a car' },
      { kind: 'reach', key: 'garage', text: 'Drive to Ray\u2019s Garage' },
    ],
  },
  {
    id: 'M2',
    title: 'Harbor Run',
    briefing: 'Pick up the three crates waiting at Solmar Docks, then drop them at the Marina.',
    reward: 400,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach Solmar Docks' },
      { kind: 'collect', count: 3, text: 'Grab 3 crates at the Docks' },
      { kind: 'reach', key: 'marina', text: 'Deliver to Solmar Marina' },
    ],
  },
  {
    id: 'M3',
    title: 'Heat Wave',
    briefing: 'Stir up trouble until the SCPD is on you, then shake them off and lay low at the Safehouse.',
    reward: 600,
    objectives: [
      { kind: 'reach', key: 'turf', text: 'Reach Vipers\u2019 Turf' },
      { kind: 'wanted', level: 2, text: 'Get 2 stars of heat' },
      { kind: 'lose', text: 'Lose the cops' },
      { kind: 'reach', key: 'safehouse', text: 'Lay low at Mara\u2019s Safehouse' },
    ],
  },
  {
    id: 'M4',
    title: 'Turf War',
    briefing: 'The Vipers own the east side. Take the turf back, then report to the Safehouse.',
    reward: 800,
    objectives: [
      { kind: 'reach', key: 'turf', text: 'Reach Vipers\u2019 Turf' },
      { kind: 'defeat', count: 4, text: 'Defeat 4 Vipers' },
      { kind: 'reach', key: 'safehouse', text: 'Return to Mara\u2019s Safehouse' },
    ],
  },
  {
    id: 'M5',
    title: 'The Solmar Score',
    briefing: 'Hit the Grand Solmar Bank vault, then vanish before the SCPD locks the city down.',
    reward: 2500,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Reach Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault (4 stars)' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to Mara\u2019s Safehouse' },
    ],
  },
];

// Distance (px) that counts as "arrived" at a landmark.
const ARRIVE_DIST = 110;
// Distance (px) that counts as "near" for an interact (vault, crate).
const INTERACT_DIST = 140;

function landmark(state, key) {
  const lm = state.city && state.city.landmarks ? state.city.landmarks[key] : null;
  if (!lm) return null;
  return { x: lm.x, y: lm.y, name: lm.name || key };
}

function firstReachLandmark(state, def) {
  const reach = def.objectives.find((o) => o.kind === 'reach' || o.kind === 'escape');
  return reach ? landmark(state, reach.key) : null;
}

function defeatCount(def) {
  const d = def.objectives.find((o) => o.kind === 'defeat');
  return d ? d.count || 0 : 0;
}

function raiseWanted(state, level) {
  state.wanted = Math.max(state.wanted, level);
  if (state.police) state.police.wanted = state.wanted;
  // Fresh heat restarts the decay clock (world.stepWanted owns decay).
  state.wantedTimer = 0;
  state.wantedDecays = 0;
}

// Start mission `index` (0-based). Spawns a gang at the first reach
// landmark when the mission has a defeat objective, and drops crates
// at that landmark when it has a collect objective. Safe to call while
// another mission is active: it replaces it.
export function startMission(state, index) {
  const def = MISSIONS[index];
  if (!def) return false;
  state.missionIndex = index;
  state.mission = {
    index,
    def,
    objectiveIndex: 0,
    killsAtStart: state.kills || 0,
    collected: 0,
    hadWanted: false,
    vaultGrabbed: false,
  };
  const spot = firstReachLandmark(state, def);
  const gang = defeatCount(def);
  if (gang > 0 && spot) {
    spawnGang(state, spot.x, spot.y, gang);
  }
  const collect = def.objectives.find((o) => o.kind === 'collect');
  state.crates = [];
  if (collect && spot) {
    for (let i = 0; i < (collect.count || 0); i++) {
      const a = (i / Math.max(1, collect.count || 1)) * Math.PI * 2;
      state.crates.push({
        x: spot.x + Math.cos(a) * 80,
        y: spot.y + Math.sin(a) * 80,
        taken: false,
      });
    }
  }
  return true;
}

export function currentObjective(state) {
  if (!state.mission) return null;
  return state.mission.def.objectives[state.mission.objectiveIndex] || null;
}

// Map marker for the current objective: its landmark, the nearest boat
// for a board objective, or null when there is nothing to point at.
export function missionMarker(state) {
  const obj = currentObjective(state);
  if (!obj) return null;
  if (obj.kind === 'board') {
    const p = state.player;
    let best = null;
    let bestD = Infinity;
    for (const b of state.boats || []) {
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best ? { x: best.x, y: best.y, name: 'Boat' } : null;
  }
  if (obj.key) {
    const lm = landmark(state, obj.key);
    return lm ? { x: lm.x, y: lm.y, name: lm.name } : null;
  }
  return null;
}

// Move to the next objective. When the list is done, pay out, count the
// mission, and mark the story complete after the last mission.
// Returns an events bitmask (MISSION 16 on advance, MISSION_COMPLETE
// 1024 on payout).
function advanceObjective(state) {
  const m = state.mission;
  if (!m) return 0;
  m.objectiveIndex += 1;
  if (m.objectiveIndex >= m.def.objectives.length) {
    state.money = (state.money || 0) + m.def.reward;
    state.missionsDone = (state.missionsDone || 0) + 1;
    const finishedIndex = m.index;
    state.mission = null;
    state.crates = [];
    state.missionIndex = finishedIndex + 1;
    if (finishedIndex >= MISSIONS.length - 1) {
      state.storyComplete = true;
    }
    return 1024;
  }
  return 16;
}

// One tick of mission logic. Called by world.step every frame.
// Returns an events bitmask.
export function updateMission(state) {
  const m = state.mission;
  if (!m) return 0;
  const obj = m.def.objectives[m.objectiveIndex];
  if (!obj) return 0;
  const p = state.player;
  let events = 0;

  if (obj.kind === 'steal') {
    if (p.inCar) events = advanceObjective(state);
  } else if (obj.kind === 'reach' || obj.kind === 'escape') {
    const lm = landmark(state, obj.key);
    if (lm && Math.hypot(p.x - lm.x, p.y - lm.y) < ARRIVE_DIST) {
      events = advanceObjective(state);
    }
  } else if (obj.kind === 'board') {
    if (p.inBoat) events = advanceObjective(state);
  } else if (obj.kind === 'collect') {
    for (const c of state.crates || []) {
      if (!c.taken && Math.hypot(p.x - c.x, p.y - c.y) < 45) {
        c.taken = true;
        m.collected += 1;
        events |= 4;
      }
    }
    if (m.collected >= (obj.count || 0)) events |= advanceObjective(state);
  } else if (obj.kind === 'wanted') {
    if ((state.wanted || 0) >= (obj.level || 1)) events = advanceObjective(state);
  } else if (obj.kind === 'lose') {
    if ((state.wanted || 0) > 0) m.hadWanted = true;
    if (m.hadWanted && (state.wanted || 0) === 0) events = advanceObjective(state);
  } else if (obj.kind === 'defeat') {
    if ((state.kills || 0) - m.killsAtStart >= (obj.count || 0)) {
      events = advanceObjective(state);
    }
  } else if (obj.kind === 'interact') {
    if (m.vaultGrabbed) events = advanceObjective(state);
  }
  return events;
}

// Nearest drivable traffic car within 90px of the player, or null.
export function nearestStealableCar(state) {
  const p = state.player;
  let best = null;
  let bestD = 90;
  for (const car of (state.traffic && state.traffic.cars) || []) {
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

// Step out of the car onto the street next to it.
export function exitCar(state) {
  const p = state.player;
  if (!p.inCar || !p.car) return;
  const car = p.car;
  const side = Math.PI / 2;
  p.x = car.x + Math.cos(car.angle + side) * 40;
  p.y = car.y + Math.sin(car.angle + side) * 40;
  p.angle = car.angle;
  car.speed = 0;
  p.inCar = false;
  p.car = null;
}

// The E key. Order matters: vault grab first (on foot, at the bank),
// then boat boarding, then stealing a car, then stepping out.
// Returns an events bitmask (VAULT 256, STEAL 512, PICKUP 4).
export function tryInteract(state) {
  const p = state.player;
  if (p.inBoat) {
    // Step ashore; boats.js owns the beach landing.
    exitBoat(state);
    return 0;
  }
  const obj = currentObjective(state);
  const m = state.mission;

  if (obj && obj.kind === 'interact' && !p.inCar) {
    const lm = landmark(state, obj.key);
    if (lm && Math.hypot(p.x - lm.x, p.y - lm.y) < INTERACT_DIST) {
      m.vaultGrabbed = true;
      raiseWanted(state, 4);
      let events = 256;
      events |= advanceObjective(state);
      return events;
    }
  }

  if (obj && obj.kind === 'collect' && !p.inCar) {
    for (const c of state.crates || []) {
      if (!c.taken && Math.hypot(p.x - c.x, p.y - c.y) < 60) {
        c.taken = true;
        m.collected += 1;
        return 4;
      }
    }
  }

  if (!p.inCar) {
    // Boat first: the harbor is where boats live, cars live on roads.
    const boat = nearestBoat(state, p.x, p.y);
    if (boat) {
      boardBoat(state, boat);
      return 0;
    }
    const car = nearestStealableCar(state);
    if (car) {
      p.inCar = true;
      p.car = car;
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      raiseWanted(state, Math.min(5, (state.wanted || 0) + 1));
      return 512;
    }
    return 0;
  }

  exitCar(state);
  return 0;
}
