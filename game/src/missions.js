// missions.js — story missions M1–M5 + the mission engine for Solmar City.
// Every mission is a list of small objectives. The engine only knows the
// objective kinds below; new missions (missions2/3/4.js) reuse them.
//
// Objective kinds:
//   steal    — get into any car (steal it with E)
//   reach    — stand close to a landmark (key = landmark name)
//   collect  — grab crates with E (crates spawn when the mission starts)
//   wanted   — raise your wanted level to `level`
//   lose     — drop your wanted level back to zero
//   defeat   — take down `count` gang members (kills since mission start)
//   board    — get into a boat
//   interact — press E at a landmark (the bank vault)
//   escape   — reach the safehouse after the heat is on
//
// Kills are counted by world.step, never here and never in combat: when an
// enemy's hp hits zero, world.step sweeps it out of the fight and bumps
// state.kills exactly once. Defeat objectives just compare kills.

import { spawnGang } from './combat.js';
import { nearestBoat, boardBoat } from './boats.js';
import { nearestTrafficCar } from './traffic.js';

// Event bits — the same numbers world.step returns. main.js listens to them
// to play sounds and flash banners.
export const EVENTS = {
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

// How close (in pixels) the player must stand to a landmark to count as
// "reached", and how close to a car, boat or crate to interact with it.
const REACH_DIST = 70;
const INTERACT_DIST = 90;
const CRATE_DIST = 44;

// The five original story missions. Payouts: M1 $200 is the proven v1
// number; M2–M5 are rebuilt from the v1 titles only.
export const MISSIONS = [
  {
    id: 'm1-hot-wheels',
    title: 'Hot Wheels',
    briefing: 'Mara needs wheels. Steal any car, then bring it to Ray\u2019s Garage.',
    reward: 200,
    objectives: [
      { kind: 'steal', text: 'Steal a car (walk up to one and press E)' },
      { kind: 'reach', key: 'garage', text: 'Drive to Ray\u2019s Garage' },
    ],
  },
  {
    id: 'm2-harbor-run',
    title: 'Harbor Run',
    briefing: 'Crates washed up at the Docks. Grab three, then drop them at the Marina.',
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
    briefing: 'The cops need a reminder. Get to 2 stars, then shake them off clean.',
    reward: 600,
    objectives: [
      { kind: 'wanted', level: 2, text: 'Raise your wanted level to 2 stars' },
      { kind: 'lose', text: 'Lose the cops — get back to 0 stars' },
    ],
  },
  {
    id: 'm4-turf-war',
    title: 'Turf War',
    briefing: 'The Vipers are pushing into Mara\u2019s streets. Clear them out of their turf.',
    reward: 800,
    objectives: [
      { kind: 'reach', key: 'turf', text: 'Go to the Vipers\u2019 Turf' },
      { kind: 'defeat', count: 3, text: 'Defeat 3 Vipers' },
      { kind: 'reach', key: 'safehouse', text: 'Get back to the Safehouse' },
    ],
  },
  {
    id: 'm5-solmar-score',
    title: 'The Solmar Score',
    briefing: 'The Grand Solmar Bank, one vault, no plan B. Grab it and vanish.',
    reward: 3500,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Go to the Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault (press E at the bank)' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to the Safehouse' },
    ],
  },
];

// Where each defeat mission's gang waits, and how many of them there are.
// The spawn point is always the mission's first "reach" landmark. New
// missions only need one line here — the table is keyed by mission id.
const GANG_SPAWNS = {
  'm4-turf-war': { key: 'turf', count: 3 },
  'm7-on-air': { key: 'radio', count: 3 },
  'm8-grand-finale': { key: 'bank', count: 6 },
  'm9-night-shift': { key: 'docks', count: 4 },
  'm10-king-of-solmar': { key: 'turf', count: 6 },
  'm11-midnight-run': { key: 'docks', count: 4 },
  'm12-solmar-crown': { key: 'bank', count: 6 },
};

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function landmark(state, key) {
  const lm = state.city && state.city.landmarks ? state.city.landmarks[key] : null;
  if (!lm) return null;
  return {
    x: typeof lm.x === 'number' ? lm.x : lm[0],
    y: typeof lm.y === 'number' ? lm.y : lm[1],
    name: lm.name || lm.label || key,
    key,
  };
}

