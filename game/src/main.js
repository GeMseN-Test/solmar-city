// Solmar City — entry point. Wires the canvas, the input, the audio,
// the radio and the world together, runs the frame loop, and owns the
// screens (title / game / paused / dead). `?shot=<name>&seed=N` renders
// one staged frame for screenshots and stops.
import { createAudio } from './audio.js';
import { WORLD_H, WORLD_W } from './config.js';
import { buildFrameInput, createInput, ACTIONS } from './input.js';
import { currentObjective } from './missions.js';
import { cycleRadio, ensureRadio, radioName, tickRadio } from './radio.js';
import { render, titleButtons } from './render.js';
import { applySave, loadSave, saveGame, saveInfoText } from './save.js';
import { stageShot } from './shots.js';
import { createWorld } from './world.js';
import { clamp, formatMoney } from './util.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const VW = canvas.width;
const VH = canvas.height;

const params = new URLSearchParams(window.location.search);
const seedParam = parseInt(params.get('seed') || '1', 10);
const shotParam = params.get('shot');

const world = createWorld(Number.isFinite(seedParam) ? seedParam : 1);
const state = world.state;
const input = createInput(canvas);
const audio = createAudio();

let screen = 'title';
let camera = { x: 0, y: 0 };
let banner = null;
let bannerUntil = 0;
let deadText = null;
let deadUntil = 0;
let lastTime = performance.now();
let saveTimer = 0;
let shotDone = false;

const savedGame = loadSave();

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function updateCamera(dt) {
  const p = state.player;
  const lookX = p.inCar && p.car ? Math.cos(p.angle) * Math.abs(p.car.speed) * 0.25 : 0;
  const lookY = p.inCar && p.car ? Math.sin(p.angle) * Math.abs(p.car.speed) * 0.25 : 0;
  const tx = clamp(p.x + lookX - VW / 2, 0, WORLD_W - VW);
  const ty = clamp(p.y + lookY - VH / 2, 0, WORLD_H - VH);
  camera.x += (tx - camera.x) * Math.min(1, dt * 5);
  camera.y += (ty - camera.y) * Math.min(1, dt * 5);
}

function showBanner(text, sub, seconds) {
  banner = { text, sub: sub || '' };
  bannerUntil = performance.now() + seconds * 1000;
}

function handleEvents(events) {
  if (events & 1) audio.shot();
  if (events & 2) audio.punch();
  if (events & 4) audio.pickup('cash');
  if (events & 8) audio.crash(0.6);
  if (events & 128) audio.enemyShot();
  if (events & 256) showBanner('VAULT GRABBED', 'Lose the heat — run!', 2.5);
  if (events & 512) showBanner('CAR STOLEN', 'The cops saw that…', 2);
  if (events & 16) audio.click();
  if (events & 1024) {
    audio.missionComplete();
    const done = state.missionsDone;
    showBanner('MISSION COMPLETE', done + ' missions done  •  ' + formatMoney(state.money), 3);
    saveGame(state);
    if (state.storyComplete) {
      showBanner('THE SOLMAR CROWN IS YOURS', 'All 12 story missions complete — Mara owns this city.', 6);
    }
  }
  if (events & 32) {
    deadText = 'WASTED';
    deadUntil = performance.now() + 2200;
    audio.busted();
  }
  if (events & 64) {
    deadText = 'BUSTED';
    deadUntil = performance.now() + 2200;
    audio.busted();
  }
}

function startNewGame() {
  audio.ensure();
  ensureRadio(state.radio);
  world.reset(); // re-rolls in place; `state` stays the live object
  state.screen = 'game';
  screen = 'game';
  showBanner('SOLMAR CITY', 'M1: Hot Wheels — steal a car', 3);
  setStatus('M1 Hot Wheels — steal a car');
  canvas.focus();
}

function continueGame() {
  if (!savedGame) return;
  audio.ensure();
  ensureRadio(state.radio);
  applySave(state, savedGame);
  state.screen = 'game';
  screen = 'game';
  setStatus('Continued — ' + formatMoney(state.money));
  canvas.focus();
}

function onTitleClick() {
  if (!input.mouse.clicked) return;
  const { clickX, clickY } = input.mouse;
  input.mouse.clicked = false;
  const btns = titleButtons(VW, VH);
  const b = btns.newGame;
  if (clickX >= b.x && clickX <= b.x + b.w && clickY >= b.y && clickY <= b.y + b.h) {
    startNewGame();
    return;
  }
  if (savedGame) {
    const c = btns.continue;
    if (clickX >= c.x && clickX <= c.x + c.w && clickY >= c.y && clickY <= c.y + c.h) {
      continueGame();
    }
  }
}

