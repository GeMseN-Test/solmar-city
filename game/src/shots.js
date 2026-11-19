// shots.js — Scripted screenshot scenes for Solmar City.
//
// stageShot(scene, seed) builds a fresh world and poses it for a
// screenshot, then returns the state. main.js calls it when the page
// loads with ?shot=<scene>&seed=<n> (see shots.json). The four shots
// the kit captures are:
//   title  — fresh spawn at the safehouse, title screen state.
//   city   — driving a stolen car through downtown, mission M1 live.
//   chase  — 4 stars, police roadblock + heli overhead.
//   harbor — M6 "Harbor Lights": the player in a boat on the water
//            with the radio on, sea + marina in frame.
//
// Scenes are pure state setup: no audio, no input, no timers — the
// frame main.js renders from the returned state is the screenshot.

import { createWorld } from './world.js';
import { startMission } from './missions.js';
import { boardBoat, nearestBoat } from './boats.js';
import { spawnGang } from './combat.js';
import { EV } from './missions.js';

export const SHOT_SCENES = ['title', 'city', 'chase', 'docks', 'harbor'];

function poseInCar(state) {
  const p = state.player;
  const car = state.traffic.cars[0];
  if (!car) return;
  const idx = state.traffic.cars.indexOf(car);
  state.traffic.cars.splice(idx, 1);
  p.inCar = true;
  p.car = car;
  car.speed = 240;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
}

function poseOnBoat(state) {
  const p = state.player;
  p.x = 2460;
  p.y = 2090;
  p.angle = Math.PI / 2;
  const boat = nearestBoat(state, p.x, p.y);
  if (boat) {
    boardBoat(state, boat);
    boat.speed = 160;
    boat.angle = Math.PI / 2;
    p.boat = boat;
  }
  state.camera.x = p.x;
  state.camera.y = p.y + 40;
}

export function stageShot(scene, seed) {
  const world = createWorld(seed == null ? 1 : seed);
  const state = world.state;
  state.playTime = 12;

  if (scene === 'title') {
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    return state;
  }

  if (scene === 'city') {
    // Downtown drive: stolen car, mission M1 running, traffic around.
    poseInCar(state);
    state.player.x = 1440;
    state.player.y = 900;
    if (state.player.car) {
      state.player.car.x = 1440;
      state.player.car.y = 900;
      state.player.car.angle = -Math.PI / 2;
      state.player.angle = -Math.PI / 2;
    }
    startMission(state, 0);
    state.camera.x = state.player.x;
    state.camera.y = state.player.y - 60;
    return state;
  }

  if (scene === 'chase') {
    // 4 stars: roadblock cruisers ahead, heli overhead, cops closing.
    poseInCar(state);
    state.wanted = 4;
    state.crimeTimer = 0;
    state.player.x = 1440;
    state.player.y = 1260;
    if (state.player.car) {
      state.player.car.x = 1440;
      state.player.car.y = 1260;
      state.player.car.angle = 0;
      state.player.angle = 0;
    }
    state.police2.heli = { x: 1440, y: 1260, angle: 0, rotor: 0.7 };
    state.police2.roadblocks = [
      { kind: 'traffic', model: 'police', x: 1620, y: 1230, angle: Math.PI / 2, speed: 0, color: '#222', roadblock: true },
      { kind: 'traffic', model: 'police', x: 1620, y: 1290, angle: Math.PI / 2, speed: 0, color: '#222', roadblock: true },
    ];
    for (const rb of state.police2.roadblocks) state.police.cars.push(rb);
    spawnGang(state, 1440, 1100, 2);
    state.camera.x = state.player.x + 60;
    state.camera.y = state.player.y;
    return state;
  }

  if (scene === 'docks') {
    // M2 "Harbor Run": on foot at the docks, crates waiting.
    state.player.x = 400;
    state.player.y = 180;
    state.player.angle = Math.PI / 4;
    startMission(state, 1);
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    return state;
  }

  if (scene === 'harbor') {
    // M6 "Harbor Lights": in a boat, radio on, crossing to the island.
    startMission(state, 5);
    poseOnBoat(state);
    state.radio.stationIndex = 1;
    state.radio.started = true;
    state.bannerText = 'Harbor Lights — board a boat, reach Gull Island';
    state.bannerTimer = 30;
    return state;
  }

  // Unknown scene: plain spawn, same as title.
  return state;
}

// Re-exported so shot tooling can read the event bits if needed.
export { EV };
