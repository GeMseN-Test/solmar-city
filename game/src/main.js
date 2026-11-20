// Solmar City — game loop + screens.
// Written from v2-spec.md only. Boots the world, runs the frame loop,
// and owns the screens: title (New Game / Continue), gameplay, pause,
// and the WASTED / BUSTED trip back to the Safehouse. Q cycles the
// radio, M mutes, P pauses, E interacts, Space punches on foot and
// handbrakes while driving. Sound and music are WebAudio synth
// (audio.js + radio.js), created lazily after the first gesture.
import { createWorld, saveSnapshot, applySave, EVENTS } from './world.js';
import { render } from './render.js';
import {
  createInput,
  consumeActions,
  moveVector,
  driveVector,
  handbrake,
  ACTION_CONFIRM,
  ACTION_PAUSE,
  ACTION_INTERACT,
  ACTION_MUTE,
  ACTION_RADIO,
} from './input.js';
import { cycleRadio, ensureRadio, tickRadio, setRadioMuted } from './radio.js';
import { startMission, currentObjective, nearestStealableCar, tryInteract } from './missions.js';
import { nearestBoat } from './boats.js';
import { saveGame, loadSave, saveInfoText } from './save.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const shotParam = params.get('shot');

const { state, step, reset } = createWorld(seed);
const input = createInput(canvas);

let muted = false;
let lastSiren = false;
let lastTime = performance.now();
let saveTimer = 0;

// --- Save / continue.
const saved = loadSave();
state.saveInfo = saveInfoText(saved);
if (saved && !shotParam) {
  state.screen = 'title';
} else if (!shotParam) {
  state.screen = 'title';
}

// --- Screenshot staging (?shot=start|city|chase|harbor).
// '?shot=start' stays on the title screen; the others stage gameplay.
if (shotParam) {
  stageShot(state, shotParam);
  if (shotParam !== 'start') state.screen = 'game';
}

// One-line hint at the bottom of the screen, or null.
export function computePrompt(st) {
  const p = st.player;
  if (p.inBoat) return 'E — Step ashore';
  if (p.inCar) return 'E — Step out of the car';
  const boat = nearestBoat(st, p.x, p.y);
  if (boat) return 'E — Board boat';
  const obj = currentObjective(st);
  if (obj && obj.kind === 'interact') {
    const lm = st.city.landmarks[obj.key];
    if (lm && Math.hypot(p.x - lm.x, p.y - lm.y) < 140) return 'E — Grab the vault';
  }
  if (obj && obj.kind === 'collect') return 'E — Grab the crate';
  if (nearestStealableCar(st)) return 'E — Steal car';
  return null;
}

function startNewGame() {
  reset();
  state.screen = 'game';
  state.saveInfo = saveInfoText(loadSave());
  try { state.audio.ensure(); } catch (e) { /* audio is optional */ }
  try { ensureRadio(state.radio); } catch (e) { /* radio is optional */ }
}

function continueGame() {
  const save = loadSave();
  if (save) {
    applySave(state, save);
    state.screen = 'game';
    if (state.missionIndex < 12 && !state.storyComplete) {
      startMission(state, state.missionIndex);
    }
  } else {
    startNewGame();
  }
  try { state.audio.ensure(); } catch (e) { /* audio is optional */ }
  try { ensureRadio(state.radio); } catch (e) { /* radio is optional */ }
}

function onTitleClick() {
  const m = input.mouse;
  if (!m.clicked) return false;
  // Menu hit areas match render.js: New Game at y ~380, Continue ~420.
  const x = m.clickX;
  const y = m.clickY;
  if (x > 440 && x < 840 && y > 360 && y < 400) { startNewGame(); return true; }
  if (state.saveInfo && x > 340 && x < 940 && y > 400 && y < 440) { continueGame(); return true; }
  return false;
}

function playEventSounds(events) {
  const a = state.audio;
  if (!a) return;
  try {
    if (events & EVENTS.SHOT) a.shot();
    if (events & EVENTS.PUNCH) a.punch();
    if (events & EVENTS.PICKUP) a.pickup('cash');
    if (events & EVENTS.CRASH) a.crash(0.6);
    if (events & EVENTS.STEAL) a.click();
    if (events & EVENTS.VAULT) a.pickup('vault');
    if (events & EVENTS.MISSION_COMPLETE) { a.missionComplete(); saveGame(state); }
    if (events & (EVENTS.DIED | EVENTS.BUSTED)) a.busted();
  } catch (e) { /* a sound failing must never stop the game */ }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(0.05, (now - lastTime) / 1000));
  lastTime = now;

  const actions = consumeActions(input);
  const clicked = input.mouse.clicked;
  input.mouse.clicked = false;

  if (state.screen === 'title') {
    if ((actions & ACTION_CONFIRM) || clicked) {
      if (!onTitleClick() && (actions & ACTION_CONFIRM)) startNewGame();
    }
    render(state, ctx);
    return;
  }

  if (state.screen === 'paused') {
    if (actions & ACTION_PAUSE) state.screen = 'game';
    render(state, ctx);
    return;
  }

  // --- Gameplay screen.
  if (actions & ACTION_PAUSE) {
    state.screen = 'paused';
    render(state, ctx);
    return;
  }
  if (actions & ACTION_MUTE) {
    muted = !muted;
    try { state.audio.setMuted(muted); } catch (e) { /* optional */ }
    try { setRadioMuted(state.radio, muted); } catch (e) { /* optional */ }
  }
  if (actions & ACTION_RADIO) {
    try { ensureRadio(state.radio); } catch (e) { /* optional */ }
    cycleRadio(state.radio);
  }

  const mv = moveVector(input);
  const dv = driveVector(input);
  const cam = state.camera;
  const frameInput = {
    mx: mv.x,
    my: mv.y,
    aimX: input.mouse.x + cam.x - 640,
    aimY: input.mouse.y + cam.y - 400,
    actions,
    shooting: input.mouse.down,
    running: input.keys.has('ShiftLeft') || input.keys.has('ShiftRight'),
    steer: dv.steer,
    throttle: dv.throttle,
    handbrake: handbrake(input) && state.player.inCar,
  };

  if (actions & ACTION_INTERACT) {
    tryInteract(state);
  }

  // Radio + music tick every frame (no-ops until a gesture starts them).
  try { tickRadio(state.radio); } catch (e) { /* optional */ }
  try { state.audio.stepMusic(); } catch (e) { /* optional */ }

  const events = step(frameInput, dt);
  playEventSounds(events);

  // Siren follows the wanted level, switched only on change.
  const sirenOn = (state.wanted || 0) > 0;
  if (sirenOn !== lastSiren) {
    lastSiren = sirenOn;
    try { state.audio.siren(sirenOn); } catch (e) { /* optional */ }
  }

  // Prompt line for the E key.
  state.prompt = computePrompt(state);

  // Autosave every 10s of play.
  saveTimer += dt;
  if (saveTimer > 10) {
    saveTimer = 0;
    saveGame(state);
  }

  render(state, ctx);
}

requestAnimationFrame(frame);
