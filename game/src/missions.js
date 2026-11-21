// missions.js — Solmar City story missions M1–M5 + mission engine.
// Written from the v2 spec only. Proven objective kinds only:
// reach / steal / board / interact / escape / defeat / wanted / lose / collect.
import { spawnGang } from './combat.js';
import { boardBoat, exitBoat, nearestBoat } from './boats.js';

// Event bitmask pieces used by updateMission (mirrors world.js EV).
export const EV_MISSION = 16;
export const EV_MISSION_COMPLETE = 1024;
export const EV_VAULT = 256;
export const EV_STEAL = 512;

// ---- Mission definitions -------------------------------------------------
// Rewards: M1 $200, M2 $400, M3 $600, M4 $800, M5 $2,500.
// Total of all 12 missions = $33,600. Final cash after M12 = $50 + $33,600.
export const MISSIONS = [];

const BASE_MISSIONS = [
  {
    id: 'm1',
    title: 'Hot Wheels',
    briefing: 'Mara needs wheels. Steal a car and bring it to Ray\'s Garage.',
    reward: 200,
    objectives: [
      { kind: 'steal', text: 'Steal a car (press E near one)' },
      { kind: 'reach', key: 'garage', text: 'Drive to Ray\'s Garage' },
    ],
  },
  {
    id: 'm2',
    title: 'Harbor Run',
    briefing: 'A package waits at the Docks. Run it down to the Marina, fast.',
    reward: 400,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach the Solmar Docks' },
      { kind: 'reach', key: 'marina', text: 'Reach the Solmar Marina' },
    ],
  },
  {
    id: 'm3',
    title: 'Heat Wave',
    briefing: 'The SCPD is watching the Turf. Stir up 2 stars of heat, then vanish.',
    reward: 600,
    objectives: [
      { kind: 'reach', key: 'turf', text: 'Reach the Vipers\' Turf' },
      { kind: 'wanted', level: 2, text: 'Raise your wanted level to 2 stars' },
      { kind: 'lose', text: 'Lose the cops (wanted back to 0)' },
    ],
  },
  {
    id: 'm4',
    title: 'Turf War',
    briefing: 'The Vipers own the south blocks. Take their turf back, then lay low.',
    reward: 800,
    objectives: [
      { kind: 'reach', key: 'turf', text: 'Reach the Vipers\' Turf' },
      { kind: 'defeat', count: 4, text: 'Defeat 4 Vipers' },
      { kind: 'reach', key: 'safehouse', text: 'Reach Mara\'s Safehouse' },
    ],
  },
  {
    id: 'm5',
    title: 'The Solmar Score',
    briefing: 'The Grand Solmar Bank vault is the big one. Grab it and disappear.',
    reward: 2500,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Reach the Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault (press E at the bank)' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to Mara\'s Safehouse' },
    ],
  },
];

// Idempotent: appends M1–M5 once, even if called again.
export function registerStoryMissions() {
  for (const def of BASE_MISSIONS) {
    if (!MISSIONS.some((m) => m.id === def.id)) MISSIONS.push(def);
  }
  return MISSIONS;
}
registerStoryMissions();

// ---- Landmark helpers ----------------------------------------------------
export function landmarkPos(state, key) {
  const lm = state.city && state.city.landmarks ? state.city.landmarks[key] : null;
  if (!lm) return null;
  return { x: lm.x, y: lm.y, name: lm.name || key, key };
}

