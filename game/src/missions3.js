// missions3.js — Solmar City story missions M9–M10.
// Written from the v2-retry spec only. Uses only proven objective kinds.
import { MISSIONS, spawnMissionGang } from './missions.js';

const V3_MISSIONS = [
  {
    id: 'm9',
    title: 'Night Shift at the Docks',
    briefing: 'The Harbor Rats own the night docks. Clear them out, then sail the island run.',
    reward: 1500,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach the Solmar Docks' },
      { kind: 'defeat', count: 4, text: 'Defeat 4 Harbor Rats' },
      { kind: 'board', text: 'Board a boat (press E near one)' },
      { kind: 'reach', key: 'island', text: 'Reach Gull Island' },
      { kind: 'reach', key: 'marina', text: 'Reach the Solmar Marina' },
    ],
  },
  {
    id: 'm10',
    title: 'King of Solmar',
    briefing: 'Take the turf, rob the bank, vanish. That is how you become king.',
    reward: 7500,
    objectives: [
      { kind: 'reach', key: 'turf', text: 'Reach the Vipers\' Turf' },
      { kind: 'defeat', count: 6, text: 'Defeat 6 Vipers' },
      { kind: 'reach', key: 'bank', text: 'Reach the Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault (press E at the bank)' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to Mara\'s Safehouse' },
    ],
  },
];

// Idempotent: appends M9–M10 once, even if called again.
export function registerStoryMissions() {
  for (const def of V3_MISSIONS) {
    if (!MISSIONS.some((m) => m.id === def.id)) MISSIONS.push(def);
  }
  return MISSIONS;
}

// Same gang-spawn contract as missions2: defeat gang spawns around the
// mission's first reach landmark when the mission starts.
export function setupV2Mission(state, def) {
  return spawnMissionGang(state, def);
}
