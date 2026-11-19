// Solmar City — v2-retry story missions M9–M10.
//
// M9 "Night Shift at the Docks" ($1,500): docks -> defeat 4 Harbor Rats
//   -> board a boat -> island -> marina.
// M10 "King of Solmar" ($7,500): turf -> defeat 6 Vipers -> bank ->
//   grab the vault (4 stars) -> escape to the safehouse.
//
// Uses only proven objective kinds (reach / defeat / board / interact /
// escape). Gang spawns are handled by startMission in missions.js — the
// gang appears around the mission's first reach landmark.

import { MISSIONS, registerMission } from './missions.js';

const MISSIONS3 = [
  {
    id: 'M9',
    title: 'Night Shift at the Docks',
    briefing:
      'The Harbor Rats own the Docks after dark. Clear 4 of them out, take a boat across to Gull Island, then dock at the Marina.',
    reward: 1500,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach Solmar Docks' },
      { kind: 'defeat', count: 4, text: 'Defeat 4 Harbor Rats' },
      { kind: 'board', text: 'Board a boat' },
      { kind: 'reach', key: 'island', text: 'Reach Gull Island' },
      { kind: 'reach', key: 'marina', text: 'Reach Solmar Marina' },
    ],
  },
  {
    id: 'M10',
    title: 'King of Solmar',
    briefing:
      'Take the crown. Clear 6 Vipers off your turf, hit the Bank vault, and escape to the Safehouse as the king of this city.',
    reward: 7500,
    objectives: [
      { kind: 'reach', key: 'turf', text: "Reach Vipers' Turf" },
      { kind: 'defeat', count: 6, text: 'Defeat 6 Vipers' },
      { kind: 'reach', key: 'bank', text: 'Reach Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault (4 stars!)' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to the Safehouse' },
    ],
  },
];

// Append M9–M10 to MISSIONS. Idempotent — safe to call more than once.
export function registerMissions3() {
  let added = 0;
  for (const def of MISSIONS3) {
    if (registerMission(def)) added += 1;
  }
  return added;
}

export { MISSIONS };
