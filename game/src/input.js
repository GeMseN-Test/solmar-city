// input.js — keyboard + mouse input for Solmar City.
// Written from the v2 spec only. Frame input is a plain VALUES object
// built by main.js each frame; this module only tracks keys and the mouse.
// Action bitmask (matches the probed frame contract):
// CONFIRM 1, PAUSE 2, INTERACT 4, PUNCH 8, MUTE 16, RADIO 32.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_RADIO = 32;

const PREVENTED = new Set([
  'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);

export function createInput(canvas) {
  const keys = new Set();
  const edges = [];
  const mouse = { x: 0, y: 0, down: false, clicked: false, clickX: 0, clickY: 0 };

  function onKeyDown(e) {
    if (PREVENTED.has(e.code)) e.preventDefault();
    if (!e.repeat) edges.push(e.code);
    keys.add(e.code);
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onBlur() {
    keys.clear();
    mouse.down = false;
  }
  function mousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }
  function onMouseMove(e) {
    const p = mousePos(e);
    mouse.x = p.x;
    mouse.y = p.y;
  }
  function onMouseDown(e) {
    const p = mousePos(e);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.down = true;
    mouse.clicked = true;
    mouse.clickX = p.x;
    mouse.clickY = p.y;
  }
  function onMouseUp() {
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  function axes() {
    let mx = 0;
    let my = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
    return { mx, my };
  }

  return {
    keys,
    mouse,
    isDown(code) {
      return keys.has(code);
    },
    // Codes pressed since the last call; each is reported once.
    takeEdges() {
      const out = edges.slice();
      edges.length = 0;
      return out;
    },
    clearClick() {
      mouse.clicked = false;
    },
    axes,
    running() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    // Held Space: handbrake while driving, punch on foot (main decides).
    handbrake() {
      return keys.has('Space');
    },
    shooting() {
      return mouse.down;
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    },
  };
}
