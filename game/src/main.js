// main.js — Solmar City game entrypoint (missions side).
// Written from the v2 spec only. Owns the frame loop, screens, prompts,
// save/load, radio cycling (Q), and the ?shot= staging hook. NOTE: this
// is the missions-side main.js — main.ts (the dossier builder) is a
// different file and is not touched here.
import { createWorld, saveSnapshot, applySave, EV } from './world.js';
import { render } from './render.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_INTERACT, ACTION_MUTE, ACTION_RADIO } from './input.js';
import { createAudio } from './audio.js';
import { createRadio, cycleRadio, ensureRadio, tickRadio, setRadioMuted, radioName } from './radio.js';
import { exitBoat } from './boats.js';
import { startMission, currentObjective, missionMarker, nearestStealableCar, nearestCrate } from './missions.js';
import { saveGame, loadSave, saveInfoText } from './save.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const shotScene = params.get('shot');
const seedParam = parseInt(params.get('seed') || '1', 10);
const seed = Number.isFinite(seedParam) ? seedParam : 1;

const world = createWorld(seed);
const state = world.state;
const input = createInput(canvas);

let audio = null;
try { audio = createAudio(); } catch (e) { audio = null; }
if (state.audio && !audio) audio = state.audio;

let screen = 'title';
let banner = '';
let bannerTimer = 0;
let muted = false;
let saveText = '';
try { saveText = saveInfoText(loadSave()); } catch (e) { saveText = ''; }

// --- Prompts (E to interact, boat lines, vault lines) ---
function computePrompt() {
  const p = state.player;
  if (screen !== 'playing') return '';
  if (p.inBoat) return 'E — Step ashore  •  Q — Change radio station';
  if (p.inCar) return 'E — Step out  •  Space — Handbrake  •  Q — Radio';
  const obj = currentObjective(state);
  if (obj && obj.kind === 'interact' && obj.key === 'bank') {
    const lm = state.city.landmarks && state.city.landmarks.bank;
    if (lm && Math.hypot(p.x - lm.x, p.y - lm.y) < 110) return 'E — Grab the vault!';
  }
  if (obj && obj.kind === 'collect' && nearestCrate(state, 60)) return 'E — Grab the crate';
  try {
    const { nearestBoat } = { nearestBoat: null };
    void nearestBoat;
  } catch (e) {}
  if (state.boats) {
    for (const b of state.boats) {
      if (Math.hypot(p.x - b.x, p.y - b.y) < 70) return 'E — Board the boat';
    }
  }
  if (nearestStealableCar(state)) return 'E — Steal the car';
  return '';
}

function showBanner(text, seconds) {
  banner = text;
  bannerTimer = seconds || 3;
}

function newGame() {
  const fresh = world.reset();
  // world.reset() swaps the internal state; re-point our bindings.
  // (createWorld keeps its own reference; use getState when available.)
  const s = typeof world.getState === 'function' ? world.getState() : fresh;
  copyStateInto(state, s);
  screen = 'playing';
  showBanner('Welcome to Solmar City', 3);
  try { if (audio) audio.click(); } catch (e) {}
}

// Copy a fresh state object into the live one (keeps render/main refs).
function copyStateInto(dst, src) {
  for (const k of Object.keys(src)) dst[k] = src[k];
}

function continueGame() {
  let save = null;
  try { save = loadSave(); } catch (e) { save = null; }
  if (!save) { newGame(); return; }
  try { applySave(state, save); } catch (e) {}
  screen = 'playing';
  showBanner('Welcome back', 2);
}

function startMissionIfNeeded() {
  if (state.missionIndex < 0 && !state.storyComplete) {
    const next = state.missionsDone || 0;
    startMission(state, next);
  }
}

