// missions3.js — story missions M9–M10 (the v2-retry batch).
// Same pattern as missions2.js: append to MISSIONS, idempotent, only
// proven objective kinds (reach / defeat / board / interact / escape).

import { MISSIONS } from './missions.js';

const EXTRA = [
  {
    id: 'm9-night-shift',
    title: 'Night Shift at the Docks',
    briefing: 'Harbor Rats run the Docks after dark. Clear them out, take a boat, and run the island loop.',
    reward: 1500,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Go to the Solmar Docks' },
      { kind: 'defeat', count: 4, text: 'Defeat 4 Harbor Rats' },
      { kind: 'board', text: 'Board a boat (walk up to one and press E)' },
      { kind: 'reach', key: 'island', text: 'Sail to Gull Island' },
      { kind: 'reach', key: 'marina', text: 'Dock at the Solmar Marina' },
    ],
  },
  {
    id: 'm10-king-of-solmar',
    title: 'King of Solmar',
    briefing: 'The Vipers want their turf back and the bank wants its vault kept. Take both, then walk away clean.',
    reward: 7500,
    objectives: [
      { kind: 'reach', key: 'turf', text: 'Go to the Vipers\u2019 Turf' },
      { kind: 'defeat', count: 6, text: 'Defeat 6 Vipers' },
      { kind: 'reach', key: 'bank', text: 'Go to the Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault (press E at the bank)' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to the Safehouse' },
    ],
  },
];

export function registerMissions3() {
  for (const def of EXTRA) {
    if (!MISSIONS.some((m) => m.id === def.id)) MISSIONS.push(def);
  }
  return MISSIONS.length;
}