function firstReachKey(def) {
  for (const obj of def.objectives) {
    if ((obj.kind === 'reach' || obj.kind === 'escape') && obj.key) return obj.key;
  }
  return null;
}

// The mission the player is currently on, or null when free-roaming.
export function currentMission(state) {
  return state.mission || null;
}

// The objective the player is working on right now, or null.
export function currentObjective(state) {
  if (!state.mission) return null;
  return state.mission.objectives[state.missionObjectiveIndex] || null;
}

// Where the on-screen arrow and the minimap should point for the current
// objective. Returns a landmark-like { x, y, name } or null when the
// objective has no place (steal a car, lose the cops, board a boat).
export function missionMarker(state) {
  const obj = currentObjective(state);
  if (!obj || !state.mission) return null;
  if (obj.kind === 'reach' || obj.kind === 'escape' || obj.kind === 'interact') {
    return landmark(state, obj.key || 'safehouse');
  }
  if (obj.kind === 'defeat') {
    const spawn = GANG_SPAWNS[state.mission.id];
    if (spawn) return landmark(state, spawn.key);
    const key = firstReachKey(state.mission);
    return key ? landmark(state, key) : null;
  }
  if (obj.kind === 'collect') {
    const crate = (state.crates || []).find((c) => !c.taken);
    if (crate) return { x: crate.x, y: crate.y, name: 'Crate', key: 'crate' };
    const key = firstReachKey(state.mission);
    return key ? landmark(state, key) : null;
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
      return dist(p.x, p.y, lm.x, lm.y) <= REACH_DIST;
    }
    case 'collect':
      return (state.missionFlags.collected || 0) >= (obj.count || 1);
    case 'wanted':
      return state.wanted >= (obj.level || 1);
    case 'lose':
      return state.wanted <= 0;
    case 'defeat':
      return state.kills - (state.killsAtStart || 0) >= (obj.count || 1);
    case 'board':
      return !!p.inBoat;
    case 'interact':
      return !!state.missionFlags.vaultGrabbed;
    default:
      return false;
  }
}

// Start mission number `index` (0-based). Spawns the gang for defeat
// missions and the crates for collect missions, then shows the briefing.
export function startMission(state, index) {
  if (index < 0 || index >= MISSIONS.length) return 0;
  const def = MISSIONS[index];
  state.mission = def;
  state.missionIndex = index;
  state.missionObjectiveIndex = 0;
  state.missionFlags = { collected: 0, vaultGrabbed: false };
  state.killsAtStart = state.kills || 0;
  state.missionActive = true;

  const spawn = GANG_SPAWNS[def.id];
  if (spawn) {
    const lm = landmark(state, spawn.key);
    if (lm) spawnGang(state, lm.x, lm.y, spawn.count);
  }

  const collectObj = def.objectives.find((o) => o.kind === 'collect');
  if (collectObj) {
    const anchorKey = firstReachKey(def) || 'docks';
    const anchor = landmark(state, anchorKey) || { x: 360, y: 130 };
    state.crates = [];
    for (let i = 0; i < (collectObj.count || 1); i++) {
      const a = state.rng.next() * Math.PI * 2;
      const r = 50 + state.rng.next() * 90;
      state.crates.push({
        x: anchor.x + Math.cos(a) * r,
        y: anchor.y + Math.sin(a) * r,
        taken: false,
      });
    }
  } else {
    state.crates = [];
  }

  state.missionBanner = { title: def.title, text: def.briefing, timer: 4.5 };
  return EVENTS.MISSION;
}

