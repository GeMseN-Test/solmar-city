// missions3.js — Story missions M9–M10 (v2 retry).
//
// M9 "Night Shift at the Docks" ($1,500): reach the docks, defeat 4
// Harbor Rats who spawn at the docks, board a boat, cross to Gull
// Island, then reach the marina.
// M10 "King of Solmar" ($7,500): reach the Vipers' turf, defeat 6
// Vipers who spawn at the turf, reach the bank, grab the vault
// (4 stars), escape to the safehouse.
//
// Both missions use only proven objective kinds: reach / defeat /
// board / interact / escape. The defeat gang spawns around the
// mission's first reach landmark via the shared helper.

import { MISSIONS, spawnDefeatGang } from './missions.js';

const NIGHT_MISSIONS = [
  {
    id: 'night-shift-docks',
    title: 'Night Shift at the Docks',
    briefing: 'Harbor Rats run the docks after dark. Clear them out, take a boat, and run the island route.',
    reward: 1500,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach the Solmar Docks' },
      { kind: 'defeat', count: 4, text: 'Defeat 4 Harbor Rats' },
      { kind: 'board', text: 'Board a boat' },
      { kind: 'reach', key: 'island', text: 'Reach Gull Island' },
      { kind: 'reach', key: 'marina', text: 'Reach the Solmar Marina' },
    ],
  },
  {
    id: 'king-of-solmar',
    title: 'King of Solmar',
    briefing: 'The Vipers want their turf back and the bank wants its money. Take both, then walk away king.',
    reward: 7500,
    objectives: [
      { kind: 'reach', key: 'turf', text: "Reach the Vipers' Turf" },
      { kind: 'defeat', count: 6, text: 'Defeat 6 Vipers' },
      { kind: 'reach', key: 'bank', text: 'Reach the Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault' },
      { kind: 'escape', key: 'safehouse', text: "Escape to Mara's Safehouse" },
    ],
  },
];

// Idempotent: safe to call twice, the missions are appended once.
export function registerNightMissions() {
  for (const def of NIGHT_MISSIONS) {
    if (!MISSIONS.some((m) => m.id === def.id)) MISSIONS.push(def);
  }
}

// Gang spawn for a night mission (M9: 4 at the docks; M10: 6 at the
// turf). Guarded — never spawns twice for the same mission run.
export function setupNightMission(state, def) {
  spawnDefeatGang(state, def);
}
