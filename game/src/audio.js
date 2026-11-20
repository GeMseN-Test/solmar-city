// audio.js — Solmar City sound effects + tiny music engine (WebAudio).
// All methods are safe before ensure() is called (no-ops until a user
// gesture creates the AudioContext). ensure() is idempotent.

export function createAudio() {
  const audio = {
    context: null,
    master: null,
    sfx: null,
    muted: false,
    sirenNodes: null,
    musicStep: 0,
    musicNextTime: 0,
    musicOn: false,
  };
  // Finisher fix (v2-retry integration): main.js calls the method-style API
  // from the spec (audio.ensure(), audio.shot(), ...), but createAudio()
  // returned a bare state object — the first call threw and the whole game
  // never booted in a browser. Attach bound method wrappers here; the
  // standalone functions below stay exported and unchanged.
  audio.ensure = () => ensure(audio);
  audio.isMuted = () => isMuted(audio);
  audio.setMuted = (muted) => setMuted(audio, muted);
  audio.engine = (norm01) => engine(audio, norm01);
  audio.siren = (on) => siren(audio, on);
  audio.stepMusic = () => stepMusic(audio);
  audio.shot = () => shot(audio);
  audio.enemyShot = () => enemyShot(audio);
  audio.punch = () => punch(audio);
  audio.crash = (force) => crash(audio, force);
  audio.pickup = (kind) => pickup(audio, kind);
  audio.missionComplete = () => missionComplete(audio);
  audio.click = () => click(audio);
  audio.busted = () => busted(audio);
  audio.setMusicOn = (on) => setMusicOn(audio, on);
  return audio;
}

export function isMuted(audio) {
  return !audio || !!audio.muted;
}

export function setMuted(audio, muted) {
  if (!audio) return;
  audio.muted = !!muted;
  if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
}

export function ensure(audio) {
  if (!audio || audio.context) return audio ? audio.context : null;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audio.context = new AC();
    audio.master = audio.context.createGain();
    audio.master.gain.value = audio.muted ? 0 : 0.5;
    audio.master.connect(audio.context.destination);
    audio.sfx = audio.context.createGain();
    audio.sfx.gain.value = 0.9;
    audio.sfx.connect(audio.master);
    if (audio.context.state === 'suspended') audio.context.resume();
  } catch (err) {
    audio.context = null;
  }
  return audio ? audio.context : null;
}

function tone(audio, freq, dur, type, vol, when, slideTo) {
  if (!audio || !audio.context || !audio.sfx || audio.muted) return;
  const t0 = when || audio.context.currentTime;
  const osc = audio.context.createOscillator();
  const gain = audio.context.createGain();
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol || 0.2, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain);
  gain.connect(audio.sfx);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noiseBurst(audio, dur, vol, filterFreq) {
  if (!audio || !audio.context || !audio.sfx || audio.muted) return;
  const ctx = audio.context;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq || 1200;
  const gain = ctx.createGain();
  gain.gain.value = vol || 0.25;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audio.sfx);
  src.start();
}

export function shot(audio) {
  if (!audio || !audio.context) return;
  noiseBurst(audio, 0.12, 0.4, 2800);
  tone(audio, 180, 0.1, 'square', 0.22, 0, 60);
}

export function enemyShot(audio) {
  if (!audio || !audio.context) return;
  noiseBurst(audio, 0.1, 0.22, 1800);
  tone(audio, 140, 0.09, 'square', 0.12, 0, 55);
}

export function punch(audio) {
  if (!audio || !audio.context) return;
  noiseBurst(audio, 0.08, 0.3, 500);
  tone(audio, 90, 0.08, 'sine', 0.25, 0, 45);
}

export function crash(audio, force) {
  if (!audio || !audio.context) return;
  const f = typeof force === 'number' ? Math.min(1, Math.max(0, force)) : 0.5;
  noiseBurst(audio, 0.18 + 0.15 * f, 0.2 + 0.35 * f, 900);
  tone(audio, 70, 0.2, 'sawtooth', 0.15 + 0.2 * f, 0, 35);
}

