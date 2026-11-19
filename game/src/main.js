// Solmar City — main.js: boot, game loop, menus, save/load.
//
// Flow: title screen (New Game / Continue) -> game loop -> pause (P).
// Every frame builds a plain VALUES input object for world.step — no
// functions inside it — and turns the returned event bits into sounds
// and banners. The radio ticks every frame; Q cycles stations.
//
// Screenshots: ?shot=start|city|chase|harbor&seed=1 stages a live scene
// through shots.js before the first frame.

import { createWorld, EV, saveSnapshot, applySave } from './world.js';
import { render, titleButtons } from './render.js';
import {
  createInput,
  ACTION_CONFIRM,
  ACTION_PAUSE,
  ACTION_INTERACT,
} from './input.js';
import { startMission, MISSIONS } from './missions.js';
import { stageShot } from './shots.js';
import * as RadioMod from './radio.js';
import * as SaveMod from './save.js';

const SAVE_KEY_FALLBACK = 'solmar-city-save-v1';

// --- save helpers (save.js owns localStorage; fall back to nothing) ---------
function doSave(state) {
  if (typeof SaveMod.saveGame === 'function') {
    try {
      return SaveMod.saveGame(state);
    } catch (e) {
      return false;
    }
  }
  return false;
}

function doLoad() {
  if (typeof SaveMod.loadSave === 'function') {
    try {
      return SaveMod.loadSave();
    } catch (e) {
      return null;
    }
  }
  return null;
}

function doSaveText(save) {
  if (typeof SaveMod.saveInfoText === 'function') {
    try {
      return SaveMod.saveInfoText(save) || '';
    } catch (e) {
      return '';
    }
  }
  return '';
}

// --- boot -------------------------------------------------------------------

function getCanvas() {
  if (typeof document === 'undefined') return null;
  return document.getElementById('game');
}

