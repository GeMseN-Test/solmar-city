// The law in Solmar City: a wanted level, police cruisers that chase the
// player down, and foot cops who try to make an arrest. Stars rise when the
// player commits crimes (the world reports them here) and fall when the
// player stays quiet and out of sight for a while.
//
// Police cruisers pursue freely across the map; foot cops run the player
// down and, if they stay close long enough, the run ends in a bust.

import { WANTED } from './config.js';
import { clampNumber, distanceBetween, turnToward } from './util.js';

export function createPolice() {
  return {
    cars: [],
    cops: [],
    quietTime: 0,
    decayTimer: 0,
    bustProgress: 0,
    lastRamAt: -100,
  };
}

export function addWanted(state, stars) {
  if (stars <= 0) return;
  state.wanted = Math.min(WANTED.max, state.wanted + stars);
  state.police.quietTime = 0;
  state.police.decayTimer = 0;
}

function spawnPoliceCar(state) {
  const angle = state.rng.range(0, Math.PI * 2);
  const dist = state.rng.range(420, 640);
  const spot = state.city.nearestRoadPoint(
    state.player.x + Math.cos(angle) * dist,
    state.player.y + Math.sin(angle) * dist,
  );
  const car = {
    kind: 'police',
    x: spot.x,
    y: spot.y,
    angle: Math.atan2(state.player.y - spot.y, state.player.x - spot.x),
    speed: 0,
    color: '#22375e',
    model: 'police',
    lightPhase: state.rng.range(0, Math.PI * 2),
  };
  state.police.cars.push(car);
  return car;
}

function spawnCop(state) {
  const angle = state.rng.range(0, Math.PI * 2);
  const dist = state.rng.range(260, 420);
  const spot = state.city.nearestRoadPoint(
    state.player.x + Math.cos(angle) * dist,
    state.player.y + Math.sin(angle) * dist,
  );
  state.police.cops.push({
    x: spot.x,
    y: spot.y,
    angle: 0,
    speed: 205,
    punchCooldown: 0,
  });
}

