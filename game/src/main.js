// main.js — Solmar City entry point: game loop, modes, HUD wiring, saves.
// Written from the v2 spec only.
// Modes: start / game / pause / wasted / busted. Q cycles radio stations,
// Space punches on foot and handbrakes while driving, E interacts / boards
// boats, M mutes, P pauses. A mission starts on MISSION_COMPLETE.
import { createWorld, EV, startMission, applySave } from './world.js';
import { createInput, ACTION } from './input.js';
import { draw } from './render.js';
import { createAudio } from './audio.js';
import { cycleRadio, ensureRadio, tickRadio, setRadioMuted } from './radio.js';
import { saveGame, loadSave, saveInfoText } from './save.js';
import { stageWorld } from './shots.js';
import { nearestBoat } from './boats.js';
import { nearestStealableCar, currentObjective, currentMission } from './missions.js';

const WORLD_W = 2880;
const WORLD_H = 2160;
const ACTION_RADIO = ACTION.RADIO;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const VW = canvas.width;
const VH = canvas.height;

const audio = createAudio();
let muted = false;
// Safe-call helper: audio methods exist per spec, but never let a missing
// sound method blank the game.
function sfx(name, ...args) {
  const f = audio && audio[name];
  if (typeof f === 'function') {
    try { f.apply(audio, args); } catch (e) { /* sound is best-effort */ }
  }
}

const input = createInput(canvas);

// ---- Boot: staged screenshot mode or normal game ---------------------------
const params = new URLSearchParams(window.location.search);
const shotScene = params.get('shot');
const seedParam = parseInt(params.get('seed') || '1', 10) || 1;

let world;
let mode = 'start';
if (shotScene) {
  world = stageWorld(seedParam, shotScene);
  // ?shot=start stays on the title screen; every other scene plays live.
  mode = shotScene === 'start' ? 'start' : 'game';
} else {
  world = createWorld(1);
}
let state = world.state;

let banner = '';
let bannerSub = '';
let bannerUntil = 0;
let lastSaveAt = 0;
let cam = { x: 0, y: 0 };

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function newGame() {
  sfx('ensure');
  world = createWorld(Math.floor(Math.random() * 100000) + 1);
  state = world.state;
  startMission(state, 0);
  mode = 'game';
  banner = 'MISSION 1 — HOT WHEELS';
  bannerSub = 'Steal a car and bring it to Ray\'s Garage';
  bannerUntil = performance.now() + 4000;
  setStatus('game • mission 1 • $' + state.money);
}

function continueGame() {
  const save = loadSave();
  if (!save) { newGame(); return; }
  sfx('ensure');
  world = createWorld(save.seed || 1);
  state = world.state;
  applySave(state, save);
  mode = 'game';
  setStatus('game • continued • $' + state.money);
}

function computePrompt() {
  const p = state.player;
  if (p.inBoat) return 'E — step ashore';
  if (p.inCar) return '';
  const boat = nearestBoat(state, p.x, p.y);
  if (boat) return 'E — board boat';
  const obj = currentObjective(state);
  if (obj && obj.kind === 'interact' && obj.key === 'bank') {
    const bank = state.city.landmarks.bank;
    const d = Math.hypot(p.x - bank.x, p.y - bank.y);
    if (d < 110) return 'E — grab the vault!';
  }
  if (nearestStealableCar(state)) return 'E — steal car';
  return '';
}

