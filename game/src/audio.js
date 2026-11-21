// audio.js — WebAudio sound effects for Solmar City.
// createAudio() returns state + METHOD wrappers (main.js calls it
// method-style: audio.ensure(), audio.shot(), ...). Every method is a
// safe no-op before ensure() runs, and ensure() is idempotent.

export function createAudio() {
  const state = {
    context: null,
    master: null,
    muted: false,
    musicOn: true,
    sirenNodes: null,
    sirenOn: false,
    musicTimer: 0,
    musicStep: 0,
  };

  function ctx() {
    return state.context;
  }

  function tone(freq, dur, type, vol, when, slideTo) {
    const c = ctx();
    if (!c || !state.master) return;
    const t0 = when !== undefined ? when : c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol || 0.15), t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(state.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, filterFreq, when) {
    const c = ctx();
    if (!c || !state.master) return;
    const t0 = when !== undefined ? when : c.currentTime;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol || 0.2, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(state.master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  const audio = {
    ...state,
    ensure() {
      if (state.context) {
        if (state.context.state === 'suspended') state.context.resume();
        return state.context;
      }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        state.context = new AC();
        state.master = state.context.createGain();
        state.master.gain.value = state.muted ? 0 : 0.5;
        state.master.connect(state.context.destination);
        audio.context = state.context;
        audio.master = state.master;
        if (state.context.state === 'suspended') state.context.resume();
      } catch (e) {
        state.context = null;
      }
      return state.context;
    },
    isMuted() {
      return !!state.muted;
    },
    setMuted(muted) {
      state.muted = !!muted;
      audio.muted = state.muted;
      if (state.master) state.master.gain.value = state.muted ? 0 : 0.5;
      return state.muted;
    },
    setMusicOn(on) {
      state.musicOn = !!on;
      audio.musicOn = state.musicOn;
      return state.musicOn;
    },
    engine(norm01) {
      const c = ctx();
      if (!c || !state.master || state.muted) return;
      const v = Math.max(0, Math.min(1, norm01 || 0));
      if (v <= 0.02) return;
      tone(50 + v * 90, 0.09, 'sawtooth', 0.03 + v * 0.05);
    },
    siren(on) {
      const c = ctx();
      state.sirenOn = !!on;
      audio.sirenOn = state.sirenOn;
      if (!c || !state.master) return;
      if (on && !state.sirenNodes) {
        const osc = c.createOscillator();
        const gain = c.createGain();
        const lfo = c.createOscillator();
        const lfoGain = c.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        lfo.type = 'sine';
        lfo.frequency.value = 0.7;
        lfoGain.gain.value = 220;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        gain.gain.value = 0.035;
        osc.connect(gain);
        gain.connect(state.master);
        osc.start();
        lfo.start();
        state.sirenNodes = { osc, lfo, gain };
      } else if (!on && state.sirenNodes) {
        try {
          state.sirenNodes.gain.gain.value = 0;
          state.sirenNodes.osc.stop();
          state.sirenNodes.lfo.stop();
        } catch (e) { /* already stopped */ }
        state.sirenNodes = null;
      }
    },
    stepMusic() {
      const c = ctx();
      if (!c || !state.master || state.muted || !state.musicOn) return;
      state.musicTimer -= 1 / 60;
      if (state.musicTimer > 0) return;
      state.musicTimer = 0.22;
      const scale = [0, 3, 5, 7, 10, 12, 15];
      const note = scale[state.musicStep % scale.length];
      state.musicStep += 1;
      const freq = 110 * Math.pow(2, note / 12);
      tone(freq, 0.2, 'triangle', 0.05);
      if (state.musicStep % 4 === 1) tone(55, 0.3, 'sine', 0.08);
    },
    shot() {
      noise(0.12, 0.35, 2600);
      tone(220, 0.08, 'square', 0.12, undefined, 60);
    },
    enemyShot() {
      noise(0.1, 0.2, 1800);
      tone(180, 0.07, 'square', 0.08, undefined, 70);
    },
    punch() {
      noise(0.09, 0.3, 500);
      tone(120, 0.08, 'sine', 0.18, undefined, 50);
    },
    crash(force) {
      const f = typeof force === 'number' ? force : 0.5;
      noise(0.25, 0.15 + f * 0.3, 900);
      tone(90, 0.2, 'sawtooth', 0.1 + f * 0.1, undefined, 40);
    },
    pickup(kind) {
      if (kind === 'health') {
        tone(523, 0.12, 'sine', 0.14);
        tone(659, 0.16, 'sine', 0.14, undefined, undefined);
      } else if (kind === 'ammo') {
        tone(392, 0.1, 'square', 0.1);
        tone(523, 0.14, 'square', 0.1);
      } else {
        tone(880, 0.1, 'sine', 0.14);
        tone(1318, 0.18, 'sine', 0.14);
      }
    },
    missionComplete() {
      const c = ctx();
      if (!c) return;
      const notes = [523, 659, 784, 1046];
      notes.forEach((f, i) => {
        tone(f, 0.22, 'triangle', 0.16, c.currentTime + i * 0.11);
      });
    },
    click() {
      tone(700, 0.05, 'square', 0.08);
    },
    busted() {
      const c = ctx();
      if (!c) return;
      tone(440, 0.3, 'sawtooth', 0.12, c.currentTime, 220);
      tone(330, 0.4, 'sawtooth', 0.12, c.currentTime + 0.25, 165);
    },
  };

  return audio;
}

export default createAudio;
