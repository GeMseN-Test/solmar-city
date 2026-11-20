// audio.js — all sound effects for Solmar City, synthesized with
// WebAudio (no audio files). Every method is safe to call before
// ensure() — it simply does nothing until the AudioContext exists.
// ensure() is idempotent and must be called from a user gesture.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenOsc2 = null;
  let sirenGain = null;
  let sirenOn = false;
  let sirenTimer = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    try {
      const AC = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) || null;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch (e) {
      ctx = null;
      master = null;
    }
    return ctx;
  }

  function isMuted() {
    return muted;
  }

  function setMuted(m) {
    muted = !!m;
    if (master && ctx) {
      master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.02);
    }
  }

  // Short blip helper: one oscillator, quick attack + decay.
  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || !master || muted) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch (e) { /* audio must never break the game */ }
  }

  // Noise burst helper (crashes, punches): filtered white noise.
  function noise(dur, vol, filterFreq) {
    if (!ctx || !master || muted) return;
    try {
      const t = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start(t);
    } catch (e) { /* audio must never break the game */ }
  }

  // Continuous engine hum. norm01 = 0..1 (speed / maxSpeed). Call every
  // frame while driving; call engine(0) or engine(null) to fade out.
  function engine(norm01) {
    if (!ctx || !master) return;
    try {
      const level = norm01 == null ? 0 : Math.max(0, Math.min(1, norm01));
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineFilter = ctx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 420;
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        engineOsc.connect(engineFilter);
        engineFilter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      const t = ctx.currentTime;
      engineOsc.frequency.setTargetAtTime(55 + level * 165, t, 0.05);
      engineFilter.frequency.setTargetAtTime(300 + level * 900, t, 0.05);
      engineGain.gain.setTargetAtTime(muted ? 0 : level * 0.11, t, 0.08);
    } catch (e) { /* ignore */ }
  }

  // Two-tone police siren. Call siren(true) when any cruiser chases,
  // siren(false) to stop. The wail alternates on a timer.
  function siren(on) {
    if (on === sirenOn) return;
    sirenOn = !!on;
    if (!ctx || !master) return;
    try {
      if (sirenOn) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'triangle';
        sirenOsc.frequency.value = 720;
        sirenOsc2 = ctx.createOscillator();
        sirenOsc2.type = 'triangle';
        sirenOsc2.frequency.value = 720;
        sirenGain = ctx.createGain();
        sirenGain.gain.value = muted ? 0 : 0.045;
        sirenOsc.connect(sirenGain);
        sirenOsc2.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        sirenOsc2.start();
        let high = false;
        sirenTimer = setInterval(() => {
          if (!sirenOsc) return;
          high = !high;
          const t = ctx.currentTime;
          sirenOsc.frequency.setTargetAtTime(high ? 950 : 720, t, 0.05);
        }, 450);
      } else {
        if (sirenTimer) { clearInterval(sirenTimer); sirenTimer = null; }
        if (sirenOsc) { try { sirenOsc.stop(); } catch (e) {} sirenOsc = null; }
        if (sirenOsc2) { try { sirenOsc2.stop(); } catch (e) {} sirenOsc2 = null; }
        sirenGain = null;
      }
    } catch (e) { /* ignore */ }
  }

  // Short music-ish step: a soft tick used for footsteps / UI pacing.
  function stepMusic() {
    blip(220, 0.07, 'sine', 0.08, 180);
  }

  function shot() {
    noise(0.12, 0.5, 2400);
    blip(190, 0.1, 'square', 0.22, 60);
  }

  function enemyShot() {
    noise(0.1, 0.3, 1600);
    blip(150, 0.09, 'square', 0.14, 55);
  }

  function punch() {
    noise(0.09, 0.45, 500);
  }

  // force 0..1 scales the crash. Called with no argument it still works.
  function crash(force) {
    const f = typeof force === 'number' && Number.isFinite(force) ? Math.max(0, Math.min(1, force)) : 0.6;
    noise(0.28, 0.25 + f * 0.5, 700);
    blip(90, 0.22, 'sine', 0.3, 40);
  }

  // kind: 'cash' | 'health' | 'ammo' | 'coin' | anything else.
  function pickup(kind) {
    if (kind === 'health') {
      blip(520, 0.12, 'sine', 0.2, 780);
    } else if (kind === 'ammo') {
      blip(340, 0.09, 'square', 0.16, 520);
    } else if (kind === 'coin') {
      blip(880, 0.1, 'sine', 0.2, 1320);
      setTimeout(() => blip(1320, 0.14, 'sine', 0.16, 1760), 70);
    } else {
      blip(660, 0.1, 'sine', 0.2, 990);
    }
  }

  function missionComplete() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.22), i * 110));
  }

  function click() {
    blip(700, 0.05, 'square', 0.12, 500);
  }

  function busted() {
    const notes = [392, 311, 233];
    notes.forEach((f, i) => setTimeout(() => blip(f, 0.3, 'sawtooth', 0.16), i * 160));
  }

  const audio = {
    ensure,
    isMuted,
    setMuted,
    engine,
    siren,
    stepMusic,
    shot,
    enemyShot,
    punch,
    crash,
    pickup,
    missionComplete,
    click,
    busted,
  };
  return audio;
}

export default createAudio;
