// missions4.js — Solmar City story missions M11–M12 (attempt-3 additions).
// Written from the attempt-3 spec only. Appends to MISSIONS; idempotent.
// M12 is the story finale: after it, storyComplete is true.
// Uses only proven objective kinds: reach / defeat / board / interact / escape.
import { MISSIONS } from './missions.js';

const EXTRA = [
  {
    id: 'midnight-run',
    title: 'Midnight Run',
    briefing: 'Tengah malam, Docks sepi — kecuali Harbor Rats. Bereskan, lalu berlayar ke pulau.',
    reward: 3000,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Pergi ke Solmar Docks' },
      { kind: 'defeat', count: 4, text: 'Kalahkan 4 Harbor Rats' },
      { kind: 'reach', key: 'marina', text: 'Pergi ke Solmar Marina' },
      { kind: 'board', text: 'Naik perahu (E di dekat perahu)' },
      { kind: 'reach', key: 'island', text: 'Berlayar ke Gull Island' },
    ],
  },
  {
    id: 'solmar-crown',
    title: 'The Solmar Crown',
    briefing: 'Mahkota Solmar: satu aksi terakhir di bank, lawan penjaga, kabur, pulang ke bengkel.',
    reward: 10000,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Pergi ke Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Bobol brankas (E di depan bank)' },
      { kind: 'defeat', count: 6, text: 'Kalahkan 6 penjaga bank' },
      { kind: 'escape', key: 'safehouse', text: 'Kabur ke Safehouse Mara' },
      { kind: 'reach', key: 'garage', text: 'Akhiri di Ray\u2019s Garage' },
    ],
  },
];

export function registerMissions4() {
  for (const m of EXTRA) {
    if (!MISSIONS.find((x) => x.id === m.id)) MISSIONS.push(m);
  }
  return MISSIONS.length;
}
