// In-game radio: five synthesized stations, no audio files.
// Each station is a little lookahead scheduler on an 8th-note
// grid — bass + lead + hat voices, all WebAudio oscillators —
// running on its own lazy AudioContext, so it only starts after
// the player has gestured (Q press / New Game click).
//
// Q cycles: SOLMAR FM -> HARBOR 98 -> NEON NIGHTS -> PALM DRIVE
// -> MIDNIGHT DRIVE -> back to SOLMAR FM.

const STATIONS = [
  {
    name: 'SOLMAR FM',
    tag: 'sunny pop',
    bpm: 112,
    minor: false,
    root: 60,
    scale: [0, 2, 4, 5, 7, 9, 11],
    bass: [0, -1, 0, -1, 4, -1, 3, -1],
    lead: [7, -1, -1, 4, -1, 7, -1, 5],
    hatEvery: 2,
    bassWave: 'triangle',
    leadWave: 'square',
  },
  {
    name: 'HARBOR 98',
    tag: 'late-night swing',
    bpm: 96,
    minor: false,
    root: 53,
    scale: [0, 2, 4, 5, 7, 9, 11],
    bass: [0, 2, 4, 5, 7, 5, 4, 2],
    lead: [4, -1, 7, -1, 5, -1, 4, -1],
    hatEvery: 2,
    swing: true,
    bassWave: 'sine',
    leadWave: 'triangle',
  },
  {
    name: 'NEON NIGHTS',
    tag: 'synthwave',
    bpm: 122,
    minor: true,
    root: 57,
    scale: [0, 2, 3, 5, 7, 8, 10],
    bass: [0, 0, 0, 3, 0, 0, 5, 3],
    lead: [7, -1, 10, -1, 7, -1, 8, -1],
    hatEvery: 1,
    bassWave: 'sawtooth',
    leadWave: 'square',
  },
  {
    name: 'PALM DRIVE',
    tag: 'sunset chillwave',
    bpm: 100,
    minor: false,
    root: 62,
    scale: [0, 2, 4, 5, 7, 9, 11],
    bass: [0, -1, -1, 0, -1, 3, -1, 4],
    lead: [4, -1, -1, 7, -1, -1, 5, -1],
    hatEvery: 2,
    bassWave: 'sine',
    leadWave: 'sine',
  },
  {
    name: 'MIDNIGHT DRIVE',
    tag: 'night cruise',
    bpm: 90,
    minor: true,
    root: 50,
    scale: [0, 2, 3, 5, 7, 8, 10],
    bass: [0, -1, 3, -1, 5, -1, 3, -1],
    lead: [7, -1, -1, 10, -1, 7, -1, 5],
    hatEvery: 2,
    bassWave: 'triangle',
    leadWave: 'triangle',
  },
];

export { STATIONS };

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function audioContextClass() {
  if (typeof window !== 'undefined') {
    return window.AudioContext || window.webkitAudioContext || null;
  }
  if (typeof globalThis !== 'undefined') {
    return globalThis.AudioContext || globalThis.webkitAudioContext || null;
  }
  return null;
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

export function radioStation(radio) {
  return STATIONS[radio.stationIndex % STATIONS.length];
}

export function radioName(radio) {
  const s = radioStation(radio);
  return s.name + ' — ' + s.tag;
}

// Advance to the next station, wrapping around. The step counter
// restarts so the new station begins on its downbeat.
export function cycleRadio(radio) {
  radio.stationIndex = (radio.stationIndex + 1) % STATIONS.length;
  radio.step = 0;
  if (radio.context) {
    radio.nextStepTime = radio.context.currentTime + 0.05;
  }
  return radioName(radio);
}

// Create the AudioContext on first gesture. Safe to call often.
export function ensureRadio(radio) {
  if (radio.context) return true;
  const AC = audioContextClass();
  if (!AC) return false;
  try {
    const c = new AC();
    radio.context = c;
    const master = c.createGain();
    master.gain.value = radio.muted ? 0 : 0.22;
    master.connect(c.destination);
    radio.master = master;
    radio.started = true;
    radio.nextStepTime = c.currentTime + 0.05;
    if (typeof c.resume === 'function') c.resume();
    return true;
  } catch {
    radio.context = null;
    return false;
  }
}

export function setRadioMuted(radio, muted) {
  radio.muted = !!muted;
  if (radio.master && radio.context) {
    radio.master.gain.setTargetAtTime(radio.muted ? 0 : 0.22, radio.context.currentTime, 0.05);
  }
}

function scheduleNote(radio, freq, time, dur, type, gain) {
  const c = radio.context;
  if (!c || !radio.master) return;
  try {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g);
    g.connect(radio.master);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  } catch {
    // A dropped note never breaks the frame.
  }
}

function scheduleStep(radio, stepIndex, time) {
  const s = radioStation(radio);
  const eighth = 60 / s.bpm / 2;
  if (s.swing && stepIndex % 2 === 1) time += eighth * 0.14;
  const bar = Math.floor(stepIndex / 8) % 4;
  const chordDegrees = [0, 5, 3, 4];
  const chordOffset = s.scale[chordDegrees[bar] % s.scale.length];
  const inBar = stepIndex % 8;

  const bassDeg = s.bass[inBar];
  if (bassDeg >= 0) {
    const midi = s.root - 12 + chordOffset + s.scale[bassDeg % s.scale.length];
    scheduleNote(radio, midiToFreq(midi), time, eighth * 0.95, s.bassWave, 0.32);
  }

  const leadDeg = s.lead[inBar];
  if (leadDeg >= 0) {
    const midi = s.root + 12 + s.scale[leadDeg % s.scale.length];
    scheduleNote(radio, midiToFreq(midi), time, eighth * 1.4, s.leadWave, 0.07);
  }

  if (stepIndex % s.hatEvery === 0) {
    scheduleNote(radio, 7200, time, 0.03, 'square', 0.012);
  }
}

// Lookahead scheduler: call every frame. No-ops until ensureRadio
// has built a context (i.e. until the player gestures).
export function tickRadio(radio) {
  const c = radio.context;
  if (!c || !radio.started) return;
  const s = radioStation(radio);
  const eighth = 60 / s.bpm / 2;
  if (radio.muted) {
    radio.nextStepTime = Math.max(radio.nextStepTime, c.currentTime + 0.1);
    return;
  }
  if (radio.nextStepTime < c.currentTime - 0.25) {
    radio.nextStepTime = c.currentTime + 0.05;
  }
  while (radio.nextStepTime < c.currentTime + 0.15) {
    scheduleStep(radio, radio.step, radio.nextStepTime);
    radio.step += 1;
    radio.nextStepTime += eighth;
  }
}
