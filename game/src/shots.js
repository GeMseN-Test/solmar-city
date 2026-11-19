// shots.js — staged scenes for the four screenshots.
// main.js reads ?shot=<name>&seed=<n> from the URL and calls stageShot
// before the first frame, so each screenshot shows a real, playable
// moment: the title, a city drive, a police chase, and the harbor.
//
// Scenes: 'start', 'city', 'chase', 'harbor'.

import { startMission, tryInteract } from './missions.js';
import { nearestBoat, boardBoat } from './boats.js';

export const SHOT_NAMES = ['start', 'city', 'chase', 'harbor'];

function putPlayerInCar(state, x, y) {
  const p = state.player;
  p.x = x;
  p.y = y;
  const found = tryInteract(state);
  if (!p.inCar) {
    // No traffic car was close enough: borrow the nearest one and drive it.
    let best = null;
    let bestD = 1e9;
    for (const car of state.traffic.cars || []) {
      const d = Math.hypot(car.x - x, car.y - y);
      if (d < bestD) {
        best = car;
        bestD = d;
      }
    }
    if (best) {
      best.x = x;
      best.y = y;
      p.x = x;
      p.y = y;
      tryInteract(state);
    }
  }
  return found;
}

// Set the world up for one named shot. Mutates the state in place.
export function stageShot(state, name) {
  const p = state.player;
  if (name === 'city') {
    // Mara driving past the bank, second job on the board.
    state.money = 1250;
    putPlayerInCar(state, 1800, 1250);
    startMission(state, 1);
    state.missionObjectiveIndex = 1;
    state.camera.x = p.x;
    state.camera.y = p.y;
    return state;
  }

  if (name === 'chase') {
    // Four stars, roadblocks ahead, helicopter overhead — the M8 job.
    state.money = 5400;
    putPlayerInCar(state, 1800, 1250);
    state.wanted = 4;
    state.wantedTimer = 0;
    startMission(state, 7);
    state.missionObjectiveIndex = 1;
    state.camera.x = p.x;
    state.camera.y = p.y;
    return state;
  }

  if (name === 'harbor') {
    // M6 "Harbor Lights": Mara in a boat off the Marina, HARBOR 98 on
    // the radio, Gull Island ahead. The boat is boarded for real, so the
    // HUD shows boat speed and the radio line.
    state.money = 2400;
    startMission(state, 5);
    p.x = 700;
    p.y = 2090;
    p.angle = Math.PI / 2;
    const boat = nearestBoat(state, p.x, p.y);
    if (boat) {
      boardBoat(state, boat);
      state.missionObjectiveIndex = 1;
    }
    if (state.radio) state.radio.stationIndex = 1;
    state.camera.x = p.x;
    state.camera.y = p.y + 60;
    return state;
  }

  // 'start' and anything unknown: Mara on foot outside the Safehouse,
  // first mission about to start. The title screen covers this shot.
  p.x = 1420;
  p.y = 1230;
  p.angle = -Math.PI / 2;
  state.camera.x = p.x;
  state.camera.y = p.y;
  return state;
}