export function distTo(state, x, y) {
  const dx = state.player.x - x;
  const dy = state.player.y - y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ---- Gang spawn for defeat objectives ------------------------------------
// Spawns the defeat count around the mission's FIRST reach landmark.
export function spawnMissionGang(state, def) {
  const defeat = def.objectives.find((o) => o.kind === 'defeat');
  if (!defeat) return 0;
  const firstReach = def.objectives.find((o) => o.kind === 'reach');
  const anchor = firstReach ? landmarkPos(state, firstReach.key) : null;
  const ax = anchor ? anchor.x : state.player.x;
  const ay = anchor ? anchor.y : state.player.y;
  spawnGang(state, ax, ay, defeat.count);
  return defeat.count;
}

// ---- Mission lifecycle ---------------------------------------------------
export function startMission(state, index) {
  if (index < 0 || index >= MISSIONS.length) return false;
  const def = MISSIONS[index];
  state.missionIndex = index;
  state.missionStep = 0;
  state.killsAtStart = state.kills || 0;
  state.vaultTaken = false;
  spawnMissionGang(state, def);
  return true;
}

export function currentObjective(state) {
  if (state.missionIndex < 0 || state.missionIndex >= MISSIONS.length) return null;
  const def = MISSIONS[state.missionIndex];
  if (state.missionStep >= def.objectives.length) return null;
  return def.objectives[state.missionStep];
}

export function currentMission(state) {
  if (state.missionIndex < 0 || state.missionIndex >= MISSIONS.length) return null;
  return MISSIONS[state.missionIndex];
}

// Marker shown on the HUD / minimap for the current objective.
export function missionMarker(state) {
  const obj = currentObjective(state);
  if (!obj) return null;
  if (obj.kind === 'reach' || obj.kind === 'escape' || obj.kind === 'interact') {
    return landmarkPos(state, obj.key);
  }
  if (obj.kind === 'board') {
    // Point at the nearest boat.
    if (state.boats && state.boats.length) {
      let best = null;
      let bestD = Infinity;
      for (const b of state.boats) {
        const d = distTo(state, b.x, b.y);
        if (d < bestD) { bestD = d; best = b; }
      }
      if (best) return { x: best.x, y: best.y, name: 'Boat', key: 'boat' };
    }
    return landmarkPos(state, 'docks');
  }
  if (obj.kind === 'defeat') {
    const def = currentMission(state);
    const firstReach = def.objectives.find((o) => o.kind === 'reach');
    if (firstReach) return landmarkPos(state, firstReach.key);
    return null;
  }
  return null;
}

function objectiveDone(state, obj) {
  switch (obj.kind) {
    case 'reach': {
      const lm = landmarkPos(state, obj.key);
      return lm ? distTo(state, lm.x, lm.y) < 80 : false;
    }
    case 'escape': {
      const lm = landmarkPos(state, obj.key);
      return lm ? distTo(state, lm.x, lm.y) < 80 : false;
    }
    case 'steal':
      return !!state.player.inCar;
    case 'board':
      return !!state.player.inBoat;
    case 'interact':
      return !!state.vaultTaken;
    case 'defeat':
      return (state.kills || 0) - (state.killsAtStart || 0) >= (obj.count || 1);
    case 'wanted':
      return (state.wanted || 0) >= (obj.level || 1);
    case 'lose':
      return (state.wanted || 0) === 0;
    case 'collect':
      return state.sideJobs ? (state.sideJobs.coinsFound || 0) >= (obj.count || 1) : false;
    default:
      return false;
  }
}

export function updateMission(state) {
  if (state.missionIndex < 0 || state.missionIndex >= MISSIONS.length) return 0;
  const def = MISSIONS[state.missionIndex];
  const obj = def.objectives[state.missionStep];
  if (!obj) return 0;
  if (!objectiveDone(state, obj)) return 0;
  // Consume one-shot flags.
  if (obj.kind === 'interact') state.vaultTaken = false;
  if (obj.kind === 'escape') state.wanted = 0;
  state.missionStep += 1;
  let events = EV_MISSION;
  if (state.missionStep >= def.objectives.length) {
    state.money = (state.money || 0) + def.reward;
    state.missionsDone = (state.missionsDone || 0) + 1;
    state.lastReward = def.reward;
    state.lastMissionTitle = def.title;
    if (state.missionIndex === MISSIONS.length - 1) state.storyComplete = true;
    state.missionIndex = -1;
    state.missionStep = 0;
    events |= EV_MISSION_COMPLETE;
  }
  return events;
}

// ---- Cars ----------------------------------------------------------------
export function nearestStealableCar(state) {
  const px = state.player.x;
  const py = state.player.y;
  let best = null;
  let bestD = 90;
  const consider = (car) => {
    if (!car) return;
    const dx = car.x - px;
    const dy = car.y - py;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestD) { bestD = d; best = car; }
  };
  if (state.parkedCars) for (const c of state.parkedCars) consider(c);
  if (state.traffic && state.traffic.cars) for (const c of state.traffic.cars) consider(c);
  return best;
}

