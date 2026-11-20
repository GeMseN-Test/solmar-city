// Solmar City — saving and loading. The save is one small JSON
// object in localStorage under SAVE_KEY ('solmar-city-save-v1').
// It only remembers the numbers that matter: where Mara is, how much
// cash she has, which missions are done, and how long she has played.
// Everything else (city, traffic, gangs) is rebuilt from the seed.
//
// saveSnapshot / applySave are the pure halves: snapshot turns a live
// state into a save object, applySave pours one back into a state.
// saveGame / loadSave / clearSave are the localStorage wrappers.

import { SAVE_KEY, PLAYER } from './config.js';
import { formatMoney, formatTime } from './util.js';
import { startMission } from './missions.js';

export { SAVE_KEY };

// A plain object that can be stored as JSON. Nothing in here holds a
// function, a DOM node, or a circular reference.
export function saveSnapshot(state) {
  return {
    seed: state.seed,
    money: Math.round(state.money),
    missionIndex: state.missionIndex,
    missionsDone: state.missionsDone,
    storyComplete: state.storyComplete,
    kills: state.kills,
    hp: Math.round(state.player.hp),
    ammo: Math.round(state.player.ammo),
    x: Math.round(state.player.x),
    y: Math.round(state.player.y),
    playTime: Math.round(state.playTime),
  };
}

// Pour a save back into a live state. The player wakes up where she
// saved, with her cash, her progress and her health. If a story
// mission was in progress it restarts from its first objective.
export function applySave(state, save) {
  if (!save) return false;
  state.money = save.money;
  state.missionIndex = save.missionIndex;
  state.missionsDone = save.missionsDone;
  state.storyComplete = !!save.storyComplete;
  state.kills = save.kills || 0;
  state.playTime = save.playTime || 0;
  state.player.hp = save.hp;
  state.player.ammo = save.ammo;
  state.player.x = save.x;
  state.player.y = save.y;
  state.player.inCar = false;
  state.player.car = null;
  state.player.inBoat = false;
  state.player.boat = null;
  state.wanted = 0;
  state.wasted = false;
  state.busted = false;
  state.mission = null;
  if (!state.storyComplete && save.missionIndex < 12) {
    startMission(state, save.missionIndex);
  }
  return true;
}

function storage() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
}

// Write the current game to localStorage. Returns true on success,
// false when there is no storage (headless runs, private mode).
export function saveGame(state) {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, JSON.stringify(saveSnapshot(state)));
    return true;
  } catch (err) {
    return false;
  }
}

// Read the save back, or null when there is none / it is corrupt.
export function loadSave() {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (typeof save !== 'object' || save === null) return null;
    if (typeof save.money !== 'number') return null;
    return save;
  } catch (err) {
    return null;
  }
}

// Delete the save slot.
export function clearSave() {
  const store = storage();
  if (!store) return false;
  try {
    store.removeItem(SAVE_KEY);
    return true;
  } catch (err) {
    return false;
  }
}

// One line for the Continue button:
// '$1,234  •  3 missions done  •  2:05 played'. '' when no save.
export function saveInfoText(save) {
  if (!save) return '';
  const done = save.missionsDone || 0;
  const noun = done === 1 ? 'mission done' : 'missions done';
  return formatMoney(save.money) + '  •  ' + done + ' ' + noun
    + '  •  ' + formatTime(save.playTime || 0) + ' played';
}

// Convenience: the player's starting ammo, so new games and
// respawns agree on the number.
export function startingAmmo() {
  return PLAYER.startAmmo;
}