function frame(now) {
  const dt = clamp((now - lastTime) / 1000, 0, 0.05);
  lastTime = now;

  // One-shot screenshot mode: stage, render once, stop the loop and
  // tell the harness the frame is ready.
  if (shotParam) {
    if (!shotDone) {
      stageShot(state, shotParam);
      state.screen = shotParam === 'title' ? 'title' : 'game';
      updateCamera(1);
      render(ctx, state, {
        camX: camera.x, camY: camera.y, vw: VW, vh: VH,
        screen: state.screen, banner: null, mouse: input.mouse,
        hasSave: !!savedGame, saveInfo: saveInfoText(savedGame),
      });
      shotDone = true;
      window.__solmarReady = true;
    }
    return;
  }

  // Edge actions are consumed once per frame, whatever the screen.
  const frameInput = buildFrameInput(input, camera);
  if (frameInput.actions & ACTIONS.MUTE) {
    const m = !audio.isMuted();
    audio.setMuted(m);
    state.radio.muted = m;
  }
  if (frameInput.actions & ACTIONS.RADIO) {
    if (ensureRadio(state.radio)) cycleRadio(state.radio);
  }

  if (screen === 'title') {
    if (frameInput.actions & ACTIONS.CONFIRM) startNewGame();
    else onTitleClick();
    updateCamera(dt);
    render(ctx, state, {
      camX: camera.x, camY: camera.y, vw: VW, vh: VH,
      screen: 'title', banner: null, mouse: input.mouse,
      hasSave: !!savedGame, saveInfo: saveInfoText(savedGame),
    });
    setStatus('Solmar City — press Enter or click New Game to play.');
  } else if (screen === 'paused') {
    if (frameInput.actions & ACTIONS.PAUSE) {
      screen = 'game';
      state.screen = 'game';
    }
    render(ctx, state, {
      camX: camera.x, camY: camera.y, vw: VW, vh: VH,
      screen: 'paused', banner: null, mouse: input.mouse,
    });
  } else {
    if (frameInput.actions & ACTIONS.PAUSE) {
      screen = 'paused';
      state.screen = 'paused';
      render(ctx, state, {
        camX: camera.x, camY: camera.y, vw: VW, vh: VH,
        screen: 'paused', banner: null, mouse: input.mouse,
      });
    } else {
      state.screen = 'game';
      const events = world.step(frameInput, dt);
      handleEvents(events);
      tickRadio(state.radio);
      audio.engine(state.player.inCar && state.player.car ? Math.abs(state.player.car.speed) / 560 : 0);
      audio.siren(state.police.wanted > 0);
      updateCamera(dt);
      // Autosave every 15 seconds of play.
      saveTimer += dt;
      if (saveTimer > 15) {
        saveTimer = 0;
        saveGame(state);
      }
      const obj = currentObjective(state);
      setStatus(
        (state.mission ? state.mission.title + ' — ' + (obj ? obj.text : '') : 'Free roam') +
        '  •  ' + formatMoney(state.money) +
        '  •  ' + state.police.wanted + '★' +
        '  •  ♪ ' + radioName(state.radio)
      );
      const showBannerNow = banner && now < bannerUntil ? banner : null;
      if (banner && now >= bannerUntil) banner = null;
      const showDead = deadText && now < deadUntil ? deadText : null;
      if (deadText && now >= deadUntil) deadText = null;
      render(ctx, state, {
        camX: camera.x, camY: camera.y, vw: VW, vh: VH,
        screen: 'game', banner: showBannerNow, dead: showDead, mouse: input.mouse,
      });
    }
  }
  requestAnimationFrame(frame);
}

// Debug / test handle: lets a headless harness inspect the live state
// (teleport the player, read money, set wanted) without touching the
// game code paths. The game itself never reads window.__solmar.
window.__solmar = { state, world, startNewGame };
window.__solmarReady = false;

if (shotParam) {
  // Render the staged shot as soon as the page loads.
  requestAnimationFrame(frame);
} else {
  state.screen = 'title';
  screen = 'title';
  camera.x = clamp(state.player.x - VW / 2, 0, WORLD_W - VW);
  camera.y = clamp(state.player.y - VH / 2, 0, WORLD_H - VH);
  requestAnimationFrame(frame);
}