export function exitCar(state) {
  if (!state.player.inCar || !state.player.car) return false;
  const car = state.player.car;
  car.x = state.player.x + 30;
  car.y = state.player.y + 30;
  car.speed = 0;
  car.kind = 'parked';
  if (!state.parkedCars) state.parkedCars = [];
  state.parkedCars.push(car);
  state.player.inCar = false;
  state.player.car = null;
  return true;
}

// ---- Interact (E key) ----------------------------------------------------
// Order: exit boat -> board boat -> vault -> steal car -> grab crate.
// Returns an events bitmask.
export function tryInteract(state) {
  const p = state.player;
  let events = 0;
  // On a boat: step ashore.
  if (p.inBoat) {
    exitBoat(state);
    return events;
  }
  // In a car: board a nearby boat (leave the car parked), grab the vault
  // from the car, or simply get out on foot.
  if (p.inCar) {
    const boat = nearestBoat(state, p.x, p.y);
    if (boat) {
      exitCar(state);
      boardBoat(state, boat);
      return events;
    }
    const obj = currentObjective(state);
    if (obj && obj.kind === 'interact' && obj.key === 'bank') {
      const bank = landmarkPos(state, 'bank');
      if (bank && distTo(state, bank.x, bank.y) < 110) {
        state.vaultTaken = true;
        state.wanted = 4;
        return events | EV_VAULT;
      }
    }
    exitCar(state);
    return events;
  }
  // On foot: board a nearby boat first (before cars).
  const boat = nearestBoat(state, p.x, p.y);
  if (boat) {
    boardBoat(state, boat);
    return events;
  }
  // Vault: near the bank while an interact objective is active.
  const obj = currentObjective(state);
  if (obj && obj.kind === 'interact' && obj.key === 'bank') {
    const bank = landmarkPos(state, 'bank');
    if (bank && distTo(state, bank.x, bank.y) < 110) {
      state.vaultTaken = true;
      state.wanted = 4;
      return events | EV_VAULT;
    }
  }
  // Steal a nearby car.
  const car = nearestStealableCar(state);
  if (car && !p.inCar) {
    // Remove it from wherever it lived.
    if (state.parkedCars) {
      const i = state.parkedCars.indexOf(car);
      if (i >= 0) state.parkedCars.splice(i, 1);
    }
    if (state.traffic && state.traffic.cars) {
      const i = state.traffic.cars.indexOf(car);
      if (i >= 0) state.traffic.cars.splice(i, 1);
    }
    p.inCar = true;
    p.car = car;
    car.speed = 0;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    state.wanted = Math.min(5, (state.wanted || 0) + 1);
    return events | EV_STEAL;
  }
  // Grab a nearby crate (cash pickup) by hand.
  if (state.pickups) {
    for (let i = 0; i < state.pickups.length; i++) {
      const pk = state.pickups[i];
      if (distTo(state, pk.x, pk.y) < 48) {
        state.pickups.splice(i, 1);
        if (pk.kind === 'cash') state.money = (state.money || 0) + (pk.value || 60);
        else if (pk.kind === 'health') p.hp = Math.min(100, p.hp + (pk.value || 40));
        else if (pk.kind === 'ammo') p.ammo = Math.min(240, p.ammo + (pk.value || 36));
        return events | 4; // PICKUP
      }
    }
  }
  return events;
}