function getParams() {
  if (typeof window === 'undefined' || !window.location) return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function startLoop() {
  const canvas = getCanvas();
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const vw = canvas.width || 1280;
  const vh = canvas.height || 800;

  const params = getParams();
  const shotName = params.get('shot') || '';
  const seed = parseInt(params.get('seed') || '1', 10) || 1;

  const world = createWorld(seed);
  let state = world.state;
  const input = createInput(canvas);

  let mode = 'title';
  let banner = null;
  let overlay = null;
  let savedGame = doLoad();
  let muted = false;

  if (shotName) {
    stageShot(state, shotName);
    // 'start' stays on the title screen; the rest drop straight into play.
    mode = shotName === 'start' ? 'title' : 'game';
    if (mode === 'game') {
      // No mission auto-start for staged shots: the shot sets its own.
      if (state.audio && typeof state.audio.ensure === 'function') {
        try {
          state.audio.ensure();
        } catch (e) {
          /* audio needs a gesture; the shot still renders fine */
        }
      }
    }
  }

  // Expose the live world for debugging / headless playthroughs.
  if (typeof window !== 'undefined') {
    window.solmar = {
      get state() {
        return state;
      },
      world,
      get mode() {
        return mode;
      },
    };
  }

  function showBanner(text, sub, color, seconds) {
    banner = {
      text,
      sub: sub || '',
      color: color || '#f7c948',
      until: (state.playTime || 0) + (seconds || 3.5),
    };
  }

  function showOverlay(text, sub, color, seconds) {
    overlay = {
      text,
      sub: sub || '',
      color: color || '#e03131',
      until: (state.playTime || 0) + (seconds || 1.6),
    };
  }

  function newGame() {
    // Fresh world, same seed family: reset() re-rolls the world.
    world.reset();
    state = world.state;
    if (typeof SaveMod.clearSave === 'function') {
      try {
        SaveMod.clearSave();
      } catch (e) {
        /* ignore */
      }
    }
    savedGame = null;
    banner = null;
    overlay = null;
    mode = 'game';
    startMission(state, 0);
    showBanner('M1 Hot Wheels — $200', "Steal a car, then reach Ray's Garage", '#f7c948', 4);
    if (state.audio && typeof state.audio.ensure === 'function') {
      try {
        state.audio.ensure();
      } catch (e) {
        /* needs a gesture; fine */
      }
    }
    if (state.radio && typeof RadioMod.ensureRadio === 'function') {
      try {
        RadioMod.ensureRadio(state.radio);
      } catch (e) {
        /* needs a gesture; fine */
      }
    }
  }

  function continueGame() {
    if (!savedGame) return;
    applySave(state, savedGame);
    banner = null;
    overlay = null;
    mode = 'game';
    if (state.audio && typeof state.audio.ensure === 'function') {
      try {
        state.audio.ensure();
      } catch (e) {
        /* ignore */
      }
    }
  }

  function handleTitleClick(click) {
    if (!click) return false;
    const btns = titleButtons(vw, vh);
    const inside = (b) =>
      click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h;
    if (inside(btns.newGame)) {
      newGame();
      return true;
    }
    if (savedGame && inside(btns.cont)) {
      continueGame();
      return true;
    }
    return false;
  }

  function handleEvents(events) {
    const audio = state.audio;
    if (!audio) return;
    const safe = (fn, ...args) => {
      try {
        if (typeof fn === 'function') fn(...args);
      } catch (e) {
        /* a sound must never break the game */
      }
    };
    if (events & EV.SHOT) safe(audio.shot);
    if (events & EV.PUNCH) safe(audio.punch);
    if (events & EV.PICKUP) safe(audio.pickup, 'cash');
    if (events & EV.CRASH) safe(audio.crash, 0.5);
    if (events & EV.VAULT) safe(audio.pickup, 'cash');
    if (events & EV.STEAL) safe(audio.click);
    if (events & EV.MISSION) safe(audio.click);
    if (events & EV.DIED) {
      showOverlay('WASTED', 'You wake up at the Safehouse.', '#e03131', 1.8);
      doSave(state);
    }
    if (events & EV.BUSTED) {
      safe(audio.busted);
      showOverlay('BUSTED', 'The cops drop you at the Safehouse.', '#2f7fe0', 1.8);
      doSave(state);
    }
    if (events & EV.MISSION_COMPLETE) {
      safe(audio.missionComplete);
      const doneIndex = state.missionIndex - 1;
      const def = MISSIONS[doneIndex];
      if (state.storyComplete) {
        showBanner(
          'STORY COMPLETE — You are the King of Solmar!',
          'All 12 missions done. Total payout $34,600.',
          '#ffd43b',
          6,
        );
      } else if (def) {
        showBanner(
          'MISSION COMPLETE — ' + def.id + ' ' + def.title + '  +$' + def.reward.toLocaleString('en-US'),
          '',
          '#37b24d',
          3.5,
        );
      }
      doSave(state);
      // The next mission starts right away — no extra click needed.
      if (!state.storyComplete && state.missionIndex < MISSIONS.length) {
        startMission(state, state.missionIndex);
        const next = MISSIONS[state.missionIndex];
        if (next) {
          showBanner(
            next.id + ' ' + next.title + ' — $' + next.reward.toLocaleString('en-US'),
            next.briefing,
            '#f7c948',
            4,
          );
        }
      }
    }
  }

  // --- the frame loop -------------------------------------------------------

  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const t = now || 0;
    let dt = last ? (t - last) / 1000 : 1 / 60;
    last = t;
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) dt = 1 / 60;

    const actions = input.takeActions();
    const click = input.consumeClick();

    if (mode === 'title') {
      if (click) handleTitleClick(click);
      if (actions & ACTION_CONFIRM) {
        if (savedGame) continueGame();
        else newGame();
      }
      render(state, ctx, {
        mode: 'title',
        hasSave: !!savedGame,
        saveText: doSaveText(savedGame),
        muted,
      });
      return;
    }

    if (actions & ACTION_PAUSE) {
      if (mode === 'game') {
        mode = 'paused';
        doSave(state);
      } else if (mode === 'paused') {
        mode = 'game';
      }
    }

    if (mode === 'paused') {
      render(state, ctx, { mode: 'paused', banner, overlay, muted });
      return;
    }

    // Build the plain VALUES frame input for world.step.
    const mv = input.moveVector();
    const drv = input.driveControls();
    const aim = input.aimWorld(state.camera, vw, vh);
    const frameInput = {
      mx: mv.mx,
      my: mv.my,
      aimX: aim.x,
      aimY: aim.y,
      actions,
      shooting: !!input.mouse.down,
      running: input.running(),
      steer: drv.steer,
      throttle: drv.throttle,
      handbrake: input.handbrake(),
    };

    const events = world.step(frameInput, dt);
    handleEvents(events);

    // Radio keeps playing (no-op until its AudioContext exists).
    if (state.radio && typeof RadioMod.tickRadio === 'function') {
      try {
        RadioMod.tickRadio(state.radio);
      } catch (e) {
        /* ignore */
      }
    }

    // Mute state for the HUD (world toggles it on the M key).
    if (state.audio && typeof state.audio.isMuted === 'function') {
      try {
        muted = !!state.audio.isMuted();
      } catch (e) {
        /* ignore */
      }
    }

    // Clear stale banners / overlays.
    if (banner && banner.until <= (state.playTime || 0)) banner = null;
    if (overlay && overlay.until <= (state.playTime || 0)) overlay = null;

    render(state, ctx, { mode: 'game', banner, overlay, muted });
  }

  requestAnimationFrame(frame);
  return { world, state, input };
}

// Boot as soon as the page is ready. The script tag is a module at the
// end of <body>, so the canvas already exists.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startLoop);
  } else {
    startLoop();
  }
}

export { startLoop, SAVE_KEY_FALLBACK };
export { saveSnapshot, applySave };
