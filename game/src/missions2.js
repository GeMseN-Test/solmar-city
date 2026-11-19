// missions2.js — story missions M6–M8 (the v2 batch).
// Appended to MISSIONS by registerStoryMissions(). Idempotent: calling it
// twice adds nothing the second time. Uses only the objective kinds the
// engine in missions.js already knows.

import { MISSIONS } from './missions.js';
import { spawnGang } from './combat.js';

const EXTRA = [
  {
    id: 'm6-harbor-lights',
    title: 'Harbor Lights',
    briefing: 'A boat is waiting at the Docks. Sail her out to Gull Island, then bring her home to the Marina.',
    reward: 900,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Go to the Solmar Docks' },
      { kind: 'board', text: 'Board a boat (walk up to one and press E)' },
      { kind: 'reach', key: 'island', text: 'Sail to Gull Island' },
      { kind: 'reach', key: 'marina', text: 'Dock at the Solmar Marina' },
    ],
  },
  {
    id: 'm7-on-air',
    title: 'On Air',
    briefing: 'Static Boys took over Solmar Radio. Take the tower back, then lay low at the Safehouse.',
    reward: 1200,
    objectives: [
      { kind: 'reach', key: 'radio', text: 'Go to the Solmar Radio tower' },
      { kind: 'defeat', count: 3, text: 'Defeat 3 Static Boys' },
      { kind: 'reach', key: 'safehouse', text: 'Get back to the Safehouse' },
    ],
  },
  {
    id: 'm8-grand-finale',
    title: 'The Grand Finale',
    briefing: 'One last bank job, done loud. Grab the vault, drop six guards, and disappear.',
    reward: 5000,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Go to the Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault (press E at the bank)' },
      { kind: 'defeat', count: 6, text: 'Defeat 6 guards' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to the Safehouse' },
    ],
  },
];

export function registerStoryMissions() {
  for (const def of EXTRA) {
    if (!MISSIONS.some((m) => m.id === def.id)) MISSIONS.push(def);
  }
  return MISSIONS.length;
}

// Gang setup for M7/M8, kept as its own call so the wiring stays obvious:
// startMission in missions.js already spawns from the same table, this is
// the v2-named entry point for the two missions that introduced it.
export function setupV2Mission(state, def) {
  const table = {
    'm7-on-air': { key: 'radio', count: 3 },
    'm8-grand-finale': { key: 'bank', count: 6 },
  };
  const spawn = table[def.id];
  if (!spawn) return false;
  const lm = state.city && state.city.landmarks ? state.city.landmarks[spawn.key] : null;
  if (!lm) return false;
  const x = typeof lm.x === 'number' ? lm.x : lm[0];
  const y = typeof lm.y === 'number' ? lm.y : lm[1];
  spawnGang(state, x, y, spawn.count);
  return true;
}
