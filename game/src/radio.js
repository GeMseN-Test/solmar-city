// radio.js — in-game radio: 5 WebAudio synth stations, Q cycles.
// Own AudioContext, lazy (only after a user gesture), lookahead
// scheduler on an 8th-note grid, bass + lead + hat voices.
export const STATIONS = [
  { name: 'SOLMAR FM', tag: 'sunny pop', bpm: 112, minor: false, root: 261.63, bright: true },
  { name: 'HARBOR 98', tag: 'late-night swing', bpm: 96, minor: false, root: 220.0, swing: true },
  { name: 'NEON NIGHTS', tag: 'synthwave', bpm: 122, minor: true, root: 196.0, arp: true },
  { name: 'PALM DRIVE', tag: 'sunset chillwave', bpm: 100, minor: false, root: 246.94, pad: true },
  { name: 'MIDNIGHT DRIVE', tag: 'night cruise', bpm: 90, minor: true, root: 174.61, smooth: true },
];

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

function scaleFreq(station, degree, octave) {
  const scale = station.minor ? MINOR : MAJOR;
  const idx = ((degree % scale.length) + scale.length) % scale.length;
  const oct = octave + Math.floor(degree / scale.length);
  return station.root * Math.pow(2, scale[idx] / 12 + oct);
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
  const s = STATIONS[((radio.stationIndex % STATIONS.length) + STATIONS.length) % STATIONS.length];
  return s.name + ' — ' + s.tag;
}

export function stationName(radio) {
  return radioName(radio);
}

export function cycleRadio(radio) {
  radio.stationIndex = (radio.stationIndex + 1) % STATIONS.length;
  radio.step = 0;
  radio.nextStepTime = 0;
  return radioName(radio);
}

export function setRadioMuted(radio, muted) {
  radio.muted = !!muted;
  if (radio.master) radio.master.gain.value = radio.muted ? 0 : 0.4;
}

export function ensureRadio(radio) {
  if (radio.context) {
    if (radio.context.state === 'suspended') radio.context.resume();
    return radio.context;
  }
  try {
    const AC = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) || null;
    if (!AC) return null;
    radio.context = new AC();
    radio.master = radio.context.createGain();
    radio.master.gain.value = radio.muted ? 0 : 0.4;
    radio.master.connect(radio.context.destination);
    radio.nextStepTime = radio.context.currentTime + 0.05;
    radio.started = true;
  } catch (e) {
    radio.context = null;
  }
  return radio.context;
}

function playNote(radio, freq, time, dur, type, vol) {
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
  } catch (e) { /* ignore */ }
}

function playHat(radio, time, vol) {
  try {
    const len = Math.floor(radio.context.sampleRate * 0.04);
    const buf = radio.context.createBuffer(1, len, radio.context.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = radio.context.createBufferSource();
    src.buffer = buf;
    const f = radio.context.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6000;
    const g = radio.context.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(radio.master);
    src.start(time);
  } catch (e) { /* ignore */ }
}

function scheduleStep(radio, station, step, time) {
  const eighth = 60 / station.bpm / 2;
  const bar = Math.floor(step / 8) % 4;
  const beat = step % 8;
  // Bass: root on 0/4, fifth on 6, walk on swing.
  let bassDegree = 0;
  if (beat === 0) bassDegree = 0;
  else if (beat === 4) bassDegree = station.swing ? 4 : 0;
  else if (beat === 6) bassDegree = 4;
  else if (beat === 2 && station.swing) bassDegree = 2;
  else bassDegree = -1;
  if (bassDegree >= 0) {
    const deg = bassDegree + (bar === 3 ? 3 : 0);
    playNote(radio, scaleFreq(station, deg, -1), time, eighth * 1.8, station.pad ? 'sine' : 'triangle', station.pad ? 0.16 : 0.2);
  }
  // Lead / arp.
  if (station.arp) {
    const arpNotes = [0, 2, 4, 7, 4, 2];
    playNote(radio, scaleFreq(station, arpNotes[step % arpNotes.length], 1), time, eighth * 0.9, 'square', 0.07);
  } else if (station.pad) {
    if (beat === 0) {
      playNote(radio, scaleFreq(station, 0, 0), time, eighth * 6, 'sine', 0.08);
      playNote(radio, scaleFreq(station, 2, 0), time, eighth * 6, 'sine', 0.06);
    }
    if (beat === 4) playNote(radio, scaleFreq(station, 4, 1), time, eighth * 0.8, 'sine', 0.09);
  } else if (station.smooth) {
    if (beat === 0 || beat === 5) playNote(radio, scaleFreq(station, beat === 0 ? 0 : 3, 1), time, eighth * 1.5, 'sine', 0.1);
  } else {
    // Sunny pop / swing lead: sparse melody notes.
    const melody = [0, -1, 2, -1, 4, -1, 2, 4];
    const deg = melody[step % melody.length];
    if (deg >= 0) playNote(radio, scaleFreq(station, deg + (bar === 2 ? 1 : 0), 1), time, eighth * 0.9, station.swing ? 'sine' : 'square', station.swing ? 0.09 : 0.06);
  }
  // Hat on off-beats.
  if (beat % 2 === 1) playHat(radio, time, 0.05);
  if (beat === 0 || beat === 4) playHat(radio, time, 0.09);
}

export function tickRadio(radio) {
  if (!radio.context || !radio.master) return;
  if (radio.muted) return;
  const station = STATIONS[((radio.stationIndex % STATIONS.length) + STATIONS.length) % STATIONS.length];
  const eighth = 60 / station.bpm / 2;
  if (!radio.nextStepTime || radio.nextStepTime < radio.context.currentTime - 0.1) {
    radio.nextStepTime = radio.context.currentTime + 0.05;
  }
  let guard = 0;
  while (radio.nextStepTime < radio.context.currentTime + 0.25 && guard++ < 16) {
    scheduleStep(radio, station, radio.step, radio.nextStepTime);
    radio.step++;
    radio.nextStepTime += eighth;
  }
}

export function currentStation(radio) {
  return STATIONS[((radio.stationIndex % STATIONS.length) + STATIONS.length) % STATIONS.length];
}
export default createRadio;
