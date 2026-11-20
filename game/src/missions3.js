// Solmar City — v2-retry story missions, M9–M10. Appended to the
// shared MISSIONS list by registerMissions3() (idempotent; world.js
// calls it after registerStoryMissions). Only proven objective kinds
// are used: reach / defeat / board / interact / escape.
//
// M9 'Night Shift at the Docks' ($1,500): reach the docks, take down
// 4 Harbor Rats who spawn there, board a boat, reach Gull Island,
// come back to the Marina.
// M10 'King of Solmar' ($7,500): reach the turf, defeat 6 Vipers,
// reach the bank, grab the vault (4 stars), escape to the Safehouse.

import { registerMissions } from './missions.js';

const V2_RETRY_MISSIONS = [
  {
    id: 'night-shift',
    title: 'Night Shift at the Docks',
    briefing: 'The Harbor Rats own the docks after dark. Clear four of them, take a boat to Gull Island, and sail home.',
    reward: 1500,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach Solmar Docks' },
      { kind: 'defeat', count: 4, text: 'Take down 4 Harbor Rats' },
      { kind: 'board', text: 'Board a boat' },
      { kind: 'reach', key: 'island', text: 'Reach Gull Island' },
      { kind: 'reach', key: 'marina', text: 'Return to the Marina' },
    ],
  },
  {
    id: 'king-of-solmar',
    title: 'King of Solmar',
    briefing: 'Six Vipers on the turf, then the bank vault. Pull this off and the city is yours.',
    reward: 7500,
    objectives: [
      { kind: 'reach', key: 'turf', text: "Reach Vipers' Turf" },
      { kind: 'defeat', count: 6, text: 'Take down 6 Vipers' },
      { kind: 'reach', key: 'bank', text: 'Reach Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to the Safehouse' },
    ],
  },
];

let registered = false;

// Append M9–M10 to MISSIONS. Safe to call more than once.
export function registerMissions3() {
  if (registered) return;
  registered = true;
  registerMissions(V2_RETRY_MISSIONS);
}
