// missions4.js — Solmar City story missions M11–M12 (the finale).
// Written from the attempt-3 spec only. Uses only proven objective kinds.
import { MISSIONS, spawnMissionGang } from './missions.js';

const V4_MISSIONS = [
  {
    id: 'm11',
    title: 'Midnight Run',
    briefing: 'One last harbor run after midnight: clear the Rats, sail the island.',
    reward: 3000,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach the Solmar Docks' },
      { kind: 'defeat', count: 4, text: 'Defeat 4 Harbor Rats' },
      { kind: 'reach', key: 'marina', text: 'Reach the Solmar Marina' },
      { kind: 'board', text: 'Board a boat (press E near one)' },
      { kind: 'reach', key: 'island', text: 'Reach Gull Island' },
    ],
  },
  {
    id: 'm12',
    title: 'The Solmar Crown',
    briefing: 'The bank. The vault. Six guards. Then home to the garage — a legend.',
    reward: 10000,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Reach the Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault (press E at the bank)' },
      { kind: 'defeat', count: 6, text: 'Defeat 6 guards' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to Mara\'s Safehouse' },
      { kind: 'reach', key: 'garage', text: 'Reach Ray\'s Garage' },
    ],
  },
];

// Idempotent: appends M11–M12 once, even if called again.
export function registerStoryMissions() {
  for (const def of V4_MISSIONS) {
    if (!MISSIONS.some((m) => m.id === def.id)) MISSIONS.push(def);
  }
  return MISSIONS;
}

// Same gang-spawn contract as missions2/3.
export function setupV2Mission(state, def) {
  return spawnMissionGang(state, def);
}
