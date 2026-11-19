// missions3.js — Solmar City story missions M9–M10 (v2 retry).
// Written from the v2 spec only. Appends to MISSIONS from missions.js.
import { MISSIONS, setupMissionGang } from './missions.js';

const EXTRA = [
  {
    id: 'M9',
    title: 'Night Shift at the Docks',
    briefing: 'The Harbor Rats own the docks after dark. Clear four of them out, take a boat to Gull Island, then dock at the marina.',
    reward: 1500,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach Solmar Docks' },
      { kind: 'defeat', count: 4, text: 'Defeat 4 Harbor Rats' },
      { kind: 'board', text: 'Board a boat (E near a boat)' },
      { kind: 'reach', key: 'island', text: 'Sail to Gull Island' },
      { kind: 'reach', key: 'marina', text: 'Dock at Solmar Marina' },
    ],
  },
  {
    id: 'M10',
    title: 'King of Solmar',
    briefing: 'Take the turf back from six Vipers, then hit the bank vault one more time and vanish to the safehouse. The city is yours.',
    reward: 7500,
    objectives: [
      { kind: 'reach', key: 'turf', text: "Reach Vipers' Turf" },
      { kind: 'defeat', count: 6, text: 'Defeat 6 Vipers' },
      { kind: 'reach', key: 'bank', text: 'Reach Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault (E at the bank)' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to the safehouse' },
    ],
  },
];

// Idempotent: safe to call on every world reset.
export function registerMissions3() {
  for (const m of EXTRA) {
    if (!MISSIONS.some((x) => x.id === m.id)) MISSIONS.push(m);
  }
  return MISSIONS;
}

// Spawn the defeat gang for an M9–M10 mission (guarded, see missions2).
export function setupV3Mission(state, def) {
  if (!def) return;
  setupMissionGang(state, def);
}
