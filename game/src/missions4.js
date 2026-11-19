// missions4.js — Solmar City story missions M11–M12 (attempt 3).
// Written from the v2 spec only. Appends to MISSIONS from missions.js.
// M12 is the story finale: after it, storyComplete is true.
import { MISSIONS, setupMissionGang } from './missions.js';

const EXTRA = [
  {
    id: 'M11',
    title: 'Midnight Run',
    briefing: 'One more night run. Clear the docks of four Harbor Rats, swing by the marina, then take a boat out to Gull Island under the moon.',
    reward: 3000,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Reach Solmar Docks' },
      { kind: 'defeat', count: 4, text: 'Defeat 4 Harbor Rats' },
      { kind: 'reach', key: 'marina', text: 'Reach Solmar Marina' },
      { kind: 'board', text: 'Board a boat (E near a boat)' },
      { kind: 'reach', key: 'island', text: 'Sail to Gull Island' },
    ],
  },
  {
    id: 'M12',
    title: 'The Solmar Crown',
    briefing: 'The last job. Hit the bank vault, drop six guards, slip away to the safehouse, then park at Ray\'s Garage a legend. The crown is yours.',
    reward: 10000,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Reach Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault (E at the bank)' },
      { kind: 'defeat', count: 6, text: 'Defeat 6 guards' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to the safehouse' },
      { kind: 'reach', key: 'garage', text: "Park at Ray's Garage — a legend" },
    ],
  },
];

// Idempotent: safe to call on every world reset.
export function registerMissions4() {
  for (const m of EXTRA) {
    if (!MISSIONS.some((x) => x.id === m.id)) MISSIONS.push(m);
  }
  return MISSIONS;
}

// Spawn the defeat gang for an M11–M12 mission (guarded, see missions2).
export function setupV4Mission(state, def) {
  if (!def) return;
  setupMissionGang(state, def);
}
