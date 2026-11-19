// Solmar City — attempt-3 story missions M11–M12 (the finale).
//
// M11 "Midnight Run" ($3,000): docks -> defeat 4 Harbor Rats -> marina
//   -> board a boat -> island.
// M12 "The Solmar Crown" ($10,000): bank -> grab the vault (4 stars) ->
//   defeat 6 guards -> escape to the safehouse -> reach the garage.
//   Story ends here; storyComplete becomes true after M12.
//
// Uses only proven objective kinds (reach / defeat / board / interact /
// escape). Gang spawns are handled by startMission in missions.js — the
// gang appears around the mission's first reach landmark (docks for M11,
// bank for M12).

import { MISSIONS, registerMission } from './missions.js';

const MISSIONS4 = [
  {
    id: 'M11',
    title: 'Midnight Run',
    briefing:
      'One last night run. Clear 4 Harbor Rats off the Docks, swing by the Marina, take a boat out, and finish on Gull Island.',
    reward: 3000,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach Solmar Docks' },
      { kind: 'defeat', count: 4, text: 'Defeat 4 Harbor Rats' },
      { kind: 'reach', key: 'marina', text: 'Reach Solmar Marina' },
      { kind: 'board', text: 'Board a boat' },
      { kind: 'reach', key: 'island', text: 'Reach Gull Island' },
    ],
  },
  {
    id: 'M12',
    title: 'The Solmar Crown',
    briefing:
      'The crown itself. Rob the Grand Solmar Bank, put down 6 guards, escape to the Safehouse, then drive home to the Garage a legend.',
    reward: 10000,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Reach Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault (4 stars!)' },
      { kind: 'defeat', count: 6, text: 'Defeat 6 guards' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to the Safehouse' },
      { kind: 'reach', key: 'garage', text: "Reach Ray's Garage" },
    ],
  },
];

// Append M11–M12 to MISSIONS. Idempotent — safe to call more than once.
export function registerMissions4() {
  let added = 0;
  for (const def of MISSIONS4) {
    if (registerMission(def)) added += 1;
  }
  return added;
}

export { MISSIONS };
