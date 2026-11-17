// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens:
// title, how-to, play, paused and game over.
//
// ?seed=N fixes the city's layout. ?shot=start|city|chase|mission (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.

import {
  STEP,
  createWorld,
  respawnPlayer,
  applySave,
  EVENT_BUSTED,
  EVENT_CRASH,
  EVENT_DIED,
  EVENT_ENEMY_SHOT,
  EVENT_MISSION,
  EVENT_MISSION_COMPLETE,
  EVENT_PICKUP,
  EVENT_PUNCH,
  EVENT_SHOT,
  EVENT_STEAL,
  EVENT_VAULT,
} from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_INTERACT,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_PUNCH,
  createInput,
} from './input.js';
import {
  createRenderer,
  SCREEN_HOWTO,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
} from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { loadSave, saveGame, saveInfoText } from './save.js';
import { currentObjective, nearestStealableCar } from './missions.js';
import { distanceBetween } from './util.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
let world = createWorld(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

function runShot(name) {
  const scene = stageShot(name, world);
  const extras = {
    screen: scene.screen, prompt: '', muted: false,
    saveExists: false, saveInfo: '', overReason: '',
  };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, extras);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = loadSave();
  let muted = false;
  let overReason = '';
  let buttons = [];
  let shootLockUntil = 0;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the changes.
  function announce(message) {
    status.textContent = message;
  }

  function refreshSave() {
    save = loadSave();
  }

  function startNewGame() {
    world = createWorld(Math.floor(Math.random() * 4294967296));
    screen = SCREEN_PLAY;
    audio.ensure();
    shootLockUntil = performance.now() + 300;
    announce('Playing Solmar City. Steal a car and drive to Ray\'s Garage.');
  }

  function continueGame() {
    const loaded = loadSave();
    if (!loaded) return;
    world = createWorld(loaded.seed ?? Math.floor(Math.random() * 4294967296));
    applySave(world.state, loaded);
    screen = SCREEN_PLAY;
    audio.ensure();
    shootLockUntil = performance.now() + 300;
    announce(`Welcome back. ${loaded.missionsDone ?? 0} missions done, $${loaded.money ?? 0} in pocket.`);
  }

  function backToTitle() {
    saveGame(world.state);
    refreshSave();
    screen = SCREEN_TITLE;
    announce('Solmar City. Press Enter or click New Game to play.');
  }

  function respawn() {
    respawnPlayer(world.state, overReason);
    saveGame(world.state);
    refreshSave();
    screen = SCREEN_PLAY;
    shootLockUntil = performance.now() + 300;
    announce('Back on your feet at the Safehouse.');
  }

  function handleButton(id) {
    audio.ensure();
    audio.click();
    if (id === 'new') startNewGame();
    else if (id === 'continue') continueGame();
    else if (id === 'howto') screen = SCREEN_HOWTO;
    else if (id === 'back') screen = SCREEN_TITLE;
    else if (id === 'resume') {
      screen = SCREEN_PLAY;
      shootLockUntil = performance.now() + 300;
    }
    else if (id === 'restart') continueGame();
    else if (id === 'quit') backToTitle();
    else if (id === 'respawn') respawn();
  }

  function handleClick(click) {
    for (const button of buttons) {
      if (click.x >= button.x && click.x <= button.x + button.w && click.y >= button.y && click.y <= button.y + button.h) {
        handleButton(button.id);
        return true;
      }
    }
    return false;
  }

  function computePrompt(state) {
    const player = state.player;
    if (player.inCar) return 'E — Step out of the car';
    const objective = currentObjective(state);
    if (objective && objective.kind === 'interact') {
      const spot = state.city.landmarks[objective.key];
      if (distanceBetween(player.x, player.y, spot.x, spot.y) < spot.r + 20) return 'E — Grab the vault cash';
    }
    if (objective && objective.kind === 'collect') {
      for (const crate of state.crates) {
        if (!crate.taken && distanceBetween(player.x, player.y, crate.x, crate.y) < 48) return 'E — Pick up the crate';
      }
    }
    if (nearestStealableCar(state)) return 'E — Steal the car';
    return '';
  }

  function playEventSounds(events) {
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_PICKUP) audio.pickup('cash');
    if (events & EVENT_CRASH) audio.crash(0.6);
    if (events & EVENT_ENEMY_SHOT) audio.enemyShot();
    if (events & EVENT_STEAL) audio.click();
    if (events & EVENT_VAULT) audio.missionComplete();
    if (events & EVENT_MISSION) audio.pickup('ammo');
    if (events & EVENT_MISSION_COMPLETE) {
      audio.missionComplete();
      saveGame(world.state);
      refreshSave();
    }
  }

  function buildWorldInput(actions) {
    const state = world.state;
    const aim = renderer.screenToWorld(input.mouse.x, input.mouse.y, state);
    const move = input.moveVector();
    return {
      mx: move.x,
      my: move.y,
      steer: input.steer(),
      throttle: input.throttle(),
      running: input.running(),
      aimX: aim.x,
      aimY: aim.y,
      shooting: input.mouse.down && performance.now() > shootLockUntil,
      actions,
    };
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      muted = !muted;
      audio.setMuted(muted);
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) screen = SCREEN_PLAY;
    } else if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        if (save) continueGame();
        else startNewGame();
      }
    } else if (screen === SCREEN_HOWTO) {
      if (actions & (ACTION_CONFIRM | ACTION_PAUSE)) screen = SCREEN_TITLE;
    } else if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) respawn();
    }
  }

  function stepFrame() {
    const actions = input.takeActions();
    const click = input.takeClick();
    if (click) handleClick(click);
    if (click && (screen === SCREEN_TITLE || screen === SCREEN_PAUSED || screen === SCREEN_OVER || screen === SCREEN_HOWTO)) {
      audio.ensure();
    }
    handleActions(actions);
    audio.ensure();
    if (screen === SCREEN_TITLE || screen === SCREEN_HOWTO) {
      // Attract mode: the city idles behind the menu.
      world.step(
        { mx: 0, my: 0, steer: 0, throttle: 0, running: false, aimX: 0, aimY: 0, shooting: false, actions: 0 },
        STEP,
      );
    } else if (screen === SCREEN_PLAY) {
      const events = world.step(buildWorldInput(actions), STEP);
      playEventSounds(events);
      if (events & EVENT_DIED) {
        overReason = 'wasted';
        screen = SCREEN_OVER;
        audio.busted();
        announce('Wasted. Back to the Safehouse.');
      } else if (events & EVENT_BUSTED) {
        overReason = 'busted';
        screen = SCREEN_OVER;
        audio.busted();
        announce('Busted. Back to the Safehouse.');
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // First gesture wakes the audio; after that the engine and the groove run.
    if (screen === SCREEN_PLAY) {
      audio.stepMusic();
      const state = world.state;
      audio.engine(state.player.inCar && state.player.car ? Math.abs(state.player.car.speed) / 560 : 0);
      audio.siren(state.wanted > 0);
    }
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_HOWTO || screen === SCREEN_PLAY)) {
      stepFrame();
      accumulator -= STEP;
    }
    if (screen === SCREEN_PAUSED || screen === SCREEN_OVER) {
      // Menus still take clicks and keys, but the world holds still.
      const actions = input.takeActions();
      const click = input.takeClick();
      if (click) handleClick(click);
      handleActions(actions);
      accumulator = 0;
    }
    const extras = {
      screen,
      prompt: screen === SCREEN_PLAY ? computePrompt(world.state) : '',
      muted,
      saveExists: !!save,
      saveInfo: save ? saveInfoText(save) : '',
      overReason,
    };
    const result = renderer.draw(world.state, screen, extras);
    buttons = result.buttons;
  }

  // Leaving the tab pauses a running game rather than letting the cops catch up unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  window.addEventListener('pointerdown', () => audio.ensure(), { once: false });
  window.addEventListener('keydown', () => audio.ensure(), { once: false });

  // A hook for playtesting from the console and from scripts.
  window.__solmar = {
    get state() {
      return world.state;
    },
    get screen() {
      return screen;
    },
    newGame: startNewGame,
    continueGame,
    respawn,
  };

  announce('Solmar City. Press Enter or click New Game to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
