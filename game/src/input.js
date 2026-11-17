// Keyboard and mouse for Solmar City. Held keys steer and drive; one-shot
// presses (interact, punch, pause, confirm, mute) are queued as bit flags
// and taken once by the loop, so a press between two frames is never lost
// and never counted twice. The mouse aims (on foot) and clicks to shoot,
// and clicks menu buttons on the title and pause screens.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Enter', 'NumpadEnter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const PUNCH = new Set(['Space']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false, clicked: false, clickX: 0, clickY: 0 };

  function codeOf(event) {
    return event.code;
  }

  window.addEventListener('keydown', (event) => {
    const code = codeOf(event);
    held.add(code);
    if (event.repeat) return;
    if (CONFIRM.has(code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(code)) actions |= ACTION_PAUSE;
    else if (INTERACT.has(code)) actions |= ACTION_INTERACT;
    else if (PUNCH.has(code)) actions |= ACTION_PUNCH;
    else if (MUTE.has(code)) actions |= ACTION_MUTE;
    if (UP.has(code) || DOWN.has(code) || LEFT.has(code) || RIGHT.has(code) || PUNCH.has(code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(codeOf(event));
  });
  // A key released while the tab is hidden never sends keyup: drop all of
  // them on blur so the player never keeps driving into a wall.
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });

  function updateMouse(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }
  canvas.addEventListener('pointermove', updateMouse);
  canvas.addEventListener('pointerdown', (event) => {
    updateMouse(event);
    mouse.down = true;
    mouse.clicked = true;
    mouse.clickX = mouse.x;
    mouse.clickY = mouse.y;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  function hasAny(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    mouse,
    /** Steering: -1 left, 1 right, from A/D or the arrow keys. */
    steer() {
      return (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0);
    },
    /** Throttle: -1 reverse, 1 forward, from W/S or the arrow keys. */
    throttle() {
      return (hasAny(UP) ? 1 : 0) - (hasAny(DOWN) ? 1 : 0);
    },
    /** On-foot move vector, normalised, from WASD / arrows. */
    moveVector() {
      const x = (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0);
      const y = (hasAny(DOWN) ? 1 : 0) - (hasAny(UP) ? 1 : 0);
      const length = Math.hypot(x, y);
      if (length === 0) return { x: 0, y: 0 };
      return { x: x / length, y: y / length };
    },
    running() {
      return hasAny(RUN);
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** A fresh click (canvas pixels) since the last call, or null. */
    takeClick() {
      if (!mouse.clicked) return null;
      mouse.clicked = false;
      return { x: mouse.clickX, y: mouse.clickY };
    },
  };
}
