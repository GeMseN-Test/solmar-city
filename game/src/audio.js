// All sound in Solmar City is synthesized live with WebAudio —
// no audio files, no network. Engine hum, siren, gunshots, thuds
// and jingles are all little oscillator / noise recipes.
//
// Every method is safe to call before ensure(): before the player
// has gestured (a click or a key press) there is no AudioContext
// yet, and everything simply does nothing. ensure() is idempotent.

function audioContextClass() {
  if (typeof window !== 'undefined') {
    return window.AudioContext || window.webkitAudioContext || null;
  }
  if (typeof globalThis !== 'undefined') {
    return globalThis.AudioContext || globalThis.webkitAudioContext || null;
  }
  return null;
}

export function createAudio() {
  const audio = {
    context: null,
    master: null,
    muted: false,
    engineNodes: null,
    sirenNodes: null,
    musicStep: 0,
    musicNext: 0,
  };

  function ctx() {
    return audio.context;
  }

  function now() {
    const c = ctx();
    return c ? c.currentTime : 0;
  }

  // Short oscillator blip, optionally sliding down in pitch.
  function blip(freq, dur, type, gain, slideTo) {
    const c = ctx();
    if (!c || !audio.master) return;
    try {
      const t = c.currentTime;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(audio.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // A blip failing must never break the frame.
    }
  }

  // A burst of filtered noise — gunshots, crashes, tyre screeches.
  function noiseBurst(dur, gain, filterFreq) {
    const c = ctx();
    if (!c || !audio.master) return;
    try {
      const t = c.currentTime;
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource();
      src.buffer = buf;
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 1800;
      const g = c.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(audio.master);
      src.start(t);
    } catch {
      // Noise failing must never break the frame.
    }
  }

  audio.ensure = function ensure() {
    if (audio.context) return true;
    const AC = audioContextClass();
    if (!AC) return false;
    try {
      const c = new AC();
      audio.context = c;
      const master = c.createGain();
      master.gain.value = audio.muted ? 0 : 0.5;
      master.connect(c.destination);
      audio.master = master;
      if (typeof c.resume === 'function') c.resume();
      return true;
    } catch {
      audio.context = null;
      return false;
    }
  };

  audio.isMuted = function isMuted() {
    return audio.muted;
  };

  audio.setMuted = function setMuted(muted) {
    audio.muted = !!muted;
    if (audio.master && audio.context) {
      audio.master.gain.setValueAtTime(audio.muted ? 0 : 0.5, audio.context.currentTime);
    }
  };

  // Continuous engine hum. norm01 is 0..1 (speed / top speed):
  // pitch and loudness rise with it. Call every frame while driving.
  audio.engine = function engine(norm01) {
    const c = ctx();
    if (!c || !audio.master) return;
    const n = Math.max(0, Math.min(1, norm01 || 0));
    try {
      if (!audio.engineNodes) {
        const osc = c.createOscillator();
        osc.type = 'sawtooth';
        const filter = c.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        const g = c.createGain();
        g.gain.value = 0;
        osc.connect(filter);
        filter.connect(g);
        g.connect(audio.master);
        osc.start();
        audio.engineNodes = { osc, g };
      }
      const t = c.currentTime;
      audio.engineNodes.osc.frequency.setTargetAtTime(55 + n * 95, t, 0.08);
      audio.engineNodes.g.gain.setTargetAtTime(n < 0.03 ? 0 : 0.05 + n * 0.06, t, 0.08);
    } catch {
      // Engine hum failing must never break the frame.
    }
  };

  // Two-tone police siren. Call with true to start, false to stop.
  audio.siren = function siren(on) {
    const c = ctx();
    if (!c || !audio.master) return;
    try {
      if (on) {
        if (audio.sirenNodes) return;
        const osc = c.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = 660;
        const lfo = c.createOscillator();
        lfo.type = 'square';
        lfo.frequency.value = 0.9;
        const lfoGain = c.createGain();
        lfoGain.gain.value = 180;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        const g = c.createGain();
        g.gain.value = 0.045;
        osc.connect(g);
        g.connect(audio.master);
        osc.start();
        lfo.start();
        audio.sirenNodes = { osc, lfo, g };
      } else if (audio.sirenNodes) {
        const nodes = audio.sirenNodes;
        audio.sirenNodes = null;
        try {
          nodes.g.gain.setTargetAtTime(0, c.currentTime, 0.05);
          nodes.osc.stop(c.currentTime + 0.3);
          nodes.lfo.stop(c.currentTime + 0.3);
        } catch {
          // Stopping a siren never matters enough to throw.
        }
      }
    } catch {
      // Siren failing must never break the frame.
    }
  };

  // A quiet bass pulse for the title / roaming music bed. Cheap
  // enough to call every frame: it only plays a note every ~0.3s.
  audio.stepMusic = function stepMusic() {
    const c = ctx();
    if (!c || !audio.master || audio.muted) return;
    const t = now();
    if (t < audio.musicNext) return;
    audio.musicNext = t + 0.3;
    const roots = [55, 55, 65.41, 49];
    const root = roots[audio.musicStep % roots.length];
    audio.musicStep += 1;
    blip(root, 0.28, 'triangle', 0.06);
    if (audio.musicStep % 4 === 0) blip(root * 2, 0.12, 'sine', 0.03);
  };

  audio.shot = function shot() {
    noiseBurst(0.12, 0.5, 2600);
    blip(220, 0.08, 'square', 0.18, 70);
  };

  audio.enemyShot = function enemyShot() {
    noiseBurst(0.1, 0.22, 2000);
    blip(180, 0.07, 'square', 0.08, 60);
  };

  audio.punch = function punch() {
    blip(130, 0.12, 'sine', 0.4, 55);
    noiseBurst(0.06, 0.2, 700);
  };

  // force is 0..1 (how hard the hit was); callers pass a number,
  // and a missing one still works.
  audio.crash = function crash(force) {
    const f = typeof force === 'number' ? Math.max(0, Math.min(1, force)) : 0.5;
    noiseBurst(0.25, 0.25 + f * 0.5, 900);
    blip(90, 0.2, 'sine', 0.3, 40);
  };

  audio.pickup = function pickup(kind) {
    if (kind === 'health') {
      blip(523.25, 0.1, 'sine', 0.16);
      blip(659.25, 0.14, 'sine', 0.16);
    } else if (kind === 'ammo') {
      blip(392, 0.09, 'square', 0.1);
      blip(523.25, 0.12, 'square', 0.1);
    } else {
      blip(659.25, 0.09, 'sine', 0.16);
      blip(987.77, 0.16, 'sine', 0.16);
    }
  };

  audio.missionComplete = function missionComplete() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const c = ctx();
    if (!c || !audio.master) return;
    notes.forEach((freq, i) => {
      setTimeout(() => blip(freq, 0.22, 'triangle', 0.16), i * 95);
    });
  };

  audio.click = function click() {
    blip(880, 0.05, 'square', 0.08);
  };

  audio.busted = function busted() {
    blip(392, 0.25, 'sawtooth', 0.14, 370);
    setTimeout(() => blip(311.13, 0.4, 'sawtooth', 0.14, 290), 220);
  };

  return audio;
}
