// radio.js — in-game radio: five synthesized stations, no audio
// files. Each station is a little step sequencer on an 8th-note
// grid: a bass line, a lead line and a hi-hat, scheduled a little
// ahead of time so it never stutters. The AudioContext is created
// lazily — only after a user gesture (Q press / New Game click) —
// because browsers block audio before that.

export const STATIONS = [
  {
    name: 'SOLMAR FM — sunny pop',
    short: 'SOLMAR FM',
    bpm: 112,
    minor: false,
    bass: [0, 0, 4, 0, 5, 0, 4, 0, 0, 0, 4, 0, 2, 0, 5, 0],
    lead: [0, 7, 0, 9, 0, 12, 0, 9, 0, 7, 0, 5, 0, 4, 0, 2],
    root: 220,
  },
  {
    name: 'HARBOR 98 — late-night swing',
    short: 'HARBOR 98',
    bpm: 96,
    minor: false,
    bass: [0, 0, 0, 4, 0, 0, 5, 0, 0, 0, 0, 4, 0, 2, 0, 5],
    lead: [0, 0, 7, 0, 0, 9, 0, 0, 12, 0, 0, 9, 0, 7, 0, 0],
    root: 196,
    swing: true,
  },
  {
    name: 'NEON NIGHTS — synthwave',
    short: 'NEON NIGHTS',
    bpm: 122,
    minor: true,
    bass: [0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 5, 0, 6, 0],
    lead: [12, 0, 10, 0, 12, 0, 15, 0, 12, 0, 10, 0, 8, 0, 7, 0],
    root: 220,
  },
  {
    name: 'PALM DRIVE — sunset chillwave',
    short: 'PALM DRIVE',
    bpm: 100,
    minor: false,
    bass: [0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 5, 0, 0, 0],
    lead: [0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 9, 0, 0, 0, 12, 0],
    root: 207.65,
    pad: true,
  },
  {
    name: 'MIDNIGHT DRIVE — night cruise',
    short: 'MIDNIGHT DRIVE',
    bpm: 90,
    minor: true,
    bass: [0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 5, 0],
    lead: [0, 0, 0, 0, 12, 0, 0, 0, 0, 0, 0, 10, 0, 0, 0, 8],
    root: 185,
    pad: true,
  },
];

// Semitone steps for a major scale and a minor scale (one octave).
const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12];
const MINOR = [0, 2, 3, 5, 7, 8, 10, 12];

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

export function radioShortName(radio) {
  return STATIONS[radio.stationIndex % STATIONS.length].short;
}

// Next station, wrapping around to the first after the last.
export function cycleRadio(radio) {
  radio.stationIndex = (radio.stationIndex + 1) % STATIONS.length;
  radio.step = 0;
  return radioName(radio);
}

export function setRadioMuted(radio, muted) {
  radio.muted = !!muted;
  if (radio.master && radio.context) {
    radio.master.gain.value = radio.muted ? 0 : 0.32;
  }
}

// Create the station's own AudioContext (lazy — after a gesture).
// Idempotent: later calls just resume a suspended context.
export function ensureRadio(radio) {
  try {
    if (typeof window === 'undefined') return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!radio.context) {
      radio.context = new AC();
      radio.master = radio.context.createGain();
      radio.master.gain.value = radio.muted ? 0 : 0.32;
      radio.master.connect(radio.context.destination);
      radio.nextStepTime = radio.context.currentTime + 0.05;
    }
    if (radio.context.state === 'suspended') {
      radio.context.resume();
    }
    radio.started = true;
  } catch (err) {
    // No audio — the radio stays silent and the game goes on.
  }
}

function noteFreq(station, degree) {
  const scale = station.minor ? MINOR : MAJOR;
  const oct = Math.floor(degree / 7);
  const step = scale[degree % 7];
  return station.root * Math.pow(2, (step + oct * 12) / 12);
}

function playNote(radio, freq, when, dur, type, vol) {
  const c = radio.context;
  if (!c || !radio.master) return;
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(gain);
    gain.connect(radio.master);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  } catch (err) {
    // Ignore a failed note.
  }
}

function playHat(radio, when, vol) {
  const c = radio.context;
  if (!c || !radio.master) return;
  try {
    const len = Math.floor(c.sampleRate * 0.04);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const gain = c.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(radio.master);
    src.start(when);
  } catch (err) {
    // Ignore.
  }
}

// Schedule upcoming 8th notes. No-op when there is no context yet.
// Call every frame from the main loop; the lookahead keeps the
// music steady even if a frame runs long.
export function tickRadio(radio) {
  const c = radio.context;
  if (!c || !radio.master || radio.muted) return;
  try {
    const station = STATIONS[radio.stationIndex % STATIONS.length];
    const stepDur = 60 / station.bpm / 2;
    if (radio.nextStepTime < c.currentTime) {
      radio.nextStepTime = c.currentTime + 0.05;
    }
    while (radio.nextStepTime < c.currentTime + 0.18) {
      const when = radio.nextStepTime;
      const stepIndex = radio.step % 16;
      let whenNote = when;
      if (station.swing && radio.step % 2 === 1) {
        whenNote = when + stepDur * 0.22;
      }
      const bassDeg = station.bass[stepIndex];
      if (bassDeg !== undefined && bassDeg !== 0) {
        playNote(radio, noteFreq(station, bassDeg - 1) / 2, whenNote, stepDur * 1.8, 'triangle', 0.22);
      } else if (station.bass[stepIndex] === 0 && stepIndex % 4 === 0) {
        playNote(radio, station.root / 2, whenNote, stepDur * 1.6, 'triangle', 0.16);
      }
      if (station.pad && stepIndex % 8 === 0) {
        playNote(radio, noteFreq(station, 0), whenNote, stepDur * 7, 'sine', 0.05);
        playNote(radio, noteFreq(station, 4), whenNote, stepDur * 7, 'sine', 0.04);
      }
      const leadDeg = station.lead[stepIndex];
      if (leadDeg) {
        playNote(radio, noteFreq(station, leadDeg - 1), whenNote, stepDur * 0.9, station.minor ? 'sawtooth' : 'square', 0.07);
      }
      if (radio.step % 2 === 0) {
        playHat(radio, whenNote, 0.05);
      }
      radio.step++;
      radio.nextStepTime += stepDur;
    }
  } catch (err) {
    // A scheduling hiccup must never break the frame.
  }
}

export default createRadio;
