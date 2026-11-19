// main.js — Solmar City entry point: game loop, screens, input wiring.
// Written from the v2 spec only. Frame input is a plain VALUES object:
// { mx, my, aimX, aimY, actions, shooting, running, steer, throttle,
// handbrake }. Q cycles the radio, Space is handbrake while driving.
import { createWorld, applySave, EV } from './world.js';
import { renderGame, drawTitle, titleButtons } from './render.js';
import {
  createInput,
  ACTION_CONFIRM, ACTION_PAUSE, ACTION_INTERACT,
  ACTION_PUNCH, ACTION_MUTE, ACTION_RADIO,
} from './input.js';
import { createAudio } from './audio.js';
import { saveGame, loadSave, saveInfoText } from './save.js';
import {
  cycleRadio, ensureRadio, tickRadio, setRadioMuted, radioName,
} from './radio.js';
import { stageShot } from './shots.js';
import { currentObjective, startMission } from './missions.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width || 1280;
const H = canvas.height || 800;

const params = new URLSearchParams(window.location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const shotName = params.get('shot');

const world = createWorld(seed);
const state = world.state;
const audio = createAudio();
const input = createInput(canvas);

let mode = 'title';
let paused = false;
let muted = false;
let banner = '';
let bannerUntil = 0;
let camX = state.player.x;
let camY = state.player.y;
let last = performance.now();
let saveTimer = 0;
let statusText = 'Solmar City. Press Enter or click New Game to play.';

const statusEl = document.getElementById('status');
function setStatus(t) {
  statusText = t;
  if (statusEl) statusEl.textContent = t;
}

function showBanner(text, seconds) {
  banner = text;
  bannerUntil = performance.now() + (seconds || 3) * 1000;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// The one-line hint at the bottom: what E does right now, or the mission.
export function computePrompt(state) {
  const p = state.player;
  if (p.inBoat) return 'E — Turun ke pantai   •   Q — Ganti radio';
  if (p.inCar) return 'E — Keluar mobil   •   Spasi — Rem tangan';
  for (const c of state.crates || []) {
    if (!c.taken && dist(p.x, p.y, c.x, c.y) < 48) return 'E — Ambil peti';
  }
  const obj = currentObjective(state);
  if (obj && obj.kind === 'interact') {
    const bank = state.city.landmarks.bank;
    if (bank && dist(p.x, p.y, bank.x, bank.y) < 110) return 'E — Bobol brankas';
  }
  for (const b of state.boats || []) {
    if (dist(p.x, p.y, b.x, b.y) < 70) return 'E — Naik perahu';
  }
  for (const car of (state.traffic && state.traffic.cars) || []) {
    if (dist(p.x, p.y, car.x, car.y) < 64) return 'E — Curi mobil';
  }
  if (obj) return obj.text;
  return '';
}

function startGame(fromSave) {
  audio.ensure();
  if (fromSave) {
    const save = loadSave();
    if (save) {
      applySave(state, save);
      setStatus('Lanjutan dimuat: ' + saveInfoText(save));
    }
  }
  mode = 'game';
  camX = state.player.x;
  camY = state.player.y;
  setStatus('Selamat datang di Solmar City, Mara.');
}

function buildFrameInput(edges) {
  const { mx, my } = input.axes();
  const p = state.player;
  let actions = 0;
  if (edges.includes('Enter')) actions |= ACTION_CONFIRM;
  if (edges.includes('KeyP') || edges.includes('Escape')) actions |= ACTION_PAUSE;
  if (edges.includes('KeyE')) actions |= ACTION_INTERACT;
  if (edges.includes('KeyM')) actions |= ACTION_MUTE;
  if (edges.includes('KeyQ')) actions |= ACTION_RADIO;
  // Space punches on foot; while driving it is the handbrake instead.
  if (edges.includes('Space') && !p.inCar && !p.inBoat) actions |= ACTION_PUNCH;
  const driving = p.inCar || p.inBoat;
  return {
    mx,
    my,
    aimX: camX + (input.mouse.x - W / 2),
    aimY: camY + (input.mouse.y - H / 2),
    actions,
    shooting: input.shooting(),
    running: input.running(),
    steer: driving ? mx : 0,
    throttle: driving ? -my : 0,
    handbrake: driving && input.handbrake(),
  };
}

function handleEvents(ev) {
  if (!ev) return;
  if (ev & EV.SHOT) audio.shot();
  if (ev & EV.PUNCH) audio.punch();
  if (ev & EV.PICKUP) audio.pickup('cash');
  if (ev & EV.CRASH) audio.crash(0.5);
  if (ev & EV.VAULT) {
    audio.pickup('vault');
    showBanner('Brankas dibobol! Kabur!', 3);
  }
  if (ev & EV.STEAL) {
    audio.pickup('steal');
    setStatus('Mobil dicuri — polisi mengejarmu!');
  }
  if (ev & EV.MISSION) {
    audio.click();
    const obj = currentObjective(state);
    if (obj) setStatus(obj.text);
  }
  if (ev & EV.MISSION_COMPLETE) {
    audio.missionComplete();
    if (state.storyComplete) {
      showBanner('SOLMAR CITY TAMAT — Kamu Raja Solmar!', 6);
      setStatus('Cerita tamat! Total hadiah misi $34.600.');
    } else {
      // Start the next mission now that the last one is done.
      startMission(state, state.missionIndex);
      const m = state.mission;
      showBanner(`Misi selesai! ${m ? 'Lanjut: ' + m.title : ''}`, 3);
      setStatus(m ? `Misi baru: ${m.title} — $${m.reward.toLocaleString('en-US')}` : 'Misi selesai!');
    }
    saveGame(state);
  }
  if (ev & EV.DIED) {
    audio.busted();
    showBanner('WASTED — Bangun di Safehouse', 3);
  }
  if (ev & EV.BUSTED) {
    audio.busted();
    showBanner('BUSTED — Dibangunkan di Safehouse', 3);
  }
}

function updateCamera(dt) {
  const p = state.player;
  const speed = p.inCar && p.car
    ? Math.abs(p.car.speed || 0)
    : p.inBoat && p.boat ? Math.abs(p.boat.speed || 0) : 0;
  const look = Math.min(90, speed * 0.12);
  const tx = p.x + Math.cos(p.angle) * look;
  const ty = p.y + Math.sin(p.angle) * look;
  const k = Math.min(1, dt * 5);
  camX += (tx - camX) * k;
  camY += (ty - camY) * k;
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  const edges = input.takeEdges();

  if (edges.includes('KeyM')) {
    muted = !muted;
    audio.setMuted(muted);
    setRadioMuted(state.radio, muted);
  }

  if (mode === 'title') {
    const save = loadSave();
    if (edges.includes('Enter')) {
      startGame(false);
    } else if (input.mouse.clicked) {
      const btns = titleButtons(W, H);
      const { clickX, clickY } = input.mouse;
      const inside = (r) => clickX >= r.x && clickX <= r.x + r.w
        && clickY >= r.y && clickY <= r.y + r.h;
      if (inside(btns.newGame)) startGame(false);
      else if (save && inside(btns.continueGame)) startGame(true);
      input.clearClick();
    }
    drawTitle(ctx, W, H, save ? saveInfoText(save) : '', !!save);
    return;
  }

  if (edges.includes('KeyP') || edges.includes('Escape')) {
    paused = !paused;
    if (paused) saveGame(state);
  }
  if (paused) {
    renderGame(ctx, state, {
      camX, camY, scale: 1, w: W, h: H,
      prompt: '', banner: '', paused: true,
    });
    return;
  }

  if (edges.includes('KeyQ')) {
    ensureRadio(state.radio);
    cycleRadio(state.radio);
    showBanner('♪ ' + radioName(state.radio), 2);
  }
  tickRadio(state.radio);

  const frameInput = buildFrameInput(edges);
  const ev = world.step(frameInput, dt);
  handleEvents(ev);
  updateCamera(dt);

  // Engine hum + sirens follow the live state.
  const p = state.player;
  if (p.inCar && p.car) audio.engine(Math.min(1, Math.abs(p.car.speed || 0) / 560));
  else if (p.inBoat && p.boat) audio.engine(Math.min(1, Math.abs(p.boat.speed || 0) / 560));
  else audio.engine(0);
  audio.siren((state.wanted || 0) > 0);

  if (performance.now() > bannerUntil) banner = '';
  saveTimer += dt;
  if (saveTimer > 10) {
    saveTimer = 0;
    saveGame(state);
  }

  renderGame(ctx, state, {
    camX, camY, scale: 1, w: W, h: H,
    prompt: computePrompt(state),
    banner,
    paused: false,
  });
}

// Screenshot mode: jump straight into a staged scene. 'start' stays on
// the title screen (SOLMAR CITY + New Game / Continue); other shots go
// straight into the game.
if (shotName) {
  audio.ensure();
  stageShot(state, shotName);
  if (shotName !== 'start') mode = 'game';
  camX = state.player.x;
  camY = state.player.y;
  setStatus('Shot: ' + shotName);
}

setStatus(statusText);
requestAnimationFrame(frame);
