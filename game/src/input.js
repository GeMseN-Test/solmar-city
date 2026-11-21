// input.js — Solmar City keyboard + mouse input.
// Written from the v2 spec only.
// Keys: Enter confirm, P/Esc pause, E interact, Space punch/handbrake,
// M mute, Q radio. Mouse: { x, y, down, clicked, clickX, clickY }.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_RADIO = 32;

export const ACTION = {
  CONFIRM: ACTION_CONFIRM,
  PAUSE: ACTION_PAUSE,
  INTERACT: ACTION_INTERACT,
  PUNCH: ACTION_PUNCH,
  MUTE: ACTION_MUTE,
  RADIO: ACTION_RADIO,
};

const KEY_TO_ACTION = {
  Enter: ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyE: ACTION_INTERACT,
  Space: ACTION_PUNCH,
  KeyM: ACTION_MUTE,
  KeyQ: ACTION_RADIO,
};

export function createInput(canvas) {
  const input = {
    keys: {},
    mouse: { x: 0, y: 0, down: false, clicked: false, clickX: 0, clickY: 0 },
    _pressed: 0, // edge-triggered action bits waiting to be consumed
    _held: {}, // currently held action bits (for held keys)

    // Edge-triggered actions pressed since the last call. Consumes them.
    actions() {
      const a = this._pressed;
      this._pressed = 0;
      return a;
    },

    // Space held while driving = handbrake.
    handbrake() {
      return !!this.keys.Space;
    },

    // Held movement keys: WASD + arrows.
    moveVector() {
      let mx = 0;
      let my = 0;
      if (this.keys.KeyA || this.keys.ArrowLeft) mx -= 1;
      if (this.keys.KeyD || this.keys.ArrowRight) mx += 1;
      if (this.keys.KeyW || this.keys.ArrowUp) my -= 1;
      if (this.keys.KeyS || this.keys.ArrowDown) my += 1;
      return { mx, my };
    },

    // Steering / throttle while driving: A/D steer, W/S throttle.
    driveVector() {
      let steer = 0;
      let throttle = 0;
      if (this.keys.KeyA || this.keys.ArrowLeft) steer -= 1;
      if (this.keys.KeyD || this.keys.ArrowRight) steer += 1;
      if (this.keys.KeyW || this.keys.ArrowUp) throttle += 1;
      if (this.keys.KeyS || this.keys.ArrowDown) throttle -= 1;
      return { steer, throttle };
    },

    get shooting() {
      return this.mouse.down;
    },
    get running() {
      return !!(this.keys.ShiftLeft || this.keys.ShiftRight);
    },
  };

  function onKeyDown(e) {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) {
      const bit = KEY_TO_ACTION[e.code];
      if (bit) input._pressed |= bit;
    }
    input.keys[e.code] = true;
  }
  function onKeyUp(e) {
    input.keys[e.code] = false;
  }
  function onMouseMove(e) {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = e.clientX - r.left;
    input.mouse.y = e.clientY - r.top;
  }
  function onMouseDown(e) {
    onMouseMove(e);
    input.mouse.down = true;
    input.mouse.clicked = true;
    input.mouse.clickX = input.mouse.x;
    input.mouse.clickY = input.mouse.y;
  }
  function onMouseUp() {
    input.mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  input.destroy = () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
  };
  return input;
}
