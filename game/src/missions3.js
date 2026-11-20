// Solmar City — story missions M9–M10 (v2 retry).
// Written from v2-spec.md only. Appended to MISSIONS by
// registerMissions3(); calling it twice changes nothing.
import { MISSIONS } from './missions.js';

const EXTRA = [
  {
    id: 'M9',
    title: 'Night Shift at the Docks',
    briefing: 'The Harbor Rats run the Docks after dark. Clear them out, take a boat to Gull Island, and come home by the Marina.',
    reward: 1500,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach Solmar Docks' },
      { kind: 'defeat', count: 4, text: 'Defeat 4 Harbor Rats' },
      { kind: 'board', text: 'Board a boat' },
      { kind: 'reach', key: 'island', text: 'Sail to Gull Island' },
      { kind: 'reach', key: 'marina', text: 'Return to Solmar Marina' },
    ],
  },
  {
    id: 'M10',
    title: 'King of Solmar',
    briefing: 'Own the turf, rob the Bank, and walk away clean. That is how you become King of Solmar.',
    reward: 7500,
    objectives: [
      { kind: 'reach', key: 'turf', text: 'Reach Vipers\u2019 Turf' },
      { kind: 'defeat', count: 6, text: 'Defeat 6 Vipers' },
      { kind: 'reach', key: 'bank', text: 'Reach Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault (4 stars)' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to Mara\u2019s Safehouse' },
    ],
  },
];

let registered = false;

// Append M9–M10 to MISSIONS. Idempotent: a second call is a no-op.
export function registerMissions3() {
  if (registered) return;
  registered = true;
  for (const m of EXTRA) {
    if (!MISSIONS.find((x) => x.id === m.id)) MISSIONS.push(m);
  }
}
