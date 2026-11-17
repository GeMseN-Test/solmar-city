// Every sound in Solmar City is synthesised live with WebAudio: no audio
// files, nothing fetched. Engine hum, police siren, gunshots, pickups and a
// small bass groove for the drive. Everything is a no-op until the first
// player gesture creates the audio context (browsers demand that), and the
// M key mutes it all.

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let musicTimer = 0;
  let musicStepIndex = 0;
  let nextNoteTime = 0;
  let muted = false;

  // A laid-back A-minor bass groove: root notes per bar, one per beat.
  const BASS_LINE = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
  const STEP_SECONDS = 60 / 96 / 2;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;
      ctx = new AudioContextClass();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      startEngineLoop();
      startSirenLoop();
      nextNoteTime = ctx.currentTime + 0.1;
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function startEngineLoop() {
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 52;
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'square';
    engineOsc2.frequency.value = 26;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    engineOsc2.start();
  }

  function startSirenLoop() {
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 720;
    sirenLfo = ctx.createOscillator();
    sirenLfo.type = 'square';
    sirenLfo.frequency.value = 0.55;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 190;
    sirenLfo.connect(lfoGain);
    lfoGain.connect(sirenOsc.frequency);
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    sirenLfo.start();
  }

  function noiseBurst(when, duration, filterFreq, volume) {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(when);
    source.stop(when + duration + 0.02);
  }

  function tone(when, freq, duration, type, volume, slideTo) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, when + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(when);
    osc.stop(when + duration + 0.02);
  }

  function scheduleMusicStep(step, when) {
    const bass = BASS_LINE[step % BASS_LINE.length];
    tone(when, bass, STEP_SECONDS * 1.8, 'triangle', 0.32);
    if (step % 2 === 0) noiseBurst(when, 0.05, 6000, 0.08);
    if (step % 8 === 6) tone(when, bass * 4, STEP_SECONDS, 'sine', 0.1);
    if (step % 16 === 12) tone(when, 440, STEP_SECONDS, 'sine', 0.12, 554.37);
  }

  return {
    ensure,
    isMuted() {
      return muted;
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    /** Engine hum follows the car's speed ratio (0..1); 0 silences it. */
    engine(ratio) {
      if (!ctx || !engineGain) return;
      const target = ratio <= 0.02 ? 0 : 0.05 + ratio * 0.075;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + ratio * 130, ctx.currentTime, 0.08);
      engineOsc2.frequency.setTargetAtTime(26 + ratio * 65, ctx.currentTime, 0.08);
    },
    /** Police siren on while any wanted stars are up. */
    siren(on) {
      if (!ctx || !sirenGain) return;
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.2);
    },
    /** Call every frame: schedules the bass groove ahead of playback. */
    stepMusic() {
      if (!ctx) return;
      musicTimer += 1;
      while (nextNoteTime < ctx.currentTime + 0.12) {
        scheduleMusicStep(musicStepIndex, nextNoteTime);
        musicStepIndex += 1;
        nextNoteTime += STEP_SECONDS;
      }
    },
    shot() {
      if (!ctx) return;
      noiseBurst(ctx.currentTime, 0.14, 2600, 0.5);
      tone(ctx.currentTime, 180, 0.09, 'square', 0.22, 60);
    },
    enemyShot() {
      if (!ctx) return;
      noiseBurst(ctx.currentTime, 0.1, 1800, 0.22);
    },
    punch() {
      if (!ctx) return;
      noiseBurst(ctx.currentTime, 0.09, 500, 0.5);
    },
    crash(strength) {
      if (!ctx) return;
      noiseBurst(ctx.currentTime, 0.22, 900, Math.min(0.6, 0.2 + strength * 0.4));
      tone(ctx.currentTime, 90, 0.18, 'sine', 0.3, 40);
    },
    pickup(kind) {
      if (!ctx) return;
      const now = ctx.currentTime;
      if (kind === 'health') {
        tone(now, 523.25, 0.12, 'sine', 0.25);
        tone(now + 0.09, 659.25, 0.16, 'sine', 0.25);
      } else if (kind === 'ammo') {
        tone(now, 392, 0.1, 'square', 0.16);
        tone(now + 0.08, 523.25, 0.14, 'square', 0.16);
      } else {
        tone(now, 880, 0.09, 'sine', 0.22);
        tone(now + 0.07, 1318.5, 0.14, 'sine', 0.22);
      }
    },
    missionComplete() {
      if (!ctx) return;
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        tone(now + i * 0.11, freq, 0.22, 'triangle', 0.28);
      });
    },
    click() {
      if (!ctx) return;
      tone(ctx.currentTime, 660, 0.06, 'sine', 0.18);
    },
    busted() {
      if (!ctx) return;
      const now = ctx.currentTime;
      tone(now, 220, 0.5, 'sawtooth', 0.2, 110);
      tone(now + 0.1, 165, 0.5, 'sawtooth', 0.2, 82.5);
    },
  };
}
