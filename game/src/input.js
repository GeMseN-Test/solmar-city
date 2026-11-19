// Solmar City — input.js: keyboard + mouse.
//
// Keys: Enter confirm, P/Esc pause, E interact, Space punch (on foot) /
// handbrake (while driving, held), M mute, Q radio. Mouse: aim + shoot.
//
// Actions are EDGE-triggered: takeActions() returns the bits pressed
// since the last frame and clears them, so one key press is one action.
// Held state (handbrake, running, driving) is read separately every frame.

// Action bits — these numbers are the contract with world.js.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_RADIO = 32;

const PREVENT_DEFAULT = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

export function createInput(canvas) {
  const keys = new Set();
  let pending = 0;
  const mouse = { x: 0, y: 0, down: false, clicked: false, clickX: 0, clickY: 0 };
  let attached = false;

  function onKeyDown(e) {
    if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Enter') pending |= ACTION_CONFIRM;
    else if (e.code === 'KeyP' || e.code === 'Escape') pending |= ACTION_PAUSE;
    else if (e.code === 'KeyE') pending |= ACTION_INTERACT;
    else if (e.code === 'Space') pending |= ACTION_PUNCH;
    else if (e.code === 'KeyM') pending |= ACTION_MUTE;
    else if (e.code === 'KeyQ') pending |= ACTION_RADIO;
  }

  function onKeyUp(e) {
    keys.delete(e.code);
  }

  function onBlur() {
    keys.clear();
    mouse.down = false;
  }

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  }

  function onMouseDown(e) {
    onMouseMove(e);
    mouse.down = true;
    mouse.clicked = true;
    mouse.clickX = mouse.x;
    mouse.clickY = mouse.y;
  }

  function onMouseUp() {
    mouse.down = false;
  }

  function attach() {
    if (attached || typeof window === 'undefined' || !canvas || !canvas.addEventListener) return;
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    attached = true;
  }

  function destroy() {
    if (!attached || typeof window === 'undefined') return;
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    if (canvas) {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
    }
    window.removeEventListener('mouseup', onMouseUp);
    attached = false;
  }

  attach();

  return {
    keys,
    mouse,

    // Edge-triggered action bits pressed since the last call.
    takeActions() {
      const a = pending;
      pending = 0;
      return a;
    },

    // WASD / arrows as a -1..1 move vector (on foot).
    moveVector() {
      let mx = 0;
      let my = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
      return { mx, my };
    },

    // Driving: steer -1..1, throttle -1..1 (W = gas, S = brake/reverse).
    driveControls() {
      let steer = 0;
      let throttle = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) steer -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) steer += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) throttle += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) throttle -= 1;
      return { steer, throttle };
    },

    // Shift held = run.
    running() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },

    // Space held while driving = handbrake.
    handbrake() {
      return keys.has('Space');
    },

    // Mouse position translated into world coordinates.
    aimWorld(camera, vw, vh) {
      return {
        x: mouse.x + camera.x - vw / 2,
        y: mouse.y + camera.y - vh / 2,
      };
    },

    // The last click (canvas coords), or null. Consumes it.
    consumeClick() {
      if (!mouse.clicked) return null;
      mouse.clicked = false;
      return { x: mouse.clickX, y: mouse.clickY };
    },

    destroy,
  };
}
