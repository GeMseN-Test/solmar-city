// Solmar City sound effects — tiny WebAudio synth, no audio files.
// Every method is safe to call before ensure() (it just no-ops).
// ensure() is idempotent and must run after a user gesture.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let sirenNodes = null;
  let sirenOn = false;
  let musicTimer = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch (e) {
      ctx = null;
    }
    return ctx;
  }

  function isMuted() {
    return muted;
  }

  function setMuted(m) {
    muted = !!m;
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  }

  // One short oscillator blip.
  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || !master || muted) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch (e) { /* audio must never break the game */ }
  }

  // Filtered noise burst (crash / punch thud).
  function noise(dur, vol, freq) {
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
      filter.frequency.value = freq || 800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start(t);
    } catch (e) { /* ignore */ }
  }

  // Engine hum: `norm01` is 0..1 throttle/speed. No-op before ensure.
  function engine(norm01) {
    if (!ctx || !master || muted) return;
    // A soft low sawtooth pulse; cheap enough to call every frame.
    const n = Math.max(0, Math.min(1, norm01 || 0));
    if (n < 0.03) return;
    blip(55 + n * 90, 0.09, 'sawtooth', 0.03 + n * 0.05);
  }

  // Two-tone police siren loop. siren(true) starts, siren(false) stops.
  function siren(on) {
    if (on === sirenOn) return;
    sirenOn = !!on;
    if (!ctx || !master) return;
    try {
      if (sirenOn && !sirenNodes) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 750;
        lfo.type = 'square';
        lfo.frequency.value = 0.9;
        lfoGain.gain.value = 220;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        g.gain.value = muted ? 0 : 0.05;
        osc.connect(g);
        g.connect(master);
        osc.start();
        lfo.start();
        sirenNodes = { osc, lfo, g };
      } else if (!sirenOn && sirenNodes) {
        sirenNodes.osc.stop();
        sirenNodes.lfo.stop();
        sirenNodes.osc.disconnect();
        sirenNodes.lfo.disconnect();
        sirenNodes.g.disconnect();
        sirenNodes = null;
      }
    } catch (e) { /* ignore */ }
  }

  // Gentle ambient music pulse (called once per frame by main).
  function stepMusic() {
    if (!ctx || !master || muted) return;
    musicTimer -= 1;
    if (musicTimer > 0) return;
    musicTimer = 90; // ~1.5s at 60fps
    blip(220, 0.5, 'triangle', 0.04);
    blip(330, 0.5, 'triangle', 0.03);
  }

  function shot() {
    noise(0.12, 0.35, 2400);
    blip(900, 0.08, 'square', 0.18, 180);
  }

  function enemyShot() {
    noise(0.1, 0.2, 1800);
    blip(620, 0.07, 'square', 0.1, 160);
  }

  function punch() {
    noise(0.09, 0.3, 500);
  }

  function crash(force) {
    const f = typeof force === 'number' ? force : 0.5;
    noise(0.25, 0.15 + Math.min(0.4, f * 0.3), 700);
    blip(120, 0.2, 'sawtooth', 0.2, 50);
  }

  function pickup(kind) {
    if (kind === 'health') {
      blip(520, 0.12, 'sine', 0.2);
      blip(780, 0.18, 'sine', 0.2);
    } else if (kind === 'ammo') {
      blip(440, 0.1, 'square', 0.15);
      blip(660, 0.14, 'square', 0.15);
    } else {
      // cash / coin
      blip(880, 0.1, 'sine', 0.2);
      blip(1320, 0.16, 'sine', 0.2);
    }
  }

  function missionComplete() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      setTimeout(() => blip(f, 0.22, 'triangle', 0.22), i * 110);
    });
  }

  function click() {
    blip(700, 0.05, 'square', 0.12);
  }

  function busted() {
    blip(392, 0.3, 'sawtooth', 0.2, 196);
    blip(311, 0.5, 'sawtooth', 0.2, 155);
  }

  return {
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
}

export default createAudio;
