// input.js — Keyboard + mouse input for Solmar City.
// Written from the v2 spec only. Frame input to world.step is a plain
// VALUES object: { mx, my, aimX, aimY, actions, shooting, running,
// steer, throttle, handbrake }. Actions bitmask: CONFIRM 1, PAUSE 2,
// INTERACT 4, PUNCH 8, MUTE 16, RADIO 32 (Q).
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_RADIO = 32;

const KEYMAP = {
  Enter: ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyE: ACTION_INTERACT,
  Space: ACTION_PUNCH,
  KeyM: ACTION_MUTE,
  KeyQ: ACTION_RADIO,
};

export function createInput(canvas) {
  const keys = Object.create(null);
  const mouse = { x: 0, y: 0, down: false, clicked: false, clickX: 0, clickY: 0 };
  let queuedActions = 0;
  let disposed = false;

  function onKeyDown(e) {
    if (e.repeat) return;
    keys[e.code] = true;
    const bit = KEYMAP[e.code];
    if (bit) queuedActions |= bit;
    // Space / arrows scroll the page — stop that while playing.
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  }
  function onKeyUp(e) { keys[e.code] = false; }
  function onMouseMove(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  }
  function onMouseDown(e) {
    onMouseMove(e);
    mouse.down = true;
  }
  function onMouseUp(e) {
    onMouseMove(e);
    mouse.down = false;
    mouse.clicked = true;
    mouse.clickX = mouse.x;
    mouse.clickY = mouse.y;
  }
  function onBlur() {
    for (const k of Object.keys(keys)) keys[k] = false;
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  function isDown(code) { return !!keys[code]; }

  // Space held while driving = handbrake. Space on foot = punch.
  function handbrake() { return !!keys.Space; }

  // Build one frame of plain values for world.step. Edge-triggered
  // actions are consumed here (each keypress fires exactly once).
  function readFrame() {
    let mx = 0;
    let my = 0;
    if (keys.KeyW || keys.ArrowUp) my -= 1;
    if (keys.KeyS || keys.ArrowDown) my += 1;
    if (keys.KeyA || keys.ArrowLeft) mx -= 1;
    if (keys.KeyD || keys.ArrowRight) mx += 1;
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }

    let steer = 0;
    if (keys.KeyA || keys.ArrowLeft) steer -= 1;
    if (keys.KeyD || keys.ArrowRight) steer += 1;
    let throttle = 0;
    if (keys.KeyW || keys.ArrowUp) throttle += 1;
    if (keys.KeyS || keys.ArrowDown) throttle -= 1;

    const actions = queuedActions;
    queuedActions = 0;
    const frame = {
      mx, my,
      aimX: mouse.x,
      aimY: mouse.y,
      actions,
      shooting: !!mouse.down,
      running: !!(keys.ShiftLeft || keys.ShiftRight),
      steer, throttle,
      handbrake: handbrake(),
    };
    return frame;
  }

  // Mouse click edge: read once per frame, then clear.
  function readClick() {
    if (!mouse.clicked) return null;
    mouse.clicked = false;
    return { x: mouse.clickX, y: mouse.clickY };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
  }

  return {
    keys, mouse, isDown, handbrake, readFrame, readClick, dispose,
  };
}
