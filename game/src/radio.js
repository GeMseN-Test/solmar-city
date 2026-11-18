// In-game radio: four original synth stations, all WebAudio, no files.
// Q cycles. Sound only starts after a gesture (Q press / New Game click),
// because browsers block audio before the player interacts.
import { clampNumber } from './util.js';

// One station: its tempo, its home note (MIDI), its mood, and two
// patterns — bass notes and lead notes, one slot per 8th-note step.
// A 0 in the lead pattern means "rest this step". Each pattern is 32
// steps long: two 16-step phrases, so the tune turns a corner halfway.
const STATIONS = [
  {
    name: 'SOLMAR FM — sunny pop',
    bpm: 112,
    root: 60,
    minor: false,
    swing: 0,
    pad: false,
    bass: [0, 0, 7, 0, 5, 0, 7, 0, 0, 0, 7, 0, 5, 7, 10, 7,
           0, 0, 7, 0, 5, 0, 7, 0, 3, 3, 7, 0, 5, 7, 10, 12],
    lead: [12, 0, 0, 16, 0, 0, 19, 0, 0, 17, 0, 0, 16, 0, 14, 0,
           12, 0, 0, 16, 0, 0, 19, 0, 21, 0, 19, 0, 17, 0, 16, 0],
  },
  {
    name: 'HARBOR 98 — late-night swing',
    bpm: 96,
    root: 55,
    minor: false,
    swing: 0.18,
    pad: false,
    bass: [0, 0, 0, 7, 0, 0, 5, 0, 0, 0, 0, 7, 0, 5, 0, 3,
           0, 0, 0, 7, 0, 0, 5, 0, 0, 0, 0, 7, 0, 5, 3, 2],
    lead: [12, 0, 0, 0, 0, 16, 0, 0, 0, 0, 19, 0, 0, 0, 17, 0,
           12, 0, 0, 0, 0, 16, 0, 0, 19, 0, 17, 0, 16, 0, 14, 0],
  },
  {
    name: 'NEON NIGHTS — synthwave',
    bpm: 122,
    root: 57,
    minor: true,
    swing: 0,
    pad: false,
    bass: [0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 5, 0,
           0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 5, 6],
    lead: [12, 15, 12, 0, 19, 0, 15, 0, 12, 15, 12, 0, 10, 0, 7, 0,
           12, 15, 12, 0, 19, 0, 15, 0, 22, 19, 15, 0, 17, 0, 15, 0],
  },
  {
    name: 'PALM DRIVE — sunset chillwave',
    bpm: 100,
    root: 62,
    minor: false,
    swing: 0,
    pad: true,
    bass: [0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 7, 0,
           0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 7, 10],
    lead: [12, 0, 0, 0, 0, 0, 0, 0, 16, 0, 0, 0, 0, 0, 19, 0,
           12, 0, 0, 0, 0, 0, 0, 0, 16, 0, 0, 0, 19, 0, 21, 0],
  },
];

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function note(ctx, out, freq, at, dur, type, vol) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(vol, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain);
  gain.connect(out);
  osc.start(at);
  osc.stop(at + dur + 0.05);
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

export function radioStationCount() {
  return STATIONS.length;
}

export function radioName(radio) {
  return STATIONS[radio.stationIndex % STATIONS.length].name;
}

// Next station, wrapping around. The pattern restarts clean.
export function cycleRadio(radio) {
  radio.stationIndex = (radio.stationIndex + 1) % STATIONS.length;
  radio.step = 0;
  radio.nextStepTime = 0;
}

// Build the audio context on first use. Silent no-op outside a browser.
export function ensureRadio(radio) {
  if (radio.context) return;
  if (typeof window === 'undefined') return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  radio.context = new AC();
  radio.master = radio.context.createGain();
  radio.master.gain.value = radio.muted ? 0 : 0.32;
  radio.master.connect(radio.context.destination);
  radio.started = true;
  radio.nextStepTime = 0;
}

export function setRadioMuted(radio, muted) {
  radio.muted = !!muted;
  if (radio.master) radio.master.gain.value = radio.muted ? 0 : 0.32;
}

// Schedule one 8th-note step: bass, a sparse lead, and a soft hat tick.
// Swing stations push the off-beat steps a little late.
function scheduleStep(radio, station, step, at) {
  const ctx = radio.context;
  const out = radio.master;
  const stepDur = 60 / station.bpm / 2;
  let time = at;
  if (station.swing && step % 2 === 1) time += stepDur * station.swing;
  const slot = step % 32;
  const bassNote = station.bass[slot];
  const bassFreq = midiToFreq(station.root + bassNote - 12);
  note(ctx, out, bassFreq, time, stepDur * 0.95, 'triangle', 0.22);
  if (station.pad) {
    // Chillwave: a warm pad hangs over the bass note.
    note(ctx, out, midiToFreq(station.root + bassNote), time, stepDur * 2.6, 'sine', 0.05);
    note(ctx, out, midiToFreq(station.root + bassNote + 7), time, stepDur * 2.6, 'sine', 0.04);
  }
  const leadNote = station.lead[slot];
  if (leadNote) {
    const wave = station.minor ? 'sawtooth' : 'square';
    note(ctx, out, midiToFreq(station.root + leadNote), time, stepDur * 0.9, wave, station.minor ? 0.06 : 0.05);
  }
  if (step % 2 === 1) {
    note(ctx, out, 6800, time, 0.03, 'square', 0.02);
  }
}

// Lookahead scheduler: called every frame, keeps ~0.15s of music queued.
export function tickRadio(radio) {
  const ctx = radio.context;
  if (!ctx || !radio.started || !radio.master) return;
  const station = STATIONS[radio.stationIndex % STATIONS.length];
  const stepDur = 60 / station.bpm / 2;
  if (radio.nextStepTime < ctx.currentTime) {
    radio.nextStepTime = ctx.currentTime + 0.05;
  }
  let guard = 0;
  while (radio.nextStepTime < ctx.currentTime + 0.15 && guard < 16) {
    scheduleStep(radio, station, radio.step, radio.nextStepTime);
    radio.nextStepTime += stepDur;
    radio.step = (radio.step + 1) % 64;
    guard += 1;
  }
}

// Keep the import used: clamping guards a station index from bad saves.
export function clampStation(index) {
  return clampNumber(index || 0, 0, STATIONS.length - 1);
}
