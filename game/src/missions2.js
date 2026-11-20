// Solmar City — v2 story missions, M6–M8. Appended to the shared
// MISSIONS list by registerStoryMissions() (idempotent; world.js
// calls it once at load). These three missions use the new v2 toys:
// the boats (M6 boards one), the radio tower (M7), and a four-star
// bank vault with six guards (M8, the v2 finale).
//
// M6 'Harbor Lights' ($900): reach the docks, board a boat, sail to
// Gull Island, come back to the Marina. First use of the 'board'
// objective kind.
// M7 'On Air' ($1,200): reach Solmar Radio tower, take down the 3
// Static Boys who spawn there, get back to the Safehouse.
// M8 'The Grand Finale' ($5,000): reach the bank, grab the vault
// (4 stars), defeat 6 guards, escape to the Safehouse.

import { registerMissions } from './missions.js';
import { spawnMissionGang } from './missions.js';

const V2_MISSIONS = [
  {
    id: 'harbor-lights',
    title: 'Harbor Lights',
    briefing: 'Take a boat out from the docks, reach Gull Island, and bring her back to the Marina.',
    reward: 900,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach Solmar Docks' },
      { kind: 'board', text: 'Board a boat' },
      { kind: 'reach', key: 'island', text: 'Reach Gull Island' },
      { kind: 'reach', key: 'marina', text: 'Return to the Marina' },
    ],
  },
  {
    id: 'on-air',
    title: 'On Air',
    briefing: 'The Static Boys took over Solmar Radio. Clear the tower, then get home safe.',
    reward: 1200,
    objectives: [
      { kind: 'reach', key: 'radio', text: 'Reach Solmar Radio' },
      { kind: 'defeat', count: 3, text: 'Take down 3 Static Boys' },
      { kind: 'reach', key: 'safehouse', text: 'Reach the Safehouse' },
    ],
  },
  {
    id: 'grand-finale',
    title: 'The Grand Finale',
    briefing: 'The Grand Solmar Bank, one last time: vault, six guards, and a clean escape.',
    reward: 5000,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Reach Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault' },
      { kind: 'defeat', count: 6, text: 'Defeat 6 guards' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to the Safehouse' },
    ],
  },
];

let registered = false;

// Append M6–M8 to MISSIONS. Safe to call more than once.
export function registerStoryMissions() {
  if (registered) return;
  registered = true;
  registerMissions(V2_MISSIONS);
}

// Spawn the gang for a v2 defeat mission (M7 at the radio tower,
// M8 at the bank). Same helper the core startMission uses.
export function setupV2Mission(state, def) {
  const defeat = def.objectives.find((o) => o.kind === 'defeat');
  if (!defeat) return;
  spawnMissionGang(state, def, defeat);
}
