// Solmar City's second act: three more story missions that take Mara from
// the Solmar Score to the top of the city. They use the same objective
// kinds the first five do (reach, board, defeat, interact, escape), so the
// mission engine needs no new rules — only the 'board' kind, which the
// boats module already teaches the player. The world registers them once
// at boot, after mission five, and the story ends with the finale.

import { MISSIONS } from './missions.js';

export const MISSIONS_V2 = [
  {
    id: 'harbor-lights',
    title: 'Harbor Lights',
    briefing: 'A buyer waits at the Marina — but the package is on Gull Island. Take a boat.',
    reward: 900,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Get to the Solmar Docks' },
      { kind: 'board', text: 'Board a boat — walk up to one on the water and press E' },
      { kind: 'reach', key: 'island', text: 'Sail out to Gull Island' },
      { kind: 'reach', key: 'marina', text: 'Sail back, step ashore (E), and deliver to the Marina' },
    ],
  },
  {
    id: 'on-air',
    title: 'On Air',
    briefing: 'Solmar Radio wants Mara live on air. The Static Boys want her off it. Three of them.',
    reward: 1200,
    objectives: [
      { kind: 'reach', key: 'radio', text: 'Get to the Solmar Radio tower' },
      { kind: 'defeat', count: 3, text: 'Take out 3 Static Boys guarding the tower' },
      { kind: 'reach', key: 'safehouse', text: 'Report back to the Safehouse' },
    ],
  },
  {
    id: 'grand-finale',
    title: 'The Grand Finale',
    briefing: 'One last job: the Grand Solmar Bank, six guards, the whole PD — and a clean getaway.',
    reward: 5000,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Get to the Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault cash (press E at the bank)' },
      { kind: 'defeat', count: 6, text: 'Take out 6 bank guards' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to the Safehouse — the whole PD is coming' },
    ],
  },
];

/**
 * Append the second act to the story, once. Safe to call again: missions
 * already registered are skipped by id, so a reload never doubles them.
 */
export function registerStoryMissions() {
  for (const mission of MISSIONS_V2) {
    if (!MISSIONS.some((existing) => existing.id === mission.id)) {
      MISSIONS.push(mission);
    }
  }
  return MISSIONS.length;
}
