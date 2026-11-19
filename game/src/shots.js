// shots.js — Deterministic staged scenes for the 4 screenshots.
// Written from the v2 spec only. stageShot(state, name) sets the world
// up so a screenshot shows the named moment; main.js calls it when the
// page loads with ?shot=<name>. Shot 4 is the harbor scene: M6 in a boat
// with the radio on.

import { startMission } from './missions.js';
import { boardBoat } from './boats.js';
import { stepPolice } from './police.js';
import { stepPolice2 } from './police2.js';

export const SHOT_NAMES = ['start', 'city', 'chase', 'harbor'];

function snapCamera(state) {
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
}

// Put the player in a traffic car on the road, ready to drive.
function putPlayerInCar(state, x, y, angle) {
  const car = state.traffic.cars[0];
  if (!car) return;
  state.traffic.cars.splice(0, 1);
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = 0;
  state.player.inCar = true;
  state.player.car = car;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  state.player.aimAngle = angle;
}

export function stageShot(state, name) {
  if (name === 'start') {
    // Title screen — nothing to stage.
    return;
  }

  if (name === 'city') {
    // M2 Harbor Run, driving through the city.
    state.money = 450;
    putPlayerInCar(state, 900, 900, 0);
    startMission(state, 1);
    snapCamera(state);
    return;
  }

  if (name === 'chase') {
    // M8 The Grand Finale, 4 stars: cruisers, roadblocks, heli.
    state.money = 5000;
    putPlayerInCar(state, 1400, 1000, 0);
    startMission(state, 7);
    state.wanted = 4;
    for (let i = 0; i < 8; i++) {
      stepPolice(state, 0.5);
      stepPolice2(state, 0.5);
    }
    snapCamera(state);
    return;
  }

  if (name === 'harbor') {
    // M6 Harbor Lights: Mara in a boat on the water, HARBOR 98 on.
    state.money = 900;
    startMission(state, 5);
    const boat = state.boats[0];
    if (boat) {
      boardBoat(state, boat);
      boat.speed = 200;
    }
    if (state.radio) state.radio.stationIndex = 1;
    snapCamera(state);
    return;
  }
}
