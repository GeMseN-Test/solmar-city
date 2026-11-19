// main.js — Solmar City entry point. Wires the canvas, the input, the
// world and the renderer together, and owns the screens: title, game,
// paused, WASTED, BUSTED.
//
// Frame loop: read one input object -> world.step -> play sounds for the
// events that came back -> tick the radio -> render. Nothing else happens
// per frame. Save on mission complete and on pause; Q cycles the radio,
// M mutes, P pauses, E interacts.

import { createWorld, EVENTS, saveSnapshot, applySave } from './world.js';
import { render } from './render.js';
import {
  createInput,
  readInput,
  ACTION_CONFIRM,
  ACTION_PAUSE,
  ACTION_INTERACT,
  ACTION_MUTE,
  ACTION_RADIO,
} from './input.js';
import { saveGame, loadSave, saveInfoText } from './save.js';
import { ensureRadio, tickRadio, cycleRadio, setRadioMuted, radioName } from './radio.js';
import { stageShot } from './shots.js';
import { nearestStealableCar, currentObjective } from './missions.js';
import { nearestBoat } from './boats.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const input = createInput(canvas);
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = parseInt(params.get('seed') || '1', 10);
const seed = Number.isFinite(seedParam) ? seedParam : 1;

let world = createWorld(seed);
let state = world.state;
let mode = 'title';
let modeTimer = 0;
let muted = false;
let saved = loadSave();
let saveInfo = saveInfoText(saved);

const BUTTONS = [
  { id: 'new', label: 'New Game', x: 490, y: 330, w: 300, h: 54 },
  { id: 'continue', label: 'Continue', x: 490, y: 400, w: 300, h: 54 },
];

function visibleButtons() {
  return saved ? BUTTONS : BUTTONS.filter((b) => b.id === 'new');
}

function startNewGame() {
  world = createWorld(seed);
  state = world.state;
  mode = 'game';
  wakeAudio();
}

function continueGame() {
  if (!saved) return;
  world = createWorld(typeof saved.seed === 'number' ? saved.seed : seed);
  state = world.state;
  applySave(state, saved);
  mode = 'game';
  wakeAudio();
}

// Audio (sound effects + radio) only starts after a real gesture — the
// browser demands it. Called on every click and keypress.
function wakeAudio() {
  if (state.audio && typeof state.audio.ensure === 'function') {
    state.audio.ensure();
  }
  ensureRadio(state.radio);
}

function playEventSounds(events) {
  const audio = state.audio;
  if (!audio) return;
  if (events & EVENTS.SHOT && typeof audio.shot === 'function') audio.shot();
  if (events & EVENTS.PUNCH && typeof audio.punch === 'function') audio.punch();
  if (events & EVENTS.PICKUP && typeof audio.pickup === 'function') audio.pickup('cash');
  if (events & EVENTS.CRASH && typeof audio.crash === 'function') audio.crash(0.5);
  if (events & EVENTS.MISSION && typeof audio.click === 'function') audio.click();
  if (events & EVENTS.DIED && typeof audio.crash === 'function') audio.crash(1);
  if (events & EVENTS.BUSTED && typeof audio.busted === 'function') audio.busted();
  if (events & EVENTS.ENEMY_SHOT && typeof audio.enemyShot === 'function') audio.enemyShot();
  if (events & EVENTS.VAULT && typeof audio.pickup === 'function') audio.pickup('vault');
  if (events & EVENTS.STEAL && typeof audio.click === 'function') audio.click();
  if (events & EVENTS.MISSION_COMPLETE && typeof audio.missionComplete === 'function') {
    audio.missionComplete();
  }
}

// The one-line hint above the bottom edge: what E does right here.
function computePrompt() {
  const p = state.player;
  if (p.inCar) return 'E — Get out of the car';
  if (p.inBoat) return 'E — Step ashore';
  if (nearestBoat(state, p.x, p.y)) return 'E — Board the boat';
  if (nearestStealableCar(state)) return 'E — Steal the car';
  const obj = currentObjective(state);
  if (obj && obj.kind === 'collect') {
    for (const crate of state.crates || []) {
      if (!crate.taken && Math.hypot(crate.x - p.x, crate.y - p.y) < 60) {
        return 'E — Grab the crate';
      }
    }
  }
  if (obj && obj.kind === 'interact') {
    const lm = state.city && state.city.landmarks ? state.city.landmarks[obj.key || 'bank'] : null;
    if (lm) {
      const lx = typeof lm.x === 'number' ? lm.x : lm[0];
      const ly = typeof lm.y === 'number' ? lm.y : lm[1];
      if (Math.hypot(lx - p.x, ly - p.y) < 90) return 'E — Grab the vault';
    }
  }
  return '';
}

function handleTitleClick() {
  if (!input.mouse.clicked) return;
  const cx = input.mouse.clickX;
  const cy = input.mouse.clickY;
  for (const b of visibleButtons()) {
    if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) {
      if (b.id === 'new') startNewGame();
      else continueGame();
      return;
    }
  }
}

function stepTitle(frame) {
  handleTitleClick();
  if (frame.actions & ACTION_CONFIRM) startNewGame();
}

function stepGame(frame, dt) {
  if (frame.actions & ACTION_PAUSE) {
    mode = 'paused';
    saveGame(state);
    return;
  }
  if (frame.actions & ACTION_MUTE) {
    muted = !muted;
    if (state.audio && typeof state.audio.setMuted === 'function') {
      state.audio.setMuted(muted);
    }
    setRadioMuted(state.radio, muted);
  }
  if (frame.actions & ACTION_RADIO) {
    wakeAudio();
    cycleRadio(state.radio);
  }
  const events = world.step(frame, dt);
  playEventSounds(events);
  tickRadio(state.radio);
  if (events & EVENTS.MISSION_COMPLETE) {
    saveGame(state);
    saved = loadSave();
    saveInfo = saveInfoText(saved);
  }
  if (events & EVENTS.DIED) {
    mode = 'wasted';
    modeTimer = 1.8;
  } else if (events & EVENTS.BUSTED) {
    mode = 'busted';
    modeTimer = 1.8;
  }
  void ACTION_INTERACT;
}

let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  const frameInput = readInput(input, state.camera);

  if (input.mouse.clicked || input.pressed.size > 0) wakeAudio();

  if (mode === 'title') {
    stepTitle(frameInput);
  } else if (mode === 'game') {
    stepGame(frameInput, dt);
  } else if (mode === 'paused') {
    if (frameInput.actions & ACTION_PAUSE) mode = 'game';
  } else if (mode === 'wasted' || mode === 'busted') {
    modeTimer -= dt;
    if (modeTimer <= 0) mode = 'game';
  }

  render(ctx, state, {
    mode,
    prompt: mode === 'game' ? computePrompt() : '',
    saveInfo,
    buttons: visibleButtons(),
    mouse: input.mouse,
  });

  input.mouse.clicked = false;
  requestAnimationFrame(frame);
}

// Screenshot mode: ?shot=harbor&seed=1 jumps straight into a staged scene.
// 'start' keeps the title screen so shot 1 shows it; other shots play.
if (shotName) {
  stageShot(state, shotName);
  if (shotName !== 'start') mode = 'game';
}

requestAnimationFrame(frame);

// Keep the save snapshot helpers reachable for the pause screen and tests.
void saveSnapshot;
void radioName;
