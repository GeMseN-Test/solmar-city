// audio.js — WebAudio synth sound effects + a tiny step sequencer.
// Every method is safe before ensure() (no-op); ensure() is idempotent.
export function createAudio() {
  const audio = {
    context: null,
    master: null,
    muted: false,
    sirenOn: false,
    sirenNodes: null,
    musicStep: 0,
    musicTimer: 0,
  };

  function ensure() {
    if (audio.context) {
      if (audio.context.state === 'suspended') audio.context.resume();
      return audio.context;
    }
    try {
      const AC = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) || null;
      if (!AC) return null;
      audio.context = new AC();
      audio.master = audio.context.createGain();
      audio.master.gain.value = audio.muted ? 0 : 0.5;
      audio.master.connect(audio.context.destination);
    } catch (e) {
      audio.context = null;
    }
    return audio.context;
  }

  function tone(freq, dur, type, vol, when, slideTo) {
    if (!audio.context || !audio.master || audio.muted) return;
    try {
      const t0 = when || audio.context.currentTime;
      const osc = audio.context.createOscillator();
      const g = audio.context.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
      g.gain.setValueAtTime(vol || 0.2, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(g);
      g.connect(audio.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (e) { /* ignore */ }
  }

  function noise(dur, vol, when, lowpass) {
    if (!audio.context || !audio.master || audio.muted) return;
    try {
      const t0 = when || audio.context.currentTime;
      const len = Math.max(1, Math.floor(audio.context.sampleRate * dur));
      const buf = audio.context.createBuffer(1, len, audio.context.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = audio.context.createBufferSource();
      src.buffer = buf;
      const g = audio.context.createGain();
      g.gain.setValueAtTime(vol || 0.2, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      let node = src;
      if (lowpass) {
        const f = audio.context.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = lowpass;
        src.connect(f);
        node = f;
      }
      node.connect(g);
      g.connect(audio.master);
      src.start(t0);
    } catch (e) { /* ignore */ }
  }

  audio.ensure = ensure;
  audio.isMuted = () => audio.muted;
  audio.setMuted = (m) => {
    audio.muted = !!m;
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
  };
  audio.setMute = audio.setMuted;
  audio.engine = (norm01) => {
    if (!audio.context || audio.muted) return;
    const n = Math.max(0, Math.min(1, norm01 || 0));
    tone(55 + n * 90, 0.09, 'sawtooth', 0.03 + n * 0.04);
  };
  audio.siren = (on) => {
    audio.sirenOn = !!on;
    if (!audio.context) return;
    if (!on) {
      if (audio.sirenNodes) {
        try { audio.sirenNodes.osc.stop(); } catch (e) {}
        audio.sirenNodes = null;
      }
      return;
    }
    if (audio.sirenNodes || audio.muted) return;
    try {
      const osc = audio.context.createOscillator();
      const g = audio.context.createGain();
      const lfo = audio.context.createOscillator();
      const lfoGain = audio.context.createGain();
      osc.type = 'sine';
      osc.frequency.value = 750;
      lfo.type = 'sine';
      lfo.frequency.value = 0.8;
      lfoGain.gain.value = 250;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      g.gain.value = 0.04;
      osc.connect(g);
      g.connect(audio.master);
      osc.start();
      lfo.start();
      audio.sirenNodes = { osc, lfo };
    } catch (e) { /* ignore */ }
  };
  audio.stepMusic = () => {
    if (!audio.context || audio.muted) return;
    const bass = [55, 55, 65.41, 49, 55, 55, 73.42, 65.41];
    const note = bass[audio.musicStep % bass.length];
    tone(note, 0.22, 'triangle', 0.10);
    if (audio.musicStep % 2 === 0) tone(note * 4, 0.08, 'square', 0.03);
    audio.musicStep++;
  };
  audio.shot = () => { noise(0.12, 0.35, 0, 3000); tone(180, 0.08, 'square', 0.18, 0, 60); };
  audio.enemyShot = () => { noise(0.1, 0.18, 0, 2200); };
  audio.punch = () => { noise(0.08, 0.3, 0, 900); };
  audio.crash = (force) => {
    const f = typeof force === 'number' ? Math.max(0, Math.min(1, force)) : 0.5;
    noise(0.25, 0.15 + f * 0.35, 0, 700);
    tone(90, 0.2, 'sawtooth', 0.12, 0, 40);
  };
  audio.pickup = (kind) => {
    if (kind === 'health') { tone(520, 0.12, 'sine', 0.2); tone(660, 0.15, 'sine', 0.2, audio.context ? audio.context.currentTime + 0.1 : 0); }
    else if (kind === 'ammo') { tone(440, 0.1, 'square', 0.15); tone(587, 0.12, 'square', 0.15); }
    else { tone(880, 0.1, 'sine', 0.2); tone(1318, 0.18, 'sine', 0.2); }
  };
  audio.missionComplete = () => {
    if (!audio.context) return;
    const t0 = audio.context.currentTime;
    tone(523, 0.15, 'triangle', 0.2, t0);
    tone(659, 0.15, 'triangle', 0.2, t0 + 0.14);
    tone(784, 0.3, 'triangle', 0.22, t0 + 0.28);
  };
  audio.click = () => tone(700, 0.05, 'square', 0.12);
  audio.busted = () => {
    if (!audio.context) return;
    const t0 = audio.context.currentTime;
    tone(392, 0.25, 'sawtooth', 0.15, t0, 196);
    tone(311, 0.4, 'sawtooth', 0.15, t0 + 0.25, 155);
  };
  audio.coin = () => {
    if (!audio.context) return;
    const t0 = audio.context.currentTime;
    tone(988, 0.08, 'sine', 0.18, t0);
    tone(1319, 0.16, 'sine', 0.18, t0 + 0.07);
  };
  return audio;
}
export default createAudio;
