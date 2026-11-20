// save.js — save / load for Solmar City.
// The snapshot is a small plain object so it survives JSON round-trips
// and so the HUD can describe it in one line. Saving needs `window`
// (localStorage); every function degrades gracefully without it.

import { SAVE_KEY } from './config.js';
import { formatMoney, formatMS } from './util.js';

// Capture everything needed to resume a run: where the player is, how
// much money they have, how far through the story they are.
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

// Restore a snapshot onto a live state. Only fields present in the
// save are applied; the world itself (city, traffic, ...) is rebuilt
// from the seed by the caller before this runs.
export function applySave(state, save) {
  if (!state || !save) return false;
  if (save.seed != null) state.seed = save.seed;
  if (save.money != null) state.money = save.money;
  if (save.missionIndex != null) state.missionIndex = save.missionIndex;
  if (save.missionsDone != null) state.missionsDone = save.missionsDone;
  if (save.storyComplete != null) state.storyComplete = !!save.storyComplete;
  if (save.kills != null) state.kills = save.kills;
  if (save.playTime != null) state.playTime = save.playTime;
  const p = state.player || (state.player = {});
  if (save.hp != null) p.hp = save.hp;
  if (save.ammo != null) p.ammo = save.ammo;
  if (save.x != null) p.x = save.x;
  if (save.y != null) p.y = save.y;
  // A loaded player always starts on foot, healthy enough to play.
  p.inCar = false;
  p.car = null;
  p.inBoat = false;
  p.boat = null;
  p.invuln = 1;
  return true;
}

// Write the current state to localStorage. Returns true on success,
// false when there is no window/storage or the write throws.
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

// Read the saved snapshot back, or null when there is none / it is
// corrupt / storage is unavailable.
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

// Delete the save slot. Returns true when the key is gone afterwards.
export function clearSave() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.removeItem(SAVE_KEY);
    return true;
  } catch (e) {
    return false;
  }
}

// One-line HUD/menu description of a save, e.g.
// "$1,234  •  3 missions done  •  2:05 played". Empty string for null.
export function saveInfoText(save) {
  if (!save) return '';
  const money = formatMoney(save.money || 0);
  const missions = save.missionsDone || 0;
  const played = formatMS(save.playTime || 0);
  return `${money}  •  ${missions} mission${missions === 1 ? '' : 's'} done  •  ${played} played`;
}

// Alias used by some callers.
export const saveInfo = saveInfoText;

export default {
  saveSnapshot,
  applySave,
  saveGame,
  loadSave,
  clearSave,
  saveInfoText,
};
