// save.js — snapshot the game to localStorage and read it back.
// The snapshot is plain JSON: seed, money, mission progress, kills,
// health, ammo, player position and play time. Nothing here touches
// the DOM except through window.localStorage, and every function is
// safe to call when there is no window at all (Node smoke tests).

import { SAVE_KEY } from './config.js';
import { formatMoney, formatTime } from './util.js';

// Pull the saveable bits out of a live world state.
export function saveSnapshot(state) {
  const player = state.player || {};
  return {
    seed: state.seed,
    money: state.money || 0,
    missionIndex: state.missionIndex || 0,
    missionsDone: state.missionsDone || 0,
    storyComplete: !!state.storyComplete,
    kills: state.kills || 0,
    hp: player.hp !== undefined ? player.hp : 100,
    ammo: player.ammo !== undefined ? player.ammo : 0,
    x: player.x || 0,
    y: player.y || 0,
    playTime: state.playTime || 0,
  };
}

// Push a loaded snapshot back into a live world state. Fields the
// save does not carry are left alone.
export function applySave(state, save) {
  if (!save) return state;
  if (save.money !== undefined) state.money = save.money;
  if (save.missionIndex !== undefined) state.missionIndex = save.missionIndex;
  if (save.missionsDone !== undefined) state.missionsDone = save.missionsDone;
  if (save.storyComplete !== undefined) state.storyComplete = save.storyComplete;
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

// Write the current state under SAVE_KEY. Returns true on success,
// false when there is no window/storage or the write throws.
export function saveGame(state) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(saveSnapshot(state)));
    return true;
  } catch (err) {
    return false;
  }
}

// Read the save back, or null when there is none / it is corrupt.
export function loadSave() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (err) {
    return null;
  }
}

// Delete the save. Returns true when a save was removed.
export function clearSave() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.removeItem(SAVE_KEY);
    return true;
  } catch (err) {
    return false;
  }
}

// One line for the Continue button: "$1,234  •  3 missions done  •
// 2:05 played". Empty string when there is no save.
export function saveInfoText(save) {
  if (!save) return '';
  const money = formatMoney(save.money || 0);
  const done = save.missionsDone || 0;
  const played = formatTime(save.playTime || 0);
  return money + '  •  ' + done + ' missions done  •  ' + played + ' played';
}

export default saveGame;
