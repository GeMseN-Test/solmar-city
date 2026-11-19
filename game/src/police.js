// police.js — the wanted system: cruisers that chase and ram,
// foot cops, the bust, and the slow fade of stars once the player
// stays out of trouble. Wanted level itself lives on state.wanted
// (the world owns it); this module reads it, spawns the right
// number of cruisers, and decays it after a quiet spell.

import { WANTED, CAR } from './config.js';
import { clamp, dist } from './util.js';

export function createPolice() {
  return {
    cars: [],
    cops: [],
    bustTimer: 0,
    spawnTimer: 0,
    quietTimer: 0,
    decayTimer: 0,
    lastWanted: 0,
  };
}

// Add stars (clamped to the max of 5). Returns the new level.
export function addWanted(state, n) {
  state.wanted = clamp((state.wanted || 0) + n, 0, WANTED.max);
  if (state.police) {
    state.police.quietTimer = 0;
    state.police.decayTimer = 0;
  }
  return state.wanted;
}

export function clearWanted(state) {
  state.wanted = 0;
  if (state.police) {
    state.police.bustTimer = 0;
    state.police.quietTimer = 0;
    state.police.decayTimer = 0;
  }
}

function spawnCruiser(state, rng) {
  const player = state.player;
  const angle = rng ? rng() * Math.PI * 2 : Math.random() * Math.PI * 2;
  const radius = 520 + (rng ? rng() * 260 : Math.random() * 260);
  const car = {
    kind: 'police',
    x: clamp(player.x + Math.cos(angle) * radius, 40, 2840),
    y: clamp(player.y + Math.sin(angle) * radius, 40, 2060),
    angle: Math.atan2(player.y - (player.y + Math.sin(angle) * radius), player.x - (player.x + Math.cos(angle) * radius)),
    speed: 0,
    cruise: 420,
    color: '#1a1a2e',
    model: 'police',
    roadblock: false,
    ramCooldown: 0,
  };
  car.angle = Math.atan2(player.y - car.y, player.x - car.x);
  return car;
}

// One police frame. Returns nothing; the world reads events off
// state (busted is signalled by state.busted / the BUSTED bit the
// world sets when bustTimer passes bustSeconds).
export function stepPolice(state, dt) {
  let remaining = dt;
  while (remaining > 0) {
    const chunk = Math.min(remaining, 0.05);
    stepPoliceOnce(state, chunk);
    remaining -= chunk;
  }
}

function stepPoliceOnce(state, dt) {
  const step = Math.min(dt, 0.05);
  const police = state.police;
  if (!police) return;
  const player = state.player;
  if (!player) return;
  const wanted = state.wanted || 0;

  // Wanted decay lives in ONE place only: world.stepWanted (world.js).
  // This module only READS state.wanted — it must never decrement it,
  // or stars would melt twice as fast (double decay).
  police.lastWanted = wanted;
  if (wanted <= 0) {
    police.quietTimer = 0;
    police.decayTimer = 0;
  }

  // Keep one cruiser per star on the road (roadblock cruisers,
  // owned by police2, count toward the total too).
  const cruising = police.cars.filter((c) => !c.roadblock);
  const target = wanted;
  police.spawnTimer -= step;
  if (cruising.length < target && police.spawnTimer <= 0) {
    police.spawnTimer = 1.2;
    const rng = state.rng;
    police.cars.push(spawnCruiser(state, rng));
  }
  if (wanted === 0) {
    // No heat: cruisers peel off and despawn once they are far.
    for (let i = police.cars.length - 1; i >= 0; i--) {
      const car = police.cars[i];
      if (car.roadblock) continue;
      const d = dist(car.x, car.y, player.x, player.y);
      if (d > 1100) police.cars.splice(i, 1);
    }
  }

  // Chase: steer at the player, ram on contact, and start the bust
  // clock when a cruiser sits on top of the player.
  let touching = false;
  for (const car of police.cars) {
    if (car.roadblock) continue; // parked roadblocks never move.
    if (car.ramCooldown > 0) car.ramCooldown -= step;
    const d = dist(car.x, car.y, player.x, player.y);
    if (d < WANTED.copChaseRadius || wanted > 0) {
      const targetAngle = Math.atan2(player.y - car.y, player.x - car.x);
      let diff = targetAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += clamp(diff, -2.6 * step, 2.6 * step);
      car.speed += (car.cruise - car.speed) * Math.min(1, 1.4 * step);
    } else {
      car.speed += (0 - car.speed) * Math.min(1, 1.4 * step);
    }
    car.x += Math.cos(car.angle) * car.speed * step;
    car.y += Math.sin(car.angle) * car.speed * step;
    car.x = clamp(car.x, 16, 2864);
    car.y = clamp(car.y, 16, 2096);
    if (d < 34) {
      touching = true;
      if (car.ramCooldown <= 0 && player.hp > 0 && (!player.invuln || player.invuln <= 0)) {
        car.ramCooldown = 1.0;
        player.hp -= CAR.ramDamage;
        if (state.audio) state.audio.crash(0.7);
      }
    }
  }

  // Bust: a cruiser parked on the player for bustSeconds ends the run.
  if (touching && wanted > 0 && player.hp > 0) {
    police.bustTimer += step;
    if (police.bustTimer >= WANTED.bustSeconds) {
      police.bustTimer = 0;
      state.busted = true;
    }
  } else {
    police.bustTimer = 0;
  }

  // Foot cops: one per two stars, they shuffle toward the player
  // on foot and give up beyond chase range. Kept small on purpose.
  const wantCops = Math.floor(wanted / 2);
  while (police.cops.length < wantCops) {
    const a = Math.random() * Math.PI * 2;
    police.cops.push({
      x: clamp(player.x + Math.cos(a) * 420, 40, 2840),
      y: clamp(player.y + Math.sin(a) * 420, 40, 2060),
      angle: a,
      speed: 150,
    });
  }
  while (police.cops.length > wantCops) police.cops.pop();
  for (const cop of police.cops) {
    const d = dist(cop.x, cop.y, player.x, player.y);
    if (d > WANTED.copChaseRadius) continue;
    const a = Math.atan2(player.y - cop.y, player.x - cop.x);
    cop.angle = a;
    cop.x += Math.cos(a) * cop.speed * step;
    cop.y += Math.sin(a) * cop.speed * step;
  }
}

export default createPolice;
