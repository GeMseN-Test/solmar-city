// missions3.js — Solmar City story missions M9–M10.
// Written from the v2-retry spec only. Appended to MISSIONS by
// registerMissions3() (idempotent — safe to call twice).

import { MISSIONS } from './missions.js';

const EXTRA = [
  {
    id: 'm9-night-shift',
    title: 'Night Shift at the Docks',
    briefing: 'Harbor Rats own the Docks after dark. Clear them, then sail out.',
    reward: 1500,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Go to the Solmar Docks' },
      { kind: 'defeat', count: 4, text: 'Defeat 4 Harbor Rats' },
      { kind: 'board', text: 'Board a boat (press E next to one)' },
      { kind: 'reach', key: 'island', radius: 130, text: 'Sail to Gull Island' },
      { kind: 'reach', key: 'marina', text: 'Sail back to the Marina' },
    ],
  },
  {
    id: 'm10-king-of-solmar',
    title: 'King of Solmar',
    briefing: 'The Vipers, the Bank, one crown. Take it all.',
    reward: 7500,
    objectives: [
      { kind: 'reach', key: 'turf', text: "Go to the Vipers' Turf" },
      { kind: 'defeat', count: 6, text: 'Defeat 6 Vipers' },
      { kind: 'reach', key: 'bank', text: 'Go to the Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault (press E at the bank)' },
      { kind: 'escape', key: 'safehouse', text: "Escape to Mara's Safehouse" },
    ],
  },
];

let registered = false;

export function registerMissions3() {
  if (registered) return;
  registered = true;
  for (const def of EXTRA) {
    if (!MISSIONS.some((m) => m.id === def.id)) MISSIONS.push(def);
  }
}
