// missions.js — Solmar City story missions (M1–M5) + mission engine.
// Written from the v2 spec only. 12 missions total once missions2/3/4
// register theirs. Objective kinds: steal, reach, collect, wanted, lose,
// defeat, board, interact, escape.
import { spawnGang } from './combat.js';
import { nearestTrafficCar } from './traffic.js';
import { nearestBoat, boardBoat, exitBoat } from './boats.js';

export const EV_MISSION = 16;
export const EV_MISSION_COMPLETE = 1024;
export const EV_VAULT = 256;
export const EV_STEAL = 512;
export const EV_PICKUP = 4;

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function landmark(state, key) {
  if (!state.city || !state.city.landmarks) return null;
  return state.city.landmarks[key] || null;
}

export function landmarkPos(state, key) {
  const lm = landmark(state, key);
  if (!lm) return null;
  return { x: lm.x, y: lm.y, name: lm.name || lm.label || key, key };
}

// The five original story missions. Payouts probed live: M1 pays $200,
// the finale M5 is the big score. M2–M4 rebuilt from the proven kinds.
export const MISSIONS = [
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    briefing: 'Mara butuh mobil. Curi satu di jalan, lalu bawa ke bengkel Ray.',
    reward: 200,
    objectives: [
      { kind: 'steal', text: 'Curi sebuah mobil (E di dekat mobil)' },
      { kind: 'reach', key: 'garage', text: 'Bawa mobil ke Ray\u2019s Garage' },
    ],
  },
  {
    id: 'harbor-run',
    title: 'Harbor Run',
    briefing: 'Ada peti titipan di Docks. Ambil tiga peti, antar ke Marina.',
    reward: 400,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Pergi ke Solmar Docks' },
      { kind: 'collect', count: 3, text: 'Ambil 3 peti di Docks (E)' },
      { kind: 'reach', key: 'marina', text: 'Antar ke Solmar Marina' },
    ],
  },
  {
    id: 'heat-wave',
    title: 'Heat Wave',
    briefing: 'Vipers mulai berulah di Turf. Datangi mereka, beri pelajaran.',
    reward: 600,
    objectives: [
      { kind: 'reach', key: 'turf', text: 'Pergi ke Vipers\u2019 Turf' },
      { kind: 'defeat', count: 3, text: 'Kalahkan 3 Viper' },
      { kind: 'reach', key: 'safehouse', text: 'Kembali ke Safehouse Mara' },
    ],
  },
  {
    id: 'turf-war',
    title: 'Turf War',
    briefing: 'Rebut Turf dari Vipers, lalu menghilang sampai polisi lupa.',
    reward: 800,
    objectives: [
      { kind: 'reach', key: 'turf', text: 'Pergi ke Vipers\u2019 Turf' },
      { kind: 'defeat', count: 4, text: 'Kalahkan 4 Viper' },
      { kind: 'lose', text: 'Hilangkan bintang wanted sampai 0' },
      { kind: 'reach', key: 'safehouse', text: 'Kembali ke Safehouse Mara' },
    ],
  },
  {
    id: 'solmar-score',
    title: 'The Solmar Score',
    briefing: 'Bank Grand Solmar. Bobol brankasnya, lalu kabur ke Safehouse.',
    reward: 3500,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Pergi ke Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Bobol brankas (E di depan bank)' },
      { kind: 'escape', key: 'safehouse', text: 'Kabur ke Safehouse Mara' },
    ],
  },
];

export function currentObjective(state) {
  const def = state.mission;
  if (!def) return null;
  return def.objectives[state.missionObjective] || null;
}

// Where the player should go right now: a {x, y, name} point or null.
export function missionMarker(state) {
  const def = state.mission;
  if (!def) return null;
  const obj = currentObjective(state);
  if (!obj) return null;
  if (obj.kind === 'reach' || obj.kind === 'escape') {
    return landmarkPos(state, obj.key);
  }
  if (obj.kind === 'interact') {
    return landmarkPos(state, obj.key || 'bank');
  }
  if (obj.kind === 'board') {
    const boat = state.boats && state.boats.length
      ? state.boats.reduce((best, b) => {
          if (!best) return b;
          return dist(state.player.x, state.player.y, b.x, b.y)
            < dist(state.player.x, state.player.y, best.x, best.y) ? b : best;
        }, null)
      : null;
    if (boat) return { x: boat.x, y: boat.y, name: 'Perahu', key: 'boat' };
    return landmarkPos(state, 'docks');
  }
  if (obj.kind === 'collect') {
    const crate = (state.crates || []).find((c) => !c.taken);
    if (crate) return { x: crate.x, y: crate.y, name: 'Peti', key: 'crate' };
    return landmarkPos(state, 'docks');
  }
  if (obj.kind === 'steal') {
    const car = nearestStealableCar(state);
    if (car) return { x: car.x, y: car.y, name: 'Mobil', key: 'car' };
    return null;
  }
  if (obj.kind === 'defeat') {
    const firstReach = def.objectives.find((o) => o.kind === 'reach');
    if (firstReach) return landmarkPos(state, firstReach.key);
    return null;
  }
  return null;
}

export function nearestStealableCar(state) {
  if (!state.traffic) return null;
  const car = nearestTrafficCar(state.traffic, state.player.x, state.player.y, 64);
  return car || null;
}

