// shots.js — Screenshot staging for Solmar City.
// Written from the v2 spec only. stageShot positions the world for a
// deterministic screenshot scene; shot 4 is the harbor scene (M6 in a
// boat, radio on). Manifest lives in shots.json.
import { startMission } from './missions.js';

export const SHOT_SCENES = ['city', 'chase', 'downtown', 'harbor'];

export const SHOTS = [
  { id: 1, scene: 'city', query: '?shot=city&seed=1', description: 'Downtown Solmar on foot, first mission, morning traffic.' },
  { id: 2, scene: 'chase', query: '?shot=chase&seed=1', description: 'Three-star police chase in a stolen car.' },
  { id: 3, scene: 'downtown', query: '?shot=downtown&seed=1', description: 'Bank district at dusk, taxi fare waiting.' },
  { id: 4, scene: 'harbor', query: '?shot=harbor&seed=1', description: 'M6 Harbor Lights: in a boat near Gull Island, radio on.' },
];

export function shotQuery(scene, seed) {
  return '?shot=' + scene + '&seed=' + (seed || 1);
}

function placeOnRoad(state, x, y) {
  state.player.x = x;
  state.player.y = y;
  state.player.angle = 0;
  state.player.aimAngle = 0;
  state.camera.x = Math.max(0, Math.min(2880 - 1280, x - 640));
  state.camera.y = Math.max(0, Math.min(2160 - 800, y - 400));
}

// Stage one of the four screenshot scenes. Returns the scene name.
export function stageShot(state, scene, seed) {
  const s = SHOT_SCENES.includes(scene) ? scene : 'city';
  // Clean slate: on foot, healthy, no heat, radio available.
  state.player.inCar = false;
  state.player.car = null;
  state.player.inBoat = false;
  state.player.boat = null;
  state.player.hp = 100;
  state.player.ammo = 48;
  if (state.police) {
    state.police.wanted = 0;
    if (typeof state.police.resetWantedTimer === 'function') state.police.resetWantedTimer();
  }
  if (state.radio) state.radio.stationIndex = 0;

  if (s === 'city') {
    // Downtown on foot, M1 active, traffic around.
    startMission(state, 0);
    placeOnRoad(state, 1260, 900);
    state.player.aimAngle = -Math.PI / 2;
  } else if (s === 'chase') {
    // Three-star chase: player in a car, cops close behind.
    startMission(state, 3);
    const car = (state.traffic && state.traffic.cars && state.traffic.cars[0]) || { x: 1620, y: 1260, angle: 0, speed: 300 };
    state.player.inCar = true;
    state.player.car = car;
    state.player.x = car.x;
    state.player.y = car.y;
    state.player.angle = car.angle;
    if (state.police) state.police.wanted = 3;
    placeOnRoad(state, car.x, car.y);
    try {
      for (let i = 0; i < 2 && state.police.cars; i++) {
        state.police.cars.push({ x: car.x - 120 - i * 60, y: car.y + 40, angle: 0, speed: 300, roadblock: false });
      }
    } catch (e) {}
  } else if (s === 'downtown') {
    // Bank district at dusk: M5 active, taxi fare waiting nearby.
    startMission(state, 4);
    placeOnRoad(state, 1800, 1260);
    state.player.aimAngle = Math.PI;
    try {
      if (state.sideJobs && !state.sideJobs.fare) {
        state.sideJobs.fare = {
          stage: 'waiting', x: 1900, y: 1260, destKey: 'marina',
          destX: 2520, destY: 1930, destName: 'Solmar Marina', pay: 120,
        };
      }
    } catch (e) {}
  } else if (s === 'harbor') {
    // M6 in a boat near Gull Island, radio on (NEON NIGHTS).
    startMission(state, 5);
    state.missionObjectiveIndex = 2; // reach island
    const boat = (state.boats && state.boats[0]) || { x: 1440, y: 2130, angle: 0, speed: 0, color: '#fff', inUse: false };
    boat.x = 1500;
    boat.y = 2132;
    boat.angle = -Math.PI / 2;
    state.player.inBoat = true;
    state.player.boat = boat;
    boat.inUse = true;
    state.player.x = boat.x;
    state.player.y = boat.y;
    if (state.radio) state.radio.stationIndex = 2;
    state.camera.x = Math.max(0, Math.min(2880 - 1280, boat.x - 640));
    state.camera.y = Math.max(0, Math.min(2160 - 800, 2132 - 500));
  }
  return s;
}
