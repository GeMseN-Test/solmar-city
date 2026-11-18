// Story missions M6-M8, appended to MISSIONS by registerMissions2().
// New landmarks they use (city.js): radio "Solmar Radio" (2520,130)
// and island "Gull Island" (1440,2130). 'board' is the new objective
// kind: the player must be sitting in a boat.
import { MISSIONS } from './missions.js';

let registered = false;

const EXTRA = [
  {
    id: 'harbor-lights',
    title: 'Harbor Lights',
    briefing: 'Take a boat out to Gull Island and back. The harbor is yours tonight.',
    reward: 900,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach Solmar Docks' },
      { kind: 'board', text: 'Board a boat' },
      { kind: 'reach', key: 'island', text: 'Reach Gull Island' },
      { kind: 'reach', key: 'marina', text: 'Reach Solmar Marina' },
    ],
  },
  {
    id: 'on-air',
    title: 'On Air',
    briefing: 'The Static Boys jammed the radio tower. Get up there and shut them down.',
    reward: 1200,
    objectives: [
      { kind: 'reach', key: 'radio', text: 'Reach Solmar Radio' },
      { kind: 'defeat', count: 3, text: 'Defeat 3 Static Boys' },
      { kind: 'reach', key: 'safehouse', text: "Reach Mara's Safehouse" },
    ],
  },
  {
    id: 'grand-finale',
    title: 'The Grand Finale',
    briefing: 'One last bank job, then disappear. Grab the vault, drop the guards, run.',
    reward: 5000,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Reach Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', level: 4, text: 'Grab the vault (4 stars)' },
      { kind: 'defeat', count: 6, text: 'Defeat 6 guards' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to the Safehouse' },
    ],
  },
];

// Idempotent: safe to call on every world reset.
export function registerMissions2() {
  if (registered) return;
  registered = true;
  for (const m of EXTRA) {
    if (!MISSIONS.find((x) => x.id === m.id)) MISSIONS.push(m);
  }
}
