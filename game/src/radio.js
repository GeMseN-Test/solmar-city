// radio.js — in-game radio: 5 synthesized WebAudio stations.
// Q cycles through all five. Each station has its own tempo, key and
// feel, played by a lookahead scheduler on an 8th-note grid with bass,
// lead and hat voices. Own AudioContext, created lazily after a user
// gesture (ensureRadio). tickRadio() is a no-op until then.

// Major / minor scale step tables (semitone offsets from the root).
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

export const STATIONS = [
  {
    name: 'SOLMAR FM',
    tag: 'sunny pop',
    bpm: 112,
    root: 57, // A3
    scale: MAJOR,
    bassPattern: [0, 0, 4, 0, 5, 0, 4, 3],
    leadPattern: [0, 2, 4, 7, 4, 2, 1, 2],
    hatEvery: 1,
    leadVol: 0.11,
    bassVol: 0.16,
  },
  {
    name: 'HARBOR 98',
    tag: 'late-night swing',
    bpm: 96,
    root: 53, // F3
    scale: MAJOR,
    bassPattern: [0, 4, 2, 4, 0, 4, 5, 4],
    leadPattern: [0, null, 2, null, 4, null, 2, null],
    hatEvery: 1,
    swing: true,
    leadVol: 0.09,
    bassVol: 0.17,
  },
  {
    name: 'NEON NIGHTS',
    tag: 'synthwave',
    bpm: 122,
    root: 45, // A2
    scale: MINOR,
    bassPattern: [0, 0, 0, 7, 0, 0, 5, 7],
    leadPattern: [0, 2, 4, 7, 9, 7, 4, 2],
    hatEvery: 1,
    leadVol: 0.12,
    bassVol: 0.15,
  },
  {
    name: 'PALM DRIVE',
    tag: 'sunset chillwave',
    bpm: 100,
    root: 55, // G3
    scale: MAJOR,
    bassPattern: [0, null, 4, null, 5, null, 4, null],
    leadPattern: [0, null, null, 4, null, 2, null, 1],
    hatEvery: 2,
    pad: true,
    leadVol: 0.09,
    bassVol: 0.13,
  },
  {
    name: 'MIDNIGHT DRIVE',
    tag: 'night cruise',
    bpm: 90,
    root: 50, // D3
    scale: MINOR,
    bassPattern: [0, null, 3, null, 5, null, 3, null],
    leadPattern: [0, null, null, 2, null, null, 4, null],
    hatEvery: 2,
    pad: true,
    leadVol: 0.08,
    bassVol: 0.14,
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
  };
}

// Full display name, e.g. "SOLMAR FM — sunny pop".
export function radioName(radio) {
  const st = STATIONS[radio.stationIndex % STATIONS.length];
  return `${st.name} — ${st.tag}`;
}

export function radioStation(radio) {
  return STATIONS[radio.stationIndex % STATIONS.length];
}

export function cycleRadio(radio) {
  radio.stationIndex = (radio.stationIndex + 1) % STATIONS.length;
  // Restart the pattern on the new station so the groove resets.
  radio.step = 0;
  if (radio.context) {
    radio.nextStepTime = radio.context.currentTime + 0.06;
  }
  return radio.stationIndex;
}

export function setRadioMuted(radio, muted) {
  radio.muted = !!muted;
  if (radio.master && radio.context) {
    radio.master.gain.setTargetAtTime(radio.muted ? 0 : 0.4, radio.context.currentTime, 0.02);
  }
}

// Create the AudioContext on first call (must come from a gesture).
// Idempotent: later calls just resume a suspended context.
export function ensureRadio(radio) {
  if (radio.context) {
    if (radio.context.state === 'suspended') radio.context.resume().catch(() => {});
    return radio.context;
  }
  try {
    const AC = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) || null;
    if (!AC) return null;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = radio.muted ? 0 : 0.4;
    master.connect(ctx.destination);
    radio.context = ctx;
    radio.master = master;
    radio.started = true;
    radio.nextStepTime = ctx.currentTime + 0.1;
    radio.step = 0;
  } catch (e) {
    radio.context = null;
    radio.master = null;
  }
  return radio.context;
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function noteAtTime(ctx, dest, freq, time, dur, type, vol) {
  try {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(vol, time + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  } catch (e) { /* never break the game for a note */ }
}

function hatAtTime(ctx, dest, time, vol) {
  try {
    const len = Math.floor(ctx.sampleRate * 0.03);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(time);
  } catch (e) { /* ignore */ }
}

// Schedule notes ahead of the playhead. Call every animation frame.
// No-op when the context does not exist yet (no gesture so far).
export function tickRadio(radio) {
  const ctx = radio.context;
  if (!ctx || !radio.master) return;
  if (ctx.state === 'suspended') return;
  const st = STATIONS[radio.stationIndex % STATIONS.length];
  const eighth = 60 / st.bpm / 2;
  const lookahead = 0.15;
  while (radio.nextStepTime < ctx.currentTime + lookahead) {
    const t = Math.max(radio.nextStepTime, ctx.currentTime);
    const step = radio.step % 8;
    const bar = Math.floor(radio.step / 8);
    // Swing: delay the off-beats a touch on HARBOR 98.
    let when = t;
    if (st.swing && step % 2 === 1) when = t + eighth * 0.25;
    // Bass voice: root an octave or two down, following the pattern.
    const bassDeg = st.bassPattern[step];
    if (bassDeg !== null && bassDeg !== undefined) {
      const scale = st.scale;
      const midi = st.root - 12 + scale[bassDeg % scale.length] + 12 * Math.floor(bassDeg / scale.length);
      noteAtTime(ctx, radio.master, midiToFreq(midi), when, eighth * 1.8, 'triangle', st.bassVol);
    }
    // Lead voice: sparkles on top, one octave up, transposed per bar
    // so the melody wanders instead of looping identically.
    const leadDeg = st.leadPattern[step];
    if (leadDeg !== null && leadDeg !== undefined) {
      const scale = st.scale;
      const shift = [0, 0, 2, 4][bar % 4];
      const deg = leadDeg + shift;
      const midi = st.root + 12 + scale[deg % scale.length] + 12 * Math.floor(deg / scale.length);
      const type = st.pad ? 'sine' : 'square';
      noteAtTime(ctx, radio.master, midiToFreq(midi), when, eighth * (st.pad ? 1.6 : 0.9), type, st.leadVol);
    }
    // Hat on the grid.
    if (step % st.hatEvery === 0) {
      hatAtTime(ctx, radio.master, when, 0.05);
    }
    radio.step++;
    radio.nextStepTime += eighth;
  }
}

export default {
  createRadio,
  cycleRadio,
  radioName,
  ensureRadio,
  tickRadio,
  setRadioMuted,
  radioStationCount,
};
