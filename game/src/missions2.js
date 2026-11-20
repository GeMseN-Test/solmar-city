// Solmar City — story missions M6–M8 (v2).
// Written from v2-spec.md only. Appended to MISSIONS by
// registerStoryMissions(); calling it twice changes nothing.
import { MISSIONS } from './missions.js';
import { spawnGang } from './combat.js';

const EXTRA = [
  {
    id: 'M6',
    title: 'Harbor Lights',
    briefing: 'Take a boat out to Gull Island at dusk, then bring her back to the Marina.',
    reward: 900,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach Solmar Docks' },
      { kind: 'board', text: 'Board a boat' },
      { kind: 'reach', key: 'island', text: 'Sail to Gull Island' },
      { kind: 'reach', key: 'marina', text: 'Return to Solmar Marina' },
    ],
  },
  {
    id: 'M7',
    title: 'On Air',
    briefing: 'The Static Boys took over Solmar Radio. Clear the tower, then get home safe.',
    reward: 1200,
    objectives: [
      { kind: 'reach', key: 'radio', text: 'Reach Solmar Radio' },
      { kind: 'defeat', count: 3, text: 'Defeat 3 Static Boys' },
      { kind: 'reach', key: 'safehouse', text: 'Reach Mara\u2019s Safehouse' },
    ],
  },
  {
    id: 'M8',
    title: 'The Grand Finale',
    briefing: 'One last job: the Bank vault, six guards, and a clean getaway. End it here.',
    reward: 5000,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Reach Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault (4 stars)' },
      { kind: 'defeat', count: 6, text: 'Defeat 6 guards' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to Mara\u2019s Safehouse' },
    ],
  },
];

let registered = false;

// Append M6–M8 to MISSIONS. Idempotent: a second call is a no-op.
export function registerStoryMissions() {
  if (registered) return;
  registered = true;
  for (const m of EXTRA) {
    if (!MISSIONS.find((x) => x.id === m.id)) MISSIONS.push(m);
  }
}

// Gang spawns for a v2 mission: the defeat crew waits at the mission's
// first reach landmark (M7: 3 Static Boys at the radio tower;
// M8: 6 guards at the bank). Same spawn rule missions.js uses at
// mission start; kept as its own helper for the v2 wiring.
export function setupV2Mission(state, def) {
  const defeat = def.objectives.find((o) => o.kind === 'defeat');
  if (!defeat) return;
  const reach = def.objectives.find((o) => o.kind === 'reach' || o.kind === 'escape');
  if (!reach) return;
  const lm = state.city && state.city.landmarks ? state.city.landmarks[reach.key] : null;
  if (!lm) return;
  spawnGang(state, lm.x, lm.y, defeat.count || 0);
}