export function exitCar(state) {
  const p = state.player;
  if (!p.inCar || !p.car) return false;
  const car = p.car;
  car.speed = 0;
  // Step out sideways so the player does not stand inside the car.
  p.x = car.x + Math.cos(p.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(p.angle + Math.PI / 2) * 34;
  if (state.traffic && state.traffic.cars) state.traffic.cars.push(car);
  p.inCar = false;
  p.car = null;
  return true;
}

// Start mission `index`: reset per-mission counters, spawn the gang for a
// defeat objective around the FIRST reach landmark, drop crates for a
// collect objective near that same landmark.
export function startMission(state, index) {
  const def = MISSIONS[index];
  if (!def) return false;
  state.missionIndex = index;
  state.mission = def;
  state.missionObjective = 0;
  state.killsAtStart = state.kills || 0;
  state.missionCollected = 0;
  state.vaultGrabbed = false;
  state.loseArmed = false;
  state.loseSince = state.time || 0;
  state.crates = [];
  const firstReach = def.objectives.find((o) => o.kind === 'reach');
  const defeat = def.objectives.find((o) => o.kind === 'defeat');
  if (defeat && firstReach) {
    const pos = landmarkPos(state, firstReach.key);
    if (pos) spawnGang(state, pos.x, pos.y, defeat.count || 3);
  }
  const collect = def.objectives.find((o) => o.kind === 'collect');
  if (collect && firstReach) {
    const pos = landmarkPos(state, firstReach.key);
    if (pos) {
      const spots = [[-70, 30], [40, -60], [90, 70], [-20, 90], [110, -20]];
      const n = collect.count || 3;
      for (let i = 0; i < n; i++) {
        state.crates.push({
          x: pos.x + spots[i % spots.length][0],
          y: pos.y + spots[i % spots.length][1],
          taken: false,
        });
      }
    }
  }
  return true;
}

// Advance the current objective when its condition is met. Returns an
// events bitmask: 16 on objective advance, 1024 on mission complete.
export function updateMission(state) {
  const def = state.mission;
  if (!def || state.storyComplete) return 0;
  const obj = def.objectives[state.missionObjective];
  if (!obj) return 0;
  const p = state.player;
  let done = false;
  if (obj.kind === 'reach' || obj.kind === 'escape') {
    const pos = landmarkPos(state, obj.key);
    if (pos && dist(p.x, p.y, pos.x, pos.y) < 80) done = true;
  } else if (obj.kind === 'board') {
    if (p.inBoat) done = true;
  } else if (obj.kind === 'defeat') {
    if ((state.kills || 0) - (state.killsAtStart || 0) >= (obj.count || 1)) done = true;
  } else if (obj.kind === 'interact') {
    if (state.vaultGrabbed) done = true;
  } else if (obj.kind === 'steal') {
    if (p.inCar) done = true;
  } else if (obj.kind === 'collect') {
    if ((state.missionCollected || 0) >= (obj.count || 1)) done = true;
  } else if (obj.kind === 'wanted') {
    if ((state.wanted || 0) >= (obj.level || 1)) done = true;
  } else if (obj.kind === 'lose') {
    if ((state.wanted || 0) > 0) state.loseArmed = true;
    // Already clean counts too once you have lain low a moment.
    if (state.loseArmed && (state.wanted || 0) === 0) done = true;
    else if ((state.wanted || 0) === 0 && (state.time || 0) - (state.loseSince || 0) > 1) done = true;
  }
  if (!done) return 0;
  state.missionObjective += 1;
  state.loseSince = state.time || 0;
  if (state.missionObjective >= def.objectives.length) {
    state.money += def.reward;
    state.missionsDone = (state.missionsDone || 0) + 1;
    state.vaultGrabbed = false;
    // Point at the next mission but do NOT start it here: the caller
    // (main.js on MISSION_COMPLETE, or an explicit startMission) starts
    // it, so a finished mission reads as done instead of auto-advancing.
    state.missionIndex += 1;
    state.mission = null;
    if (state.missionIndex >= MISSIONS.length) {
      state.storyComplete = true;
      return EV_MISSION_COMPLETE;
    }
    return EV_MISSION_COMPLETE;
  }
  return EV_MISSION;
}

// The E key. Order matters: exit boat/car first, then crates (a crate next
// to a parked car must win over stealing), then the bank vault, then
// boarding a boat, then stealing a car. Returns an events bitmask.
export function tryInteract(state) {
  const p = state.player;
  if (p.inBoat) {
    exitBoat(state);
    return 0;
  }
  if (p.inCar) {
    exitCar(state);
    return 0;
  }
  const crate = (state.crates || []).find(
    (c) => !c.taken && dist(p.x, p.y, c.x, c.y) < 48,
  );
  if (crate) {
    crate.taken = true;
    state.missionCollected = (state.missionCollected || 0) + 1;
    return EV_PICKUP;
  }
  const obj = currentObjective(state);
  const bank = landmarkPos(state, 'bank');
  if (
    obj && obj.kind === 'interact' && bank
    && dist(p.x, p.y, bank.x, bank.y) < 110 && !state.vaultGrabbed
  ) {
    state.vaultGrabbed = true;
    state.wanted = 4;
    state.wantedGainAt = state.time || 0;
    state.wantedTick = 0;
    return EV_VAULT;
  }
  const boat = nearestBoat(state, p.x, p.y);
  if (boat) {
    boardBoat(state, boat);
    return 0;
  }
  const car = nearestStealableCar(state);
  if (car) {
    const cars = state.traffic && state.traffic.cars;
    if (cars) {
      const i = cars.indexOf(car);
      if (i >= 0) cars.splice(i, 1);
    }
    p.inCar = true;
    p.car = car;
    p.angle = car.angle;
    car.speed = 0;
    state.wanted = Math.min(5, (state.wanted || 0) + 1);
    state.wantedGainAt = state.time || 0;
    state.wantedTick = 0;
    return EV_STEAL;
  }
  return 0;
}
