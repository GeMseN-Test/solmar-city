// Story missions M11-M12 — the finale of Solmar City — appended to
// MISSIONS by registerMissions4(). M11 is a midnight boat run through
// the harbor; M12 is the crown job, and finishing it sets
// storyComplete. Both use only proven objective kinds (reach / defeat
// / board / interact / escape).
import { MISSIONS } from './missions.js';

let registered = false;

const EXTRA = [
  {
    id: 'midnight-run',
    title: 'Midnight Run',
    briefing: 'Midnight at the docks: Harbor Rats own the piers. Clear them, take a boat, and run to the island.',
    reward: 3000,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach Solmar Docks' },
      { kind: 'defeat', count: 4, text: 'Defeat 4 Harbor Rats' },
      { kind: 'reach', key: 'marina', text: 'Reach Solmar Marina' },
      { kind: 'board', text: 'Board a boat' },
      { kind: 'reach', key: 'island', text: 'Reach Gull Island' },
    ],
  },
  {
    id: 'solmar-crown',
    title: 'The Solmar Crown',
    briefing: 'The crown job: empty the Grand Solmar Bank, drop six guards, and drive home a legend.',
    reward: 10000,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Reach Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', level: 4, text: 'Grab the vault (4 stars)' },
      { kind: 'defeat', count: 6, text: 'Defeat 6 guards' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to the Safehouse' },
      { kind: 'reach', key: 'garage', text: "Reach Ray's Garage" },
    ],
  },
];

// Idempotent: safe to call on every world reset.
export function registerMissions4() {
  if (registered) return;
  registered = true;
  for (const m of EXTRA) {
    if (!MISSIONS.find((x) => x.id === m.id)) MISSIONS.push(m);
  }
}
