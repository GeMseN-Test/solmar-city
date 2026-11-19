// save.js — localStorage save / load for Solmar City.
import { SAVE_KEY } from './config.js';
import { formatMoney, formatTime } from './util.js';

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

export function applySave(state, save) {
  if (!save) return false;
  if (save.seed != null) state.seed = save.seed;
  if (save.money != null) state.money = save.money;
  if (save.missionIndex != null) state.missionIndex = save.missionIndex;
  if (save.missionsDone != null) state.missionsDone = save.missionsDone;
  state.storyComplete = !!save.storyComplete;
  if (save.kills != null) state.kills = save.kills;
  if (save.playTime != null) state.playTime = save.playTime;
  const p = state.player;
  if (p) {
    if (save.hp != null) p.hp = save.hp;
    if (save.ammo != null) p.ammo = save.ammo;
    if (save.x != null) p.x = save.x;
    if (save.y != null) p.y = save.y;
  }
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
    if (!parsed || typeof parsed !== 'object') return null;
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

export function saveInfoText(save) {
  if (!save) return '';
  const money = formatMoney(save.money || 0);
  const done = save.missionsDone || 0;
  const time = formatTime(save.playTime || 0);
  return money + '  •  ' + done + ' mission' + (done === 1 ? '' : 's') + ' done  •  ' + time + ' played';
}

export function hasSave() {
  return loadSave() !== null;
}
export default saveGame;
