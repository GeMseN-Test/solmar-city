// missions4.js — Solmar City story missions M11–M12 (the finale).
// Written from the attempt-3 spec only. Appended to MISSIONS by
// registerMissions4() (idempotent — safe to call twice).
// M12 is the last mission: completing it sets storyComplete.

import { MISSIONS } from './missions.js';

const EXTRA = [
  {
    id: 'm11-midnight-run',
    title: 'Midnight Run',
    briefing: 'One more night on the water. Rats at the Docks, then the Island.',
    reward: 3000,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Go to the Solmar Docks' },
      { kind: 'defeat', count: 4, text: 'Defeat 4 Harbor Rats' },
      { kind: 'reach', key: 'marina', text: 'Run to the Marina' },
      { kind: 'board', text: 'Board a boat (press E next to one)' },
      { kind: 'reach', key: 'island', radius: 130, text: 'Sail to Gull Island' },
    ],
  },
  {
    id: 'm12-solmar-crown',
    title: 'The Solmar Crown',
    briefing: 'The crown job. Bank, vault, six guards — then home a legend.',
    reward: 10000,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Go to the Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault (press E at the bank)' },
      { kind: 'defeat', count: 6, text: 'Defeat 6 guards' },
      { kind: 'escape', key: 'safehouse', text: "Escape to Mara's Safehouse" },
      { kind: 'reach', key: 'garage', text: "Finish at Ray's Garage" },
    ],
  },
];

let registered = false;

export function registerMissions4() {
  if (registered) return;
  registered = true;
  for (const def of EXTRA) {
    if (!MISSIONS.some((m) => m.id === def.id)) MISSIONS.push(def);
  }
}
