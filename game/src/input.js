// Solmar City — keyboard + mouse input.
// Written from v2-spec.md only. Keys: Enter confirm, P/Esc pause,
// E interact, Space punch (on foot) / handbrake (while driving),
// M mute, Q radio. Mouse: position, held, and click point in canvas
// pixels. createInput() wires the listeners and returns the live
// input object main.js reads every frame.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_RADIO = 32;

const ACTION_KEYS = {
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
    actions: 0,
    // Space held while driving = handbrake. On foot the same key
    // punches (main.js only asks when it matters).
    handbrake() {
      return this.keys.has('Space');
    },
  };

  function onKeyDown(e) {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.repeat) return;
    input.keys.add(e.code);
    const bit = ACTION_KEYS[e.code];
    if (bit) input.actions |= bit;
  }

  function onKeyUp(e) {
    input.keys.delete(e.code);
  }

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    input.mouse.x = e.clientX - rect.left;
    input.mouse.y = e.clientY - rect.top;
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

  return input;
}

// Read + clear the one-shot action bits for this frame.
export function consumeActions(input) {
  const a = input.actions;
  input.actions = 0;
  return a;
}

// Space held while driving = handbrake (standalone form).
export function handbrake(input) {
  return !!input.keys && input.keys.has('Space');
}

// WASD / arrow movement vector, normalized, in screen space
// (y down). main.js turns it into world movement.
export function moveVector(input) {
  const k = input.keys;
  let x = 0;
  let y = 0;
  if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
  if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
  if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
  if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
  const len = Math.hypot(x, y);
  if (len > 0) { x /= len; y /= len; }
  return { x, y };
}

// Driving pedals from the same keys: W/S throttle, A/D steering.
export function driveVector(input) {
  const k = input.keys;
  let throttle = 0;
  let steer = 0;
  if (k.has('KeyW') || k.has('ArrowUp')) throttle += 1;
  if (k.has('KeyS') || k.has('ArrowDown')) throttle -= 1;
  if (k.has('KeyA') || k.has('ArrowLeft')) steer -= 1;
  if (k.has('KeyD') || k.has('ArrowRight')) steer += 1;
  return { throttle, steer };
}
