// radio.js — In-game radio: 5 WebAudio synth stations, Q cycles.
// Each station has its own AudioContext-free design: one lazy context,
// a lookahead scheduler on an 8th-note grid, bass + lead + hat voices.
// Works only after a user gesture (Q press / New Game click).

export const STATIONS = [
  {
    name: 'SOLMAR FM',
    tag: 'sunny pop',
    bpm: 112,
    minor: false,
    root: 220,
    bassNotes: [0, 0, 7, 5, 0, 0, 7, 10],
    leadNotes: [0, 4, 7, 12, 7, 4, 2, 0],
    hatEvery: 1,
    bassVol: 0.2,
    leadVol: 0.09,
  },
  {
    name: 'HARBOR 98',
    tag: 'late-night swing',
    bpm: 96,
    minor: false,
    root: 196,
    bassNotes: [0, 4, 7, 4, 0, 4, 7, 10],
    leadNotes: [0, 0, 7, 0, 12, 7, 4, 2],
    hatEvery: 2,
    bassVol: 0.18,
    leadVol: 0.08,
    swing: true,
  },
  {
    name: 'NEON NIGHTS',
    tag: 'synthwave',
    bpm: 122,
    minor: true,
    root: 207.65,
    bassNotes: [0, 0, 3, 0, 5, 0, 3, 7],
    leadNotes: [12, 10, 7, 10, 12, 15, 12, 10],
    hatEvery: 1,
    bassVol: 0.22,
    leadVol: 0.07,
    arp: true,
  },
  {
    name: 'PALM DRIVE',
    tag: 'sunset chillwave',
    bpm: 100,
    minor: false,
    root: 233.08,
    bassNotes: [0, 0, 0, 5, 0, 0, 7, 5],
    leadNotes: [0, 7, 12, 7, 0, 4, 7, 12],
    hatEvery: 2,
    bassVol: 0.16,
    leadVol: 0.06,
    pad: true,
  },
  {
    name: 'MIDNIGHT DRIVE',
    tag: 'night cruise',
    bpm: 90,
    minor: true,
    root: 174.61,
    bassNotes: [0, 0, 3, 5, 0, 0, 7, 5],
    leadNotes: [0, 0, 10, 7, 0, 3, 7, 12],
    hatEvery: 2,
    bassVol: 0.18,
    leadVol: 0.06,
  },
];

const SCALE_MAJOR = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 19, 24];
const SCALE_MINOR = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19, 24];

export function radioStationCount() {
  return STATIONS.length;
}

export function createRadio() {
  return {
    context: null,
    master: null,
    stationIndex: 0,
    step: 0,
    nextStepTime: 0,
    started: false,
    muted: false,
  };
}

export function radioName(radio) {
  if (!radio) return STATIONS[0].name;
  const st = STATIONS[radio.stationIndex % STATIONS.length];
  return st.name + ' — ' + st.tag;
}

export function stationName(radio) {
  return radioName(radio);
}

export function cycleRadio(radio) {
  if (!radio) return 0;
  radio.stationIndex = (radio.stationIndex + 1) % STATIONS.length;
  radio.step = 0;
  radio.nextStepTime = 0;
  return radio.stationIndex;
}

export function setRadioMuted(radio, muted) {
  if (!radio) return;
  radio.muted = !!muted;
  if (radio.master) radio.master.gain.value = radio.muted ? 0 : 0.4;
}

export function ensureRadio(radio) {
  if (!radio || radio.context) return radio ? radio.context : null;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    radio.context = new AC();
    radio.master = radio.context.createGain();
    radio.master.gain.value = radio.muted ? 0 : 0.4;
    radio.master.connect(radio.context.destination);
    if (radio.context.state === 'suspended') radio.context.resume();
    radio.started = true;
    radio.nextStepTime = radio.context.currentTime + 0.06;
  } catch (err) {
    radio.context = null;
  }
  return radio ? radio.context : null;
}

function noteFreq(station, degree) {
  const scale = station.minor ? SCALE_MINOR : SCALE_MAJOR;
  const idx = ((degree % scale.length) + scale.length) % scale.length;
  const oct = Math.floor(degree / scale.length);
  return station.root * Math.pow(2, (scale[idx] + oct * 12) / 12);
}

function playTone(ctx, dest, freq, t0, dur, type, vol) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function playHat(ctx, dest, t0, vol) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * 0.04));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 6000;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  src.start(t0);
}

function scheduleStep(radio, station, stepIndex, t0, stepDur) {
  const ctx = radio.context;
  const dest = radio.master;
  const bar = stepIndex % 8;
  // Bass: walking / root pulse on every step.
  const bassDegree = station.bassNotes[bar];
  const bassFreq = noteFreq(station, bassDegree) / 2;
  playTone(ctx, dest, bassFreq, t0, stepDur * 1.7, 'triangle', station.bassVol);
  // Lead: sparse melody, every other step.
  if (bar % 2 === 0) {
    const leadDegree = station.leadNotes[bar];
    const leadFreq = noteFreq(station, leadDegree);
    playTone(ctx, dest, leadFreq, t0, stepDur * 1.4, 'sine', station.leadVol);
  }
  // Synthwave arpeggio: extra 16th sparkle on NEON NIGHTS.
  if (station.arp && bar % 2 === 1) {
    const arpFreq = noteFreq(station, station.leadNotes[bar] + 12);
    playTone(ctx, dest, arpFreq, t0, stepDur * 0.7, 'square', 0.03);
  }
  // Warm pad on PALM DRIVE: long root chord every bar start.
  if (station.pad && bar === 0) {
    playTone(ctx, dest, noteFreq(station, 0), t0, stepDur * 8, 'sine', 0.05);
    playTone(ctx, dest, noteFreq(station, 4), t0, stepDur * 8, 'sine', 0.04);
  }
  // Hat on the grid.
  if (bar % station.hatEvery === 0) playHat(ctx, dest, t0, 0.05);
}

export function tickRadio(radio) {
  if (!radio || !radio.context || !radio.started) return;
  if (radio.muted) {
    radio.nextStepTime = radio.context.currentTime + 0.05;
    return;
  }
  const ctx = radio.context;
  const station = STATIONS[radio.stationIndex % STATIONS.length];
  const stepDur = 60 / station.bpm / 2;
  if (radio.nextStepTime < ctx.currentTime) {
    radio.nextStepTime = ctx.currentTime + 0.05;
  }
  let guard = 0;
  while (radio.nextStepTime < ctx.currentTime + 0.25 && guard < 16) {
    let t0 = radio.nextStepTime;
    // Swing feel on HARBOR 98: delay off-beats slightly.
    if (station.swing && radio.step % 2 === 1) t0 += stepDur * 0.18;
    scheduleStep(radio, station, radio.step, t0, stepDur);
    radio.step++;
    radio.nextStepTime += stepDur;
    guard++;
  }
}

export default createRadio;
