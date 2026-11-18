// Sound effects + the menu music loop, all synthesized with WebAudio.
// No audio files: every sound is a tiny oscillator/noise recipe, so the
// game works offline. Everything is a safe no-op until `ensure()` runs
// after a user gesture (browsers block audio before that).
import { clamp } from './util.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let sirenOn = false;
  let sirenNodes = null;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch (e) {
      return false;
    }
  }

  function isMuted() {
    return muted;
  }

  function setMuted(m) {
    muted = !!m;
    if (master && ctx) master.gain.value = muted ? 0 : 0.5;
  }

  // A short oscillator blip with a pitch slide and a volume envelope.
  function blip(type, from, to, dur, vol, when) {
    if (!ctx || !master) return;
    const t0 = when || ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // Filtered noise burst — gunshots, crashes, punches.
  function noise(dur, vol, filterFreq, when) {
    if (!ctx || !master) return;
    const t0 = when || ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  function engine(norm01) {
    if (!ctx || !master || muted) return;
    // A low putter whose pitch follows the speed; called every frame
    // while driving, so it stays cheap and quiet.
    const v = clamp(norm01, 0, 1);
    if (v < 0.03) return;
    blip('sawtooth', 55 + v * 90, 50 + v * 80, 0.09, 0.03 + v * 0.03);
  }

  function siren(on) {
    if (on === sirenOn) return;
    sirenOn = on;
    if (!ctx || !master) return;
    if (on) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 700;
      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 1.4;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      const gain = ctx.createGain();
      gain.gain.value = 0.045;
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      lfo.start();
      sirenNodes = { osc, lfo, gain };
    } else if (sirenNodes) {
      try {
        sirenNodes.gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        sirenNodes.osc.stop(ctx.currentTime + 0.1);
        sirenNodes.lfo.stop(ctx.currentTime + 0.1);
      } catch (e) { /* already stopped */ }
      sirenNodes = null;
    }
  }

  // A lazy bassline that keeps the title screen alive. One bar loops.
  function stepMusic() {
    if (!ctx || !master || muted) return;
    if (musicTimer !== null) return;
    const bassNotes = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
    const stepDur = 0.24;
    musicTimer = setInterval(() => {
      if (!ctx || muted) return;
      const note = bassNotes[musicStep % bassNotes.length];
      blip('triangle', note, note, stepDur * 0.9, 0.12);
      if (musicStep % 4 === 2) blip('sine', note * 4, note * 4, 0.12, 0.03);
      musicStep++;
    }, stepDur * 1000);
  }

  function stopMusic() {
    if (musicTimer !== null) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function shot() {
    noise(0.12, 0.35, 2400);
    blip('square', 220, 60, 0.08, 0.12);
  }

  function enemyShot() {
    noise(0.1, 0.18, 1600);
    blip('square', 180, 70, 0.07, 0.07);
  }

  function punch() {
    noise(0.09, 0.3, 900);
    blip('sine', 140, 60, 0.1, 0.2);
  }

  function crash(force) {
    const f = typeof force === 'number' ? clamp(force, 0, 1) : 0.5;
    noise(0.25, 0.25 + f * 0.35, 700);
    blip('sawtooth', 120, 40, 0.22, 0.15 + f * 0.15);
  }

  function pickup(kind) {
    if (kind === 'health') {
      blip('sine', 520, 780, 0.16, 0.18);
    } else if (kind === 'ammo') {
      blip('square', 440, 660, 0.1, 0.1);
      blip('square', 660, 880, 0.1, 0.1, ctx ? ctx.currentTime + 0.09 : 0);
    } else {
      // Cash / coin: two bright coin pings.
      blip('sine', 988, 988, 0.09, 0.16);
      blip('sine', 1319, 1319, 0.14, 0.16, ctx ? ctx.currentTime + 0.08 : 0);
    }
  }

  function missionComplete() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => blip('triangle', n, n, 0.22, 0.18, t + i * 0.11));
  }

  function click() {
    blip('square', 800, 600, 0.05, 0.08);
  }

  function busted() {
    if (!ctx) return;
    const t = ctx.currentTime;
    blip('sawtooth', 220, 110, 0.5, 0.2, t);
    blip('sawtooth', 165, 82, 0.6, 0.2, t + 0.4);
  }

  return {
    ensure, isMuted, setMuted, engine, siren, stepMusic, stopMusic,
    shot, enemyShot, punch, crash, pickup, missionComplete, click, busted,
  };
}