function updateCamera() {
  const p = state.player;
  // Boat camera lookahead: lead the boat's heading a little.
  let lx = p.x;
  let ly = p.y;
  if (p.inBoat && p.boat) {
    lx += Math.cos(p.angle) * 60;
    ly += Math.sin(p.angle) * 60;
  }
  cam.x = Math.max(0, Math.min(WORLD_W - VW, lx - VW / 2));
  cam.y = Math.max(0, Math.min(WORLD_H - VH, ly - VH / 2));
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - (frame._last || now)) / 1000 || 0.016);
  frame._last = now;

  const actions = input.actions();
  const nowMs = performance.now();

  // ---- Start screen ------------------------------------------------------
  if (mode === 'start') {
    if (actions & ACTION.CONFIRM) { newGame(); return; }
    if (input.keys.KeyC) {
      const save = loadSave();
      if (save) { continueGame(); return; }
    }
    if (input.mouse.clicked) {
      const cx = input.mouse.clickX;
      const cy = input.mouse.clickY;
      input.mouse.clicked = false;
      if (Math.abs(cx - VW / 2) < 220 && Math.abs(cy - 340) < 22) { newGame(); return; }
      if (Math.abs(cx - VW / 2) < 260 && Math.abs(cy - 380) < 22) {
        if (loadSave()) { continueGame(); return; }
      }
    }
    input.mouse.clicked = false;
    const save = loadSave();
    draw(ctx, state, cam, { mode: 'start', saveText: save ? saveInfoText(save) : '' });
    setStatus('start screen');
    return;
  }

  // ---- Pause ---------------------------------------------------------------
  if (mode === 'pause') {
    if (actions & ACTION.PAUSE) { mode = 'game'; }
    draw(ctx, state, cam, { mode: 'pause', prompt: '' });
    return;
  }

  // ---- Wasted / busted overlays --------------------------------------------
  if (mode === 'wasted' || mode === 'busted') {
    if (actions & ACTION.CONFIRM) { mode = 'game'; }
    draw(ctx, state, cam, { mode, prompt: '' });
    return;
  }

  // ---- Game ------------------------------------------------------------------
  if (actions & ACTION.PAUSE) {
    mode = 'pause';
    draw(ctx, state, cam, { mode: 'pause', prompt: '' });
    return;
  }
  if (actions & ACTION.MUTE) {
    muted = !muted;
    sfx('setMuted', muted);
    setRadioMuted(state.radio, muted);
  }
  if (actions & ACTION_RADIO) {
    sfx('ensure');
    ensureRadio(state.radio);
    cycleRadio(state.radio);
  }
  tickRadio(state.radio);

  const mv = input.moveVector();
  const dv = input.driveVector();
  const frameInput = {
    mx: mv.mx,
    my: mv.my,
    aimX: cam.x + input.mouse.x,
    aimY: cam.y + input.mouse.y,
    actions,
    shooting: input.shooting,
    running: input.running,
    steer: dv.steer,
    throttle: dv.throttle,
    handbrake: input.handbrake(),
  };

  const events = world.step(frameInput, dt);
  state = world.state;

  if (events & EV.SHOT) sfx('shot');
  if (events & EV.PUNCH) sfx('punch');
  if (events & EV.PICKUP) sfx('pickup', 'cash');
  if (events & EV.CRASH) sfx('crash', 0.5);
  if (events & EV.ENEMY_SHOT) sfx('enemyShot');
  if (events & EV.VAULT) sfx('pickup', 'vault');
  if (events & EV.STEAL) sfx('click');
  if (events & EV.MISSION) sfx('click');
  if (events & EV.MISSION_COMPLETE) {
    sfx('missionComplete');
    const done = state.missionsDone;
    banner = 'MISSION COMPLETE — ' + (state.lastMissionTitle || '').toUpperCase();
    bannerSub = '+' + (state.lastReward || 0) + '  •  ' + moneyLine();
    bannerUntil = nowMs + 4000;
    if (state.storyComplete) {
      banner = 'STORY COMPLETE — YOU ARE THE KING OF SOLMAR';
      bannerSub = 'Final cash ' + moneyLine() + '  •  Thanks for playing!';
      bannerUntil = nowMs + 8000;
    } else if (done < 12) {
      // Start the next mission right away.
      startMission(state, done);
    }
  }
  if (events & EV.DIED) {
    sfx('busted');
    mode = 'wasted';
  } else if (events & EV.BUSTED) {
    sfx('busted');
    mode = 'busted';
  }

  // Engine + siren + music, every frame.
  const speedNorm = state.player.inCar && state.player.car
    ? Math.abs(state.player.car.speed || 0) / 560
    : 0;
  sfx('engine', speedNorm);
  sfx('siren', (state.wanted || 0) > 0);
  sfx('stepMusic');

  // Autosave every 10s.
  if (nowMs - lastSaveAt > 10000) {
    lastSaveAt = nowMs;
    saveGame(state);
  }

  updateCamera();
  const showBanner = nowMs < bannerUntil ? banner : '';
  draw(ctx, state, cam, {
    mode: 'game',
    prompt: computePrompt(),
    banner: showBanner,
    bannerSub: nowMs < bannerUntil ? bannerSub : '',
  });

  const mission = currentMission(state);
  setStatus(
    'game • ' + (mission ? mission.title : state.storyComplete ? 'story complete' : 'free roam')
    + ' • ' + moneyLine()
    + ' • HP ' + Math.ceil(state.player.hp)
    + ' • SCPD ' + (state.wanted || 0) + '★'
  );
}

function moneyLine() {
  return '$' + Math.floor(state.money || 0).toLocaleString('en-US');
}

requestAnimationFrame(frame);
