// Local save: snapshot the world to localStorage and read it back.
// Every method is safe outside a browser (node, tests) — it just returns
// false / null instead of touching storage that is not there.
import { SAVE_KEY } from './config.js';

function storage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function snapshotOf(state) {
  return {
    version: 1,
    seed: state.seed,
    money: state.money,
    missionIndex: state.missionIndex,
    missionsDone: state.missionsDone,
    storyComplete: state.storyComplete,
    kills: state.kills,
    hp: state.player.hp,
    ammo: state.player.ammo,
    x: state.player.x,
    y: state.player.y,
    playTime: state.playTime,
  };
}

export function saveGame(state) {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, JSON.stringify(snapshotOf(state)));
    return true;
  } catch {
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
    if (!save || typeof save !== 'object' || typeof save.seed !== 'number') return null;
    // Version 1 is the only shape written so far; anything else is not ours.
    if (save.version !== undefined && save.version !== 1) return null;
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

// "$1,234  •  3 missions done  •  2:05 played" — '' when there is no save.
export function saveInfoText(save) {
  if (!save) return '';
  const money = `$${Math.round(save.money || 0).toLocaleString('en-US')}`;
  const missions = `${save.missionsDone || 0} missions done`;
  const total = Math.max(0, Math.floor(save.playTime || 0));
  const played = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} played`;
  return `${money}  •  ${missions}  •  ${played}`;
}
