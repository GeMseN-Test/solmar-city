// missions2.js — Solmar City story missions M6–M8.
// Written from the v2 spec only. Appended to MISSIONS by
// registerStoryMissions() (idempotent — safe to call twice).

import { MISSIONS, spawnMissionGang } from './missions.js';

const EXTRA = [
  {
    id: 'm6-harbor-lights',
    title: 'Harbor Lights',
    briefing: 'Take a boat out. Docks, Gull Island, then home to the Marina.',
    reward: 900,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Go to the Solmar Docks' },
      { kind: 'board', text: 'Board a boat (press E next to one)' },
      { kind: 'reach', key: 'island', radius: 130, text: 'Sail to Gull Island' },
      { kind: 'reach', key: 'marina', text: 'Sail back to the Marina' },
    ],
  },
  {
    id: 'm7-on-air',
    title: 'On Air',
    briefing: 'Static Boys took the radio tower. Clear them out, then get home.',
    reward: 1200,
    objectives: [
      { kind: 'reach', key: 'radio', text: 'Go to the Solmar Radio tower' },
      { kind: 'defeat', count: 3, text: 'Defeat 3 Static Boys' },
      { kind: 'reach', key: 'safehouse', text: "Get back to Mara's Safehouse" },
    ],
  },
  {
    id: 'm8-grand-finale',
    title: 'The Grand Finale',
    briefing: 'One last bank job. Vault, six guards, and a clean getaway.',
    reward: 5000,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Go to the Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault (press E at the bank)' },
      { kind: 'defeat', count: 6, text: 'Defeat 6 guards' },
      { kind: 'escape', key: 'safehouse', text: "Escape to Mara's Safehouse" },
    ],
  },
];

let registered = false;

export function registerStoryMissions() {
  if (registered) return;
  registered = true;
  for (const def of EXTRA) {
    if (!MISSIONS.some((m) => m.id === def.id)) MISSIONS.push(def);
  }
}

// Gang spawn for M7/M8 (called by startMission via spawnMissionGang,
// kept as the named v2 API for the tower / bank spawns).
export function setupV2Mission(state, def) {
  spawnMissionGang(state, def);
}
