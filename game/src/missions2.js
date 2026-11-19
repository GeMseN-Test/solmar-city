// Solmar City — v2 story missions M6–M8.
//
// M6 "Harbor Lights" ($900): docks -> board a boat -> Gull Island -> marina.
// M7 "On Air" ($1,200): radio tower -> defeat 3 Static Boys -> safehouse.
// M8 "The Grand Finale" ($5,000): bank -> grab the vault (4 stars) ->
//   defeat 6 guards -> escape to the safehouse.
//
// Uses only proven objective kinds (reach / board / defeat / interact /
// escape). The gang for a "defeat" step spawns around the mission's first
// reach landmark — that is handled by startMission in missions.js, so
// setupV2Mission below is just the small named helper the spec asks for.

import { MISSIONS, registerMission, landmark } from './missions.js';
import * as Combat from './combat.js';

const V2_MISSIONS = [
  {
    id: 'M6',
    title: 'Harbor Lights',
    briefing:
      'Night run on the water. Get to the Docks, board a boat, cross to Gull Island, then bring her home to the Marina.',
    reward: 900,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach Solmar Docks' },
      { kind: 'board', text: 'Board a boat' },
      { kind: 'reach', key: 'island', text: 'Reach Gull Island' },
      { kind: 'reach', key: 'marina', text: 'Reach Solmar Marina' },
    ],
  },
  {
    id: 'M7',
    title: 'On Air',
    briefing:
      'Somebody is jamming Solmar Radio. Get to the tower, shut down 3 Static Boys, then get back to the Safehouse.',
    reward: 1200,
    objectives: [
      { kind: 'reach', key: 'radio', text: 'Reach Solmar Radio tower' },
      { kind: 'defeat', count: 3, text: 'Defeat 3 Static Boys' },
      { kind: 'reach', key: 'safehouse', text: "Reach Mara's Safehouse" },
    ],
  },
  {
    id: 'M8',
    title: 'The Grand Finale',
    briefing:
      'The last job. Hit the Grand Solmar Bank, grab the vault, put down 6 guards, and escape to the Safehouse. Story ends here.',
    reward: 5000,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Reach Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault (4 stars!)' },
      { kind: 'defeat', count: 6, text: 'Defeat 6 guards' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to the Safehouse' },
    ],
  },
];

// Append M6–M8 to MISSIONS. Idempotent — safe to call more than once.
export function registerStoryMissions() {
  let added = 0;
  for (const def of V2_MISSIONS) {
    if (registerMission(def)) added += 1;
  }
  return added;
}

// Set up the v2-specific bits of a mission: spawn the gang for M7/M8
// around the mission's first reach landmark. startMission already does
// this through the generic rule; this helper exists so the wiring stays
// explicit and testable on its own.
export function setupV2Mission(state, def) {
  if (!state || !def) return false;
  const defeat = def.objectives.find((o) => o.kind === 'defeat');
  if (!defeat) return false;
  const firstReach = def.objectives.find((o) => o.kind === 'reach');
  if (!firstReach) return false;
  const lm = landmark(state, firstReach.key);
  if (!lm) return false;
  if (typeof Combat.spawnGang === 'function') {
    Combat.spawnGang(state, lm.x, lm.y, defeat.count || 3);
    return true;
  }
  if (state.combat && typeof state.combat.spawnGang === 'function') {
    state.combat.spawnGang(state, lm.x, lm.y, defeat.count || 3);
    return true;
  }
  return false;
}

export { MISSIONS };
