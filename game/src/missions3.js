// Act three: the last two story missions (M9 + M10).
// They use only the objective kinds the mission engine already knows:
// reach, defeat, board, interact, escape.
import { MISSIONS } from './missions.js';

export const MISSIONS_V3 = [
  {
    id: 'night-shift',
    title: 'Night Shift at the Docks',
    briefing: 'The Harbor Rats run the docks after dark. Take the night shift back, then sail the island run.',
    reward: 1500,
    objectives: [
      {
        kind: 'reach',
        key: 'docks',
        text: 'Get to the Solmar Docks — the Rats own the night shift',
      },
      {
        kind: 'defeat',
        count: 4,
        text: 'Take out 4 Harbor Rats on the docks',
      },
      {
        kind: 'board',
        text: 'Board a boat — walk up to one on the water and press E',
      },
      {
        kind: 'reach',
        key: 'island',
        text: 'Sail out to Gull Island',
      },
      {
        kind: 'reach',
        key: 'marina',
        text: 'Sail back and deliver to the Marina',
      },
    ],
  },
  {
    id: 'king-of-solmar',
    title: 'King of Solmar',
    briefing: 'One last job to own the city: take the turf, hit the bank, and get home clean.',
    reward: 7500,
    objectives: [
      {
        kind: 'reach',
        key: 'turf',
        text: "Get to the Vipers' Turf in Old Town",
      },
      {
        kind: 'defeat',
        count: 6,
        text: 'Take out 6 Vipers holding the turf',
      },
      {
        kind: 'reach',
        key: 'bank',
        text: 'Get to the Grand Solmar Bank',
      },
      {
        kind: 'interact',
        key: 'bank',
        text: 'Grab the vault cash (press E at the bank)',
      },
      {
        kind: 'escape',
        key: 'safehouse',
        text: 'Escape to the Safehouse — the whole PD is coming',
      },
    ],
  },
];

let registered = false;

// Append the act-three missions to the story list. Idempotent: calling
// it twice (a fresh world, a re-import) must not duplicate the missions.
export function registerStoryMissions3() {
  if (registered) return MISSIONS.length;
  registered = true;
  for (const mission of MISSIONS_V3) {
    if (!MISSIONS.some((m) => m.id === mission.id)) MISSIONS.push(mission);
  }
  return MISSIONS.length;
}
