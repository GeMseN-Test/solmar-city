// Story missions M9-M10, appended to MISSIONS by registerMissions3().
// M9 works the docks at night; M10 is the fight for the whole city.
// Both use only proven objective kinds (reach / defeat / board /
// interact / escape) — the gang spawns come free from the missions.js
// engine, around each mission's first reach landmark.
import { MISSIONS } from './missions.js';

let registered = false;

const EXTRA = [
  {
    id: 'night-shift',
    title: 'Night Shift at the Docks',
    briefing: 'Harbor Rats moved into the docks after dark. Clear them out, then run the boat to the island.',
    reward: 1500,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach Solmar Docks' },
      { kind: 'defeat', count: 4, text: 'Defeat 4 Harbor Rats' },
      { kind: 'board', text: 'Board a boat' },
      { kind: 'reach', key: 'island', text: 'Reach Gull Island' },
      { kind: 'reach', key: 'marina', text: 'Reach Solmar Marina' },
    ],
  },
  {
    id: 'king-of-solmar',
    title: 'King of Solmar',
    briefing: 'Take the turf back from the Vipers, then hit the bank and vanish like a ghost.',
    reward: 7500,
    objectives: [
      { kind: 'reach', key: 'turf', text: "Reach Vipers' Turf" },
      { kind: 'defeat', count: 6, text: 'Defeat 6 Vipers' },
      { kind: 'reach', key: 'bank', text: 'Reach Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', level: 4, text: 'Grab the vault (4 stars)' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to the Safehouse' },
    ],
  },
];

// Idempotent: safe to call on every world reset.
export function registerMissions3() {
  if (registered) return;
  registered = true;
  for (const m of EXTRA) {
    if (!MISSIONS.find((x) => x.id === m.id)) MISSIONS.push(m);
  }
}
