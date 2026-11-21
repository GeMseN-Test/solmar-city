// radio.js — in-game radio: 5 synth stations on one lazy AudioContext.
// Q cycles stations. The scheduler runs on an 8th-note grid with a
// lookahead so the music keeps time even when frames stutter. Nothing
// plays until a user gesture calls ensureRadio().

export const STATIONS = [
  { name: 'SOLMAR FM', desc: 'sunny pop', bpm: 112, mode: 'major', wave: 'triangle', bass: 'sine' },
  { name: 'HARBOR 98', desc: 'late-night swing', bpm: 96, mode: 'major', wave: 'sine', bass: 'triangle' },
  { name: 'NEON NIGHTS', desc: 'synthwave', bpm: 122, mode: 'minor', wave: 'sawtooth', bass: 'square' },
  { name: 'PALM DRIVE', desc: 'sunset chillwave', bpm: 100, mode: 'major', wave: 'sine', bass: 'sine' },
  { name: 'MIDNIGHT DRIVE', desc: 'night cruise', bpm: 90, mode: 'minor', wave: 'triangle', bass: 'sine' },
];

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
  if (!radio) return 'RADIO OFF';
  const st = STATIONS[radio.stationIndex % STATIONS.length];
  return st.name + ' — ' + st.desc;
}

export function stationName(radio) {
  return radioName(radio);
}

export function cycleRadio(radio) {
  if (!radio) return 0;
  radio.stationIndex = (radio.stationIndex + 1) % STATIONS.length;
  radio.step = 0;
  radio.started = false;
  return radio.stationIndex;
}

export function setRadioMuted(radio, muted) {
  if (!radio) return;
  radio.muted = !!muted;
  if (radio.master) radio.master.gain.value = radio.muted ? 0 : 0.32;
}

export function ensureRadio(radio) {
  if (!radio) return null;
  if (radio.context) {
    if (radio.context.state === 'suspended') radio.context.resume();
    return radio.context;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    radio.context = new AC();
    radio.master = radio.context.createGain();
    radio.master.gain.value = radio.muted ? 0 : 0.32;
    radio.master.connect(radio.context.destination);
    radio.nextStepTime = radio.context.currentTime + 0.05;
    radio.started = true;
    if (radio.context.state === 'suspended') radio.context.resume();
  } catch (e) {
    radio.context = null;
  }
  return radio.context;
}

function noteFreq(root, scale, degree, octave) {
  const idx = ((degree % scale.length) + scale.length) % scale.length;
  const oct = octave + Math.floor(degree / scale.length);
  return root * Math.pow(2, (scale[idx] + 12 * oct) / 12);
}

function scheduleNote(radio, freq, time, dur, type, vol) {
  const c = radio.context;
  if (!c || !radio.master) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), time + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  osc.connect(gain);
  gain.connect(radio.master);
  osc.start(time);
  osc.stop(time + dur + 0.05);
}

function scheduleHat(radio, time, vol) {
  const c = radio.context;
  if (!c || !radio.master) return;
  const len = Math.floor(c.sampleRate * 0.04);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
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
}

export function tickRadio(radio) {
  if (!radio || !radio.context || !radio.master) return;
  if (radio.muted) return;
  const c = radio.context;
  const st = STATIONS[radio.stationIndex % STATIONS.length];
  const stepDur = 60 / st.bpm / 2; // 8th notes
  const scale = st.mode === 'minor' ? MINOR : MAJOR;
  const root = st.mode === 'minor' ? 110 : 130.81;
  // Schedule ahead up to 0.15s so timing survives frame hitches.
  while (radio.nextStepTime < c.currentTime + 0.15) {
    const t = Math.max(radio.nextStepTime, c.currentTime);
    const s = radio.step;
    const bar = Math.floor(s / 8) % 4;
    // Bass: root on beats, fifth on the off-beats for swing stations.
    if (s % 2 === 0) {
      const deg = s % 8 === 6 ? 4 : 0;
      scheduleNote(radio, noteFreq(root / 2, scale, deg, 0), t, stepDur * 1.8, st.bass, 0.16);
    }
    // Lead: sparse melody, denser on synthwave.
    const leadEvery = st.name === 'NEON NIGHTS' ? 2 : 4;
    if (s % leadEvery === 1) {
      const seq = [0, 2, 4, 2, 5, 4, 2, 1];
      const deg = seq[(bar * 2 + Math.floor(s / leadEvery)) % seq.length];
      scheduleNote(radio, noteFreq(root, scale, deg, 1), t, stepDur * 1.4, st.wave, 0.07);
    }
    // Hat on every off-beat 8th.
    if (s % 2 === 1) scheduleHat(radio, t, 0.05);
    // Swing feel: HARBOR 98 delays the off-beat a touch.
    const swing = st.name === 'HARBOR 98' && s % 2 === 1 ? stepDur * 0.12 : 0;
    radio.nextStepTime += stepDur + swing;
    radio.step += 1;
  }
}

export default { createRadio, cycleRadio, radioName, ensureRadio, tickRadio, setRadioMuted, radioStationCount, STATIONS };
