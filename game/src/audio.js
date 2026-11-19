// Sound effects for Solmar City, all synthesized with WebAudio —
// no audio files to load. Every method is a safe no-op until ensure()
// runs after a user gesture, and ensure() is idempotent, so the game
// can call these freely from the first frame on.

export function createAudio() {
  const audio = {
    context: null,
    master: null,
    muted: false,
    sirenNodes: null,
    sirenOn: false,
    engineNodes: null,
  };

  function ctx() {
    return audio.context;
  }

  // Short blip helper: one oscillator, quick attack, exponential fade.
  function blip(type, freqFrom, freqTo, dur, vol, when = 0) {
    const c = ctx();
    if (!c || audio.muted) return;
    const t0 = c.currentTime + when;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, freqFrom), t0);
    if (freqTo !== undefined && freqTo !== freqFrom) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t0 + dur);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, vol, filterFreq) {
    const c = ctx();
    if (!c || audio.muted) return;
    const t0 = c.currentTime;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buffer = c.createBuffer(1, len, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    src.start(t0);
  }

  audio.ensure = function ensure() {
    if (audio.context) {
      if (audio.context.state === 'suspended') audio.context.resume();
      return audio.context;
    }
    try {
      const AC = typeof window !== 'undefined'
        ? (window.AudioContext || window.webkitAudioContext)
        : undefined;
      if (!AC) return null;
      audio.context = new AC();
      audio.master = audio.context.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.context.destination);
      if (audio.context.state === 'suspended') audio.context.resume();
    } catch (e) {
      audio.context = null;
    }
    return audio.context;
  };

  audio.isMuted = function isMuted() {
    return audio.muted;
  };

  audio.setMuted = function setMuted(muted) {
    audio.muted = !!muted;
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
    if (audio.muted) audio.siren(false);
  };

  // Continuous engine hum. norm01 is 0..1 (speed / max speed).
  // Called every frame while driving; silent on foot.
  audio.engine = function engine(norm01) {
    const c = ctx();
    if (!c || audio.muted) {
      if (audio.engineNodes) {
        try { audio.engineNodes.osc.stop(); } catch (e) { /* already stopped */ }
        audio.engineNodes = null;
      }
      return;
    }
    const level = Math.max(0, Math.min(1, norm01 || 0));
    if (level <= 0.02) {
      if (audio.engineNodes) {
        try { audio.engineNodes.osc.stop(); } catch (e) { /* already stopped */ }
        audio.engineNodes = null;
      }
      return;
    }
    if (!audio.engineNodes) {
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      const gain = c.createGain();
      gain.gain.value = 0;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audio.master);
      osc.start();
      audio.engineNodes = { osc, filter, gain };
    }
    const n = audio.engineNodes;
    n.osc.frequency.setTargetAtTime(55 + level * 165, c.currentTime, 0.08);
    n.filter.frequency.setTargetAtTime(320 + level * 900, c.currentTime, 0.08);
    n.gain.gain.setTargetAtTime(0.02 + level * 0.05, c.currentTime, 0.08);
  };

  // Two-tone police siren loop. Pass false to stop it.
  audio.siren = function siren(on) {
    const c = ctx();
    if (!on || audio.muted) {
      if (audio.sirenNodes) {
        try { audio.sirenNodes.osc.stop(); } catch (e) { /* already stopped */ }
        audio.sirenNodes = null;
      }
      audio.sirenOn = false;
      return;
    }
    if (!c || audio.sirenNodes) {
      audio.sirenOn = !!c;
      return;
    }
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 720;
    const lfo = c.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 0.9;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    const gain = c.createGain();
    gain.gain.value = 0.035;
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start();
    lfo.start();
    audio.sirenNodes = { osc, lfo };
    audio.sirenOn = true;
  };

  // One soft tick of the background music pulse (main.js drives it).
  audio.stepMusic = function stepMusic() {
    blip('sine', 196, 196, 0.09, 0.05);
  };

  audio.shot = function shot() {
    noiseBurst(0.14, 0.5, 2600);
    blip('square', 320, 70, 0.1, 0.22);
  };

  audio.enemyShot = function enemyShot() {
    noiseBurst(0.11, 0.28, 1800);
    blip('square', 240, 60, 0.09, 0.12);
  };

  audio.punch = function punch() {
    noiseBurst(0.09, 0.4, 700);
    blip('sine', 130, 55, 0.1, 0.3);
  };

  audio.crash = function crash(force) {
    const f = force === undefined ? 0.5 : Math.max(0, Math.min(1, force));
    noiseBurst(0.25, 0.25 + f * 0.45, 900);
    blip('sine', 90, 38, 0.22, 0.25 + f * 0.25);
  };

  audio.pickup = function pickup(kind) {
    if (kind === 'health') {
      blip('sine', 520, 780, 0.12, 0.2);
      blip('sine', 780, 1040, 0.14, 0.18, 0.09);
    } else if (kind === 'ammo') {
      blip('square', 440, 440, 0.07, 0.14);
      blip('square', 660, 660, 0.07, 0.14, 0.07);
    } else {
      blip('sine', 880, 1320, 0.1, 0.2);
      blip('sine', 1320, 1760, 0.12, 0.18, 0.08);
    }
  };

  audio.missionComplete = function missionComplete() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => blip('triangle', f, f, 0.22, 0.22, i * 0.11));
  };

  audio.click = function click() {
    blip('sine', 700, 500, 0.05, 0.14);
  };

  audio.busted = function busted() {
    blip('sawtooth', 392, 392, 0.3, 0.16);
    blip('sawtooth', 311, 311, 0.34, 0.16, 0.28);
  };

  return audio;
}

export default createAudio;
