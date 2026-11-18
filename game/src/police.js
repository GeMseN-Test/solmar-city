// police.js — the Solmar PD: cruisers, foot cops, and the wanted level.
//
// The wanted level (0-5 stars) is the heat on Mara. Crimes add stars
// (addWanted); laying low sheds them again, but only once every cop is
// far away — the heat does not fade while a cruiser is on your bumper.
//
// What the PD fields:
//
//   - Cruisers chase the player across the city, fast from far away
//     and slow when they close in to ram. A ram hurts (9) and knocks
//     the cruiser back into a short recovery; it cannot ram again
//     until its cooldown clears.
//   - Foot cops chase on foot. Close up, they punch (9 damage, about
//     once a second) and they build the bust: stand next to a cop long
//     enough and the bust completes (the world step watches
//     bustProgress and ends the run as BUSTED).
//   - Roadblock cruisers (police2) are parked, not driven: stepPolice
//     leaves any car with roadblock: true exactly where it is.
//
//   createPolice() -> { cars: [], cops: [], quietTime, decayTimer,
//                       bustProgress, lastRamAt }
//   addWanted(state, stars)
//   stepPolice(state, dt) -> { busted, rammed } — the world step
//     turns busted into EVENT_BUSTED and rammed into EVENT_CRASH.

import { WANTED } from './config.js';
import { clampNumber, distanceBetween, turnToward } from './util.js';

const POLICE_COLOR = '#22375e';
const POLICE_TOP_SPEED = 450;
const POLICE_CLOSE_SPEED = 60;
const COP_SPEED = 205;
const COP_PUNCH_DAMAGE = 9;
const COP_PUNCH_COOLDOWN = 1.0;
const COP_BUST_RANGE = 30;
const RAM_DAMAGE = 9;
const RAM_RANGE = 34;
const RAM_COOLDOWN = 1.2;
const RECOVER_TIME = 1.0;
const MAX_CARS = 6;
const MAX_COPS = 3;

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

// Add stars for a crime, up to the maximum. Any new heat resets the
// quiet clock: the PD does not start forgetting while you are still
// making noise.
export function addWanted(state, stars) {
  state.wanted = clampNumber(state.wanted + stars, 0, WANTED.max);
  state.police.quietTime = 0;
  state.police.decayTimer = 0;
}

export function stepPolice(state, dt) {
  const police = state.police;
  const player = state.player;
  let rammed = false;

  // Keep the force at the size the heat calls for. Roadblock cruisers
  // belong to police2 and are never counted or moved here.
  const cars = police.cars.filter((car) => !car.roadblock);
  const wantedCars = state.wanted === 0 ? 0 : Math.min(state.wanted + 1, MAX_CARS);
  while (cars.length < wantedCars && state.wanted > 0) {
    const car = spawnCruiser(state);
    if (!car) break;
    police.cars.push(car);
    cars.push(car);
  }
  while (cars.length > wantedCars) {
    const farthest = farthestFrom(cars, player);
    police.cars.splice(police.cars.indexOf(farthest), 1);
    cars.splice(cars.indexOf(farthest), 1);
  }
  const wantedCops = Math.min(state.wanted, MAX_COPS);
  while (police.cops.length < wantedCops && state.wanted > 0) {
    police.cops.push(spawnCop(state));
  }
  while (police.cops.length > wantedCops) {
    const farthest = farthestFrom(police.cops, player);
    police.cops.splice(police.cops.indexOf(farthest), 1);
  }

  // Drive the cruisers, walk the cops, build or fade the bust.
  for (const car of police.cars) {
    if (!car.roadblock && stepCruiser(state, car, dt)) rammed = true;
  }
  let copClose = false;
  for (const cop of police.cops) {
    if (stepCop(state, cop, dt)) copClose = true;
  }
  if (copClose && !player.inCar && !player.inBoat) {
    police.bustProgress += dt * 0.4;
  } else {
    police.bustProgress = Math.max(0, police.bustProgress - dt);
  }

  // Losing the heat: the clock only runs while no unit is close, and
  // the stars come off one at a time after a long quiet stretch.
  const nearest = nearestUnitDistance(state);
  if (nearest === null || nearest > WANTED.copChaseRadius) {
    police.quietTime += dt;
  } else {
    police.quietTime = 0;
    police.decayTimer = 0;
  }
  if (police.quietTime > WANTED.decayDelay) {
    police.decayTimer += dt;
    if (police.decayTimer >= WANTED.decayEvery) {
      police.decayTimer -= WANTED.decayEvery;
      state.wanted = Math.max(0, state.wanted - 1);
    }
  }
  if (state.wanted === 0) {
    police.bustProgress = 0;
  }
  return {
    busted: police.bustProgress >= WANTED.bustSeconds,
    rammed,
  };
}