// Advance the current mission. Call once per frame from world.step.
// Returns EVENTS.MISSION_COMPLETE when the last objective is done.
export function updateMission(state) {
  if (!state.mission) return 0;
  let guard = 0;
  while (state.mission && guard < 10) {
    guard += 1;
    const obj = currentObjective(state);
    if (!obj) break;
    if (!objectiveDone(state, obj)) break;
    state.missionObjectiveIndex += 1;
    if (state.missionObjectiveIndex >= state.mission.objectives.length) {
      const def = state.mission;
      state.money += def.reward;
      state.missionsDone = (state.missionsDone || 0) + 1;
      state.missionIndex = (state.missionIndex || 0) + 1;
      state.mission = null;
      state.missionActive = false;
      state.missionObjectiveIndex = 0;
      state.missionCooldown = 3;
      if (state.missionIndex >= MISSIONS.length) {
        state.storyComplete = true;
        state.missionBanner = {
          title: 'The Solmar Crown',
          text: 'Story complete — Mara owns Solmar City. Free roam, or chase freelance runs.',
          timer: 6,
        };
      } else {
        state.missionBanner = {
          title: def.title + ' complete',
          text: 'Paid $' + def.reward.toLocaleString('en-US') + '. Next job coming up.',
          timer: 4,
        };
      }
      return EVENTS.MISSION_COMPLETE;
    }
  }
  return 0;
}

// The nearest car the player could steal, on the street or parked.
// Returns { car, source } where source is 'traffic' or 'parked', or null.
export function nearestStealableCar(state) {
  const p = state.player;
  let best = null;
  let bestD = INTERACT_DIST;
  if (state.traffic) {
    const car = nearestTrafficCar(state.traffic, p.x, p.y, INTERACT_DIST);
    if (car) {
      best = { car, source: 'traffic' };
      bestD = dist(p.x, p.y, car.x, car.y);
    }
  }
  for (const car of state.parkedCars || []) {
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) {
      best = { car, source: 'parked' };
      bestD = d;
    }
  }
  return best;
}

// Step out of the car. The car stays where it is, parked, and can be
// stolen again later.
export function exitCar(state) {
  const p = state.player;
  if (!p.inCar || !p.car) return false;
  const car = p.car;
  car.x = p.x;
  car.y = p.y;
  car.angle = p.angle;
  car.speed = 0;
  state.parkedCars = state.parkedCars || [];
  state.parkedCars.push(car);
  p.inCar = false;
  p.car = null;
  p.x += Math.cos(p.angle + Math.PI / 2) * 26;
  p.y += Math.sin(p.angle + Math.PI / 2) * 26;
  return true;
}

// The E key. Boats first, then the crate the current job needs (a crate
// next to your parked car must win over stealing the car again), then
// cars, then the bank vault. Returns an event bitmask (STEAL, VAULT,
// PICKUP, or 0).
export function tryInteract(state) {
  const p = state.player;
  if (!p) return 0;

  if (!p.inCar && !p.inBoat) {
    const boat = nearestBoat(state, p.x, p.y);
    if (boat) {
      boardBoat(state, boat);
      return 0;
    }
  }

  if (!p.inCar && !p.inBoat) {
    const obj = currentObjective(state);
    if (obj && obj.kind === 'collect') {
      for (const crate of state.crates || []) {
        if (!crate.taken && dist(p.x, p.y, crate.x, crate.y) <= CRATE_DIST) {
          crate.taken = true;
          state.missionFlags.collected = (state.missionFlags.collected || 0) + 1;
          return EVENTS.PICKUP;
        }
      }
    }
  }

  if (!p.inCar && !p.inBoat) {
    const found = nearestStealableCar(state);
    if (found) {
      const car = found.car;
      if (found.source === 'traffic' && state.traffic) {
        const i = state.traffic.cars.indexOf(car);
        if (i >= 0) state.traffic.cars.splice(i, 1);
      } else {
        const i = (state.parkedCars || []).indexOf(car);
        if (i >= 0) state.parkedCars.splice(i, 1);
      }
      p.inCar = true;
      p.car = car;
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      car.speed = 0;
      state.wanted = Math.min(5, (state.wanted || 0) + 1);
      state.wantedTimer = 0;
      return EVENTS.STEAL;
    }
  }

  if (!p.inCar && !p.inBoat) {
    const obj = currentObjective(state);
    if (obj && obj.kind === 'interact') {
      const lm = landmark(state, obj.key || 'bank');
      if (lm && dist(p.x, p.y, lm.x, lm.y) <= REACH_DIST + 10) {
        state.missionFlags.vaultGrabbed = true;
        state.wanted = 4;
        state.wantedTimer = 0;
        return EVENTS.VAULT;
      }
    }
  }

  return 0;
}