export function pickup(audio, kind) {
  if (!audio || !audio.context) return;
  const base = kind === 'health' ? 520 : kind === 'ammo' ? 420 : 660;
  tone(audio, base, 0.09, 'sine', 0.25);
  tone(audio, base * 1.5, 0.14, 'sine', 0.25, audio.context.currentTime + 0.08);
}

export function missionComplete(audio) {
  if (!audio || !audio.context) return;
  const t = audio.context.currentTime;
  const notes = [523, 659, 784, 1047];
  for (let i = 0; i < notes.length; i++) {
    tone(audio, notes[i], 0.18, 'triangle', 0.28, t + i * 0.11);
  }
}

export function click(audio) {
  if (!audio || !audio.context) return;
  tone(audio, 880, 0.05, 'square', 0.12);
}

export function busted(audio) {
  if (!audio || !audio.context) return;
  const t = audio.context.currentTime;
  tone(audio, 392, 0.25, 'sawtooth', 0.2, t, 196);
  tone(audio, 311, 0.4, 'sawtooth', 0.2, t + 0.24, 155);
}

export function engine(audio, norm01) {
  if (!audio || !audio.context || audio.muted) return;
  const n = Math.min(1, Math.max(0, norm01 || 0));
  if (!audio.engineNodes) {
    const osc = audio.context.createOscillator();
    const gain = audio.context.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    gain.gain.value = 0;
    const filter = audio.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    osc.start();
    audio.engineNodes = { osc, gain, filter };
  }
  const nodes = audio.engineNodes;
  const t = audio.context.currentTime;
  nodes.osc.frequency.setTargetAtTime(55 + n * 165, t, 0.08);
  nodes.filter.frequency.setTargetAtTime(350 + n * 900, t, 0.08);
  nodes.gain.gain.setTargetAtTime(n > 0.02 ? 0.05 + n * 0.06 : 0, t, 0.1);
}

export function siren(audio, on) {
  if (!audio || !audio.context) return;
  if (!on) {
    if (audio.sirenNodes) {
      try { audio.sirenNodes.osc.stop(); } catch (e) {}
      try { audio.sirenNodes.gain.disconnect(); } catch (e) {}
      audio.sirenNodes = null;
    }
    return;
  }
  if (audio.sirenNodes || audio.muted) return;
  const osc = audio.context.createOscillator();
  const gain = audio.context.createGain();
  const lfo = audio.context.createOscillator();
  const lfoGain = audio.context.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 750;
  lfo.type = 'sine';
  lfo.frequency.value = 0.9;
  lfoGain.gain.value = 180;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  gain.gain.value = 0.045;
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start();
  lfo.start();
  audio.sirenNodes = { osc, gain, lfo };
}

// Tiny cruise-music loop: soft bass pulse + sparkle, 8th-note grid.
const MUSIC_BASS = [55, 55, 65.41, 49, 55, 55, 73.42, 82.41];
const MUSIC_LEAD = [220, 0, 261.63, 0, 329.63, 0, 392, 0];

export function stepMusic(audio) {
  if (!audio || !audio.context || audio.muted || !audio.musicOn) return;
  const ctx = audio.context;
  const stepDur = 60 / 100 / 2;
  if (audio.musicNextTime < ctx.currentTime) audio.musicNextTime = ctx.currentTime + 0.05;
  while (audio.musicNextTime < ctx.currentTime + 0.25) {
    const i = audio.musicStep % 8;
    const bass = MUSIC_BASS[i];
    if (bass) tone(audio, bass, stepDur * 1.8, 'triangle', 0.16, audio.musicNextTime);
    const lead = MUSIC_LEAD[i];
    if (lead) tone(audio, lead, stepDur * 0.9, 'sine', 0.07, audio.musicNextTime);
    audio.musicStep++;
    audio.musicNextTime += stepDur;
  }
}

export function setMusicOn(audio, on) {
  if (!audio) return;
  audio.musicOn = !!on;
  if (on) ensure(audio);
}

export default createAudio;
