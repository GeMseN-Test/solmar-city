// police.js — the SCPD (Solmar City Police Department).
// Black-and-white cruisers and foot cops. When the player has stars
// they chase: cruisers ram, foot cops close in and grab. Stand close
// to the player for bustSeconds (1.6s) and the player is BUSTED.
// Wanted level is READ from state.wanted here — decay lives only in
// world.stepWanted, never in this module. HUD label is always SCPD.

import { WANTED } from './config.js';
import { clamp, dist, turnToward } from './util.js';

export const POLICE_LABEL = 'SCPD';
export const POLICE_NAME = 'Solmar City Police Department';

export function createPolice() {
  return {
    cars: [],
    cops: [],
    bustTimer: 0,
    spawnCooldown: 0,
    siren: false,
  };
}

function spawnCruiser(state, x, y) {
  const car = {
    kind: 'police',
    roadblock: false,
    x, y,
    angle: 0,
    speed: 0,
    cruise: 430,
    color: '#1c1c22',
    model: 'cruiser',
    ix: 0, iy: 0,
    fromIx: 0, fromIy: 0,
    nextIx: 0, nextIy: 0,
    wait: 0,
    wobble: 0,
  };
  state.police.cars.push(car);
  return car;
}

function spawnFootCop(state, x, y) {
  const cop = {
    x, y,
    angle: 0,
    speed: 150,
    shirt: '#1c2f5e',
    skin: '#e8b98a',
    hp: 100,
  };
  state.police.cops.push(cop);
  return cop;
}

// How many cruisers the current wanted level calls for.
export function cruisersWanted(wanted) {
  if (wanted <= 0) return 0;
  if (wanted === 1) return 1;
  if (wanted === 2) return 2;
  if (wanted === 3) return 3;
  return 4;
}

export function stepPolice(state, dt) {
  const step = dt || 0.016;
  const police = state.police;
  const p = state.player;
  if (!police || !p) return;
  const wanted = state.wanted || 0;

  // Keep the cruiser count in line with the wanted level. Roadblock
  // cruisers (police2) are owned by police2 and never removed here.
  const patrol = police.cars.filter((c) => !c.roadblock);
  const need = cruisersWanted(wanted);
  if (patrol.length < need) {
    police.spawnCooldown -= step;
    if (police.spawnCooldown <= 0) {
      police.spawnCooldown = 1.2;
      // Spawn off-screen-ish: on a road behind the player's view.
      const a = Math.random() * Math.PI * 2;
      const sx = clamp(p.x + Math.cos(a) * 620, 60, 2820);
      const sy = clamp(p.y + Math.sin(a) * 620, 60, 2000);
      const road = state.city ? state.city.nearestRoadPoint(sx, sy) : { x: sx, y: sy };
      spawnCruiser(state, road.x, road.y);
    }
  } else if (patrol.length > need) {
    // Wanted dropped: the furthest patrol cruiser peels off.
    let worst = null;
    let worstD = -1;
    for (const c of patrol) {
      const d = dist(c.x, c.y, p.x, p.y);
      if (d > worstD) { worstD = d; worst = c; }
    }
    if (worst) {
      const idx = police.cars.indexOf(worst);
      if (idx >= 0) police.cars.splice(idx, 1);
    }
  }

  // Foot cops only appear at 2+ stars and only on foot chases.
  if (wanted >= 2 && police.cops.length < wanted - 1 && p.hp > 0) {
    police.spawnCooldown -= step;
    if (police.spawnCooldown <= 0) {
      police.spawnCooldown = 2.5;
      const a = Math.random() * Math.PI * 2;
      spawnFootCop(state, p.x + Math.cos(a) * 320, p.y + Math.sin(a) * 320);
    }
  }
  if (wanted === 0 && police.cops.length > 0) {
    police.cops.length = 0;
    police.bustTimer = 0;
  }

  // --- Cruisers: chase and ram ---------------------------------------
  let anyChasing = false;
  for (const car of police.cars) {
    if (car.roadblock) continue; // police2 owns roadblocks; they park.
    if (wanted <= 0) continue;
    anyChasing = true;
    const d = dist(car.x, car.y, p.x, p.y);
    const toPlayer = Math.atan2(p.y - car.y, p.x - car.x);
    car.angle = turnToward(car.angle, toPlayer, 2.2 * step);
    // Faster than traffic, slower than a full-speed getaway car.
    const targetSpeed = d > 420 ? car.cruise : car.cruise * 0.8;
    if (car.speed < targetSpeed) car.speed = Math.min(targetSpeed, car.speed + 520 * step);
    else car.speed = Math.max(targetSpeed, car.speed - 400 * step);
    car.x += Math.cos(car.angle) * car.speed * step;
    car.y += Math.sin(car.angle) * car.speed * step;
    if (state.city && state.city.resolveCircle) state.city.resolveCircle(car, 20);
    car.x = clamp(car.x, 30, 2850);
    car.y = clamp(car.y, 30, 2070);
    // Ram: a hard hit at close range hurts and shoves the player.
    if (d < 34 && p.hp > 0 && (!p.invuln || p.invuln <= 0)) {
      p.hp = Math.max(0, p.hp - 18 * step * 3);
      if (state.events != null) state.events |= 8; // CRASH
    }
  }
  police.siren = anyChasing;

  // --- Foot cops: run the player down ---------------------------------
  for (const cop of police.cops) {
    const d = dist(cop.x, cop.y, p.x, p.y);
    const toPlayer = Math.atan2(p.y - cop.y, p.x - cop.x);
    cop.angle = toPlayer;
    if (d > 26) {
      cop.x += Math.cos(cop.angle) * cop.speed * step;
      cop.y += Math.sin(cop.angle) * cop.speed * step;
    }
    if (state.city && state.city.resolveCircle) state.city.resolveCircle(cop, 10);
  }

  // --- Bust: a cop car or foot cop glued to the player -----------------
  const bustRange = 42;
  let touching = false;
  if (wanted > 0 && p.hp > 0 && !p.inBoat) {
    for (const car of police.cars) {
      if (dist(car.x, car.y, p.x, p.y) < bustRange && Math.abs(car.speed) < 120) touching = true;
    }
    for (const cop of police.cops) {
      if (dist(cop.x, cop.y, p.x, p.y) < bustRange) touching = true;
    }
  }
  if (touching) {
    police.bustTimer += step;
    if (police.bustTimer >= WANTED.bustSeconds) {
      police.bustTimer = 0;
      state.busted = true;
      if (state.events != null) state.events |= 64; // BUSTED
    }
  } else {
    police.bustTimer = 0;
  }
  void clamp;
}

// Alias for callers that use the update* naming.
export const updatePolice = stepPolice;

export default {
  createPolice,
  stepPolice,
  updatePolice,
  cruisersWanted,
  POLICE_LABEL,
};
