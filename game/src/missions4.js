// Solmar City — story missions M11–M12 (attempt 3).
// Written from v2-spec.md only. Appended to MISSIONS by
// registerMissions4(); calling it twice changes nothing.
// M12 is the last mission: finishing it sets storyComplete.
import { MISSIONS } from './missions.js';

const EXTRA = [
  {
    id: 'M11',
    title: 'Midnight Run',
    briefing: 'Midnight at the Docks: the Harbor Rats are back. Settle it, then run the boat out to Gull Island.',
    reward: 3000,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach Solmar Docks' },
      { kind: 'defeat', count: 4, text: 'Defeat 4 Harbor Rats' },
      { kind: 'reach', key: 'marina', text: 'Reach Solmar Marina' },
      { kind: 'board', text: 'Board a boat' },
      { kind: 'reach', key: 'island', text: 'Sail to Gull Island' },
    ],
  },
  {
    id: 'M12',
    title: 'The Solmar Crown',
    briefing: 'The Bank vault. Six guards. One clean getaway to the Garage. Take the Crown.',
    reward: 10000,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Reach Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault (4 stars)' },
      { kind: 'defeat', count: 6, text: 'Defeat 6 guards' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to Mara\u2019s Safehouse' },
      { kind: 'reach', key: 'garage', text: 'Drive home to Ray\u2019s Garage' },
    ],
  },
];

let registered = false;

// Append M11–M12 to MISSIONS. Idempotent: a second call is a no-op.
export function registerMissions4() {
  if (registered) return;
  registered = true;
  for (const m of EXTRA) {
    if (!MISSIONS.find((x) => x.id === m.id)) MISSIONS.push(m);
  }
}
