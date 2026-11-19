// Police pursuit for Solmar City. Cop cruisers spawn on the roads
// and chase the player; on foot, a cop that stays close long enough
// busts the player. Two rules:
//   - Wanted level is READ-ONLY here. world.js owns stars, decay and
//     all wanted changes; this module only reads state.wanted.
//   - Roadblock cruisers (roadblock: true, owned by police2.js) are
//     never moved, never removed and never counted as chasers here.

import { COP_CHASE_RADIUS, BUST_SECONDS, WANTED_MAX } from './config.js';
import { clamp, dist, wrapAngle, angleDiff } from './util.js';

export function createPolice() {
  return {
    cars: [],
    spawnTimer: 0,
    bustTimer: 0,
  };
}

function wantedOf(state) {
  if (typeof state.wanted === 'number') return state.wanted;
  if (state.police && typeof state.police.wanted === 'number') return state.police.wanted;
  return 0;
}

function spawnCop(state, rng) {
  const p = state.player;
  const city = state.city;
  // Spawn on a road 350-600px away from the player, preferably
  // behind the direction the player is facing.
  for (let tries = 0; tries < 12; tries++) {
    const pt = city.randomStreetPoint(rng);
    const d = dist(pt.x, pt.y, p.x, p.y);
    if (d > 350 && d < 650) {
      return {
        kind: 'police',
        x: pt.x,
        y: pt.y,
        angle: Math.atan2(p.y - pt.y, p.x - pt.x),
        speed: 0,
        cruise: 430,
        color: '#20242e',
        model: 'cruiser',
        roadblock: false,
      };
    }
  }
  const near = city.nearestRoadPoint(p.x + 420, p.y);
  return {
    kind: 'police',
    x: near.x,
    y: near.y,
    angle: Math.atan2(p.y - near.y, p.x - near.x),
    speed: 0,
    cruise: 430,
    color: '#20242e',
    model: 'cruiser',
    roadblock: false,
  };
}

// One police tick. Chasers steer toward the player and ram the
// player's car; on foot they close in for the bust. Sets
// state.busted = true once the bust timer fills — world.step turns
// that into the BUSTED event.
export function stepPolice(state, dt) {
  const police = state.police;
  const p = state.player;
  const city = state.city;
  const rng = state.rng;
  const wanted = clamp(wantedOf(state), 0, WANTED_MAX);
  if (!police || !p || !city) return;

  police.spawnTimer -= dt;

  // Desired chaser count follows the wanted level; roadblocks don't
  // count (police2 owns them) and are never culled here.
  const chasers = police.cars.filter((c) => !c.roadblock);
  const wantChasers = wanted === 0 ? 0 : Math.min(wanted, 4);
  if (chasers.length < wantChasers && police.spawnTimer <= 0) {
    police.cars.push(spawnCop(state, rng));
    police.spawnTimer = 1.2;
  } else if (chasers.length > wantChasers) {
    const idx = police.cars.findIndex((c) => !c.roadblock);
    if (idx >= 0) police.cars.splice(idx, 1);
  }

  let busting = false;
  for (const cop of police.cars) {
    if (cop.roadblock) continue;
    const d = dist(cop.x, cop.y, p.x, p.y);
    if (d > COP_CHASE_RADIUS + 400) {
      // Lost the trail: reposition closer instead of driving forever.
      const near = city.nearestRoadPoint(p.x + 380, p.y);
      cop.x = near.x;
      cop.y = near.y;
      cop.speed = 0;
      continue;
    }
    const cruise = p.inCar ? 520 : 300;
    const wantAngle = Math.atan2(p.y - cop.y, p.x - cop.x);
    // On foot and already on top of the player: hold still and make
    // the arrest instead of overshooting and circling forever.
    const closeOnFoot = !p.inCar && !p.inBoat && d < 52;
    if (closeOnFoot) {
      cop.speed = Math.max(0, cop.speed - 500 * dt);
    } else {
      cop.angle = wrapAngle(cop.angle + clamp(angleDiff(cop.angle, wantAngle), -2.4 * dt, 2.4 * dt));
      cop.speed += (cruise - cop.speed) * Math.min(1, dt * 0.9);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
    }
    const fixed = city.resolveCircle(cop.x, cop.y, 12);
    cop.x = fixed.x;
    cop.y = clamp(fixed.y, 0, 2010);

    if (!p.inCar && !p.inBoat && d < 46 && p.hp > 0) busting = true;
  }

  if (busting) {
    police.bustTimer += dt;
    if (police.bustTimer >= BUST_SECONDS) {
      state.busted = true;
      police.bustTimer = 0;
    }
  } else {
    police.bustTimer = Math.max(0, police.bustTimer - dt * 2);
  }
}

export default createPolice;
