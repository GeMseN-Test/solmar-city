// missions4.js — Story missions M11–M12 (attempt 3): the finale.
//
// M11 "Midnight Run" ($3,000): reach the docks, defeat 4 Harbor Rats
// who spawn at the docks, reach the marina, board a boat, cross to
// Gull Island.
// M12 "The Solmar Crown" ($10,000): reach the bank, grab the vault
// (4 stars), defeat 6 guards who spawn at the bank, escape to the
// safehouse, then reach the garage. The story ends here —
// storyComplete becomes true when M12 pays out.
//
// Both missions use only proven objective kinds: reach / defeat /
// board / interact / escape. The defeat gang spawns around the
// mission's first reach landmark via the shared helper. Note M12's
// defeat objective comes AFTER the vault grab: updateMission spawns
// the gang when the defeat objective becomes current.

import { MISSIONS, spawnDefeatGang } from './missions.js';

const FINAL_MISSIONS = [
  {
    id: 'midnight-run',
    title: 'Midnight Run',
    briefing: 'One more island run, and this time the Rats are waiting. Clear the docks and sail out under the moon.',
    reward: 3000,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach the Solmar Docks' },
      { kind: 'defeat', count: 4, text: 'Defeat 4 Harbor Rats' },
      { kind: 'reach', key: 'marina', text: 'Reach the Solmar Marina' },
      { kind: 'board', text: 'Board a boat' },
      { kind: 'reach', key: 'island', text: 'Reach Gull Island' },
    ],
  },
  {
    id: 'solmar-crown',
    title: 'The Solmar Crown',
    briefing: 'The crown job. Empty the bank, drop six guards, lose the city, and park the getaway car at Ray\'s. Do this and Solmar is yours.',
    reward: 10000,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Reach the Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault' },
      { kind: 'defeat', count: 6, text: 'Defeat 6 guards' },
      { kind: 'escape', key: 'safehouse', text: "Escape to Mara's Safehouse" },
      { kind: 'reach', key: 'garage', text: "Reach Ray's Garage" },
    ],
  },
];

// Idempotent: safe to call twice, the missions are appended once.
export function registerFinalMissions() {
  for (const def of FINAL_MISSIONS) {
    if (!MISSIONS.some((m) => m.id === def.id)) MISSIONS.push(def);
  }
}

// Gang spawn for a final mission (M11: 4 at the docks; M12: 6 at the
// bank). Guarded — never spawns twice for the same mission run.
export function setupFinalMission(state, def) {
  spawnDefeatGang(state, def);
}
