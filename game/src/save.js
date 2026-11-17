// Saving Solmar City to the browser's localStorage: one slot, written on
// every mission payout and whenever the player quits to the title. A save
// holds the money, the mission, the health and ammo, and where Mara stood.
// Loading one restarts the current mission from its first objective — the
// city is too big to freeze mid-chase.

import { SAVE_KEY } from './config.js';
import { saveSnapshot } from './world.js';

/** Read the save slot, or null when there is none or it is unreadable. */
export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (typeof save !== 'object' || save === null) return null;
    if (typeof save.money !== 'number' || typeof save.missionIndex !== 'number') return null;
    return save;
  } catch {
    return null;
  }
}

export function saveGame(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(saveSnapshot(state)));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off (private windows): the game still plays.
  }
}

/** One line about a save for the title screen, e.g. "$1,250 • 2 missions • 12:34 played". */
export function saveInfoText(save) {
  if (!save) return '';
  const minutes = Math.floor((save.playTime ?? 0) / 60);
  const seconds = String(Math.floor((save.playTime ?? 0) % 60)).padStart(2, '0');
  const missions = save.storyComplete ? 'story complete' : `${save.missionsDone ?? 0} missions done`;
  return `$${(save.money ?? 0).toLocaleString('en-US')}  •  ${missions}  •  ${minutes}:${seconds} played`;
}
