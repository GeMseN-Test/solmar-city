// shots.js — Solmar City staged screenshot scenes.
// Written from the v2 spec only. stageShot(state, scene) mutates a fresh
// world state so each screenshot shows a real, data-filled game moment.
// Scenes: 'city' (shot 1, full sample HUD), 'chase', 'start', 'harbor'.
import { createWorld, startMission } from './world.js';
import { boardBoat } from './boats.js';

export const SHOT_LIST = [
  { id: 1, scene: 'city', url: '?shot=city&seed=1', label: 'Downtown Solmar — full HUD' },
  { id: 2, scene: 'chase', url: '?shot=chase&seed=1', label: 'SCPD chase at 4 stars' },
  { id: 3, scene: 'start', url: '?shot=start&seed=1', label: 'Title screen' },
  { id: 4, scene: 'harbor', url: '?shot=harbor&seed=1', label: 'Harbor run — M6 in a boat' },
];

function putPlayerInCar(state, x, y) {
  const car = state.parkedCars && state.parkedCars.length
    ? state.parkedCars[0]
    : { kind: 'parked', x, y, angle: 0, speed: 0, color: '#d23b3b', model: 'sport' };
  if (state.parkedCars) {
    const i = state.parkedCars.indexOf(car);
    if (i >= 0) state.parkedCars.splice(i, 1);
  }
  car.x = x;
  car.y = y;
  car.angle = -Math.PI / 2;
  state.player.inCar = true;
  state.player.car = car;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = -Math.PI / 2;
}

// Stage one scene on a live state. Shot 1 (city) MUST show a full sample
// HUD: $2,450, Coins 5/12, Fares $230, SOLMAR FM, a running mission, HP,
// SCPD stars, and the Grand Prix countdown.
export function stageShot(state, scene) {
  // Common base: a mid-game moment.
  state.grandPrix.startsIn = 2 * 3600 + 60 + 56; // 02:01:56 on the HUD
  if (scene === 'city') {
    state.money = 2450;
    state.sideJobs.coinsFound = 5;
    state.sideJobs.faresEarned = 230;
    state.radio.stationIndex = 0; // SOLMAR FM
    state.wanted = 2;
    state.player.hp = 88;
    state.player.ammo = 120;
    putPlayerInCar(state, 1260, 1190);
    startMission(state, 2); // M3 Heat Wave, in progress
    return state;
  }
  if (scene === 'chase') {
    state.money = 3200;
    state.sideJobs.coinsFound = 7;
    state.sideJobs.faresEarned = 410;
    state.radio.stationIndex = 2; // NEON NIGHTS
    state.wanted = 4;
    state.player.hp = 64;
    state.player.ammo = 96;
    putPlayerInCar(state, 1440, 830);
    // Roadblocks + heli, as the live game shows at 4 stars.
    if (state.police2) {
      state.police2.heli = { x: 1440, y: 830, angle: 0, rotor: 0.7 };
      state.police2.roadblocks = [
        { kind: 'police', x: 1440, y: 650, angle: 0, speed: 0, color: '#1a1a2e', model: 'sedan', roadblock: true },
        { kind: 'police', x: 1440, y: 1010, angle: 0, speed: 0, color: '#1a1a2e', model: 'sedan', roadblock: true },
      ];
    }
    if (state.police) {
      state.police.wanted = 4;
      state.police.cars = (state.police2 && state.police2.roadblocks) ? state.police2.roadblocks.slice() : [];
    }
    startMission(state, 7); // M8 The Grand Finale, in progress
    return state;
  }
  if (scene === 'start') {
    // Title screen: keep the fresh defaults, just set the clock.
    state.money = 50;
    return state;
  }
  if (scene === 'harbor') {
    state.money = 1850;
    state.sideJobs.coinsFound = 3;
    state.sideJobs.faresEarned = 120;
    state.radio.stationIndex = 1; // HARBOR 98
    state.wanted = 0;
    state.player.hp = 100;
    state.player.ammo = 48;
    // M6 Harbor Lights, in progress, player already in a boat.
    startMission(state, 5);
    const boat = state.boats && state.boats.length ? state.boats[0] : null;
    if (boat) {
      state.player.x = boat.x;
      state.player.y = boat.y;
      boardBoat(state, boat);
      state.player.boat.speed = 120;
      boat.speed = 120;
    }
    return state;
  }
  // Unknown scene: leave the state as-is.
  return state;
}

// Convenience: fresh world + staged scene, for main.js ?shot= handling.
export function stageWorld(seed, scene) {
  const world = createWorld(seed == null ? 1 : seed);
  stageShot(world.state, scene);
  return world;
}
