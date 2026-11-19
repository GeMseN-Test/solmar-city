// radio.js — in-game radio: 5 WebAudio synth stations on one lazy
// AudioContext with a lookahead scheduler on an 8th-note grid.
// Bass + lead + hat voices per station. Only starts after a user
// gesture (Q press / New Game click); tickRadio is a no-op before that.

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

const STATIONS = [
  {
    name: 'SOLMAR FM',
    desc: 'sunny pop',
    bpm: 112,
    root: 60,
    scale: MAJOR,
    swing: false,
    bass: [0, null, 0, null, 5, null, 5, null, 4, null, 4, null, 5, null, 7, null],
    lead: [7, null, null, 9, null, null, 7, null, 9, null, null, 7, null, 9, null, null],
    bassVol: 0.16,
    leadVol: 0.09,
  },
  {
    name: 'HARBOR 98',
    desc: 'late-night swing',
    bpm: 96,
    root: 53,
    scale: MAJOR,
    swing: true,
    bass: [0, 2, 4, 5, 7, 5, 4, 2, 0, 2, 4, 5, 7, 9, 7, 5],
    lead: [7, null, null, null, 9, null, null, null, 7, null, 5, null, 4, null, null, null],
    bassVol: 0.15,
    leadVol: 0.08,
  },
  {
    name: 'NEON NIGHTS',
    desc: 'synthwave',
    bpm: 122,
    root: 57,
    scale: MINOR,
    swing: false,
    bass: [0, null, 7, null, 0, null, 10, null, 8, null, 7, null, 5, null, 3, null],
    lead: [12, null, 10, null, 12, null, 14, null, 15, null, 14, null, 12, null, 10, null],
    bassVol: 0.17,
    leadVol: 0.07,
  },
  {
    name: 'PALM DRIVE',
    desc: 'sunset chillwave',
    bpm: 100,
    root: 55,
    scale: MAJOR,
    swing: false,
    bass: [0, null, null, null, 5, null, null, null, 4, null, null, null, 5, null, null, null],
    lead: [7, null, null, null, null, null, 9, null, 7, null, null, null, null, 5, null, null],
    bassVol: 0.13,
    leadVol: 0.08,
  },
  {
    name: 'MIDNIGHT DRIVE',
    desc: 'night cruise',
    bpm: 90,
    root: 50,
    scale: MINOR,
    swing: false,
    bass: [0, null, null, null, 0, null, 3, null, 5, null, null, null, 3, null, 2, null],
    lead: [7, null, null, null, null, null, null, null, 10, null, null, null, null, null, 7, null],
    bassVol: 0.14,
    leadVol: 0.07,
  },
];

export function radioStationCount() {
  return STATIONS.length;
}

export function createRadio() {
  return {
    context: null,
    master: null,
    noiseBuf: null,
    stationIndex: 0,
    step: 0,
    nextStepTime: 0,
    started: false,
    muted: false,
  };
}

function stationOf(radio) {
  return STATIONS[radio.stationIndex % STATIONS.length];
}

export function radioName(radio) {
  const s = stationOf(radio);
  return s.name + ' — ' + s.desc;
}

export function ensureRadio(radio) {
  if (radio.context) {
    if (radio.context.state === 'suspended') {
      radio.context.resume().catch(() => {});
    }
    return radio;
  }
  try {
    const AC =
      typeof window !== 'undefined'
        ? window.AudioContext || window.webkitAudioContext
        : typeof AudioContext !== 'undefined'
          ? AudioContext
          : null;
    if (!AC) return radio;
    const ctx = new AC();
    radio.context = ctx;
    radio.master = ctx.createGain();
    radio.master.gain.value = radio.muted ? 0 : 0.35;
    radio.master.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 0.1);
    radio.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = radio.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    radio.started = true;
    radio.step = 0;
    radio.nextStepTime = ctx.currentTime + 0.1;
  } catch (e) {
    radio.context = null;
  }
  return radio;
}

export function setRadioMuted(radio, muted) {
  radio.muted = !!muted;
  if (radio.master && radio.context) {
    radio.master.gain.setTargetAtTime(radio.muted ? 0 : 0.35, radio.context.currentTime, 0.05);
  }
}

export function cycleRadio(radio) {
  radio.stationIndex = (radio.stationIndex + 1) % STATIONS.length;
  radio.step = 0;
  if (radio.context) {
    radio.nextStepTime = radio.context.currentTime + 0.05;
  }
  return radioName(radio);
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function degreeToMidi(station, degree, octaveUp) {
  const scale = station.scale;
  const idx = ((degree % 7) + 7) % 7;
  const oct = Math.floor(degree / 7);
  return station.root + scale[idx] + 12 * oct + 12 * (octaveUp || 0);
}

function playTone(radio, freq, time, dur, type, vol) {
  const ctx = radio.context;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  osc.connect(g);
  g.connect(radio.master);
  osc.start(time);
  osc.stop(time + dur + 0.02);
}

function playHat(radio, time, vol) {
  const ctx = radio.context;
  const src = ctx.createBufferSource();
  src.buffer = radio.noiseBuf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 6000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
  src.connect(filter);
  filter.connect(g);
  g.connect(radio.master);
  src.start(time);
  src.stop(time + 0.05);
}

function scheduleStep(radio, station, step, time, stepDur) {
  let t = time;
  if (station.swing && step % 2 === 1) {
    t += stepDur * 0.25;
  }
  const bassDeg = station.bass[step];
  if (bassDeg !== null && bassDeg !== undefined) {
    playTone(radio, midiToFreq(degreeToMidi(station, bassDeg, 0)), t, stepDur * 0.9, 'triangle', station.bassVol);
  }
  const leadDeg = station.lead[step];
  if (leadDeg !== null && leadDeg !== undefined) {
    playTone(radio, midiToFreq(degreeToMidi(station, leadDeg, 1)), t, stepDur * 0.8, 'square', station.leadVol);
  }
  if (step % 2 === 0) {
    playHat(radio, t, 0.05);
  }
}

export function tickRadio(radio) {
  if (!radio || !radio.context || !radio.started) return;
  const ctx = radio.context;
  const station = stationOf(radio);
  const stepDur = 60 / station.bpm / 2;
  while (radio.nextStepTime < ctx.currentTime + 0.15) {
    scheduleStep(radio, station, radio.step, radio.nextStepTime, stepDur);
    radio.nextStepTime += stepDur;
    radio.step = (radio.step + 1) % 16;
  }
}

// Module object for render.js: RadioMod.name(radio) is the station label.
export const RadioMod = {
  name: radioName,
  stationCount: radioStationCount,
  cycle: cycleRadio,
};
