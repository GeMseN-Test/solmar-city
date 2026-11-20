// Solmar City — screenshot staging.
// Written from v2-spec.md only. stageShot(state, shot) poses the world
// for one of the four dossier screenshots. 'start' stays on the title
// screen (never forced into gameplay); the others stage live gameplay.
// NOTE: whenever a wanted level is staged, set state.wanted AND
// state.police.wanted — world.step syncs police from state, and would
// otherwise wipe the staged heat.
import { startMission } from './missions.js';
import { boardBoat } from './boats.js';

function setWanted(state, level) {
  state.wanted = level;
  if (state.police) state.police.wanted = level;
  state.wantedTimer = 0;
  state.wantedDecays = 0;
}

function putPlayerInCar(state, model) {
  const cars = (state.traffic && state.traffic.cars) || [];
  const car = cars.find((c) => c.model === model) || cars[0];
  if (!car) return;
  const p = state.player;
  p.inCar = true;
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  state.camera.x = p.x;
  state.camera.y = p.y;
}

export function stageShot(state, shot) {
  const p = state.player;

  if (shot === 'start') {
    // Title screen with a full HUD of sample data — never an empty frame.
    state.screen = 'title';
    state.money = 1250;
    state.hp = 100;
    state.ammo = 48;
    setWanted(state, 2);
    if (state.sideJobs) state.sideJobs.coinsFound = 3;
    state.radio.stationIndex = 0;
    state.grandPrix.startsIn = 3599;
    p.x = 1420;
    p.y = 1230;
    p.angle = -Math.PI / 2;
    p.inCar = false;
    p.inBoat = false;
    state.camera.x = 1420;
    state.camera.y = 1230;
    startMission(state, 0);
    return state;
  }

  if (shot === 'city') {
    state.screen = 'game';
    state.money = 2450;
    state.hp = 88;
    state.ammo = 96;
    setWanted(state, 0);
    if (state.sideJobs) state.sideJobs.coinsFound = 5;
    state.radio.stationIndex = 0;
    state.grandPrix.startsIn = 2400;
    putPlayerInCar(state, 'sedan');
    startMission(state, 1);
    return state;
  }

  if (shot === 'chase') {
    state.screen = 'game';
    state.money = 5200;
    state.hp = 64;
    state.ammo = 120;
    setWanted(state, 4);
    if (state.sideJobs) state.sideJobs.coinsFound = 8;
    state.radio.stationIndex = 2;
    state.grandPrix.startsIn = 900;
    putPlayerInCar(state, 'sport');
    // stepPolice2 grows the heli on the next step at 4 stars.
    startMission(state, 4);
    return state;
  }

  if (shot === 'harbor') {
    state.screen = 'game';
    state.money = 3100;
    state.hp = 100;
    state.ammo = 48;
    setWanted(state, 0);
    if (state.sideJobs) state.sideJobs.coinsFound = 7;
    state.radio.stationIndex = 1;
    state.grandPrix.startsIn = 1800;
    startMission(state, 5);
    const boat = (state.boats || [])[0];
    if (boat) {
      boardBoat(state, boat);
      state.camera.x = boat.x;
      state.camera.y = boat.y;
    }
    return state;
  }

  return state;
}
