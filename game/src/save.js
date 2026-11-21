// save.js — localStorage save/load for Solmar City.

import { SAVE_KEY } from './config.js';
import { formatMoney, formatTime } from './util.js';

export { SAVE_KEY };

export function saveSnapshot(state) {
  const p = state.player || {};
  return {
    seed: state.seed || 1,
    money: state.money || 0,
    missionIndex: state.missionIndex || 0,
    missionsDone: state.missionsDone || 0,
    storyComplete: !!state.storyComplete,
    kills: state.kills || 0,
    hp: p.hp !== undefined ? p.hp : 100,
    ammo: p.ammo !== undefined ? p.ammo : 48,
    x: p.x || 1420,
    y: p.y || 1230,
    playTime: state.playTime || 0,
  };
}

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

export function loadSave() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (!save || typeof save !== 'object') return null;
    return save;
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

export function applySave(state, save) {
  if (!state || !save) return state;
  if (typeof save.money === 'number') state.money = save.money;
  if (typeof save.missionIndex === 'number') state.missionIndex = save.missionIndex;
  if (typeof save.missionsDone === 'number') state.missionsDone = save.missionsDone;
  if (typeof save.storyComplete === 'boolean') state.storyComplete = save.storyComplete;
  if (typeof save.kills === 'number') state.kills = save.kills;
  if (typeof save.playTime === 'number') state.playTime = save.playTime;
  const p = state.player || {};
  if (typeof save.hp === 'number') p.hp = save.hp;
  if (typeof save.ammo === 'number') p.ammo = save.ammo;
  if (typeof save.x === 'number') p.x = save.x;
  if (typeof save.y === 'number') p.y = save.y;
  state.player = p;
  return state;
}

export function saveInfoText(save) {
  if (!save) return '';
  const money = formatMoney(save.money || 0);
  const missions = save.missionsDone || 0;
  const time = formatTime(save.playTime || 0);
  return money + '  •  ' + missions + ' mission' + (missions === 1 ? '' : 's') + ' done  •  ' + time + ' played';
}

export default { saveSnapshot, saveGame, loadSave, clearSave, applySave, saveInfoText, SAVE_KEY };
