// In-game radio: five synthesized stations on one lazy AudioContext.
// Q cycles stations. Nothing plays until a user gesture (Q press or a
// New Game click) creates the context — browsers demand that. A
// lookahead scheduler drops bass + lead + hat notes on an 8th-note grid.
import { clamp } from './util.js';

const STATIONS = [
  {
    name: 'SOLMAR FM — sunny pop',
    bpm: 112, minor: false, root: 261.63,
    bass: [0, 0, 7, 5], lead: [0, 2, 4, 7, 9, 7, 4, 2], hatEvery: 1,
  },
  {
    name: 'HARBOR 98 — late-night swing',
    bpm: 96, minor: false, root: 220.0,
    bass: [0, 0, 4, 3], lead: [0, 4, 7, 4, 2, 0, -2, 0], hatEvery: 2,
  },
  {
    name: 'NEON NIGHTS — synthwave',
    bpm: 122, minor: true, root: 196.0,
    bass: [0, 0, 0, 3], lead: [0, 3, 5, 7, 10, 7, 5, 3], hatEvery: 1,
  },
  {
    name: 'PALM DRIVE — sunset chillwave',
    bpm: 100, minor: false, root: 246.94,
    bass: [0, 5, 3, 4], lead: [0, 2, 4, 2, 0, -2, -4, -2], hatEvery: 2,
  },
  {
    name: 'MIDNIGHT DRIVE — night cruise',
    bpm: 90, minor: true, root: 174.61,
    bass: [0, 0, 5, 3], lead: [0, 3, 5, 3, 0, -2, -4, -2], hatEvery: 2,
  },
];

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];

function noteFreq(station, degree) {
  const scale = station.minor ? MINOR_STEPS : MAJOR_STEPS;
  const octave = Math.floor(degree / 7);
  const idx = ((degree % 7) + 7) % 7;
  const semis = scale[idx] + octave * 12;
  return station.root * Math.pow(2, semis / 12);
}

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
  return STATIONS[radio.stationIndex % STATIONS.length].name;
}

export function cycleRadio(radio) {
  radio.stationIndex = (radio.stationIndex + 1) % STATIONS.length;
  radio.step = 0;
  if (radio.context) radio.nextStepTime = radio.context.currentTime + 0.05;
  return radioName(radio);
}

export function setRadioMuted(radio, muted) {
  radio.muted = !!muted;
  if (radio.master && radio.context) {
    radio.master.gain.value = radio.muted ? 0 : 0.32;
  }
}

// Create the AudioContext after a gesture. Idempotent — safe to call
// on every Q press or click.
export function ensureRadio(radio) {
  if (radio.context) {
    if (radio.context.state === 'suspended') radio.context.resume();
    return true;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    radio.context = new AC();
    radio.master = radio.context.createGain();
    radio.master.gain.value = radio.muted ? 0 : 0.32;
    radio.master.connect(radio.context.destination);
    radio.nextStepTime = radio.context.currentTime + 0.06;
    radio.started = true;
    return true;
  } catch (e) {
    return false;
  }
}

function scheduleNote(radio, freq, when, dur, type, vol) {
  const osc = radio.context.createOscillator();
  const gain = radio.context.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
  osc.connect(gain);
  gain.connect(radio.master);
  osc.start(when);
  osc.stop(when + dur + 0.02);
}

function scheduleHat(radio, when) {
  const len = Math.floor(radio.context.sampleRate * 0.04);
  const buf = radio.context.createBuffer(1, len, radio.context.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = radio.context.createBufferSource();
  src.buffer = buf;
  const filter = radio.context.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 7000;
  const gain = radio.context.createGain();
  gain.gain.setValueAtTime(0.05, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + 0.04);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(radio.master);
  src.start(when);
}

// Schedule every 8th-note whose time has come, ~0.12s ahead of the
// playhead. No-op before the context exists or while muted.
export function tickRadio(radio) {
  if (!radio.context || !radio.started || radio.muted) return;
  const station = STATIONS[radio.stationIndex % STATIONS.length];
  const stepDur = 60 / station.bpm / 2;
  const horizon = radio.context.currentTime + 0.12;
  while (radio.nextStepTime < horizon) {
    const t = radio.nextStepTime;
    const s = radio.step;
    const bar = Math.floor(s / 8) % 4;
    const beat = s % 8;
    // Bass: one note per beat, from the station's 4-chord walk.
    if (beat % 2 === 0) {
      const deg = station.bass[bar];
      scheduleNote(radio, noteFreq(station, deg - 7), t, stepDur * 1.8, 'triangle', 0.22);
    }
    // Lead: sparse on the chill stations, busy on the fast ones.
    const leadOn = station.bpm >= 110 ? true : beat % 2 === 0;
    if (leadOn) {
      const deg = station.lead[s % station.lead.length];
      scheduleNote(radio, noteFreq(station, deg + 7), t, stepDur * 0.9, 'square', 0.05);
    }
    // Hat on the grid the station asks for.
    if (beat % station.hatEvery === 0) scheduleHat(radio, t);
    radio.step++;
    radio.nextStepTime += stepDur;
  }
  // Keep the playhead from running away if the tab was asleep.
  if (radio.nextStepTime < radio.context.currentTime - 0.5) {
    radio.nextStepTime = radio.context.currentTime + 0.05;
  }
}
