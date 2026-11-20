// Solmar City — the entry point. Wires the world to the screen:
// the canvas, the frame loop, the title screen (New Game /
// Continue), pause, WASTED / BUSTED, the radio (Q), mute (M), the
// save slot, and the ?shot= staging hook the screenshots use.
//
// The frame loop is small on purpose: build the frame input, step
// the world, play the sounds the returned events ask for, tick the
// radio, draw. The world does the rules; the renderer does the
// picture; this file does the plumbing between them.

import { createWorld, respawnPlayer } from './world.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_MUTE, ACTION_RADIO } from './input.js';
import { createAudio } from './audio.js';
import {
  cycleRadio, radioName, ensureRadio, tickRadio,
  setRadioMuted,
} from './radio.js';
import { saveGame, loadSave, clearSave, saveInfoText, applySave } from './save.js';
import {
  MISSIONS, startMission, currentObjective, missionMarker,
} from './missions.js';
import { nearestBoat } from './boats.js';
import { nearestStealableCar } from './missions.js';
import { formatMoney, formatTime, formatCountdown } from './util.js';
import { EV } from './config.js';
import * as Render from './render.js';
import * as Shots from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const params = new URLSearchParams(window.location.search);
const seedParam = parseInt(params.get('seed') || '', 10);
const shotParam = params.get('shot');
const seed = Number.isFinite(seedParam) ? seedParam : 1;

const { state, reset, step } = createWorld(seed);
const input = createInput(canvas);
const audio = createAudio();
// The radio lives on the state (world.js builds it); always read it
// through state.radio — reset() pours a fresh world into the same
// state object, so a cached reference would go stale.

let mode = 'title'; // title | game | paused | wasted | busted
let lastNow = 0;
let saveTimer = 0;
let banner = '';
let bannerTimer = 0;

// The renderer is imported as a namespace so this file keeps working
// whichever verb the render module exports: render, draw or drawGame.
const draw = Render.render || Render.draw || Render.drawGame || null;

// ---- menu -----------------------------------------------------------

const menu = document.createElement('div');
menu.id = 'menu';
menu.style.cssText = 'position:absolute;left:50%;top:58%;transform:translate(-50%,-50%);'
  + 'display:flex;flex-direction:column;gap:10px;align-items:center;';
const newBtn = document.createElement('button');
newBtn.textContent = 'New Game';
newBtn.style.cssText = menuButtonStyle();
const contBtn = document.createElement('button');
contBtn.textContent = 'Continue';
contBtn.style.cssText = menuButtonStyle();
menu.appendChild(newBtn);
menu.appendChild(contBtn);
document.body.appendChild(menu);

function menuButtonStyle() {
  return 'font:600 18px system-ui,sans-serif;padding:10px 28px;'
    + 'background:#f5c518;color:#111;border:0;border-radius:8px;cursor:pointer;';
}

function refreshMenu() {
  const save = loadSave();
  contBtn.style.display = save ? '' : 'none';
  contBtn.textContent = save ? 'Continue — ' + saveInfoText(save) : 'Continue';
  menu.style.display = mode === 'title' ? 'flex' : 'none';
}

newBtn.addEventListener('click', () => {
  clearSave();
  startFresh();
});
contBtn.addEventListener('click', () => {
  const save = loadSave();
  if (save) startContinued(save);
});

function startFresh() {
  reset();
  audio.ensure();
  ensureRadio(state.radio);
  state.money = 50;
  startMission(state, 0);
  showBanner('M1 — Hot Wheels: steal a car!');
  mode = 'game';
  refreshMenu();
}

function startContinued(save) {
  reset();
  audio.ensure();
  ensureRadio(state.radio);
  applySave(state, save);
  mode = 'game';
  refreshMenu();
}

function showBanner(text) {
  banner = text;
  bannerTimer = 4;
}

// The bag passed to the renderer as its third (`camera`) argument:
// the camera centre (x/y) first — that is what the renderer reads
// as the camera — plus mode, the top-left view origin, the banner
// line and the current station name.
function renderUi(view, bannerText) {
  return {
    ...state.camera,
    mode,
    view,
    banner: bannerText,
    radioName: radioName(state.radio),
  };
}

// ---- prompts --------------------------------------------------------

// What the E key would do right now, for the HUD prompt line. Boat
// lines come first: boarding and stepping ashore are the ones players
// miss.
export function computePrompt(s) {
  const p = s.player;
  if (p.inBoat) return 'Press E to step ashore';
  if (p.inCar) return 'Press E to exit the car';
  if (nearestBoat(s, p.x, p.y)) return 'Press E to board the boat';
  if (nearestStealableCar(s)) return 'Press E to steal the car';
  if (s.mission && s.crates) {
    for (const crate of s.crates) {
      if (crate.taken) continue;
      const dx = p.x - crate.x;
      const dy = p.y - crate.y;
      if (dx * dx + dy * dy < 60 * 60) return 'Press E to grab the crate';
    }
  }
  const obj = currentObjective(s);
  if (obj && obj.kind === 'interact' && obj.key === 'bank') {
    const bank = s.city.landmarks.bank;
    const dx = p.x - bank.x;
    const dy = p.y - bank.y;
    if (dx * dx + dy * dy < 90 * 90) return 'Press E to grab the vault';
  }
  return '';
}

