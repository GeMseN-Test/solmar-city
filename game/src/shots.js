// Staged screenshot scenes for `?shot=<name>&seed=1`. Each scene puts
// the player, the mission and the heat exactly where the shot needs
// them, then main.js renders one frame and stops. The four shots:
//   title  — the title screen over the city
//   city   — Mara driving through downtown, mission M1 on the HUD
//   chase  — wanted 3, cop cars close, roadblocks ahead
//   harbor — Mara in a boat off the marina, radio on, M6 on the HUD
import { setWanted } from './police.js';
import { stepPolice2 } from './police2.js';
import { startMission } from './missions.js';
import { MISSIONS } from './missions.js';
import { clamp } from './util.js';

export const SHOT_NAMES = ['title', 'city', 'chase', 'harbor'];

function putPlayerInCar(state, x, y) {
  const p = state.player;
  let best = null;
  let bestD = Infinity;
  for (const car of state.traffic.cars) {
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return false;
  const idx = state.traffic.cars.indexOf(best);
  if (idx >= 0) state.traffic.cars.splice(idx, 1);
  p.inCar = true;
  p.car = best;
  best.speed = 0;
  best.x = x;
  best.y = y;
  p.x = x;
  p.y = y;
  p.angle = best.angle;
  return true;
}

function putPlayerInBoat(state, boatIndex, x, y) {
  const p = state.player;
  const boat = state.boats[boatIndex % state.boats.length];
  boat.x = x;
  boat.y = y;
  boat.angle = -0.4;
  p.inBoat = true;
  p.boat = boat;
  boat.inUse = true;
  p.x = x;
  p.y = y;
  p.angle = boat.angle;
  return boat;
}

export function stageShot(state, name) {
  const p = state.player;
  state.screen = 'game';
  if (name === 'title') {
    state.screen = 'title';
    p.x = 1420;
    p.y = 1190;
    p.angle = -Math.PI / 2;
    p.aimAngle = -Math.PI / 2;
    return true;
  }
  if (name === 'city') {
    startMission(state, 0);
    state.missionStep = 1; // steal done — now drive to the garage
    putPlayerInCar(state, 1260, 900);
    p.car.angle = 0;
    p.car.speed = 220;
    p.angle = 0;
    return true;
  }
  if (name === 'chase') {
    startMission(state, 2);
    putPlayerInCar(state, 1620, 1260);
    p.car.angle = Math.PI / 2;
    p.car.speed = 300;
    p.angle = Math.PI / 2;
    setWanted(state, 3);
    // Two cruisers closing in + the roadblock pair ahead.
    for (let i = 0; i < 2; i++) {
      state.police.cars.push({
        kind: 'police',
        x: p.x - 160 - i * 90,
        y: p.y - 120 + i * 60,
        angle: Math.PI / 2,
        speed: 380,
        cruise: 430,
        color: '#1a1a2e',
        model: 'sedan',
        ramCooldown: 0,
        roadblock: false,
      });
    }
    stepPolice2(state, 0.1);
    return true;
  }
  if (name === 'harbor') {
    startMission(state, 5); // M6 Harbor Lights
    state.missionStep = 2; // on the water — now reach Gull Island
    const boat = putPlayerInBoat(state, 2, 2050, 2130);
    boat.speed = 120;
    state.radio.stationIndex = 2; // NEON NIGHTS on the HUD
    // A couple of coins and the marina in frame.
    p.aimAngle = -0.4;
    return true;
  }
  return false;
}
