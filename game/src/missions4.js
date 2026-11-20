// Solmar City — attempt-3 story missions, M11–M12. Appended to the
// shared MISSIONS list by registerMissions4() (idempotent; world.js
// calls it after registerMissions3). Only proven objective kinds:
// reach / defeat / board / interact / escape.
//
// M11 'Midnight Run' ($3,000): reach the docks, take down 4 Harbor
// Rats, reach the Marina, board a boat, reach Gull Island.
// M12 'The Solmar Crown' ($10,000): reach the bank, grab the vault
// (4 stars), defeat 6 guards, escape to the Safehouse, reach Ray's
// Garage. The story ends here — storyComplete turns true after M12.

import { registerMissions } from './missions.js';

const ATTEMPT3_MISSIONS = [
  {
    id: 'midnight-run',
    title: 'Midnight Run',
    briefing: 'A midnight run across the harbor: clear the docks, grab a boat at the Marina, and vanish to Gull Island.',
    reward: 3000,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach Solmar Docks' },
      { kind: 'defeat', count: 4, text: 'Take down 4 Harbor Rats' },
      { kind: 'reach', key: 'marina', text: 'Reach Solmar Marina' },
      { kind: 'board', text: 'Board a boat' },
      { kind: 'reach', key: 'island', text: 'Reach Gull Island' },
    ],
  },
  {
    id: 'solmar-crown',
    title: 'The Solmar Crown',
    briefing: 'The crown job: the bank vault, six guards, and a getaway to the garage. Finish this and Solmar is yours.',
    reward: 10000,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Reach Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault' },
      { kind: 'defeat', count: 6, text: 'Defeat 6 guards' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to the Safehouse' },
      { kind: 'reach', key: 'garage', text: "Reach Ray's Garage" },
    ],
  },
];

let registered = false;

// Append M11–M12 to MISSIONS. Safe to call more than once.
export function registerMissions4() {
  if (registered) return;
  registered = true;
  registerMissions(ATTEMPT3_MISSIONS);
}
