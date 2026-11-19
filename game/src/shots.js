// shots.js — staged screenshot scenes for Solmar City.
// Written from the v2 spec only. main.js reads ?shot=<name>&seed=1 and
// calls stageShot(state, name) so each screenshot shows a real game state.
import { startMission } from './missions.js';
import { boardBoat } from './boats.js';
import { stepPolice } from './police.js';
import { stepPolice2 } from './police2.js';

export const SHOT_NAMES = ['start', 'city', 'chase', 'harbor'];

export function shotQuery(name) {
  return `?shot=${name}&seed=1`;
}

// Set the world up for a named scene. Returns the scene name.
export function stageShot(state, name) {
  const p = state.player;
  if (name === 'start') {
    return 'start';
  }
  if (name === 'city') {
    // M2 in progress, Mara driving through the city.
    startMission(state, 1);
    const car = state.traffic && state.traffic.cars && state.traffic.cars[0];
    if (car) {
      state.traffic.cars.splice(0, 1);
      p.inCar = true;
      p.car = car;
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      car.speed = 220;
    } else {
      p.x = 1420;
      p.y = 1190;
    }
    return 'city';
  }
  if (name === 'chase') {
    // M8 in progress, 4 stars: roadblocks + police heli overhead.
    startMission(state, 7);
    p.x = 1800;
    p.y = 1190;
    state.wanted = 4;
    state.wantedGainAt = state.time;
    for (let i = 0; i < 12; i++) {
      stepPolice(state, 0.5);
      stepPolice2(state, 0.5);
    }
    return 'chase';
  }
  if (name === 'harbor') {
    // M6 in progress, Mara in a boat, HARBOR 98 on the radio.
    startMission(state, 5);
    const boat = state.boats && state.boats[0];
    if (boat) boardBoat(state, boat);
    if (state.radio) state.radio.stationIndex = 1;
    return 'harbor';
  }
  return name;
}
