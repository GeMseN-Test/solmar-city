// save.js — save / load for Solmar City (localStorage, SAVE_KEY).
// saveSnapshot / applySave are the plain-data pair world.js uses;
// saveGame / loadSave are the storage wrappers. All safe without a
// browser (node smoke tests): they just return false / null.

import { SAVE_KEY } from './config.js';
import { formatMoney, formatTime } from './util.js';

export function saveSnapshot(state) {
  const p = state.player || {};
  return {
    seed: state.seed ?? 1,
    money: state.money ?? 0,
    missionIndex: state.missionIndex ?? 0,
    missionsDone: state.missionsDone ?? 0,
    storyComplete: !!state.storyComplete,
    kills: state.kills ?? 0,
    hp: p.hp ?? 100,
    ammo: p.ammo ?? 0,
    x: p.x ?? 1420,
    y: p.y ?? 1230,
    playTime: state.playTime ?? 0,
  };
}

export function applySave(state, save) {
  if (!save || typeof save !== 'object') return false;
  state.seed = save.seed ?? state.seed;
  state.money = save.money ?? state.money;
  state.missionIndex = save.missionIndex ?? 0;
  state.missionsDone = save.missionsDone ?? 0;
  state.storyComplete = !!save.storyComplete;
  state.kills = save.kills ?? 0;
  state.playTime = save.playTime ?? 0;
  if (state.player) {
    state.player.hp = save.hp ?? state.player.hp;
    state.player.ammo = save.ammo ?? state.player.ammo;
    state.player.x = save.x ?? state.player.x;
    state.player.y = save.y ?? state.player.y;
    state.player.inCar = false;
    state.player.car = null;
    state.player.inBoat = false;
    state.player.boat = null;
  }
  return true;
}

function storage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch (e) {
    // Storage unavailable (private mode, node, ...).
  }
  return null;
}

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

export function loadSave() {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (!save || typeof save !== 'object') return null;
    return save;
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

export function saveInfoText(save) {
  if (!save) return '';
  const money = '$' + formatMoney(save.money ?? 0);
  const done = (save.missionsDone ?? 0) + ' missions done';
  const played = formatTime(save.playTime ?? 0) + ' played';
  return money + '  •  ' + done + '  •  ' + played;
}