// A cruiser joins the chase from a road near the player.
function spawnCruiser(state) {
  const player = state.player;
  const city = state.city;
  const rng = state.rng;
  const spot = city.nearestRoadPoint(
    player.x + rng.range(-320, 320),
    player.y + rng.range(-320, 320),
  );
  if (!spot) return null;
  return {
    kind: 'police',
    x: spot.x,
    y: spot.y,
    angle: rng.next() * Math.PI * 2,
    speed: 60,
    color: POLICE_COLOR,
    model: 'police',
    lightPhase: rng.next() * Math.PI * 2,
    ramCooldown: 0,
    recover: 0,
  };
}

// A foot cop joins the chase on the street near the player.
function spawnCop(state) {
  const player = state.player;
  const rng = state.rng;
  return {
    x: player.x + rng.range(-160, 160),
    y: player.y + rng.range(-160, 160),
    angle: rng.next() * Math.PI * 2,
    speed: COP_SPEED,
    punchCooldown: 0,
  };
}

function stepCruiser(state, car, dt) {
  const player = state.player;
  car.lightPhase += dt * 8;
  if (car.ramCooldown > 0) car.ramCooldown -= dt;
  if (car.recover > 0) {
    // Just rammed something: back off and straighten out.
    car.recover -= dt;
    car.speed = Math.max(0, car.speed - 300 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    return false;
  }
  const dist = distanceBetween(car.x, car.y, player.x, player.y);
  // Fast from far away, crawling as they close in for the ram.
  const closeFactor = clampNumber((dist - 120) / 380, 0, 1);
  const targetSpeed = POLICE_CLOSE_SPEED + closeFactor * (POLICE_TOP_SPEED - POLICE_CLOSE_SPEED);
  const gap = targetSpeed - car.speed;
  car.speed = clampNumber(car.speed + clampNumber(gap, -320 * dt, 380 * dt), 0, POLICE_TOP_SPEED);
  const heading = Math.atan2(player.y - car.y, player.x - car.x);
  car.angle = turnToward(car.angle, heading, 3 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  state.city.resolveCircle(car, 22);

  // The ram: close, fast enough, and the cooldown clear.
  if (
    car.ramCooldown <= 0 &&
    car.speed > 60 &&
    distanceBetween(car.x, car.y, player.x, player.y) < RAM_RANGE
  ) {
    player.hp -= RAM_DAMAGE;
    car.ramCooldown = RAM_COOLDOWN;
    car.recover = RECOVER_TIME;
    car.speed *= -0.3;
    state.police.lastRamAt = state.time;
    return true;
  }
  return false;
}

// A foot cop runs the player down. Returns true when the cop is close
// enough to count toward a bust.
function stepCop(state, cop, dt) {
  const player = state.player;
  if (cop.punchCooldown > 0) cop.punchCooldown -= dt;
  const dist = distanceBetween(cop.x, cop.y, player.x, player.y);
  const heading = Math.atan2(player.y - cop.y, player.x - cop.x);
  cop.angle = turnToward(cop.angle, heading, 6 * dt);
  if (dist > 24) {
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    state.city.resolveCircle(cop, 11);
  }
  if (dist < 30 && cop.punchCooldown <= 0 && player.invuln <= 0) {
    player.hp -= COP_PUNCH_DAMAGE;
    cop.punchCooldown = COP_PUNCH_COOLDOWN;
  }
  return dist < COP_BUST_RANGE;
}

function farthestFrom(units, player) {
  let farthest = units[0];
  let farthestDist = -1;
  for (const unit of units) {
    const dist = distanceBetween(unit.x, unit.y, player.x, player.y);
    if (dist > farthestDist) {
      farthest = unit;
      farthestDist = dist;
    }
  }
  return farthest;
}

// Distance to the nearest police unit of any kind, or null when the
// street is empty.
function nearestUnitDistance(state) {
  const player = state.player;
  let nearest = null;
  for (const car of state.police.cars) {
    const dist = distanceBetween(car.x, car.y, player.x, player.y);
    if (nearest === null || dist < nearest) nearest = dist;
  }
  for (const cop of state.police.cops) {
    const dist = distanceBetween(cop.x, cop.y, player.x, player.y);
    if (nearest === null || dist < nearest) nearest = dist;
  }
  return nearest;
}
