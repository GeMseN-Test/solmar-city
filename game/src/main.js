// main.js — Entry point for Solmar City.
//
// Wires everything together: canvas + game loop, screens (title /
// playing / paused / wasted / busted), save + continue, radio (Q),
// handbrake, prompts, and audio. Each frame it builds a plain VALUES
// input object for world.step — no functions cross that boundary:
//   { mx, my, aimX, aimY, actions, shooting, running,
//     steer, throttle, handbrake }
//
// Screens:
//   title   — "SOLMAR CITY", New Game / Continue (if a save exists).
//   playing — the loop runs world.step + render.
//   paused  — P / Esc freezes the loop, overlay with resume/quit.
//   wasted / busted — overlay after DIED / BUSTED, Enter respawns
//             at the safehouse and play continues.
//
// ?shot=<scene>&seed=<n> in the URL stages a screenshot scene via
// shots.js instead of starting at the title screen.
//
// Audio: WebAudio synth (audio.js) for effects + music, and the
// in-game radio (radio.js) with its own lazy AudioContext — both only
// start after a user gesture (a click or key press).

import { createWorld, EV, MISSIONS, startMission, applySnapshot } from './world.js';
import { render } from './render.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_INTERACT, ACTION_PUNCH, ACTION_MUTE, ACTION_RADIO } from './input.js';
import { createAudio } from './audio.js';
import { createRadio, cycleRadio, radioName, ensureRadio, tickRadio, setRadioMuted } from './radio.js';
import { saveGame, loadSave, clearSave, saveInfoText } from './save.js';
import { stageShot } from './shots.js';
import { nearestBoat } from './boats.js';
import { currentObjective, missionMarker } from './missions.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

let world = createWorld(1);
let state = world.state;
let screen = 'title';
let save = loadSave();
let lastTime = 0;
let saveTimer = 0;
let shotMode = null;

const input = createInput(canvas);
const audio = createAudio();
if (!state.radio) state.radio = createRadio();

// ------------------------------------------------------------------
// Context prompt: one line that tells the player what E does here.
// ------------------------------------------------------------------

export function computePrompt(state) {
  const p = state.player;
  const obj = currentObjective(state);

  if (p.inBoat) return 'E — step ashore   •   W/S throttle, A/D steer the boat';
  if (p.inCar) return 'E — get out   •   Space (hold) — handbrake   •   W/S drive, A/D steer';
  if (nearestBoat(state, p.x, p.y)) return 'E — board the boat';
  const crate = (state.crates || []).find((c) => !c.taken);
  if (crate) {
    const dx = p.x - crate.x;
    const dy = p.y - crate.y;
    if (dx * dx + dy * dy < 46 * 46) return 'E — grab the crate';
  }
  if (obj && obj.kind === 'interact') {
    const bank = state.city.landmarks.bank;
    if (bank) {
      const dx = p.x - bank.x;
      const dy = p.y - bank.y;
      if (dx * dx + dy * dy < 110 * 110) return 'E — grab the vault (4 stars!)';
    }
  }
  const car = state.traffic.cars.find((c) => {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    return dx * dx + dy * dy < 70 * 70;
  });
  if (car) return 'E — steal the car (+1 star)';
  if (obj && obj.kind === 'board') return 'Head to the docks and board a boat (E)';
  if (obj) return obj.text;
  return 'Enter — start a mission at the map marker   •   E — interact';
}

// ------------------------------------------------------------------
// Screens
// ------------------------------------------------------------------

function drawTitle() {
  ctx.fillStyle = '#0d1520';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffd54a';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SOLMAR CITY', canvas.width / 2, 240);
  ctx.fillStyle = '#9fd8ff';
  ctx.font = '24px sans-serif';
  ctx.fillText('An open-world crime game — 12 story missions, boats, radio, taxi fares', canvas.width / 2, 300);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('▶  New Game  (Enter)', canvas.width / 2, 420);
  if (save) {
    ctx.fillStyle = '#2ecc71';
    ctx.fillText('↻  Continue — ' + saveInfoText(save) + '  (C)', canvas.width / 2, 470);
  }
  ctx.fillStyle = '#aaa';
  ctx.font = '17px sans-serif';
  ctx.fillText('WASD move • Mouse aim, click to shoot • E interact / steal car / board boat', canvas.width / 2, 560);
  ctx.fillText('Space punch — hold Space to handbrake while driving • Q radio • M mute • P pause', canvas.width / 2, 590);
  ctx.textAlign = 'left';
}

function drawOverlay(title, sub) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 56px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 20);
  ctx.font = '22px sans-serif';
  ctx.fillStyle = '#ddd';
  ctx.fillText(sub, canvas.width / 2, canvas.height / 2 + 30);
  ctx.textAlign = 'left';
}

function startNewGame() {
  world = createWorld((Math.random() * 0x7fffffff) | 0);
  state = world.state;
  if (!state.radio) state.radio = createRadio();
  state.radio.stationIndex = 0;
  clearSave();
  save = null;
  audio.ensure();
  ensureRadio(state.radio);
  startMission(state, 0);
  screen = 'playing';
}

function continueGame() {
  if (!save) return;
  world = createWorld(save.seed || 1);
  state = world.state;
  applySnapshot(state, save);
  audio.ensure();
  ensureRadio(state.radio);
  screen = 'playing';
}

