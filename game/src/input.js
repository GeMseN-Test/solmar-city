// Solmar City — keyboard and mouse. createInput(canvas) listens to
// the window and the canvas and turns raw events into the plain
// frame object world.step wants:
//   { mx, my, aimX, aimY, actions, shooting, running,
//     steer, throttle, handbrake }
//
// Keys: WASD/arrows move, Shift runs, Enter confirms, P/Esc pauses,
// E interacts, Space punches on foot and handbrakes while driving,
// M mutes, Q cycles the radio. The mouse aims and shoots.
//
// The actions bitmask is edge-triggered for the one-shot keys
// (confirm, pause, interact, mute, radio) and held for punch, so a
// tap of E does one thing and holding Space keeps punching. The
// pressed set is consumed when a frame is built, so no key press is
// ever counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_RADIO = 32;

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'Enter', 'KeyP', 'Escape', 'KeyE', 'KeyM', 'KeyQ',
  'ShiftLeft', 'ShiftRight',
]);

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false, clickX: 0, clickY: 0 };

  function onKeyDown(e) {
    if (!GAME_KEYS.has(e.code)) return;
    e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
  }

  function onKeyUp(e) {
    keys.delete(e.code);
  }

  function onBlur() {
    keys.clear();
  }

  function trackMouse(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  }

  function onMouseMove(e) {
    trackMouse(e);
  }

  function onMouseDown(e) {
    trackMouse(e);
    mouse.down = true;
    mouse.clicked = true;
    mouse.clickX = mouse.x;
    mouse.clickY = mouse.y;
  }

  function onMouseUp() {
    mouse.down = false;
  }

  function attach() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
  }

  function detach() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
  }

  // True while the given key is held down.
  function isDown(code) {
    return keys.has(code);
  }

  // True while Space is held — the handbrake while driving, the
  // punch button on foot. Both read the same key.
  function handbrake() {
    return keys.has('Space');
  }

  // Build the one-shot actions bitmask from keys pressed since the
  // last frame, then clear the pressed set.
  function actions() {
    let bits = 0;
    if (pressed.has('Enter')) bits |= ACTION_CONFIRM;
    if (pressed.has('KeyP') || pressed.has('Escape')) bits |= ACTION_PAUSE;
    if (pressed.has('KeyE')) bits |= ACTION_INTERACT;
    if (pressed.has('KeyM')) bits |= ACTION_MUTE;
    if (pressed.has('KeyQ')) bits |= ACTION_RADIO;
    if (keys.has('Space')) bits |= ACTION_PUNCH;
    pressed.clear();
    mouse.clicked = false;
    return bits;
  }

  // The full frame input. view is { x, y, scale } — the camera the
  // renderer uses — so the mouse position becomes world coordinates.
  function frameInput(view) {
    const scale = (view && view.scale) || 1;
    const camX = (view && view.x) || 0;
    const camY = (view && view.y) || 0;
    let mx = 0;
    let my = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; }
    return {
      mx,
      my,
      aimX: camX + mouse.x / scale,
      aimY: camY + mouse.y / scale,
      actions: actions(),
      shooting: mouse.down,
      running: keys.has('ShiftLeft') || keys.has('ShiftRight'),
      steer: mx,
      throttle: -my,
      handbrake: handbrake(),
    };
  }

  return {
    keys,
    mouse,
    attach,
    detach,
    isDown,
    handbrake,
    actions,
    frameInput,
  };
}
