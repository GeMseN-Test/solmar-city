// missions2.js — Solmar City story missions M6–M8 (v2 additions).
// Written from the v2 spec only. Appends to MISSIONS; idempotent.
import { MISSIONS, landmarkPos } from './missions.js';
import { spawnGang } from './combat.js';

const EXTRA = [
  {
    id: 'harbor-lights',
    title: 'Harbor Lights',
    briefing: 'Malam di pelabuhan. Naik perahu di Docks, mampir ke Gull Island, sampai ke Marina.',
    reward: 900,
    objectives: [
      { kind: 'reach', key: 'docks', text: 'Pergi ke Solmar Docks' },
      { kind: 'board', text: 'Naik perahu (E di dekat perahu)' },
      { kind: 'reach', key: 'island', text: 'Berlayar ke Gull Island' },
      { kind: 'reach', key: 'marina', text: 'Berlayar ke Solmar Marina' },
    ],
  },
  {
    id: 'on-air',
    title: 'On Air',
    briefing: 'Static Boys menguasai menara radio. Usir mereka, lalu pulang ke Safehouse.',
    reward: 1200,
    objectives: [
      { kind: 'reach', key: 'radio', text: 'Pergi ke menara Solmar Radio' },
      { kind: 'defeat', count: 3, text: 'Kalahkan 3 Static Boys' },
      { kind: 'reach', key: 'safehouse', text: 'Kembali ke Safehouse Mara' },
    ],
  },
  {
    id: 'grand-finale',
    title: 'The Grand Finale',
    briefing: 'Bank Grand Solmar, sekali lagi — kali ini besar. Bobol, lawan penjaga, kabur.',
    reward: 5000,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Pergi ke Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Bobol brankas (E di depan bank)' },
      { kind: 'defeat', count: 6, text: 'Kalahkan 6 penjaga bank' },
      { kind: 'escape', key: 'safehouse', text: 'Kabur ke Safehouse Mara' },
    ],
  },
];

export function registerStoryMissions() {
  for (const m of EXTRA) {
    if (!MISSIONS.find((x) => x.id === m.id)) MISSIONS.push(m);
  }
  return MISSIONS.length;
}

// Spawn the gang for a v2 mission: defeat count around the FIRST reach
// landmark (radio tower for M7, bank for M8). startMission already does
// this generically; this helper keeps the v2 API from the spec.
export function setupV2Mission(state, def) {
  if (!def) return false;
  const defeat = def.objectives.find((o) => o.kind === 'defeat');
  const firstReach = def.objectives.find((o) => o.kind === 'reach');
  if (!defeat || !firstReach) return false;
  const pos = landmarkPos(state, firstReach.key);
  if (!pos) return false;
  spawnGang(state, pos.x, pos.y, defeat.count || 3);
  return true;
}
