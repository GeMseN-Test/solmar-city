// Save / load for Solmar City (localStorage, one slot).
import { SAVE_KEY } from './config.js';
import { formatMoney, formatTime } from './util.js';

// Snapshot of the fields a save carries. Pure — no window needed.
export function saveSnapshot(state) {
  const p = state.player || {};
  return {
    seed: state.seed,
    money: state.money || 0,
    missionIndex: state.missionIndex || 0,
    missionsDone: state.missionsDone || 0,
    storyComplete: !!state.storyComplete,
    kills: state.kills || 0,
    hp: p.hp != null ? p.hp : 100,
    ammo: p.ammo != null ? p.ammo : 0,
    x: p.x || 0,
    y: p.y || 0,
    playTime: state.playTime || 0,
  };
}

// Apply a loaded snapshot back onto a live state object.
export function applySave(state, save) {
  if (!save) return false;
  state.money = save.money || 0;
  state.missionIndex = save.missionIndex || 0;
  state.missionsDone = save.missionsDone || 0;
  state.storyComplete = !!save.storyComplete;
  state.kills = save.kills || 0;
  state.playTime = save.playTime || 0;
  if (state.player) {
    state.player.hp = save.hp != null ? save.hp : 100;
    state.player.ammo = save.ammo != null ? save.ammo : 0;
    if (save.x != null) state.player.x = save.x;
    if (save.y != null) state.player.y = save.y;
    state.player.inCar = false;
    state.player.car = null;
    state.player.inBoat = false;
    state.player.boat = null;
  }
  return true;
}

// Write the current state to localStorage. Returns true on success.
export function saveGame(state) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const snap = saveSnapshot(state);
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
    return true;
  } catch (e) {
    return false;
  }
}

// Read the save slot. Returns the save object, or null when empty/bad.
export function loadSave() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

// Delete the save slot. Returns true when it ran.
export function clearSave() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.removeItem(SAVE_KEY);
    return true;
  } catch (e) {
    return false;
  }
}

// One-line summary for the Continue button:
// "$1,234  •  3 missions done  •  2:05 played"
export function saveInfoText(save) {
  if (!save) return '';
  const money = '$' + formatMoney(save.money || 0);
  const missions = (save.missionsDone || 0) + ' mission' + ((save.missionsDone || 0) === 1 ? '' : 's') + ' done';
  const played = formatTime(save.playTime || 0) + ' played';
  return money + '  •  ' + missions + '  •  ' + played;
}

// True when a save slot exists.
export function hasSave() {
  return loadSave() !== null;
}
