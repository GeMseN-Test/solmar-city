// audio.js — every sound in Solmar City, synthesized live.
//
// There are no audio files: every effect is a small WebAudio recipe
// (an oscillator sliding between two notes, a burst of filtered noise).
// The AudioContext is created lazily by ensure(), which the game calls
// from the first user gesture — browsers will not let a page make sound
// before the player has clicked or pressed a key.
//
// Calling any effect before ensure() is a silent no-op, never a crash:
// the title screen and the automated screenshots both run without a
// context, and the game must not fall over there.
//
// The returned object:
//
//   ensure()            create (or wake) the context; true when sound is live
//   isMuted()           whether the player muted everything (M)
//   setMuted(muted)     mute / unmute; drives the master gain
//   engine(norm)        continuous engine hum; norm 0..1 is how hard the car works
//   siren(on)           the two-tone police siren loop, on or off
//   stepMusic()         called once a frame; keeps a quiet bass groove ticking
//   shot() / enemyShot() / punch() / crash(force) / pickup(kind)
//   missionComplete() / click() / busted()
//                       one-shot effects; crash takes 0..1 impact strength,
//                       pickup takes 'cash' | 'health' | 'ammo'

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let engineNodes = null;
  let sirenNodes = null;
  let musicStep = 0;
  let nextMusicTime = 0;

  // A minor-pentatonic walk for the ambient bass line, in semitones
  // above A2. It loops forever under the game, quiet enough to ignore.
  const BASS_WALK = [0, 0, 3, 5, 7, 5, 3, 0, 0, 10, 7, 5, 3, 5, 7, 10];
  const EIGHTH = 0.25; // seconds per eighth note at 120 BPM

  function ensure() {
    try {
      if (context) {
        if (context.state === 'suspended') void context.resume();
        return true;
      }
      const Ctor =
        typeof window !== 'undefined'
          ? window.AudioContext || window.webkitAudioContext
          : null;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      if (context.state === 'suspended') void context.resume();
      return true;
    } catch {
      return false;
    }
  }

  function isMuted() {
    return muted;
  }

  function setMuted(value) {
    muted = !!value;
    if (master && context) {
      master.gain.setTargetAtTime(muted ? 0 : 0.5, context.currentTime, 0.02);
    }
  }

  // One short oscillator note with a quick fade, wired to the master.
  function tone({ freq, endFreq, duration, type = 'sine', gain = 0.2, delay = 0 }) {
    if (!context || !master) return;
    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), start);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + duration);
    }
    amp.gain.setValueAtTime(0, start);
    amp.gain.linearRampToValueAtTime(gain, start + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp);
    amp.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  // A burst of white noise through a low-pass filter — the raw material
  // for gunshots, crashes and punches.
  function noiseBurst({ duration, gain = 0.25, cutoff = 3000 }) {
    if (!context || !master) return;
    const start = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const amp = context.createGain();
    amp.gain.value = gain;
    source.connect(filter);
    filter.connect(amp);
    amp.connect(master);
    source.start(start);
  }

  // The car's engine: one sawtooth through a low-pass filter, its pitch
  // and loudness following how hard the car is working (0 = idle).
  function engine(norm) {
    if (!context || !master) return;
    const n = Number.isFinite(norm) ? Math.min(1, Math.max(0, norm)) : 0;
    const now = context.currentTime;
    if (!engineNodes) {
      const osc = context.createOscillator();
      osc.type = 'sawtooth';
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      const amp = context.createGain();
      amp.gain.value = 0;
      osc.connect(filter);
      filter.connect(amp);
      amp.connect(master);
      osc.start();
      engineNodes = { osc, filter, amp };
    }
    engineNodes.osc.frequency.setTargetAtTime(55 + n * 95, now, 0.05);
    engineNodes.filter.frequency.setTargetAtTime(320 + n * 750, now, 0.05);
    engineNodes.amp.gain.setTargetAtTime(0.02 + n * 0.05, now, 0.08);
  }

  // The police siren: a triangle wave wobbling between two notes.
  function siren(on) {
    if (!context || !master) return;
    if (on && !sirenNodes) {
      const osc = context.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 720;
      const lfo = context.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.7;
      const lfoGain = context.createGain();
      lfoGain.gain.value = 230;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      const amp = context.createGain();
      amp.gain.value = 0.045;
      osc.connect(amp);
      amp.connect(master);
      osc.start();
      lfo.start();
      sirenNodes = { osc, lfo, amp };
    } else if (!on && sirenNodes) {
      try {
        sirenNodes.osc.stop();
        sirenNodes.lfo.stop();
      } catch {
        // Already stopped; nothing to clean up.
      }
      try {
        sirenNodes.amp.disconnect();
      } catch {
        // Already disconnected.
      }
      sirenNodes = null;
    }
  }

  // A quiet bass groove that ticks along under the game. Called once a
  // frame; it schedules eighth notes a little ahead of the playhead, so
  // the groove stays steady no matter the frame rate.
  function stepMusic() {
    if (!context || !master) return;
    const now = context.currentTime;
    if (nextMusicTime < now) nextMusicTime = now + 0.05;
    while (nextMusicTime < now + 0.18) {
      const semitone = BASS_WALK[musicStep % BASS_WALK.length];
      const freq = 110 * Math.pow(2, semitone / 12);
      const start = nextMusicTime;
      const osc = context.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const amp = context.createGain();
      amp.gain.setValueAtTime(0, start);
      amp.gain.linearRampToValueAtTime(0.055, start + 0.01);
      amp.gain.exponentialRampToValueAtTime(0.0001, start + EIGHTH * 0.9);
      osc.connect(amp);
      amp.connect(master);
      osc.start(start);
      osc.stop(start + EIGHTH);
      musicStep += 1;
      nextMusicTime += EIGHTH;
    }
  }

  function shot() {
    noiseBurst({ duration: 0.09, gain: 0.28, cutoff: 4200 });
    tone({ freq: 190, endFreq: 65, duration: 0.08, type: 'square', gain: 0.16 });
  }

  function enemyShot() {
    tone({ freq: 140, endFreq: 70, duration: 0.09, type: 'square', gain: 0.11 });
    noiseBurst({ duration: 0.06, gain: 0.1, cutoff: 2600 });
  }

  function punch() {
    tone({ freq: 130, endFreq: 48, duration: 0.12, type: 'sine', gain: 0.4 });
    noiseBurst({ duration: 0.05, gain: 0.12, cutoff: 900 });
  }

  function crash(force) {
    const strength = Number.isFinite(force) ? Math.min(1, Math.max(0, force)) : 0.5;
    noiseBurst({ duration: 0.22 + strength * 0.1, gain: 0.15 + strength * 0.3, cutoff: 1400 });
    tone({ freq: 90, endFreq: 40, duration: 0.2, type: 'sine', gain: 0.25 * strength + 0.08 });
  }

  function pickup(kind) {
    const voices = {
      cash: [880, 1318],
      health: [660, 990],
      ammo: [520, 780],
    };
    const [first, second] = voices[kind] || [740, 1108];
    tone({ freq: first, duration: 0.07, type: 'sine', gain: 0.2 });
    tone({ freq: second, duration: 0.12, type: 'sine', gain: 0.2, delay: 0.07 });
  }

  function missionComplete() {
    [523, 659, 784, 1046].forEach((freq, i) => {
      tone({ freq, duration: 0.14, type: 'triangle', gain: 0.2, delay: i * 0.11 });
    });
  }

  function click() {
    tone({ freq: 1050, duration: 0.045, type: 'sine', gain: 0.15 });
  }

  function busted() {
    [392, 311, 233].forEach((freq, i) => {
      tone({ freq, duration: 0.2, type: 'triangle', gain: 0.2, delay: i * 0.17 });
    });
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
