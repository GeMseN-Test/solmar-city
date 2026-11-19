// missions4.js — story missions M11–M12 (the attempt-3 batch).
// The last two jobs. M12 pays $10,000 and ends the story: after it,
// storyComplete is true and Mara free-roams Solmar City.
// Same pattern as missions2/3.js: append to MISSIONS, idempotent, only
// proven objective kinds (reach / defeat / board / interact / escape).

import { MISSIONS } from './missions.js';

const EXTRA = [
  {
    id: 'm11-midnight-run',
    title: 'Midnight Run',
    briefing: 'One more night at the Docks. Clear the Rats, run the boat out to the island, and be gone before dawn.',
    reward: 3000,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Go to the Solmar Docks' },
      { kind: 'defeat', count: 4, text: 'Defeat 4 Harbor Rats' },
      { kind: 'reach', key: 'marina', text: 'Go to the Solmar Marina' },
      { kind: 'board', text: 'Board a boat (walk up to one and press E)' },
      { kind: 'reach', key: 'island', text: 'Sail to Gull Island' },
    ],
  },
  {
    id: 'm12-solmar-crown',
    title: 'The Solmar Crown',
    briefing: 'The crown job. Hit the bank, drop six guards, lose the whole city, and park it at Ray\u2019s. After this, Solmar is yours.',
    reward: 10000,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Go to the Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault (press E at the bank)' },
      { kind: 'defeat', count: 6, text: 'Defeat 6 guards' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to the Safehouse' },
      { kind: 'reach', key: 'garage', text: 'Park it at Ray\u2019s Garage' },
    ],
  },
];

export function registerMissions4() {
  for (const def of EXTRA) {
    if (!MISSIONS.some((m) => m.id === def.id)) MISSIONS.push(def);
  }
  return MISSIONS.length;
}
