// All sound is synthesized with WebAudio — no audio files anywhere.
// Every method is safe to call before ensure() (it just does nothing),
// and ensure() is idempotent: the context is built once, after a gesture.
import { clampNumber } from './util.js';

// One short oscillator blip with a quick fade, so nothing clicks.
function tone(ctx, out, opts) {
  const type = opts.type || 'sine';
  const freq = opts.freq || 440;
  const freqEnd = opts.freqEnd === undefined ? null : opts.freqEnd;
  const dur = opts.dur || 0.15;
  const vol = opts.vol || 0.2;
  const when = opts.when || 0;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(1, freq), t0);
  if (freqEnd !== null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
  }
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// One burst of filtered noise — gunshots, crashes, punches.
function noiseBurst(ctx, out, opts) {
  const dur = opts.dur || 0.1;
  const vol = opts.vol || 0.3;
  const freq = opts.freq || 1200;
  const when = opts.when || 0;
  const t0 = ctx.currentTime + when;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  src.start(t0);
}

// A quiet bass groove that steps forward a little on every call, so the
// title screen and the drive both hum along without a music file.
// Two 16-step phrases, so the line turns a corner halfway through.
const GROOVE = [0, 0, 7, 0, 10, 0, 7, 5, 0, 0, 7, 0, 12, 10, 7, 5,
                0, 0, 7, 0, 10, 0, 7, 3, 0, 0, 7, 0, 12, 10, 5, 3];
const GROOVE_ROOT = 55;

