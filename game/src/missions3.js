// missions3.js — Solmar City story missions M9–M10 (v2-retry additions).
// Written from the v2-retry spec only. Appends to MISSIONS; idempotent.
// Uses only proven objective kinds: reach / defeat / board / interact / escape.
import { MISSIONS } from './missions.js';

const EXTRA = [
  {
    id: 'night-shift',
    title: 'Night Shift at the Docks',
    briefing: 'Shift malam di Docks. Harbor Rats bikin onar — bereskan, lalu berlayar.',
    reward: 1500,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Pergi ke Solmar Docks' },
      { kind: 'defeat', count: 4, text: 'Kalahkan 4 Harbor Rats' },
      { kind: 'board', text: 'Naik perahu (E di dekat perahu)' },
      { kind: 'reach', key: 'island', text: 'Berlayar ke Gull Island' },
      { kind: 'reach', key: 'marina', text: 'Berlayar ke Solmar Marina' },
    ],
  },
  {
    id: 'king-of-solmar',
    title: 'King of Solmar',
    briefing: 'Jadi raja kota: kuasai Turf, bobol bank, kabur tanpa jejak.',
    reward: 7500,
    objectives: [
      { kind: 'reach', key: 'turf', text: 'Pergi ke Vipers\u2019 Turf' },
      { kind: 'defeat', count: 6, text: 'Kalahkan 6 Viper' },
      { kind: 'reach', key: 'bank', text: 'Pergi ke Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Bobol brankas (E di depan bank)' },
      { kind: 'escape', key: 'safehouse', text: 'Kabur ke Safehouse Mara' },
    ],
  },
];

export function registerMissions3() {
  for (const m of EXTRA) {
    if (!MISSIONS.find((x) => x.id === m.id)) MISSIONS.push(m);
  }
  return MISSIONS.length;
}
