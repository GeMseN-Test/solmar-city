// audio.js — tiny WebAudio synth for sound effects, engine hum, siren
// and a quiet ambient bass pulse. Everything is a no-op until ensure()
// runs (after a user gesture), and ensure() is idempotent.

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenOn = false;
  let muted = false;
  let musicStep = 0;
  let nextMusicTime = 0;

  const MUSIC_BASS = [55, 55, 65.41, 49];

  function ac() {
    if (ctx) return ctx;
    try {
      const AC =
        typeof window !== 'undefined'
          ? window.AudioContext || window.webkitAudioContext
          : typeof AudioContext !== 'undefined'
            ? AudioContext
            : null;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.6;
      master.connect(ctx.destination);

      const len = Math.floor(ctx.sampleRate * 0.5);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      // Engine hum: sawtooth through a lowpass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();

      // Siren: sine wobbling between two tones on a slow square LFO.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 750;
      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 0.6;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 170;
      lfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      lfo.start();
    } catch (e) {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo, when) {
    if (!ctx || !master) return;
    const t0 = when ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx || !master || !noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start();
    src.stop(ctx.currentTime + dur + 0.02);
  }

  return {
    ensure() {
      const c = ac();
      if (c && c.state === 'suspended') {
        c.resume().catch(() => {});
      }
      return !!c;
    },
    isMuted() {
      return muted;
    },
    setMuted(m) {
      muted = !!m;
      if (master && ctx) {
        master.gain.setTargetAtTime(muted ? 0 : 0.6, ctx.currentTime, 0.05);
      }
    },
    engine(norm01) {
      if (!ctx || !engineOsc || !engineGain) return;
      const n = Math.max(0, Math.min(1, norm01 || 0));
      engineOsc.frequency.setTargetAtTime(55 + n * 160, ctx.currentTime, 0.05);
      engineGain.gain.setTargetAtTime(n > 0.02 ? 0.04 + n * 0.05 : 0, ctx.currentTime, 0.08);
    },
    siren(on) {
      sirenOn = !!on;
      if (!ctx || !sirenGain) return;
      sirenGain.gain.setTargetAtTime(sirenOn && !muted ? 0.045 : 0, ctx.currentTime, 0.1);
    },
    stepMusic() {
      // Quiet ambient bass pulse, one soft note every half second.
      if (!ctx || !master || muted) return;
      if (ctx.currentTime < nextMusicTime) return;
      nextMusicTime = ctx.currentTime + 0.5;
      const freq = MUSIC_BASS[musicStep % MUSIC_BASS.length];
      musicStep++;
      tone(freq, 0.45, 'sine', 0.035);
    },
    shot() {
      tone(880, 0.09, 'square', 0.16, 220);
      noise(0.06, 0.1, 3000);
    },
    enemyShot() {
      tone(520, 0.08, 'square', 0.09, 180);
    },
    punch() {
      tone(160, 0.12, 'sine', 0.22, 60);
      noise(0.05, 0.08, 700);
    },
    crash(force) {
      const f = typeof force === 'number' && Number.isFinite(force) ? force : 0.5;
      noise(0.25, 0.1 + Math.min(0.3, f * 0.25), 420);
      tone(90, 0.22, 'sine', 0.2, 45);
    },
    pickup(kind) {
      if (kind === 'health') {
        tone(523, 0.1, 'sine', 0.14);
        tone(659, 0.14, 'sine', 0.14, null, ctx ? ctx.currentTime + 0.09 : 0);
      } else if (kind === 'ammo') {
        tone(392, 0.1, 'sine', 0.14);
        tone(523, 0.14, 'sine', 0.14, null, ctx ? ctx.currentTime + 0.09 : 0);
      } else {
        tone(880, 0.09, 'sine', 0.15);
        tone(1318, 0.16, 'sine', 0.15, null, ctx ? ctx.currentTime + 0.08 : 0);
      }
    },
    missionComplete() {
      if (!ctx) return;
      const notes = [523, 659, 784, 1046];
      notes.forEach((freq, i) => {
        tone(freq, 0.22, 'triangle', 0.16, null, ctx.currentTime + i * 0.09);
      });
    },
    click() {
      tone(1200, 0.03, 'square', 0.06);
    },
    busted() {
      tone(440, 0.7, 'sawtooth', 0.12, 110);
    },
  };
}