function handleEvents(events) {
  if (!events) return;
  try {
    if (events & EV.SHOT && audio) audio.shot();
    if (events & EV.PUNCH && audio) audio.punch();
    if (events & EV.PICKUP && audio) audio.pickup('cash');
    if (events & EV.CRASH && audio) audio.crash(0.5);
    if (events & EV.VAULT && audio) audio.pickup('cash');
    if (events & EV.BUSTED) {
      showBanner('BUSTED!', 3);
      screen = 'busted';
      if (audio) audio.busted();
    }
    if (events & EV.DIED) {
      showBanner('WASTED', 3);
      screen = 'dead';
    }
    if (events & EV.MISSION_COMPLETE) {
      showBanner('Mission complete!', 3);
      if (audio) audio.missionComplete();
      try { saveGame(state); } catch (e) {}
      saveText = '';
      try { saveText = saveInfoText(loadSave()); } catch (e) {}
      if (state.storyComplete) screen = 'complete';
      else startMissionIfNeeded();
    }
  } catch (e) { /* audio is best-effort */ }
}

// --- Frame loop ---
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  if (dt <= 0) dt = 0.016;

  const frameInput = input.readFrame();
  const click = input.readClick();
  // Mouse aim in world coords.
  frameInput.aimX = frameInput.aimX + state.camera.x;
  frameInput.aimY = frameInput.aimY + state.camera.y;

  // Radio ticks every frame (no-op until the AudioContext exists).
  try { tickRadio(state.radio); } catch (e) {}

  if (bannerTimer > 0) bannerTimer -= dt;
  const ui = {
    screen,
    prompt: computePrompt(),
    banner: bannerTimer > 0 ? banner : '',
    saveText,
  };

  if (screen === 'title') {
    if ((frameInput.actions & ACTION_CONFIRM) || (click && click.y > 420 && click.y < 480)) {
      // Click on "New Game" (or Enter): start fresh. Click lower = continue.
      if (click && click.y > 340 && click.y < 400 && saveText) continueGame();
      else newGame();
    }
    render(ctx, state, state.camera, ui);
    return;
  }

  if (screen === 'paused') {
    if (frameInput.actions & ACTION_PAUSE) screen = 'playing';
    render(ctx, state, state.camera, ui);
    return;
  }

  if (screen === 'dead' || screen === 'busted' || screen === 'complete') {
    if (frameInput.actions & ACTION_CONFIRM) {
      if (screen === 'complete') screen = 'playing';
      else screen = 'playing';
    }
    render(ctx, state, state.camera, ui);
    return;
  }

  // Playing.
  if (frameInput.actions & ACTION_PAUSE) {
    screen = 'paused';
    try { saveGame(state); } catch (e) {}
    render(ctx, state, state.camera, ui);
    return;
  }
  if (frameInput.actions & ACTION_MUTE) {
    muted = !muted;
    try {
      setRadioMuted(state.radio, muted);
      if (audio) audio.setMuted(muted);
    } catch (e) {}
  }
  if (frameInput.actions & ACTION_RADIO) {
    // Q cycles the station — only after a user gesture, so the
    // AudioContext can start.
    try {
      ensureRadio(state.radio);
      cycleRadio(state.radio);
      showBanner('Radio: ' + radioName(state.radio), 2);
    } catch (e) {}
  }

  startMissionIfNeeded();
  const events = world.step(frameInput, dt);
  handleEvents(events);
  // Keep the ui prompt fresh after the step.
  ui.prompt = computePrompt();
  ui.banner = bannerTimer > 0 ? banner : '';
  render(ctx, state, state.camera, ui);
}

// --- Boot ---
try {
  const save = loadSave();
  if (save) saveText = saveInfoText(save);
} catch (e) {}
if (shotScene) {
  // Screenshot mode: stage the scene, skip the title screen.
  try { stageShot(state, shotScene, seed); } catch (e) {}
  screen = 'playing';
  startMissionIfNeeded();
}
try { if (audio) audio.ensure(); } catch (e) {}
requestAnimationFrame(frame);

// Keep the save fresh when the player leaves the page.
window.addEventListener('beforeunload', () => {
  try { if (screen === 'playing') saveGame(state); } catch (e) {}
});

export { state, world, screen };