// ---- sounds ---------------------------------------------------------

function playEvents(events) {
  if (events & EV.SHOT) audio.shot();
  if (events & EV.PUNCH) audio.punch();
  if (events & EV.PICKUP) audio.pickup('cash');
  if (events & EV.CRASH) audio.crash(0.6);
  if (events & EV.VAULT) audio.pickup('vault');
  if (events & EV.STEAL) audio.pickup('steal');
  if (events & EV.MISSION) audio.pickup('mission');
  if (events & EV.MISSION_COMPLETE) {
    audio.missionComplete();
    const done = state.missionsDone;
    if (state.storyComplete) {
      showBanner('Story complete — Solmar is yours, Mara!');
    } else if (done < MISSIONS.length) {
      const next = MISSIONS[done];
      showBanner('Mission complete! Next: ' + next.title + ' — $' + next.reward);
      startMission(state, done);
    }
  }
  if (events & EV.DIED) {
    audio.busted();
    mode = 'wasted';
  }
  if (events & EV.BUSTED) {
    audio.busted();
    mode = 'busted';
  }
}

// ---- HUD status line ------------------------------------------------

function updateStatus() {
  if (!statusEl) return;
  const obj = currentObjective(state);
  const marker = missionMarker(state);
  let line = formatMoney(state.money) + '  •  ';
  line += 'HP ' + Math.max(0, Math.round(state.player.hp)) + '  •  ';
  line += 'Ammo ' + Math.round(state.player.ammo) + '  •  ';
  line += '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted) + '  •  ';
  line += 'Grand Prix ' + formatCountdown(state.grandPrix.startsIn);
  if (obj) {
    line += '  •  ' + obj.text;
    if (marker) {
      const d = Math.hypot(state.player.x - marker.x, state.player.y - marker.y);
      line += ' (' + Math.round(d) + 'm)';
    }
  }
  if (state.storyComplete) line += '  •  STORY COMPLETE';
  const prompt = computePrompt(state);
  if (prompt) line += '  •  ' + prompt;
  statusEl.textContent = line;
  state.prompt = prompt;
}

// ---- frame loop -----------------------------------------------------

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, Math.max(0.001, (now - lastNow) / 1000 || 0.016));
  lastNow = now;

  const view = {
    x: state.camera.x - canvas.width / 2,
    y: state.camera.y - canvas.height / 2,
    scale: 1,
  };

  if (mode === 'title') {
    if (draw) draw(ctx, state, renderUi(view, ''));
    return;
  }

  const frameInput = input.frameInput(view);
  const actions = frameInput.actions;

  if (actions & ACTION_MUTE) {
    const muted = !audio.isMuted();
    audio.setMuted(muted);
    setRadioMuted(state.radio, muted);
  }
  if (actions & ACTION_RADIO) {
    ensureRadio(state.radio);
    cycleRadio(state.radio);
    showBanner('Radio: ' + radioName(state.radio));
  }
  if (actions & ACTION_PAUSE) {
    if (mode === 'game') {
      mode = 'paused';
      saveGame(state);
    } else if (mode === 'paused') {
      mode = 'game';
    }
  }

  if (mode === 'paused') {
    if (draw) draw(ctx, state, renderUi(view, 'Paused — press P to resume'));
    return;
  }

  if (mode === 'wasted' || mode === 'busted') {
    const label = mode === 'wasted'
      ? 'WASTED — press Enter to wake up at the Safehouse'
      : 'BUSTED — press Enter to wake up at the Safehouse';
    if (draw) draw(ctx, state, renderUi(view, label));
    if (actions & ACTION_CONFIRM) {
      respawnPlayer(state, mode);
      mode = 'game';
    }
    return;
  }

  // Playing.
  const events = step(frameInput, dt);
  playEvents(events);
  tickRadio(state.radio);
  audio.engine(state.player.inCar ? Math.abs(state.player.car.speed) / 560 : 0);
  audio.siren(state.wanted > 0);
  if (bannerTimer > 0) bannerTimer -= dt;
  saveTimer += dt;
  if (saveTimer > 10) {
    saveTimer = 0;
    saveGame(state);
  }
  if (draw) {
    draw(ctx, state, renderUi(view, bannerTimer > 0 ? banner : ''));
  }
  updateStatus();
}

// ---- boot -----------------------------------------------------------

input.attach();
audio.ensure();
if (shotParam && Shots.stageShot) {
  // Screenshot mode: stage the scene (harbor, chase, ...) then play.
  Shots.stageShot(state, shotParam);
  mode = 'game';
  refreshMenu();
} else {
  refreshMenu();
  const save = loadSave();
  if (save) contBtn.style.display = '';
}
requestAnimationFrame((now) => {
  lastNow = now;
  requestAnimationFrame(frame);
});
