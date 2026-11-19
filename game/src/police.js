// police.js — cop pursuit + bust.
// One cruiser per wanted star (max 5). Cruisers chase the player; when
// the player is ON FOOT and a cruiser gets close it HOLDS position
// instead of overshooting, and bust pressure builds — bust at 1.6s.
// Roadblock cruisers (roadblock: true) never move; police2 owns them.
// Wanted decay lives in world.stepWanted, never here.

import { WANTED } from './config.js';
import { moveTowardsAngle } from './util.js';

const COP_COLORS = ['#22303e', '#1c2733'];
const BUST_RANGE = 46;
const HOLD_RANGE = 70;
const COP_TOP_SPEED = 520;
const COP_ACCEL = 560;

export function createPolice() {
  return {
    cars: [],
    bustTimer: 0,
    bustReady: false,
    spawnCooldown: 0,
  };
}

function spawnSpot(state) {
  const city = state.city;
  const player = state.player;
  const a = (state.rng ? state.rng.next() : Math.random()) * Math.PI * 2;
  const px = player.x + Math.cos(a) * 600;
  const py = player.y + Math.sin(a) * 600;
  if (!city || !city.nearestRoadPoint) {
    return { x: px, y: py, angle: Math.atan2(player.y - py, player.x - px) };
  }
  const pt = city.nearestRoadPoint(px, py);
  return { x: pt.x, y: pt.y, angle: Math.atan2(player.y - pt.y, player.x - pt.x) };
}

export function stepPolice(state, dt) {
  const police = state.police;
  const player = state.player;
  const city = state.city;
  const wanted = (state.police && state.police.wanted) || 0;

  if (wanted <= 0) {
    // Heat is off: cruisers leave, bust pressure resets.
    if (police.cars.length > 0) police.cars.length = 0;
    police.bustTimer = 0;
    police.bustReady = false;
    police.spawnCooldown = 0;
    return;
  }

  police.spawnCooldown -= dt;
  const chasers = police.cars.filter((c) => !c.roadblock);
  const want = Math.min(Math.max(wanted, 0), 5);
  if (chasers.length < want && police.spawnCooldown <= 0) {
    const spot = spawnSpot(state);
    if (spot) {
      police.cars.push({
        kind: 'police',
        roadblock: false,
        x: spot.x,
        y: spot.y,
        angle: spot.angle,
        speed: 0,
        color: COP_COLORS[police.cars.length % COP_COLORS.length],
      });
    }
    police.spawnCooldown = 1.5;
  }

  let busting = false;
  for (const cop of police.cars) {
    if (cop.roadblock) continue;
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const d = Math.hypot(dx, dy);
    const onFoot = !player.inCar && !player.inBoat;

    if (onFoot && d < HOLD_RANGE) {
      // Close to an on-foot player: hold position, don't overshoot.
      cop.speed = Math.max(0, cop.speed - COP_ACCEL * 2 * dt);
      if (d > 8) {
        cop.angle = moveTowardsAngle(cop.angle, Math.atan2(dy, dx), 3 * dt);
      }
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
    } else {
      // Pursuit: steer at the player, just under the player's top speed.
      const targetAngle = Math.atan2(dy, dx);
      cop.angle = moveTowardsAngle(cop.angle, targetAngle, 3.0 * dt);
      const targetSpeed = onFoot ? 380 : COP_TOP_SPEED;
      if (cop.speed < targetSpeed) {
        cop.speed = Math.min(targetSpeed, cop.speed + COP_ACCEL * dt);
      } else {
        cop.speed = Math.max(targetSpeed, cop.speed - COP_ACCEL * dt);
      }
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
    }

    if (city && city.resolveCircle) {
      const fixed = city.resolveCircle(cop.x, cop.y, 12);
      cop.x = fixed.x;
      cop.y = fixed.y;
    }

    // Touching the player's car: bounce off instead of pushing through.
    if (player.inCar && d < 44) {
      cop.speed *= 0.4;
    }

    if (onFoot && d < BUST_RANGE) busting = true;
  }

  // Keep cruisers from stacking on one spot.
  for (let i = 0; i < police.cars.length; i++) {
    for (let j = i + 1; j < police.cars.length; j++) {
      const a = police.cars[i];
      const b = police.cars[j];
      if (a.roadblock || b.roadblock) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.01 && d < 50) {
        const push = (50 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }

  // Bust pressure: builds only while a cruiser sits on the on-foot player.
  if (busting) {
    police.bustTimer += dt;
    if (police.bustTimer >= WANTED.bustSeconds) {
      police.bustTimer = WANTED.bustSeconds;
      police.bustReady = true;
    }
  } else {
    police.bustTimer = Math.max(0, police.bustTimer - dt * 2);
    police.bustReady = false;
  }
}
