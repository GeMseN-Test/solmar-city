// input.js — keyboard + mouse, turned into one plain values object per
// frame for world.step. main.js builds that object with readInput(); the
// world never sees keys, only numbers.
//
// Keys: WASD / arrows move, mouse aims, click shoots, Enter confirms,
// P or Esc pauses, E interacts, Space punches (on foot) or handbrakes
// (while driving), M mutes, Q cycles the radio, Shift runs.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_RADIO = 32;

// Keys that scroll the page if we let them — swallowed while playing.
const SWALLOWED = new Set([
  'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    mouse: { x: 0, y: 0, down: false, clicked: false, clickX: 0, clickY: 0 },
    canvas: canvas || null,
  };

  function onKeyDown(e) {
    if (SWALLOWED.has(e.code)) e.preventDefault();
    if (!e.repeat) input.pressed.add(e.code);
    input.keys.add(e.code);
  }

  function onKeyUp(e) {
    input.keys.delete(e.code);
  }

  function onBlur() {
    input.keys.clear();
    input.mouse.down = false;
  }

  function mousePos(e) {
    if (!input.canvas) return { x: 0, y: 0 };
    const rect = input.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (input.canvas.width / rect.width),
      y: (e.clientY - rect.top) * (input.canvas.height / rect.height),
    };
  }

  function onMouseMove(e) {
    const pos = mousePos(e);
    input.mouse.x = pos.x;
    input.mouse.y = pos.y;
  }

  function onMouseDown(e) {
    const pos = mousePos(e);
    input.mouse.x = pos.x;
    input.mouse.y = pos.y;
    input.mouse.down = true;
    input.mouse.clicked = true;
    input.mouse.clickX = pos.x;
    input.mouse.clickY = pos.y;
  }

  function onMouseUp() {
    input.mouse.down = false;
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
  }
  if (canvas) {
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
  }

  input.detach = function detach() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    }
    if (canvas) {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
    }
  };
  return input;
}

// True while Space is held — the handbrake while driving.
export function handbrake(input) {
  return input.keys.has('Space');
}

function keyHeld(input, codes) {
  for (const code of codes) {
    if (input.keys.has(code)) return true;
  }
  return false;
}

function keyPressed(input, codes) {
  for (const code of codes) {
    if (input.pressed.has(code)) return true;
  }
  return false;
}

// Build the frame's input object. `camera` is state.camera (world coords
// of the screen center). Edge-triggered actions (E, Q, M, P, Enter, Space
// punch) are consumed here, so holding a key never double-fires.
export function readInput(input, camera) {
  const mx = (keyHeld(input, ['KeyD', 'ArrowRight']) ? 1 : 0)
    - (keyHeld(input, ['KeyA', 'ArrowLeft']) ? 1 : 0);
  const my = (keyHeld(input, ['KeyS', 'ArrowDown']) ? 1 : 0)
    - (keyHeld(input, ['KeyW', 'ArrowUp']) ? 1 : 0);

  let actions = 0;
  if (keyPressed(input, ['Enter'])) actions |= ACTION_CONFIRM;
  if (keyPressed(input, ['KeyP', 'Escape'])) actions |= ACTION_PAUSE;
  if (keyPressed(input, ['KeyE'])) actions |= ACTION_INTERACT;
  if (keyPressed(input, ['Space'])) actions |= ACTION_PUNCH;
  if (keyPressed(input, ['KeyM'])) actions |= ACTION_MUTE;
  if (keyPressed(input, ['KeyQ'])) actions |= ACTION_RADIO;

  const frame = {
    mx,
    my,
    aimX: (camera ? camera.x : 640) + input.mouse.x - 640,
    aimY: (camera ? camera.y : 400) + input.mouse.y - 400,
    actions,
    shooting: input.mouse.down,
    running: keyHeld(input, ['ShiftLeft', 'ShiftRight']),
    steer: mx,
    throttle: -my,
    handbrake: handbrake(input),
  };
  input.pressed.clear();
  return frame;
}
