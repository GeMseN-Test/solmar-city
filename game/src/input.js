// input.js — Keyboard + mouse input for Solmar City.
//
// createInput() attaches listeners (to window, and to the canvas for
// the mouse) and returns a small state object main.js polls each
// frame. Keys are tracked as a live set; edge-triggered actions are
// consumed once per frame via takeActions().
//
// Action bitmask (shared with world.step):
//   CONFIRM  1  — Enter
//   PAUSE    2  — P or Escape
//   INTERACT 4  — E
//   PUNCH    8  — Space (on foot)
//   MUTE    16  — M
//   RADIO   32  — Q
//
// Mouse state: { x, y, down, clicked, clickX, clickY } in canvas
// pixels. `clicked` is an edge flag main.js consumes once per frame.
//
// Handbrake: Space HELD while driving (handbrake() reads the live
// key set — no edge involved). On foot the same key punches.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_RADIO = 32;

const KEY_ACTIONS = {
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
    keys: new Set(),
    mouse: { x: 0, y: 0, down: false, clicked: false, clickX: 0, clickY: 0 },
    _queued: 0,
    _attached: false,

    isDown(code) {
      return this.keys.has(code);
    },

    // Space held while driving = handbrake.
    handbrake() {
      return this.keys.has('Space');
    },

    running() {
      return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    },

    // Move vector from WASD / arrows, normalized-ish (-1..1 each).
    moveVector() {
      let mx = 0;
      let my = 0;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) my -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) my += 1;
      return { mx, my };
    },

    // Driving: A/D steer, W/S throttle (-1..1).
    driveVector() {
      let steer = 0;
      let throttle = 0;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) steer -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) steer += 1;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) throttle += 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) throttle -= 1;
      return { steer, throttle };
    },

    // Consume the edge-triggered action bits queued since last frame.
    takeActions() {
      const a = this._queued;
      this._queued = 0;
      return a;
    },

    takeClick() {
      const c = this.mouse.clicked;
      this.mouse.clicked = false;
      return c;
    },

    attach() {
      if (this._attached) return;
      this._attached = true;
      const self = this;
      this._onKeyDown = (e) => {
        if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
        if (!e.repeat) {
          const bit = KEY_ACTIONS[e.code];
          if (bit) self._queued |= bit;
        }
        self.keys.add(e.code);
      };
      this._onKeyUp = (e) => {
        self.keys.delete(e.code);
      };
      this._onBlur = () => {
        self.keys.clear();
        self.mouse.down = false;
      };
      this._onMouseMove = (e) => {
        const r = canvas.getBoundingClientRect();
        self.mouse.x = e.clientX - r.left;
        self.mouse.y = e.clientY - r.top;
      };
      this._onMouseDown = (e) => {
        const r = canvas.getBoundingClientRect();
        self.mouse.x = e.clientX - r.left;
        self.mouse.y = e.clientY - r.top;
        self.mouse.down = true;
        self.mouse.clicked = true;
        self.mouse.clickX = self.mouse.x;
        self.mouse.clickY = self.mouse.y;
      };
      this._onMouseUp = () => {
        self.mouse.down = false;
      };
      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('keyup', this._onKeyUp);
      window.addEventListener('blur', this._onBlur);
      canvas.addEventListener('mousemove', this._onMouseMove);
      canvas.addEventListener('mousedown', this._onMouseDown);
      window.addEventListener('mouseup', this._onMouseUp);
    },

    detach() {
      if (!this._attached) return;
      this._attached = false;
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('keyup', this._onKeyUp);
      window.removeEventListener('blur', this._onBlur);
      canvas.removeEventListener('mousemove', this._onMouseMove);
      canvas.removeEventListener('mousedown', this._onMouseDown);
      window.removeEventListener('mouseup', this._onMouseUp);
    },
  };

  input.attach();
  return input;
}
