// Keyboard + mouse input. The game polls this once per frame and
// turns it into the plain VALUES object world.step expects — no
// functions cross into the world. Action keys (Enter, P, E, Space,
// M, Q) are edge-triggered: a press fires once, a hold does not repeat.
// Space is special: on foot it punches (edge), in a car it is the
// handbrake (held) — the world decides which by context.

export const ACTIONS = {
  CONFIRM: 1,
  PAUSE: 2,
  INTERACT: 4,
  PUNCH: 8,
  MUTE: 16,
  RADIO: 32,
};

const KEY_ACTIONS = {
  Enter: ACTIONS.CONFIRM,
  KeyP: ACTIONS.PAUSE,
  Escape: ACTIONS.PAUSE,
  KeyE: ACTIONS.INTERACT,
  Space: ACTIONS.PUNCH,
  KeyM: ACTIONS.MUTE,
  KeyQ: ACTIONS.RADIO,
};

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    mouse: { x: 0, y: 0, down: false, clicked: false, clickX: 0, clickY: 0 },
    canvas,
  };

  function onKeyDown(e) {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) {
      input.keys.add(e.code);
      if (KEY_ACTIONS[e.code]) input.pressed.add(e.code);
    }
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

  function onBlur() {
    input.keys.clear();
    input.mouse.down = false;
  }

  canvas.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.tabIndex = 0;

  input.detach = function detach() {
    canvas.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
  };

  return input;
}

// Held-Space handbrake (only meaningful while driving).
export function handbrake(input) {
  return input.keys.has('Space');
}

// Build the frame input for world.step. `camera` is {x, y} — the top
// left of the viewport in world coordinates. Consumes the edge
// presses, so each key press fires exactly once.
export function buildFrameInput(input, camera) {
  const k = input.keys;
  let mx = 0;
  let my = 0;
  if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
  if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
  if (k.has('KeyW') || k.has('ArrowUp')) my -= 1;
  if (k.has('KeyS') || k.has('ArrowDown')) my += 1;

  let steer = 0;
  let throttle = 0;
  if (k.has('KeyA') || k.has('ArrowLeft')) steer -= 1;
  if (k.has('KeyD') || k.has('ArrowRight')) steer += 1;
  if (k.has('KeyW') || k.has('ArrowUp')) throttle += 1;
  if (k.has('KeyS') || k.has('ArrowDown')) throttle -= 1;

  let actions = 0;
  for (const code of input.pressed) {
    actions |= KEY_ACTIONS[code] || 0;
  }
  input.pressed.clear();

  return {
    mx, my,
    aimX: camera.x + input.mouse.x,
    aimY: camera.y + input.mouse.y,
    actions,
    shooting: input.mouse.down,
    running: k.has('ShiftLeft') || k.has('ShiftRight'),
    steer, throttle,
    handbrake: handbrake(input),
  };
}
