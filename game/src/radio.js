// radio.js — Solmar City's in-game radio.
//
// Four original synth stations, all generated live with WebAudio: no
// audio files, no network. Q cycles the dial; the HUD shows the station
// name. The radio keeps its OWN AudioContext (separate from the sound
// effects), created lazily by ensureRadio() after the first user gesture
// — browsers stay silent until the player has clicked or pressed a key.
//
// How it works: tickRadio() is called once a frame. It looks ahead a
// quarter of a second and schedules the next 8th notes on a grid —
// bass, lead and hi-hat — so the music stays in time whatever the
// frame rate does. Each station is just data: a tempo, a root note, and
// three 16-step patterns (two bars of eighth notes). `null` is a rest.
//
// The returned radio object:
//
//   { context, master, stationIndex, step, nextStepTime, started, muted }
//
//   createRadio()       a fresh radio, silent, tuned to station 0
//   radioStationCount() how many stations the dial has (4)
//   radioName(radio)    'NAME — tagline' for the HUD
//   cycleRadio(radio)   next station (wraps), restarts the pattern
//   ensureRadio(radio)  create the context; true when the radio can play
//   tickRadio(radio)    schedule upcoming notes; no-op without a context
//   setRadioMuted(radio, muted)

const STATIONS = [
  {
    name: 'SOLMAR FM',
    tagline: 'sunny pop',
    bpm: 112,
    root: 60, // C4
    minor: false,
    bass: [0, null, 7, null, 5, null, 7, null, 4, null, 7, null, 5, 7, null, null],
    lead: [12, null, null, 16, null, null, 14, null, 12, null, 19, null, 16, null, 14, null],
    hat: true,
  },
  {
    name: 'HARBOR 98',
    tagline: 'late-night swing',
    bpm: 96,
    root: 57, // A3
    minor: true,
    bass: [0, null, 4, null, 7, null, 10, null, 12, null, 10, null, 7, null, 4, null],
    lead: [12, null, null, null, 15, null, null, 12, null, null, 14, null, null, null, 12, null],
    hat: true,
  },
  {
    name: 'NEON NIGHTS',
    tagline: 'synthwave',
    bpm: 122,
    root: 57, // A3
    minor: true,
    bass: [0, 0, 12, 0, 0, 3, 0, 7, 0, 0, 12, 0, 10, 7, 3, 0],
    lead: [12, null, 15, null, 19, null, 15, null, 12, null, 24, null, 19, null, 15, null],
    hat: true,
  },
  {
    name: 'PALM DRIVE',
    tagline: 'sunset chillwave',
    bpm: 100,
    root: 62, // D4
    minor: false,
    bass: [0, null, null, 0, null, null, 7, null, 5, null, null, 5, null, null, 4, null],
    lead: [12, null, null, null, null, 14, null, null, 16, null, null, null, 14, null, 12, null],
    hat: false,
  },
];

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
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
  const station = STATIONS[radio.stationIndex % STATIONS.length];
  return `${station.name} — ${station.tagline}`;
}

export function cycleRadio(radio) {
  radio.stationIndex = (radio.stationIndex + 1) % STATIONS.length;
  radio.step = 0;
  radio.nextStepTime = 0;
  return radioName(radio);
}

export function ensureRadio(radio) {
  try {
    if (radio.context) {
      if (radio.context.state === 'suspended') void radio.context.resume();
      radio.started = true;
      return true;
    }
    const Ctor =
      typeof window !== 'undefined'
        ? window.AudioContext || window.webkitAudioContext
        : null;
    if (!Ctor) return false;
    radio.context = new Ctor();
    radio.master = radio.context.createGain();
    radio.master.gain.value = radio.muted ? 0 : 0.32;
    radio.master.connect(radio.context.destination);
    radio.started = true;
    if (radio.context.state === 'suspended') void radio.context.resume();
    return true;
  } catch {
    return false;
  }
}

export function setRadioMuted(radio, value) {
  radio.muted = !!value;
  if (radio.master && radio.context) {
    radio.master.gain.setTargetAtTime(radio.muted ? 0 : 0.32, radio.context.currentTime, 0.02);
  }
}

// Schedule the notes that fall due in the next quarter second.
export function tickRadio(radio) {
  const ctx = radio.context;
  if (!ctx || !radio.master) return;
  const station = STATIONS[radio.stationIndex % STATIONS.length];
  const stepDuration = 60 / station.bpm / 2;
  if (radio.nextStepTime < ctx.currentTime) {
    radio.nextStepTime = ctx.currentTime + 0.05;
  }
  while (radio.nextStepTime < ctx.currentTime + 0.25) {
    scheduleStep(radio, station, radio.step, radio.nextStepTime, stepDuration);
    radio.step += 1;
    radio.nextStepTime += stepDuration;
  }
}

function scheduleStep(radio, station, step, time, stepDuration) {
  const slot = step % 16;
  const bassNote = station.bass[slot];
  if (bassNote !== null && bassNote !== undefined) {
    playTone(radio, midiToFreq(station.root + bassNote - 12), time, stepDuration * 0.95, 'triangle', 0.16);
  }
  const leadNote = station.lead[slot];
  if (leadNote !== null && leadNote !== undefined) {
    const wave = station.minor ? 'sawtooth' : 'square';
    playTone(radio, midiToFreq(station.root + leadNote), time, stepDuration * 0.8, wave, 0.045);
  }
  if (station.hat && step % 2 === 0) {
    playTone(radio, 6800, time, 0.03, 'sine', 0.02);
  }
}

function playTone(radio, freq, time, duration, type, gain) {
  const ctx = radio.context;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, time);
  amp.gain.linearRampToValueAtTime(gain, time + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.connect(amp);
  amp.connect(radio.master);
  osc.start(time);
  osc.stop(time + duration + 0.05);
}
