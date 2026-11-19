// Saving and loading: a plain snapshot of the run, stored as
// JSON under SAVE_KEY in localStorage. Nothing here touches the
// live game except through the snapshot, so the world can hand
// saveSnapshot / applySave back and forth without a cycle.

import { SAVE_KEY } from './config.js';
import { formatMoney, formatTime } from './util.js';

// The save is deliberately small: just enough to pick the run back
// up where the player left it.
export function saveSnapshot(state) {
  const p = state.player || {};
  const m = state.mission || {};
  return {
    seed: state.seed !== undefined ? state.seed : 1,
    money: state.money || 0,
    missionIndex: m.index !== undefined ? m.index : (state.missionIndex || 0),
    missionsDone: state.missionsDone || 0,
    storyComplete: !!state.storyComplete,
    kills: state.kills || 0,
    hp: p.hp !== undefined ? p.hp : 100,
    ammo: p.ammo !== undefined ? p.ammo : 0,
    x: p.x || 0,
    y: p.y || 0,
    playTime: state.playTime || 0,
  };
}

// Put a snapshot back into a live world. Returns false when there
// is nothing usable to apply.
export function applySave(state, save) {
  if (!save || typeof save !== 'object') return false;
  if (typeof save.money === 'number') state.money = save.money;
  if (typeof save.missionsDone === 'number') state.missionsDone = save.missionsDone;
  if (typeof save.storyComplete === 'boolean') state.storyComplete = save.storyComplete;
  if (typeof save.kills === 'number') state.kills = save.kills;
  if (typeof save.playTime === 'number') state.playTime = save.playTime;
  if (typeof save.seed === 'number') state.seed = save.seed;
  if (typeof save.missionIndex === 'number') {
    if (state.mission) state.mission.index = save.missionIndex;
    state.missionIndex = save.missionIndex;
  }
  const p = state.player;
  if (p) {
    if (typeof save.hp === 'number') p.hp = save.hp;
    if (typeof save.ammo === 'number') p.ammo = save.ammo;
    if (typeof save.x === 'number') p.x = save.x;
    if (typeof save.y === 'number') p.y = save.y;
    p.inCar = false;
    p.car = null;
    p.inBoat = false;
    p.boat = null;
  }
  return true;
}

function storage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // No storage available (headless run, private mode) — saves
    // simply do not persist, and every call below says so.
  }
  return null;
}

// Write the current run to localStorage. True when it stuck.
export function saveGame(state) {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, JSON.stringify(saveSnapshot(state)));
    return true;
  } catch {
    return false;
  }
}

// Read the saved run back, or null when there is none / it is broken.
export function loadSave() {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (!save || typeof save.money !== 'number') return null;
    return save;
  } catch {
    return null;
  }
}

export function clearSave() {
  const store = storage();
  if (!store) return false;
  try {
    store.removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}

// One line for the title screen: "$1,234  •  3 missions done  •  2:05 played".
export function saveInfoText(save) {
  if (!save) return '';
  return (
    formatMoney(save.money || 0) +
    '  •  ' +
    (save.missionsDone || 0) +
    ' missions done  •  ' +
    formatTime(save.playTime || 0) +
    ' played'
  );
}
