// missions2.js — Solmar City story missions M6–M8 (v2).
// Written from the v2 spec only. Appends to MISSIONS from missions.js.
import { MISSIONS, setupMissionGang } from './missions.js';

const EXTRA = [
  {
    id: 'M6',
    title: 'Harbor Lights',
    briefing: 'Night run on the water. Get to the docks, take a boat out to Gull Island, then bring her home to the marina.',
    reward: 900,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach Solmar Docks' },
      { kind: 'board', text: 'Board a boat (E near a boat)' },
      { kind: 'reach', key: 'island', text: 'Sail to Gull Island' },
      { kind: 'reach', key: 'marina', text: 'Dock at Solmar Marina' },
    ],
  },
  {
    id: 'M7',
    title: 'On Air',
    briefing: 'The Static Boys took over Solmar Radio tower. Get up there, shut all three of them down, then get back to the safehouse.',
    reward: 1200,
    objectives: [
      { kind: 'reach', key: 'radio', text: 'Reach Solmar Radio tower' },
      { kind: 'defeat', count: 3, text: 'Defeat 3 Static Boys' },
      { kind: 'reach', key: 'safehouse', text: "Return to Mara's Safehouse" },
    ],
  },
  {
    id: 'M8',
    title: 'The Grand Finale',
    briefing: 'One last bank job, the biggest yet. Grab the vault, drop six guards, and disappear to the safehouse. Story ends here.',
    reward: 5000,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Reach Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault (E at the bank)' },
      { kind: 'defeat', count: 6, text: 'Defeat 6 guards' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to the safehouse' },
    ],
  },
];

// Idempotent: safe to call on every world reset.
export function registerStoryMissions() {
  for (const m of EXTRA) {
    if (!MISSIONS.some((x) => x.id === m.id)) MISSIONS.push(m);
  }
  return MISSIONS;
}

// Spawn the defeat gang for an M6–M8 mission (no-op if already spawned
// for this mission start — startMission already calls setupMissionGang).
export function setupV2Mission(state, def) {
  if (!def) return;
  setupMissionGang(state, def);
}
