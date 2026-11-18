// save.js — Solmar City's save slot.
//
// The whole save is one small JSON object in localStorage (see
// world.js saveSnapshot for the fields). There is a single slot, keyed
// by SAVE_KEY, shared by New Game / Continue on the title screen.
//
// Everything here is defensive: on a server, in a test, or in a browser
// that blocks storage, the calls fail soft (false / null / '') instead
// of throwing and taking the game down with them.

import { SAVE_KEY } from './config.js';
import { saveSnapshot } from './world.js';

// True when the browser's localStorage is actually reachable. The game
// also runs headless in tests, where there is no window at all.
function storageAvailable() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

// Write the current game state to the save slot. Returns true when the
// save landed, false when there is nowhere to save to.
export function saveGame(state) {
  if (!storageAvailable()) return false;
  try {
    const data = saveSnapshot(state);
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

// Read the save slot back. Returns the save object, or null when there
// is no save yet (or the stored text is damaged).
export function loadSave() {
  if (!storageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

// Wipe the save slot, so the title screen offers New Game only.
export function clearSave() {
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // A blocked storage is already as good as empty.
  }
}

// One line for the Continue button: how much money, how many missions,
// how long played. Empty string when there is no save to describe.
export function saveInfoText(save) {
  if (!save) return '';
  const money = save.money ?? 0;
  const missions = save.missionsDone ?? 0;
  const playedSeconds = Math.max(0, Math.floor(save.playTime ?? 0));
  const minutes = Math.floor(playedSeconds / 60);
  const seconds = String(playedSeconds % 60).padStart(2, '0');
  const moneyText = Number(money).toLocaleString('en-US');
  return `$${moneyText}  •  ${missions} missions done  •  ${minutes}:${seconds} played`;
}
