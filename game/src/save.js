// Local save: a plain snapshot of the run, stored as JSON under one
// key in localStorage. Safe to call anywhere — every function guards
// against a missing `window` (headless / node) and returns false/null.
import { SAVE_KEY } from './config.js';
import { formatMoney, formatTime } from './util.js';

export function saveSnapshot(state) {
  return {
    seed: state.seed,
    money: Math.round(state.money),
    missionIndex: state.missionIndex,
    missionsDone: state.missionsDone,
    storyComplete: state.storyComplete,
    kills: state.kills,
    hp: Math.round(state.player.hp),
    ammo: state.player.ammo,
    x: Math.round(state.player.x),
    y: Math.round(state.player.y),
    playTime: Math.round(state.playTime),
  };
}

export function applySave(state, save) {
  if (!save) return false;
  state.seed = save.seed;
  state.money = save.money;
  state.missionIndex = save.missionIndex;
  state.missionsDone = save.missionsDone;
  state.storyComplete = !!save.storyComplete;
  state.kills = save.kills || 0;
  state.player.hp = save.hp;
  state.player.ammo = save.ammo;
  state.player.x = save.x;
  state.player.y = save.y;
  state.playTime = save.playTime || 0;
  return true;
}

export function saveGame(state) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(saveSnapshot(state)));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadSave() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.removeItem(SAVE_KEY);
    return true;
  } catch (e) {
    return false;
  }
}

// One-line save summary for the title screen: "$1,234  •  3 missions
// done  •  2:05 played". Empty string when there is no save.
export function saveInfoText(save) {
  if (!save) return '';
  const missions = save.missionsDone || 0;
  const word = missions === 1 ? 'mission' : 'missions';
  return formatMoney(save.money) + '  •  ' + missions + ' ' + word + ' done  •  ' + formatTime(save.playTime || 0) + ' played';
}
