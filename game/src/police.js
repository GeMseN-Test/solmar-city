// The law: police cruisers that chase and ram, foot cops that close in
// and bust the player, and a wanted level that fades once the player is
// clear of every cruiser and cop for a while.
import { WANTED } from './config.js';
import { clampNumber } from './util.js';

const COP_SPEED = 205;
const BUST_RADIUS = 28;
const RAM_RADIUS = 30;
const RAM_DAMAGE = 9;
const RAM_MIN_SPEED = 60;
const QUIET_RADIUS = 500;
const CRUISER_COLOR = '#22375e';
const COP_SHIRT = '#22375e';
const COP_SKIN = '#f0c8a0';

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

// Raise the heat and reset the "laying low" clock.
export function addWanted(state, amount) {
  state.wanted = Math.min(WANTED.max, (state.wanted || 0) + amount);
  state.police.quietTime = 0;
}

// A road point a little way from the player, for spawning a cruiser.
function spawnSpot(state) {
  const city = state.city;
  const player = state.player;
  for (let tries = 0; tries < 12; tries++) {
    const p = city.randomStreetPoint(state.rng);
    const d = Math.hypot(p.x - player.x, p.y - player.y);
    if (d > 380 && d < 750) return p;
  }
  return city.randomStreetPoint(state.rng);
}

function makeCruiser(state, spot) {
  const rng = state.rng;
  return {
    kind: 'police',
    x: spot.x,
    y: spot.y,
    angle: 0,
    speed: 60,
    color: CRUISER_COLOR,
    model: 'police',
    lightPhase: rng ? rng.range(0, Math.PI * 2) : Math.random() * Math.PI * 2,
    ramCooldown: 0,
    recover: 0,
    stuckTime: 0,
  };
}

function makeCop(state) {
  const player = state.player;
  const rng = state.rng;
  const angle = rng ? rng.range(0, Math.PI * 2) : Math.random() * Math.PI * 2;
  const dist = rng ? rng.range(220, 420) : 300;
  return {
    x: clampNumber(player.x + Math.cos(angle) * dist, 40, 2840),
    y: clampNumber(player.y + Math.sin(angle) * dist, 40, 2120),
    angle: 0,
    speed: COP_SPEED,
    shirt: COP_SHIRT,
    skin: COP_SKIN,
  };
}

// One police tick. Returns { busted, rammed } — the world turns those
// into the BUSTED event and the crash sound.
export function stepPolice(state, dt) {
  const police = state.police;
  const player = state.player;
  const city = state.city;
  let busted = false;
  let rammed = false;

  // Laying low: the wanted level only starts fading once no cruiser or
  // cop is anywhere near the player.
  const nearLaw = police.cars.some((c) => Math.hypot(c.x - player.x, c.y - player.y) < QUIET_RADIUS)
    || police.cops.some((c) => Math.hypot(c.x - player.x, c.y - player.y) < QUIET_RADIUS);
  if (nearLaw) {
    police.quietTime = 0;
    police.decayTimer = 0;
  } else if (state.wanted > 0) {
    police.quietTime += dt;
    if (police.quietTime > WANTED.decayDelay) {
      police.decayTimer += dt;
      if (police.decayTimer >= WANTED.decayEvery) {
        police.decayTimer = 0;
        state.wanted = Math.max(0, state.wanted - 1);
      }
    }
  }

  const level = state.wanted || 0;

  // No heat, no police: everyone drives off.
  if (level === 0) {
    police.cars = [];
    police.cops = [];
    police.bustProgress = 0;
    return { busted: false, rammed: false };
  }

  // Keep the right number of cruisers on the road (roadblock cruisers,
  // parked by police2, are not ours to count or move).
  const chaseCars = police.cars.filter((c) => !c.roadblock);
  const wantCars = level + 1;
  while (chaseCars.length < wantCars) {
    const car = makeCruiser(state, spawnSpot(state));
    police.cars.push(car);
    chaseCars.push(car);
  }
  while (chaseCars.length > wantCars) {
    const extra = chaseCars.pop();
    const at = police.cars.indexOf(extra);
    if (at >= 0) police.cars.splice(at, 1);
  }

  // And the right number of foot cops.
  while (police.cops.length < level) police.cops.push(makeCop(state));
  if (police.cops.length > level) police.cops.length = level;

  for (const car of police.cars) {
    car.lightPhase += dt * 6;
    if (car.ramCooldown > 0) car.ramCooldown -= dt;
    if (car.roadblock) continue;
    // Stuck on a building corner: back up and turn around instead of
    // grinding against the wall forever.
    if (car.recover > 0) {
      car.recover -= dt;
      car.speed = -130;
      car.angle += 2.2 * dt;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (city) city.resolveCircle(car, 22);
      continue;
    }
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const dist = Math.hypot(dx, dy);
    const targetAngle = Math.atan2(dy, dx);
    let turn = targetAngle - car.angle;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    const maxTurn = 3.2 * dt;
    car.angle += Math.max(-maxTurn, Math.min(maxTurn, turn));
    const topSpeed = 380 + level * 30;
    car.speed = Math.min(topSpeed, car.speed + 520 * dt);
    const beforeX = car.x;
    const beforeY = car.y;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (city) city.resolveCircle(car, 22);
    const moved = Math.hypot(car.x - beforeX, car.y - beforeY);
    const wanted = Math.abs(car.speed) * dt;
    if (wanted > 2 && moved < 0.5) {
      car.stuckTime = (car.stuckTime || 0) + dt;
      if (car.stuckTime > 0.6) {
        car.stuckTime = 0;
        car.recover = 0.9;
      }
    } else if (car.stuckTime) {
      car.stuckTime = Math.max(0, car.stuckTime - dt);
    }
    // Ram the player on contact — a solid hit, then a short breather.
    if (dist < RAM_RADIUS && car.speed > RAM_MIN_SPEED && car.ramCooldown <= 0) {
      player.hp -= RAM_DAMAGE;
      car.ramCooldown = 1;
      car.speed *= -0.35;
      police.lastRamAt = state.time;
      rammed = true;
    }
  }

  // Foot cops run the player down. Close in on foot long enough and
  // the player is busted.
  let touching = false;
  for (const cop of police.cops) {
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const dist = Math.hypot(dx, dy);
    if (dist < WANTED.copChaseRadius) {
      cop.angle = Math.atan2(dy, dx);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
    }
    if (city) city.resolveCircle(cop, 11);
    if (dist < BUST_RADIUS && !player.inCar && !player.inBoat) touching = true;
  }
  if (touching) {
    police.bustProgress += dt;
    if (police.bustProgress >= WANTED.bustSeconds) {
      police.bustProgress = 0;
      busted = true;
    }
  } else if (police.bustProgress > 0) {
    police.bustProgress = Math.max(0, police.bustProgress - dt * 2);
  }

  return { busted, rammed };
}
