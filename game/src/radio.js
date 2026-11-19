// In-game radio — 5 WebAudio synth stations, Q cycles through them.
// Own lazy AudioContext (created on first user gesture), lookahead
// scheduler on an 8th-note grid: bass + lead + hat voices per station.
import { clamp } from './util.js';

// Station table: name, bpm, mode, and the voice recipe.
export const STATIONS = [
  {
    name: 'SOLMAR FM',
    tag: 'sunny pop',
    bpm: 112,
    minor: false,
    root: 261.63, // C4
    bassPattern: [0, 0, 7, 5, 0, 0, 7, 10],
    leadNotes: [0, 2, 4, 7, 9, 7, 4, 2],
    leadEvery: 2,
    hatEvery: 1,
    leadWave: 'square',
    bassWave: 'triangle',
  },
  {
    name: 'HARBOR 98',
    tag: 'late-night swing',
    bpm: 96,
    minor: false,
    root: 220.0, // A3
    bassPattern: [0, 4, 7, 4, 0, 4, 7, 10],
    leadNotes: [0, 4, 7, 9, 7, 4, 2, 0],
    leadEvery: 2,
    hatEvery: 1,
    swing: 0.18,
    leadWave: 'sine',
    bassWave: 'sine',
  },
  {
    name: 'NEON NIGHTS',
    tag: 'synthwave',
    bpm: 122,
    minor: true,
    root: 196.0, // G3
    bassPattern: [0, 0, 3, 0, 5, 0, 3, 10],
    leadNotes: [0, 3, 5, 7, 10, 7, 5, 3],
    leadEvery: 1,
    hatEvery: 1,
    leadWave: 'sawtooth',
    bassWave: 'sawtooth',
  },
  {
    name: 'PALM DRIVE',
    tag: 'sunset chillwave',
    bpm: 100,
    minor: false,
    root: 246.94, // B3
    bassPattern: [0, 0, 0, 7, 0, 0, 5, 7],
    leadNotes: [0, 4, 7, 4, 9, 7, 4, 2],
    leadEvery: 4,
    hatEvery: 2,
    leadWave: 'sine',
    bassWave: 'triangle',
  },
  {
    name: 'MIDNIGHT DRIVE',
    tag: 'night cruise',
    bpm: 90,
    minor: true,
    root: 174.61, // F3
    bassPattern: [0, 0, 3, 0, 0, 5, 3, 0],
    leadNotes: [0, 3, 7, 10, 7, 3, 5, 3],
    leadEvery: 2,
    hatEvery: 1,
    leadWave: 'triangle',
    bassWave: 'sine',
  },
];

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15];

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
  const st = STATIONS[radio.stationIndex % STATIONS.length];
  return st.name + ' — ' + st.tag;
}

export function stationName(radio) {
  return radioName(radio);
}

export function cycleRadio(radio) {
  radio.stationIndex = (radio.stationIndex + 1) % STATIONS.length;
  radio.step = 0;
  if (radio.context) {
    radio.nextStepTime = radio.context.currentTime + 0.05;
  }
  return radio.stationIndex;
}

export function setRadioMuted(radio, muted) {
  radio.muted = !!muted;
  if (radio.master) radio.master.gain.value = radio.muted ? 0 : 0.32;
  return radio.muted;
}

export function ensureRadio(radio) {
  if (radio.context) {
    if (radio.context.state === 'suspended') radio.context.resume();
    return radio.context;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = radio.muted ? 0 : 0.32;
    master.connect(ctx.destination);
    radio.context = ctx;
    radio.master = master;
    radio.nextStepTime = ctx.currentTime + 0.1;
    radio.started = true;
  } catch (e) {
    radio.context = null;
  }
  return radio.context;
}

function semitoneFreq(root, semitones) {
  return root * Math.pow(2, semitones / 12);
}

function noteFreq(station, degree) {
  const scale = station.minor ? MINOR_STEPS : MAJOR_STEPS;
  const semis = scale[clamp(degree, 0, scale.length - 1)];
  return semitoneFreq(station.root, semis);
}

function playTone(radio, freq, time, dur, type, vol) {
  if (!radio.context || !radio.master) return;
  try {
    const osc = radio.context.createOscillator();
    const g = radio.context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(g);
    g.connect(radio.master);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  } catch (e) { /* never break the game for audio */ }
}

function playHat(radio, time, vol) {
  if (!radio.context || !radio.master) return;
  try {
    const len = Math.floor(radio.context.sampleRate * 0.04);
    const buf = radio.context.createBuffer(1, len, radio.context.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = radio.context.createBufferSource();
    src.buffer = buf;
    const filter = radio.context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    const g = radio.context.createGain();
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(radio.master);
    src.start(time);
  } catch (e) { /* ignore */ }
}

// Schedule one 8th-note step for the current station.
function scheduleStep(radio, station, stepIndex, time) {
  const pat = station.bassPattern;
  const bassDegree = pat[stepIndex % pat.length];
  // Bass on every step, one octave down.
  playTone(radio, noteFreq(station, bassDegree) / 2, time, 0.22, station.bassWave, 0.16);
  // Lead on its own grid.
  if (stepIndex % station.leadEvery === 0) {
    const leadDegree = station.leadNotes[(stepIndex / station.leadEvery) % station.leadNotes.length];
    playTone(radio, noteFreq(station, leadDegree) * 2, time, 0.2, station.leadWave, 0.07);
  }
  // Hat on its grid.
  if (stepIndex % station.hatEvery === 0) {
    playHat(radio, time, 0.05);
  }
}

// Lookahead scheduler: call every frame. No-op before ensure().
export function tickRadio(radio) {
  if (!radio.context || !radio.master || radio.muted) return;
  const station = STATIONS[radio.stationIndex % STATIONS.length];
  const stepDur = 60 / station.bpm / 2; // 8th notes
  const ahead = radio.context.currentTime + 0.12;
  if (radio.nextStepTime < radio.context.currentTime) {
    radio.nextStepTime = radio.context.currentTime + 0.02;
  }
  let guard = 0;
  while (radio.nextStepTime < ahead && guard < 16) {
    let t = radio.nextStepTime;
    // Swing: delay off-beat 8ths slightly.
    if (station.swing && radio.step % 2 === 1) t += stepDur * station.swing;
    scheduleStep(radio, station, radio.step, t);
    radio.step++;
    radio.nextStepTime += stepDur;
    guard++;
  }
}

export default createRadio;
