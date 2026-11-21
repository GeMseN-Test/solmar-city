// missions2.js — Solmar City story missions M6–M8.
// Written from the v2 spec only. Uses only proven objective kinds.
import { MISSIONS, spawnMissionGang } from './missions.js';

const V2_MISSIONS = [
  {
    id: 'm6',
    title: 'Harbor Lights',
    briefing: 'Sail the harbor at night: Docks, out to Gull Island, home to the Marina.',
    reward: 900,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach the Solmar Docks' },
      { kind: 'board', text: 'Board a boat (press E near one)' },
      { kind: 'reach', key: 'island', text: 'Reach Gull Island' },
      { kind: 'reach', key: 'marina', text: 'Reach the Solmar Marina' },
    ],
  },
  {
    id: 'm7',
    title: 'On Air',
    briefing: 'The Static Boys run pirate radio from the tower. Shut them down.',
    reward: 1200,
    objectives: [
      { kind: 'reach', key: 'radio', text: 'Reach Solmar Radio tower' },
      { kind: 'defeat', count: 3, text: 'Defeat 3 Static Boys' },
      { kind: 'reach', key: 'safehouse', text: 'Reach Mara\'s Safehouse' },
    ],
  },
  {
    id: 'm8',
    title: 'The Grand Finale',
    briefing: 'The bank, the vault, six guards, and one clean getaway. The big one.',
    reward: 5000,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Reach the Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault (press E at the bank)' },
      { kind: 'defeat', count: 6, text: 'Defeat 6 guards' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to Mara\'s Safehouse' },
    ],
  },
];

// Idempotent: appends M6–M8 once, even if called again.
export function registerStoryMissions() {
  for (const def of V2_MISSIONS) {
    if (!MISSIONS.some((m) => m.id === def.id)) MISSIONS.push(def);
  }
  return MISSIONS;
}

// Gang spawn for M7/M8 (and any later mission with a defeat objective):
// the gang spawns around the mission's first reach landmark when it starts.
export function setupV2Mission(state, def) {
  return spawnMissionGang(state, def);
}