function handleTitleInput(actions) {
  if (actions & ACTION_CONFIRM || input.takeClick()) {
    startNewGame();
    return;
  }
  if (input.isDown('KeyC') && save) {
    continueGame();
  }
}

function handleOverlayInput(actions, after) {
  if ((actions & ACTION_CONFIRM) || input.takeClick()) {
    after();
  }
}

// ------------------------------------------------------------------
// Events from world.step
// ------------------------------------------------------------------

function handleEvents(events) {
  if (events & EV.SHOT) audio.shot();
  if (events & EV.PUNCH) audio.punch();
  if (events & EV.PICKUP) audio.pickup('cash');
  if (events & EV.CRASH) audio.crash(0.5);
  if (events & EV.STEAL) audio.pickup('cash');
  if (events & EV.VAULT) audio.missionComplete();
  if (events & EV.ENEMY_SHOT) audio.enemyShot();
  if (events & EV.MISSION) audio.click();
  if (events & EV.MISSION_COMPLETE) {
    audio.missionComplete();
    saveGame(state);
    save = loadSave();
  }
  if (events & EV.DIED) {
    audio.busted();
    screen = 'wasted';
  }
  if (events & EV.BUSTED) {
    audio.busted();
    screen = 'busted';
  }
}

// ------------------------------------------------------------------
// Frame
// ------------------------------------------------------------------

function buildInput(actions) {
  const p = state.player;
  const move = input.moveVector();
  const drive = input.driveVector();
  // Mouse position in world coords (screen + camera - viewport half).
  const aimX = input.mouse.x + state.camera.x - canvas.width / 2;
  const aimY = input.mouse.y + state.camera.y - canvas.height / 2;
  const driving = p.inCar || p.inBoat;
  return {
    mx: move.mx,
    my: move.my,
    aimX,
    aimY,
    actions,
    shooting: input.mouse.down && !driving,
    running: input.running(),
    steer: driving ? drive.steer : 0,
    throttle: driving ? drive.throttle : 0,
    handbrake: driving ? input.handbrake() : false,
  };
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
  lastTime = now;
  const actions = input.takeActions();

  if (screen === 'title') {
    handleTitleInput(actions);
    drawTitle();
    return;
  }

  if (screen === 'paused') {
    render(state, ctx, canvas.width, canvas.height);
    drawOverlay('PAUSED', 'P / Esc — resume    •    Enter — save & quit to title');
    if (actions & ACTION_PAUSE) {
      screen = 'playing';
    } else if (actions & ACTION_CONFIRM) {
      saveGame(state);
      save = loadSave();
      screen = 'title';
    }
    return;
  }

  if (screen === 'wasted' || screen === 'busted') {
    render(state, ctx, canvas.width, canvas.height);
    drawOverlay(
      screen === 'wasted' ? 'WASTED' : 'BUSTED',
      'Enter — back to the safehouse',
    );
    handleOverlayInput(actions, () => {
      screen = 'playing';
    });
    return;
  }

  // Playing.
  if (actions & ACTION_PAUSE) {
    screen = 'paused';
    return;
  }
  if (actions & ACTION_MUTE) {
    const muted = !state.muted;
    state.muted = muted;
    audio.setMuted(muted);
    setRadioMuted(state.radio, muted);
  }
  if (actions & ACTION_RADIO) {
    audio.ensure();
    ensureRadio(state.radio);
    cycleRadio(state.radio);
    state.bannerText = '♪ ' + radioName(state.radio);
    state.bannerTimer = 2;
  }
  if (actions & ACTION_CONFIRM && !state.mission) {
    const next = state.missionIndex < MISSIONS.length ? state.missionIndex : 0;
    if (!state.storyComplete) startMission(state, next);
  }

  const values = buildInput(actions);
  const events = world.step(values, dt);
  handleEvents(events);

  // Radio scheduler + music tick every frame.
  tickRadio(state.radio);
  audio.stepMusic();

  // Autosave every 20s of play.
  saveTimer += dt;
  if (saveTimer > 20) {
    saveTimer = 0;
    saveGame(state);
    save = loadSave();
  }

  render(state, ctx, canvas.width, canvas.height);

  // Prompt line (bottom, above the how-to bar).
  const prompt = computePrompt(state);
  if (prompt) {
    ctx.font = 'bold 16px sans-serif';
    const pw = ctx.measureText(prompt).width;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect((canvas.width - pw) / 2 - 12, canvas.height - 78, pw + 24, 28);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(prompt, canvas.width / 2, canvas.height - 59);
    ctx.textAlign = 'left';
  }

  if (statusEl) {
    statusEl.textContent =
      '$' + (state.money || 0) + '  •  ' +
      (state.missionsDone || 0) + ' missions done' +
      (state.storyComplete ? '  •  STORY COMPLETE' : '');
  }
}

// ------------------------------------------------------------------
// Boot
// ------------------------------------------------------------------

function boot() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) {
    shotMode = shot;
    const seed = parseInt(params.get('seed') || '1', 10) || 1;
    state = stageShot(shot, seed);
    world.state = state;
    screen = 'playing';
    if (statusEl) statusEl.textContent = 'Shot: ' + shot;
  }
  requestAnimationFrame(frame);
}

boot();
