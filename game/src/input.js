// input.js — Keyboard + mouse input for Solmar City.
// Written from the v2 spec only. pollInput() builds the plain VALUES
// object world.step wants each frame: { mx, my, aimX, aimY, actions,
// shooting, running, steer, throttle, handbrake }.
// Keys: Enter confirm, P/Esc pause, E interact, Space punch/handbrake,
// M mute, Q radio. Mouse: aim + shoot.

export const ACTIONS = {
  CONFIRM: 1,
  PAUSE: 2,
  INTERACT: 4,
  PUNCH: 8,
  MUTE: 16,
  RADIO: 32,
};

const KEY_TO_ACTION = {
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
    if (!e.repeat) input.pressed.add(e.code);
    input.keys.add(e.code);
  }
  function onKeyUp(e) {
    input.keys.delete(e.code);
  }
  function onBlur() {
    input.keys.clear();
  }
  function mousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
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

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  input.detach = () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
  };
  return input;
}

// Space held = handbrake while driving (on foot it punches instead).
export function handbrake(input) {
  return input.keys.has('Space');
}

export function isDown(input, code) {
  return input.keys.has(code);
}

export function clearClick(input) {
  input.mouse.clicked = false;
}

// Build the frame input values. Edge-triggered actions come from the
// pressed set (keys hit since the last poll) and are consumed here.
export function pollInput(input, camera, viewW, viewH) {
  const keys = input.keys;
  let mx = 0;
  let my = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
  const len = Math.sqrt(mx * mx + my * my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }

  const steer = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0)
    - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  const throttle = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0)
    - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const running = keys.has('ShiftLeft') || keys.has('ShiftRight');

  let actions = 0;
  for (const code of input.pressed) {
    const bit = KEY_TO_ACTION[code];
    if (bit) actions |= bit;
  }
  input.pressed.clear();

  const camX = camera ? camera.x : 0;
  const camY = camera ? camera.y : 0;
  const aimX = camX + (input.mouse.x - viewW / 2);
  const aimY = camY + (input.mouse.y - viewH / 2);

  return {
    mx,
    my,
    aimX,
    aimY,
    actions,
    shooting: input.mouse.down,
    running,
    steer,
    throttle,
    handbrake: handbrake(input),
  };
}
