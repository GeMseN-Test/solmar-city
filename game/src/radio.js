// In-game radio for Solmar City. Five synthesized stations, all
// WebAudio, no audio files. Each station has its own tempo, key and
// patterns; a lookahead scheduler plays bass + lead + hats on an
// 8th-note grid. The context is created lazily — only after a user
// gesture (Q press / New Game click) — so browsers never block it.

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

function midiFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

// One entry per station. bass/lead are 16 steps (two bars of 8ths);
// a number is a scale degree, null is a rest. hat lists which steps
// get a hi-hat tick. pad stations hold a soft chord at each bar line.
export const STATIONS = [
  {
    name: 'SOLMAR FM — sunny pop',
    bpm: 112,
    root: 48,
    scale: MAJOR,
    swing: 0,
    bass: [0, null, 0, null, 4, null, 0, null, 5, null, 5, null, 4, null, 7, null],
    lead: [0, null, 2, null, 4, null, 2, null, 4, null, 6, null, 4, 2, 1, null],
    leadWave: 'square',
    hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    pad: false,
  },
  {
    name: 'HARBOR 98 — late-night swing',
    bpm: 96,
    root: 50,
    scale: MAJOR,
    swing: 0.16,
    bass: [0, 2, 4, 5, 4, 2, 1, 0, 0, 2, 4, 5, 7, 5, 4, 2],
    lead: [4, null, null, 2, null, null, 5, null, 4, null, null, 2, null, 1, null, null],
    leadWave: 'triangle',
    hat: [0, 2, 4, 6, 8, 10, 12, 14],
    pad: false,
  },
  {
    name: 'NEON NIGHTS — synthwave',
    bpm: 122,
    root: 45,
    scale: MINOR,
    swing: 0,
    bass: [0, null, 0, 0, 0, null, 7, null, 0, null, 0, 0, 5, null, 4, null],
    lead: [0, 2, 4, 6, 4, 2, 0, 2, 0, 2, 4, 6, 7, 6, 4, 2],
    leadWave: 'sawtooth',
    hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    pad: false,
  },
  {
    name: 'PALM DRIVE — sunset chillwave',
    bpm: 100,
    root: 48,
    scale: MAJOR,
    swing: 0,
    bass: [0, null, null, null, 4, null, null, null, 5, null, null, null, 4, null, 3, null],
    lead: [0, null, null, null, null, 2, null, null, 4, null, null, null, null, null, 2, null],
    leadWave: 'sine',
    hat: [2, 6, 10, 14],
    pad: true,
  },
  {
    name: 'MIDNIGHT DRIVE — night cruise',
    bpm: 90,
    root: 43,
    scale: MINOR,
    swing: 0,
    bass: [0, null, null, 0, null, null, 3, null, 0, null, null, 0, null, 5, null, 4],
    lead: [0, null, null, null, 2, null, null, null, 4, null, 3, null, 2, null, null, null],
    leadWave: 'triangle',
    hat: [0, 4, 8, 12],
    pad: false,
  },
];

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
    noiseBuffer: null,
  };
}

export function radioName(radio) {
  return STATIONS[radio.stationIndex % STATIONS.length].name;
}

export function cycleRadio(radio) {
  radio.stationIndex = (radio.stationIndex + 1) % STATIONS.length;
  radio.step = 0;
  if (radio.context) {
    radio.nextStepTime = radio.context.currentTime + 0.06;
  }
  return radioName(radio);
}

// Create the AudioContext on first use (must be called from a user
// gesture the first time). Idempotent — later calls just resume.
export function ensureRadio(radio) {
  if (radio.context) {
    if (radio.context.state === 'suspended') radio.context.resume();
    return radio.context;
  }
  try {
    const AC = typeof window !== 'undefined'
      ? (window.AudioContext || window.webkitAudioContext)
      : undefined;
    if (!AC) return null;
    const c = new AC();
    radio.context = c;
    radio.master = c.createGain();
    radio.master.gain.value = radio.muted ? 0 : 0.4;
    radio.master.connect(c.destination);
    const len = Math.floor(c.sampleRate * 0.05);
    const buffer = c.createBuffer(1, len, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    radio.noiseBuffer = buffer;
    radio.nextStepTime = c.currentTime + 0.08;
    radio.step = 0;
    radio.started = true;
    if (c.state === 'suspended') c.resume();
  } catch (e) {
    radio.context = null;
  }
  return radio.context;
}

export function setRadioMuted(radio, muted) {
  radio.muted = !!muted;
  if (radio.master) radio.master.gain.value = radio.muted ? 0 : 0.4;
}

function playTone(radio, type, freq, time, dur, vol) {
  const c = radio.context;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = Math.max(20, freq);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(vol, time + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  osc.connect(gain);
  gain.connect(radio.master);
  osc.start(time);
  osc.stop(time + dur + 0.05);
}

function playHat(radio, time, vol) {
  const c = radio.context;
  const src = c.createBufferSource();
  src.buffer = radio.noiseBuffer;
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 6000;
  const gain = c.createGain();
  gain.gain.setValueAtTime(vol, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(radio.master);
  src.start(time);
  src.stop(time + 0.06);
}

function scheduleStep(radio, station, stepIndex, time) {
  const stepDur = 60 / station.bpm / 2;
  let t = time;
  if (station.swing && stepIndex % 2 === 1) t += stepDur * station.swing;

  const bassDeg = station.bass[stepIndex];
  if (bassDeg !== null && bassDeg !== undefined) {
    const midi = station.root + station.scale[bassDeg % station.scale.length];
    playTone(radio, 'triangle', midiFreq(midi), t, stepDur * 0.92, 0.22);
  }
  const leadDeg = station.lead[stepIndex];
  if (leadDeg !== null && leadDeg !== undefined) {
    const midi = station.root + 24 + station.scale[leadDeg % station.scale.length];
    playTone(radio, station.leadWave, midiFreq(midi), t, stepDur * 0.85, 0.085);
  }
  if (station.hat.includes(stepIndex)) playHat(radio, t, 0.05);
  if (station.pad && (stepIndex === 0 || stepIndex === 8)) {
    for (const deg of [0, 2, 4]) {
      const midi = station.root + 12 + station.scale[deg % station.scale.length];
      playTone(radio, 'triangle', midiFreq(midi), t, stepDur * 8, 0.035);
    }
  }
}

// Called every animation frame. Schedules notes ~0.15s ahead so the
// music never stutters. No-op until ensureRadio() has run.
export function tickRadio(radio) {
  const c = radio.context;
  if (!c || !radio.started) return;
  if (c.state === 'suspended') {
    c.resume();
    return;
  }
  const station = STATIONS[radio.stationIndex % STATIONS.length];
  const stepDur = 60 / station.bpm / 2;
  if (radio.nextStepTime < c.currentTime - 0.25) {
    radio.nextStepTime = c.currentTime + 0.05;
  }
  while (radio.nextStepTime < c.currentTime + 0.15) {
    scheduleStep(radio, station, radio.step, radio.nextStepTime);
    radio.nextStepTime += stepDur;
    radio.step = (radio.step + 1) % 16;
  }
}

export default createRadio;
