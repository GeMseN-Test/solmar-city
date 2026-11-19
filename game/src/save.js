// Save / load for Solmar City. One slot in localStorage under
// SAVE_KEY. Only progress numbers are stored — never live objects —
// so a save from an older build still loads cleanly.

import { SAVE_KEY } from './config.js';
import { formatMoney, formatTime } from './util.js';

// The plain snapshot the rest of the game passes around. world.js
// owns the live state; this just flattens the bits worth keeping.
export function saveSnapshot(state) {
  const p = state.player || {};
  return {
    seed: state.seed,
    money: state.money || 0,
    missionIndex: state.missionIndex || 0,
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

// Write the snapshot back into a live state (after a fresh world was
// created from the same seed). Returns the state for chaining.
export function applySave(state, save) {
  if (!save) return state;
  if (save.seed !== undefined) state.seed = save.seed;
  if (save.money !== undefined) state.money = save.money;
  if (save.missionIndex !== undefined) state.missionIndex = save.missionIndex;
  if (save.missionsDone !== undefined) state.missionsDone = save.missionsDone;
  if (save.storyComplete !== undefined) state.storyComplete = !!save.storyComplete;
  if (save.kills !== undefined) state.kills = save.kills;
  if (save.playTime !== undefined) state.playTime = save.playTime;
  if (state.player) {
    if (save.hp !== undefined) state.player.hp = save.hp;
    if (save.ammo !== undefined) state.player.ammo = save.ammo;
    if (save.x !== undefined) state.player.x = save.x;
    if (save.y !== undefined) state.player.y = save.y;
  }
  return state;
}

function storage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch (e) {
    return null;
  }
  return null;
}

// Persist the current state. False when there is nowhere to save
// (headless run, storage blocked) — never throws.
export function saveGame(state) {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, JSON.stringify(saveSnapshot(state)));
    return true;
  } catch (e) {
    return false;
  }
}

// Read the stored save, or null when there is none / it is corrupt.
export function loadSave() {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  const store = storage();
  if (!store) return false;
  try {
    store.removeItem(SAVE_KEY);
    return true;
  } catch (e) {
    return false;
  }
}

// One line for the menu / HUD: "$1,234  •  3 missions done  •  2:05
// played". Empty string when there is no save to describe.
export function saveInfoText(save) {
  if (!save) return '';
  const money = formatMoney(save.money || 0);
  const done = save.missionsDone || 0;
  const noun = done === 1 ? 'mission done' : 'missions done';
  return money + '  •  ' + done + ' ' + noun + '  •  ' + formatTime(save.playTime || 0) + ' played';
}
