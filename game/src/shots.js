// Solmar City — shots.js: staged scenes for the 4 screenshots.
//
// The game reads ?shot=<name>&seed=1 from the URL. main.js builds a fresh
// world and calls stageShot(state, name) before the first frame, so each
// screenshot shows a real, live scene — never a mock.
//
//   start  — the title screen (nothing staged; main.js stays on title)
//   city   — Mara driving through downtown on M2 "Harbor Run"
//   chase  — 4 wanted stars, roadblocks + heli, M8 "The Grand Finale"
//   harbor — Mara in a boat off the Marina on M6, NEON NIGHTS on the HUD

import { startMission } from './missions.js';
import * as BoatsMod from './boats.js';

export const SHOT_NAMES = ['start', 'city', 'chase', 'harbor'];

export const SHOT_DESCRIPTIONS = {
  start: 'Title screen — Solmar City, New Game / Continue.',
  city: 'Downtown drive — Mara in a stolen car on mission M2 Harbor Run.',
  chase: 'Police chase — 4 wanted stars, roadblocks and the heli, mission M8.',
  harbor: 'Harbor at night — Mara in a boat, radio NEON NIGHTS, mission M6.',
};

// Put the player in a car at (x, y), facing `angle`.
function putPlayerInCar(state, x, y, angle) {
  const car = {
    kind: 'player',
    x,
    y,
    angle,
    speed: 0,
    vx: 0,
    vy: 0,
    color: '#b03a3a',
    model: 'sport',
    radius: 18,
    r: 18,
  };
  const p = state.player;
  p.inCar = true;
  p.car = car;
  p.inBoat = false;
  p.boat = null;
  p.x = x;
  p.y = y;
  p.angle = angle;
  p.speed = 0;
  state.camera.x = x;
  state.camera.y = y;
  return car;
}

function snapCamera(state) {
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
}

export function stageShot(state, name) {
  if (!state) return false;
  switch (name) {
    case 'start': {
      // Title screen — nothing to stage.
      return true;
    }
    case 'city': {
      putPlayerInCar(state, 1420, 1190, -Math.PI / 2);
      state.money = 450;
      startMission(state, 1); // M2 Harbor Run ($400)
      snapCamera(state);
      return true;
    }
    case 'chase': {
      putPlayerInCar(state, 1420, 1190, -Math.PI / 2);
      state.money = 8450;
      state.wanted = 4;
      state.wantedTimer = 0;
      startMission(state, 7); // M8 The Grand Finale ($5,000)
      // Two cruisers closing in from the north and the south.
      if (state.police && Array.isArray(state.police.cars)) {
        const mkCop = (x, y, angle) => ({
          kind: 'police',
          x,
          y,
          angle,
          speed: 0,
          vx: 0,
          vy: 0,
          color: '#22303e',
          model: 'sedan',
          roadblock: false,
        });
        state.police.cars.push(mkCop(1420, 950, Math.PI / 2));
        state.police.cars.push(mkCop(1420, 1430, -Math.PI / 2));
        state.police.cars.push(mkCop(1180, 1190, 0));
      }
      snapCamera(state);
      return true;
    }
    case 'harbor': {
      state.money = 1250;
      startMission(state, 5); // M6 Harbor Lights ($900)
      // Board the first boat and sail it out toward the island.
      const boat = (state.boats || [])[0];
      if (boat && typeof BoatsMod.boardBoat === 'function') {
        // Walk the player onto the boat first (boardBoat takes over).
        state.player.x = boat.x;
        state.player.y = boat.y;
        BoatsMod.boardBoat(state, boat);
        boat.x = 1800;
        boat.y = 2130;
        boat.angle = Math.PI / 2;
        state.player.x = boat.x;
        state.player.y = boat.y;
        state.player.angle = boat.angle;
      }
      // NEON NIGHTS on the HUD (station index 2 of 5).
      if (state.radio) state.radio.stationIndex = 2;
      snapCamera(state);
      return true;
    }
    default:
      return false;
  }
}