export function stepPolice(state, dt) {
  const police = state.police;
  const player = state.player;

  // Numbers on the street scale with the heat.
  const wantedCars = state.wanted === 0 ? 0 : Math.min(3 + (state.wanted >= 4 ? 1 : 0), 1 + state.wanted);
  const wantedCops = state.wanted === 0 ? 0 : Math.min(3, state.wanted);
  while (police.cars.length < wantedCars) spawnPoliceCar(state);
  while (police.cops.length < wantedCops) spawnCop(state);

  // Wanted decay: quiet, unseen, and no cruiser nearby for a while.
  let nearestPolice = Infinity;
  for (const car of police.cars) nearestPolice = Math.min(nearestPolice, distanceBetween(player.x, player.y, car.x, car.y));
  for (const cop of police.cops) nearestPolice = Math.min(nearestPolice, distanceBetween(player.x, player.y, cop.x, cop.y));
  if (state.wanted > 0 && nearestPolice > 460) {
    police.quietTime += dt;
    if (police.quietTime > WANTED.decayDelay) {
      police.decayTimer += dt;
      if (police.decayTimer >= WANTED.decayEvery) {
        state.wanted -= 1;
        police.decayTimer = 0;
        police.quietTime = WANTED.decayDelay;
      }
    }
  } else {
    police.quietTime = 0;
    police.decayTimer = 0;
  }

  const events = { busted: false, rammed: false };

  for (let i = police.cars.length - 1; i >= 0; i -= 1) {
    const car = police.cars[i];
    if (state.wanted === 0 && distanceBetween(player.x, player.y, car.x, car.y) > 700) {
      police.cars.splice(i, 1);
      continue;
    }
    // Roadblock cars are parked, not chasing: they just sit across the
    // road flashing their lights until the heat drops (police2 clears them).
    if (car.roadblock) {
      car.lightPhase += dt * 9;
      continue;
    }
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const dist = Math.hypot(dx, dy);
    const targetAngle = Math.atan2(dy, dx);
    // Cruisers are fast, but the player's car is faster: a clean getaway
    // stays possible, and the chase stays a chase.
    const topSpeed = 420 + state.wanted * 15;
    car.angle = turnToward(car.angle, targetAngle, 2.3 * dt);
    const aligned = Math.abs(((targetAngle - car.angle) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
    // After a ram the cruiser backs off for a second instead of staying
    // glued to the player's bumper and pinning the car to a wall.
    const drive = car.recover > 0 ? 0.25 : 1;
    car.speed = clampNumber(car.speed + (aligned < 0.9 ? 520 : -260) * drive * dt, 0, topSpeed);
    const playerSpeed = player.inCar && player.car ? Math.abs(player.car.speed) : 0;
    if (dist < 80) car.speed = Math.min(car.speed, playerSpeed + 60);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.lightPhase += dt * 9;
    car.ramCooldown = Math.max(0, (car.ramCooldown ?? 0) - dt);
    car.recover = Math.max(0, (car.recover ?? 0) - dt);
    state.city.resolveCircle(car, 20);
    // Never stack on top of the player: a cruiser sits beside its target,
    // not inside it, so a chase reads as two cars, not one blob.
    const pdx = player.x - car.x;
    const pdy = player.y - car.y;
    const pd = Math.hypot(pdx, pdy);
    const minDist = 20 + (player.inCar ? 24 : 12);
    if (pd < minDist && pd > 0.01) {
      const pushOut = minDist - pd;
      car.x -= (pdx / pd) * pushOut;
      car.y -= (pdy / pd) * pushOut;
    }
    // Ram: a cruiser that reaches the player shoves and hurts — one solid
    // hit per cruiser every 1.2 s, so a chase pressures without pinning
    // the player's car to a wall or deleting the health bar in one go.
    const hitRadius = player.inCar ? 34 : 24;
    if (dist < hitRadius + 18 && car.speed > 60 && car.ramCooldown <= 0) {
      car.ramCooldown = 1.2;
      car.recover = 1.0;
      car.speed *= 0.55;
      state.shake = Math.min(14, state.shake + 6);
      addSparks(state, player.x, player.y, 6);
      events.rammed = true;
      // Health and speed damage are throttled across the whole force:
      // at most one solid hit a little over a second, however many
      // cruisers are piling in.
      if (state.time - police.lastRamAt > 1.2) {
        player.hp -= 5;
        police.lastRamAt = state.time;
        if (player.inCar && player.car) player.car.speed *= 0.8;
      }
    }
  }

  // Foot cops: run the player down; stay close and the bust lands.
  let busting = false;
  for (let i = police.cops.length - 1; i >= 0; i -= 1) {
    const cop = police.cops[i];
    if (state.wanted === 0) {
      police.cops.splice(i, 1);
      continue;
    }
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const dist = Math.hypot(dx, dy);
    cop.angle = Math.atan2(dy, dx);
    if (dist > 30) {
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
    }
    state.city.resolveCircle(cop, 10);
    cop.punchCooldown -= dt;
    if (!player.inCar && dist < 30) {
      busting = true;
      if (cop.punchCooldown <= 0) {
        player.hp -= 9;
        cop.punchCooldown = 0.9;
        state.shake = Math.min(10, state.shake + 3);
      }
    }
  }
  if (busting && !player.inCar) {
    police.bustProgress += dt;
    if (police.bustProgress >= WANTED.bustSeconds) {
      events.busted = true;
      police.bustProgress = 0;
    }
  } else {
    police.bustProgress = Math.max(0, police.bustProgress - dt * 2);
  }

  return events;
}

function addSparks(state, x, y, count) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      kind: 'spark',
      x, y,
      vx: state.rng.range(-160, 160),
      vy: state.rng.range(-160, 160),
      life: state.rng.range(0.2, 0.5),
      maxLife: 0.5,
      size: state.rng.range(2, 4),
      color: '#ffd94d',
    });
  }
}
