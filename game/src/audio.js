// audio.js — all sound effects and the little driving-music loop,
// synthesized live with WebAudio. No audio files, no network.
// Everything is a no-op until ensure() runs (which needs a user
// gesture), and ensure() is safe to call as many times as you like.

export function createAudio() {
  const audio = {
    context: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenOn: false,
    musicStep: 0,
    musicTimer: 0,
  };

  function ctx() {
    return audio.context;
  }

  // Create the AudioContext + master gain on first call (after a
  // gesture). Later calls just resume a suspended context.
  audio.ensure = function ensure() {
    try {
      if (typeof window === 'undefined') return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audio.context) {
        audio.context = new AC();
        audio.master = audio.context.createGain();
        audio.master.gain.value = audio.muted ? 0 : 0.5;
        audio.master.connect(audio.context.destination);
      }
      if (audio.context.state === 'suspended') {
        audio.context.resume();
      }
    } catch (err) {
      // No audio on this machine — the game plays on silently.
    }
  };

  audio.isMuted = function isMuted() {
    return audio.muted;
  };

  audio.setMuted = function setMuted(muted) {
    audio.muted = !!muted;
    if (audio.master && audio.context) {
      audio.master.gain.value = audio.muted ? 0 : 0.5;
    }
  };

  // One short beep/tone. freq in Hz, dur in seconds, type is an
  // oscillator type, vol is 0..1, slideTo bends the pitch.
  function tone(freq, dur, type, vol, slideTo, delay) {
    const c = ctx();
    if (!c || !audio.master || audio.muted) return;
    try {
      const t0 = c.currentTime + (delay || 0);
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      gain.gain.setValueAtTime(vol || 0.15, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (err) {
      // Ignore — a failed beep must never break the game.
    }
  }

  // Short burst of filtered noise (crashes, punches, splashes).
  function noise(dur, vol, freq) {
    const c = ctx();
    if (!c || !audio.master || audio.muted) return;
    try {
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource();
      src.buffer = buf;
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq || 1200;
      const gain = c.createGain();
      gain.gain.value = vol || 0.2;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(audio.master);
      src.start();
    } catch (err) {
      // Ignore.
    }
  }

  // Engine hum. norm01 is 0..1 (0 = idle, 1 = flat out). Call every
  // frame while driving; call engine(0) to fade it out.
  audio.engine = function engine(norm01) {
    const c = ctx();
    if (!c || !audio.master) return;
    try {
      if (!audio.engineOsc) {
        audio.engineOsc = c.createOscillator();
        audio.engineOsc.type = 'sawtooth';
        audio.engineGain = c.createGain();
        audio.engineGain.gain.value = 0;
        const filter = c.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        audio.engineOsc.connect(filter);
        filter.connect(audio.engineGain);
        audio.engineGain.connect(audio.master);
        audio.engineOsc.start();
      }
      const n = Math.max(0, Math.min(1, norm01 || 0));
      audio.engineOsc.frequency.setTargetAtTime(55 + n * 165, c.currentTime, 0.08);
      audio.engineGain.gain.setTargetAtTime(audio.muted ? 0 : n * 0.09, c.currentTime, 0.08);
    } catch (err) {
      // Ignore.
    }
  };

  // Two-tone police siren, on or off. The wail is an LFO on the
  // oscillator frequency; turning it off fades the gain to zero.
  audio.siren = function siren(on) {
    const c = ctx();
    if (!c || !audio.master) return;
    try {
      if (on && !audio.sirenOsc) {
        audio.sirenOsc = c.createOscillator();
        audio.sirenOsc.type = 'triangle';
        audio.sirenOsc.frequency.value = 720;
        const lfo = c.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.55;
        const lfoGain = c.createGain();
        lfoGain.gain.value = 190;
        lfo.connect(lfoGain);
        lfoGain.connect(audio.sirenOsc.frequency);
        audio.sirenGain = c.createGain();
        audio.sirenGain.gain.value = 0;
        audio.sirenOsc.connect(audio.sirenGain);
        audio.sirenGain.connect(audio.master);
        audio.sirenOsc.start();
        lfo.start();
        audio.sirenLfo = lfo;
      }
      audio.sirenOn = !!on;
      if (audio.sirenGain) {
        audio.sirenGain.gain.setTargetAtTime(
          on && !audio.muted ? 0.05 : 0, c.currentTime, 0.15
        );
      }
    } catch (err) {
      // Ignore.
    }
  };

  // One step of the quiet bass-line loop that plays while the game
  // runs. The main loop calls this on a timer; it is deliberately
  // soft so it never fights the radio stations.
  const BASS_LINE = [55, 0, 65.41, 0, 49, 0, 58.27, 0];
  audio.stepMusic = function stepMusic() {
    const c = ctx();
    if (!c || !audio.master || audio.muted) return;
    const note = BASS_LINE[audio.musicStep % BASS_LINE.length];
    audio.musicStep++;
    if (note > 0) tone(note, 0.32, 'triangle', 0.06);
  };

  audio.shot = function shot() {
    noise(0.09, 0.28, 3200);
    tone(190, 0.08, 'square', 0.12, 60);
  };

  audio.enemyShot = function enemyShot() {
    noise(0.07, 0.14, 2400);
    tone(150, 0.07, 'square', 0.07, 55);
  };

  audio.punch = function punch() {
    noise(0.08, 0.22, 700);
  };

  // Crash thud. force is 0..1 (or a raw speed number — anything
  // above 1 is treated as full force). Callers pass a number.
  audio.crash = function crash(force) {
    const f = typeof force === 'number' ? Math.min(1, force / 300) : 0.5;
    noise(0.22, 0.15 + 0.25 * f, 500);
    tone(90, 0.18, 'sine', 0.2, 40);
  };

  audio.pickup = function pickup(kind) {
    if (kind === 'health') {
      tone(520, 0.12, 'sine', 0.14);
      tone(780, 0.18, 'sine', 0.14, null, 0.09);
    } else if (kind === 'ammo') {
      tone(660, 0.08, 'square', 0.1);
      tone(660, 0.08, 'square', 0.1, null, 0.1);
    } else {
      // Cash / coin: a bright two-note ding.
      tone(880, 0.1, 'sine', 0.14);
      tone(1318, 0.16, 'sine', 0.14, null, 0.08);
    }
  };

  audio.missionComplete = function missionComplete() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => tone(f, 0.22, 'triangle', 0.14, null, i * 0.11));
  };

  audio.click = function click() {
    tone(740, 0.05, 'square', 0.08);
  };

  audio.busted = function busted() {
    tone(392, 0.25, 'sawtooth', 0.12, 311);
    tone(311, 0.4, 'sawtooth', 0.12, 233, 0.22);
  };

  return audio;
}

export default createAudio;