export function createAudio() {
  const audio = {
    context: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenLfo: null,
    musicStep: 0,
    nextMusicTime: 0,
  };

  function ctx() {
    return audio.context;
  }

  function out() {
    return audio.master;
  }

  function ready() {
    return audio.context !== null && audio.master !== null;
  }

  audio.ensure = function ensure() {
    if (audio.context) {
      if (audio.context.state === 'suspended') audio.context.resume();
      return;
    }
    if (typeof window === 'undefined') return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio.context = new AC();
    audio.master = audio.context.createGain();
    audio.master.gain.value = audio.muted ? 0 : 0.6;
    audio.master.connect(audio.context.destination);
    // Engine hum: a low sawtooth whose pitch follows the speed.
    audio.engineOsc = audio.context.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 52;
    audio.engineGain = audio.context.createGain();
    audio.engineGain.gain.value = 0;
    const engineFilter = audio.context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    audio.engineOsc.connect(engineFilter);
    engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    // Siren: a square wave wobbling between two tones, off until needed.
    audio.sirenOsc = audio.context.createOscillator();
    audio.sirenOsc.type = 'square';
    audio.sirenOsc.frequency.value = 720;
    audio.sirenLfo = audio.context.createOscillator();
    audio.sirenLfo.type = 'sine';
    audio.sirenLfo.frequency.value = 0.7;
    const lfoGain = audio.context.createGain();
    lfoGain.gain.value = 190;
    audio.sirenLfo.connect(lfoGain);
    lfoGain.connect(audio.sirenOsc.frequency);
    audio.sirenGain = audio.context.createGain();
    audio.sirenGain.gain.value = 0;
    audio.sirenOsc.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.master);
    audio.sirenOsc.start();
    audio.sirenLfo.start();
    audio.nextMusicTime = audio.context.currentTime + 0.1;
  };

  audio.isMuted = function isMuted() {
    return audio.muted;
  };

  audio.setMuted = function setMuted(muted) {
    audio.muted = !!muted;
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.6;
  };

  // norm01: 0 parked, 1 flat out. The hum follows the speed.
  audio.engine = function engine(norm01) {
    if (!ready() || !audio.engineOsc || !audio.engineGain) return;
    const n = clampNumber(norm01 || 0, 0, 1);
    audio.engineOsc.frequency.setTargetAtTime(52 + n * 95, ctx().currentTime, 0.08);
    audio.engineGain.gain.setTargetAtTime(0.015 + n * 0.05, ctx().currentTime, 0.08);
  };

  audio.siren = function siren(on) {
    if (!ready() || !audio.sirenGain) return;
    audio.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx().currentTime, 0.1);
  };

  audio.stepMusic = function stepMusic() {
    if (!ready()) return;
    const c = ctx();
    if (c.currentTime < audio.nextMusicTime) return;
    const step = GROOVE[audio.musicStep % GROOVE.length];
    const freq = GROOVE_ROOT * Math.pow(2, step / 12);
    tone(c, out(), { type: 'triangle', freq, dur: 0.22, vol: 0.11 });
    if (audio.musicStep % 4 === 2) {
      tone(c, out(), { type: 'sine', freq: freq * 2, dur: 0.16, vol: 0.05 });
    }
    audio.musicStep += 1;
    audio.nextMusicTime = c.currentTime + 0.24;
  };

  audio.shot = function shot() {
    if (!ready()) return;
    noiseBurst(ctx(), out(), { dur: 0.09, vol: 0.32, freq: 2600 });
    tone(ctx(), out(), { type: 'square', freq: 190, freqEnd: 60, dur: 0.1, vol: 0.16 });
  };

  audio.enemyShot = function enemyShot() {
    if (!ready()) return;
    noiseBurst(ctx(), out(), { dur: 0.07, vol: 0.14, freq: 1700 });
    tone(ctx(), out(), { type: 'square', freq: 150, freqEnd: 70, dur: 0.09, vol: 0.08 });
  };

  audio.punch = function punch() {
    if (!ready()) return;
    noiseBurst(ctx(), out(), { dur: 0.06, vol: 0.25, freq: 500 });
  };

  audio.crash = function crash(force) {
    if (!ready()) return;
    const f = force === undefined ? 0.5 : force;
    noiseBurst(ctx(), out(), { dur: 0.16 + f * 0.1, vol: 0.2 + f * 0.25, freq: 700 });
    tone(ctx(), out(), { type: 'sine', freq: 90, freqEnd: 40, dur: 0.2, vol: 0.2 });
  };

  audio.pickup = function pickup(kind) {
    if (!ready()) return;
    if (kind === 'health') {
      tone(ctx(), out(), { type: 'sine', freq: 520, dur: 0.12, vol: 0.16 });
      tone(ctx(), out(), { type: 'sine', freq: 780, dur: 0.16, vol: 0.16, when: 0.08 });
    } else if (kind === 'ammo') {
      tone(ctx(), out(), { type: 'square', freq: 660, dur: 0.07, vol: 0.12 });
      tone(ctx(), out(), { type: 'square', freq: 880, dur: 0.07, vol: 0.12, when: 0.06 });
    } else {
      tone(ctx(), out(), { type: 'sine', freq: 880, dur: 0.09, vol: 0.16 });
      tone(ctx(), out(), { type: 'sine', freq: 1174, dur: 0.12, vol: 0.16, when: 0.07 });
    }
  };

  audio.missionComplete = function missionComplete() {
    if (!ready()) return;
    const notes = [523, 659, 784, 1046];
    for (let i = 0; i < notes.length; i++) {
      tone(ctx(), out(), { type: 'triangle', freq: notes[i], dur: 0.18, vol: 0.18, when: i * 0.09 });
    }
  };

  audio.click = function click() {
    if (!ready()) return;
    tone(ctx(), out(), { type: 'sine', freq: 980, dur: 0.05, vol: 0.12 });
  };

  audio.busted = function busted() {
    if (!ready()) return;
    tone(ctx(), out(), { type: 'sawtooth', freq: 392, freqEnd: 392, dur: 0.22, vol: 0.14 });
    tone(ctx(), out(), { type: 'sawtooth', freq: 311, freqEnd: 311, dur: 0.34, vol: 0.14, when: 0.2 });
  };

  return audio;
}
