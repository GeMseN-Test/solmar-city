// missions2.js — Story missions M6–M8 (v2): the harbor arc.
//
// M6 "Harbor Lights" ($900): reach the docks, board a boat, cross to
// Gull Island, then reach the marina. Uses the 'board' objective kind.
// M7 "On Air" ($1,200): reach the Solmar Radio tower, defeat 3 Static
// Boys who spawn at the tower, then reach the safehouse.
// M8 "The Grand Finale" ($5,000): reach the bank, grab the vault
// (4 stars), defeat 6 guards, escape to the safehouse.
//
// New landmarks these missions need live in city.js: radio
// (2520,130) "Solmar Radio" and island (1440,2130) "Gull Island".

import { MISSIONS, spawnDefeatGang } from './missions.js';

const V2_MISSIONS = [
  {
    id: 'harbor-lights',
    title: 'Harbor Lights',
    briefing: 'A package is waiting on Gull Island. Take a boat from the docks and bring it back to the marina.',
    reward: 900,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach the Solmar Docks' },
      { kind: 'board', text: 'Board a boat' },
      { kind: 'reach', key: 'island', text: 'Reach Gull Island' },
      { kind: 'reach', key: 'marina', text: 'Reach the Solmar Marina' },
    ],
  },
  {
    id: 'on-air',
    title: 'On Air',
    briefing: 'The Static Boys took over Solmar Radio. Clear the tower, then get home before they regroup.',
    reward: 1200,
    objectives: [
      { kind: 'reach', key: 'radio', text: 'Reach the Solmar Radio tower' },
      { kind: 'defeat', count: 3, text: 'Defeat 3 Static Boys' },
      { kind: 'reach', key: 'safehouse', text: "Reach Mara's Safehouse" },
    ],
  },
  {
    id: 'grand-finale',
    title: 'The Grand Finale',
    briefing: 'One last score. Empty the Grand Solmar Bank vault, drop the guards, and disappear.',
    reward: 5000,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Reach the Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault' },
      { kind: 'defeat', count: 6, text: 'Defeat 6 guards' },
      { kind: 'escape', key: 'safehouse', text: "Escape to Mara's Safehouse" },
    ],
  },
];

// Idempotent: safe to call twice, the missions are appended once.
export function registerStoryMissions() {
  for (const def of V2_MISSIONS) {
    if (!MISSIONS.some((m) => m.id === def.id)) MISSIONS.push(def);
  }
}

// Gang spawn for a v2 mission: the defeat objective's gang spawns
// around the mission's first reach landmark (M7: 3 at the radio
// tower; M8: 6 at the bank). Same guarded helper missions.js uses,
// so calling this and startMission can never double-spawn.
export function setupV2Mission(state, def) {
  spawnDefeatGang(state, def);
}
