// main.js — Solmar City entrypoint: screens, game loop, save, radio, shots.
// Written from the v2 spec only. The loop builds the plain VALUES input
// object each frame and hands it to world.step. updateMission never
// auto-starts the next mission: THIS file starts it on MISSION_COMPLETE.

import { createWorld, EV } from './world.js';
import { createInput, pollInput, clearClick, ACTIONS } from './input.js';
import { drawGame, drawTitleScreen, drawPauseOverlay } from './render.js';
import { saveGame, loadSave, saveInfoText, applySave } from './save.js';
import { MISSIONS, startMission, currentObjective, nearestStealableCar } from './missions.js';
import { cycleRadio, ensureRadio, tickRadio, setRadioMuted } from './radio.js';
import { nearestBoat } from './boats.js';
import { stageShot, SHOT_NAMES } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const shotParam = params.get('shot');
const seedParam = parseInt(params.get('seed') || '1', 10) || 1;

let world = createWorld(seedParam);
let state = world.state;
let mode = 'title'; // 'title' | 'game' | 'paused'
let titleButtons = [];
let saveTimer = 0;

const NEUTRAL_INPUT = {
  mx: 0,
  my: 0,
  aimX: 0,
  aimY: 0,
  actions: 0,
  shooting: false,
  running: false,
  steer: 0,
  throttle: 0,
  handbrake: false,
};

const input = createInput(canvas);

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

// Contextual prompt line (boat lines, car lines, crates, vault).
function computeHint(st) {
  const p = st.player;
  if (st.dead || st.busted) return '';
  if (p.inBoat) return 'E — step ashore    ·    W/S — sail    ·    Q — radio';
  if (p.inCar) return 'E — get out    ·    Space — handbrake    ·    Q — radio';
  const obj = currentObjective(st);
  if (obj && obj.kind === 'collect' && st.crates) {
    for (const c of st.crates) {
      if (!c.taken && dist(p.x, p.y, c.x, c.y) < 60) return 'E — grab the crate';
    }
  }
  if (obj && obj.kind === 'interact' && obj.key === 'bank') {
    const bank = st.city.landmarks.bank;
    if (bank && dist(p.x, p.y, bank.x, bank.y) < 120) return 'E — grab the vault!';
  }
  if (nearestBoat(st, p.x, p.y)) return 'E — board the boat';
  if (nearestStealableCar(st)) return 'E — steal the car';
  if (!st.mission && !st.storyComplete) return 'Enter — start the next mission';
  return '';
}

function startNew() {
  world = createWorld(seedParam);
  state = world.state;
  if (state.audio) state.audio.ensure();
  if (state.radio) ensureRadio(state.radio);
  startMission(state, 0);
  mode = 'game';
  saveTimer = 0;
}

function startContinue() {
  const save = loadSave();
  if (!save) {
    startNew();
    return;
  }
  world = createWorld(save.seed || seedParam);
  state = world.state;
  applySave(state, save);
  if (state.audio) state.audio.ensure();
  if (state.radio) ensureRadio(state.radio);
  if (!state.storyComplete && !state.mission) {
    startMission(state, state.missionIndex || 0);
  }
  mode = 'game';
  saveTimer = 0;
}

function toggleMute() {
  state.muted = !state.muted;
  if (state.audio) state.audio.setMuted(state.muted);
  if (state.radio) setRadioMuted(state.radio, state.muted);
}

// --- title screen input ---
function handleTitleInput(frameInput) {
  if (input.mouse.clicked) {
    const cx = input.mouse.clickX;
    const cy = input.mouse.clickY;
    clearClick(input);
    for (const b of titleButtons) {
      if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) {
        if (b.id === 'new') startNew();
        else startContinue();
        return;
      }
    }
  }
  if (frameInput.actions & ACTIONS.CONFIRM) {
    if (loadSave()) startContinue();
    else startNew();
  }
}

// --- one frame ---
let last = performance.now();
function frame(now) {
  const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
  last = now;
  const t = now / 1000;

  if (mode === 'title') {
    const frameInput = pollInput(input, state.camera, canvas.width, canvas.height);
    handleTitleInput(frameInput);
    const save = loadSave();
    titleButtons = drawTitleScreen(ctx, canvas.width, canvas.height, saveInfoText(save));
    requestAnimationFrame(frame);
    return;
  }

  if (mode === 'paused') {
    const frameInput = pollInput(input, state.camera, canvas.width, canvas.height);
    if (frameInput.actions & ACTIONS.PAUSE) mode = 'game';
    if (frameInput.actions & ACTIONS.MUTE) toggleMute();
    if (frameInput.actions & ACTIONS.RADIO) {
      ensureRadio(state.radio);
      cycleRadio(state.radio);
    }
    drawGame(ctx, state, t);
    drawPauseOverlay(ctx, canvas.width, canvas.height);
    requestAnimationFrame(frame);
    return;
  }

  // --- game ---
  const frameInput = pollInput(input, state.camera, canvas.width, canvas.height);
  if (frameInput.actions & ACTIONS.PAUSE) {
    mode = 'paused';
    saveGame(state);
    requestAnimationFrame(frame);
    return;
  }
  if (frameInput.actions & ACTIONS.MUTE) toggleMute();
  if (frameInput.actions & ACTIONS.RADIO) {
    ensureRadio(state.radio);
    cycleRadio(state.radio);
  }

  const events = world.step(frameInput, dt);
  if (events & EV.ENEMY_SHOT) {
    if (state.audio) state.audio.enemyShot();
  }
  if (events & EV.MISSION_COMPLETE) {
    saveGame(state);
    // Start the next mission here — updateMission never does it.
    if (!state.storyComplete && state.missionsDone < MISSIONS.length) {
      startMission(state, state.missionsDone);
    }
  }
  if (state.radio) tickRadio(state.radio);
  if (state.audio) state.audio.stepMusic();

  state.hint = computeHint(state);

  saveTimer += dt;
  if (saveTimer > 20) {
    saveTimer = 0;
    saveGame(state);
  }

  drawGame(ctx, state, t);
  requestAnimationFrame(frame);
}

// --- screenshot staging (?shot=name&seed=n) ---
if (shotParam && SHOT_NAMES.includes(shotParam)) {
  if (shotParam === 'start') {
    mode = 'title';
  } else {
    stageShot(state, shotParam);
    mode = 'game';
    // Let traffic / police / roadblocks settle before the capture.
    for (let i = 0; i < 40; i++) {
      const settle = { ...NEUTRAL_INPUT, aimX: state.player.x, aimY: state.player.y };
      world.step(settle, 1 / 60);
    }
  }
}

window.addEventListener('beforeunload', () => {
  if (mode === 'game') saveGame(state);
});

// Debug handle for the playthrough harness.
window.__solmar = {
  get state() {
    return state;
  },
  get world() {
    return world;
  },
};

requestAnimationFrame(frame);
