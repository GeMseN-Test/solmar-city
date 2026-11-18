// Solmar City's in-game radio: three original synth stations, played live
// through WebAudio — no audio files, no network. Q cycles the station;
// the HUD shows what is playing. The radio only starts after a user
// gesture (a key press or a click), because browsers demand one before
// any sound. Each station is a small step sequencer: a bass line, a lead
// line and a hat, all built from plain oscillators on an 8th-note grid.

const STATIONS = [
  {
    name: 'SOLMAR FM',
    tag: 'sunny pop',
    bpm: 112,
    // C major, bright and breezy: the sound of driving with the windows down.
    root: 130.81, // C3
    bassSteps: [0, null, 7, null, 5, null, 7, null, 0, null, 7, null, 10, null, 7, null],
    leadSteps: [12, null, 16, 19, 16, null, 12, null, 14, null, 16, null, 19, 21, 19, 16],
    leadWave: 'triangle',
    bassWave: 'sine',
  },
  {
    name: 'HARBOR 98',
    tag: 'late-night swing',
    bpm: 96,
    // F major 7th flavour, swung: walking bass under a lazy Rhodes-ish lead.
    root: 87.31, // F2
    bassSteps: [0, null, 5, null, 7, null, 10, null, 0, null, 5, null, 7, null, 3, null],
    leadSteps: [12, null, null, 16, null, 19, null, null, 17, null, null, 16, null, 14, null, 12],
    leadWave: 'sine',
    bassWave: 'triangle',
  },
  {
    name: 'NEON NIGHTS',
    tag: 'synthwave',
    bpm: 122,
    // A minor arpeggios over a driving bass: the city after dark.
    root: 110.0, // A2
    bassSteps: [0, 0, 12, 0, 0, 7, 0, 12, 0, 0, 12, 0, 10, 0, 7, 5],
    leadSteps: [12, 15, 19, 24, 19, 15, 12, 15, 12, 15, 19, 22, 19, 15, 12, 7],
    leadWave: 'sawtooth',
    bassWave: 'square',
  },
];

// A semitone step above the station root, equal temperament.
function noteFreq(station, semitones) {
  return station.root * Math.pow(2, semitones / 12);
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

/** The station currently playing, or the one that will play. */
export function radioName(radio) {
  const station = STATIONS[radio.stationIndex];
  return `${station.name} — ${station.tag}`;
}

/** How many stations the dial has. */
export function radioStationCount() {
  return STATIONS.length;
}

/** Create the audio context on first use; resume it after a gesture. */
export function ensureRadio(radio) {
  if (typeof window === 'undefined' || !window.AudioContext) return;
  if (!radio.context) {
    const context = new window.AudioContext();
    const master = context.createGain();
    master.gain.value = 0.16;
    master.connect(context.destination);
    radio.context = context;
    radio.master = master;
    radio.nextStepTime = context.currentTime + 0.1;
  }
  if (radio.context.state === 'suspended') radio.context.resume();
}

/** Switch to the next station. Starts the radio if it never ran. */
export function cycleRadio(radio) {
  ensureRadio(radio);
  radio.stationIndex = (radio.stationIndex + 1) % STATIONS.length;
  radio.step = 0;
  if (radio.context) radio.nextStepTime = radio.context.currentTime + 0.05;
  radio.started = true;
  return radioName(radio);
}

/** Silence the radio without forgetting the station. */
export function setRadioMuted(radio, muted) {
  radio.muted = muted;
  if (radio.master) radio.master.gain.value = muted ? 0 : 0.16;
}

function playNote(radio, freq, when, duration, wave, volume) {
  const context = radio.context;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = wave;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(volume, when + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
  osc.connect(gain);
  gain.connect(radio.master);
  osc.start(when);
  osc.stop(when + duration + 0.05);
}

function playHat(radio, when, volume) {
  const context = radio.context;
  const length = Math.floor(context.sampleRate * 0.03);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = context.createBufferSource();
  source.buffer = buffer;
  const gain = context.createGain();
  gain.gain.value = volume;
  const filter = context.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 6000;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(radio.master);
  source.start(when);
}

function scheduleStep(radio, station, stepIndex, when) {
  const eighth = 60 / station.bpm / 2;
  const bass = station.bassSteps[stepIndex];
  if (bass !== null && bass !== undefined) {
    playNote(radio, noteFreq(station, bass), when, eighth * 1.8, station.bassWave, 0.5);
  }
  const lead = station.leadSteps[stepIndex];
  if (lead !== null && lead !== undefined) {
    const soft = station.leadWave === 'sawtooth' ? 0.1 : 0.16;
    playNote(radio, noteFreq(station, lead) * 2, when, eighth * 1.4, station.leadWave, soft);
  }
  // Hats tick on the off-beats; the swing station swings them.
  if (stepIndex % 2 === 1) playHat(radio, when, 0.12);
  return eighth;
}

/**
 * Called every frame from the main loop: schedules the notes a little
 * ahead of time, so the music keeps playing even when a frame stutters.
 * Silent until ensureRadio() has run (that is, until the player pressed
 * a key or clicked) — before that there is no context to schedule on.
 */
export function tickRadio(radio) {
  if (!radio.context || radio.muted) return;
  if (radio.context.state !== 'running') return;
  const station = STATIONS[radio.stationIndex];
  const eighth = 60 / station.bpm / 2;
  while (radio.nextStepTime < radio.context.currentTime + 0.15) {
    scheduleStep(radio, station, radio.step, radio.nextStepTime);
    radio.step = (radio.step + 1) % 16;
    radio.nextStepTime += eighth;
  }
}
