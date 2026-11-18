// missions3.js — Solmar City, act three: the last two story missions.
//
// These two close Mara's story after The Grand Finale (act two). They
// use only objective kinds the mission engine already knows — reach,
// defeat, board, interact, escape — so nothing else in the game has to
// change to run them. The engine spawns the gang for a defeat
// objective around the mission's first reach landmark, which is why
// each mission opens by sending Mara to the fight first.
//
//   M9  'Night Shift at the Docks'  ($1,500): clear the Harbor Rats
//       off the docks, take a boat, run the package out to Gull
//       Island, and deliver it to the Marina.
//   M10 'King of Solmar'            ($7,500): break the Vipers on
//       their own turf, hit the Grand Solmar Bank, and vanish before
//       the whole PD closes in.
//
//   MISSIONS_V3            the two mission definitions
//   registerStoryMissions3() appends them to MISSIONS (idempotent:
//       calling it twice changes nothing)

import { MISSIONS } from './missions.js';

export const MISSIONS_V3 = [
  {
    id: 'night-shift',
    title: 'Night Shift at the Docks',
    briefing:
      'The Harbor Rats run the docks after dark, and a buyer waits at the Marina. Clear the rats, take a boat, and run the package out to Gull Island.',
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
    briefing:
      'One last job to own this city: break the Vipers on their own turf, hit the Grand Solmar Bank, and vanish before the whole PD closes in.',
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

export function registerStoryMissions3() {
  for (const def of MISSIONS_V3) {
    if (!MISSIONS.some((mission) => mission.id === def.id)) {
      MISSIONS.push(def);
    }
  }
}
