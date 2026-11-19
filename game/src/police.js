// Standard police: cruisers + foot cops. They chase the player when
// wanted, ram the player's car, and bust the player on foot after
// holding them close for bustSeconds. Roadblock cars (roadblock: true)
// are parked — stepPolice never moves them; police2 owns them.
import { WANTED, CAR } from './config.js';
import { clamp, dist, angleDiff, turnToward } from './util.js';
import { randRange, pick } from './random.js';

const COP_SKINS = ['#e8b98a', '#c98d5f', '#8a5a3b'];

export function createPolice() {
  return {
    cars: [],
    cops: [],
    bustTimer: 0,
    siren: false,
  };
}

export function createPoliceState() {
  return createPolice();
}

function spawnCruiser(state, x, y) {
  const car = {
    kind: 'police',
    x,
    y,
    angle: 0,
    speed: 0,
    cruise: 430,
    color: '#1c2733',
    model: 'cruiser',
    roadblock: false,
    ramCooldown: 0,
  };
  state.police.cars.push(car);
  return car;
}

function spawnCop(state, x, y) {
  const cop = {
    x,
    y,
    angle: 0,
    speed: 165,
    skin: pick(state.rng || Math.random, COP_SKINS),
    bustHold: 0,
  };
  state.police.cops.push(cop);
  return cop;
}

// Keep the number of police units roughly matched to the wanted level.
function ensureUnits(state) {
  const wanted = state.wanted || 0;
  const p = state.player;
  if (!p) return;
  const wantCruisers = wanted >= 1 ? Math.min(3, 1 + Math.floor(wanted / 2)) : 0;
  const wantCops = wanted >= 1 ? Math.min(4, wanted) : 0;
  const liveCruisers = state.police.cars.filter((c) => !c.roadblock);
  while (liveCruisers.length < wantCruisers) {
    const a = randRange(state.rng || Math.random, 0, Math.PI * 2);
    const r = randRange(state.rng || Math.random, 420, 620);
    const car = spawnCruiser(state, clamp(p.x + Math.cos(a) * r, 40, 2840), clamp(p.y + Math.sin(a) * r, 40, 2000));
    liveCruisers.push(car);
  }
  while (state.police.cops.length < wantCops) {
    const a = randRange(state.rng || Math.random, 0, Math.PI * 2);
    const r = randRange(state.rng || Math.random, 160, 320);
    spawnCop(state, clamp(p.x + Math.cos(a) * r, 40, 2840), clamp(p.y + Math.sin(a) * r, 40, 2000));
  }
}

// One police frame. Returns nothing; sets state.busted when caught.
export function stepPolice(state, dt) {
  const police = state.police;
  const p = state.player;
  if (!police || !p) return;
  const wanted = state.wanted || 0;

  if (wanted <= 0) {
    // Stand down: cruisers slow to a stop, cops wander off.
    for (const car of police.cars) {
      if (car.roadblock) continue;
      car.speed = Math.max(0, car.speed - 300 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
    }
    police.cops.length = 0;
    police.bustTimer = 0;
    police.siren = false;
    return;
  }

  ensureUnits(state);
  police.siren = true;
  const rng = state.rng || Math.random;

  // --- Cruisers chase and ram ---
  for (const car of police.cars) {
    if (car.roadblock) continue; // parked roadblock, owned by police2
    car.ramCooldown = Math.max(0, car.ramCooldown - dt);
    const d = dist(car.x, car.y, p.x, p.y);
    const want = Math.atan2(p.y - car.y, p.x - car.x);
    // Lead the player slightly when they are moving fast.
    const lead = p.inCar && p.car ? 0.35 : 0;
    const aim = want + angleDiff(want, Math.atan2(p.y + Math.sin(p.angle) * 80 * lead - car.y, p.x + Math.cos(p.angle) * 80 * lead - car.x)) * 0;
    void aim;
    car.angle = turnToward(car.angle, want, 2.4 * dt);
    const targetSpeed = d > 900 ? car.cruise * 1.05 : car.cruise;
    car.speed += (targetSpeed - car.speed) * Math.min(1, 1.4 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (state.city) state.city.resolveCircle(car, 20);

    // Ram: bump the player's car / hurt the player on foot.
    if (d < 52 && car.ramCooldown <= 0) {
      car.ramCooldown = 0.9;
      if (p.inCar && p.car) {
        p.car.speed *= 0.55;
        p.car.x += Math.cos(car.angle) * 26;
        p.car.y += Math.sin(car.angle) * 26;
        state.crashEvent = (state.crashEvent || 0) + 1;
      } else {
        p.hp -= CAR.ramDamage;
        p.x += Math.cos(car.angle) * 30;
        p.y += Math.sin(car.angle) * 30;
      }
    }
  }

  // --- Foot cops chase and bust ---
  let nearestCopD = Infinity;
  for (const cop of police.cops) {
    const d = dist(cop.x, cop.y, p.x, p.y);
    nearestCopD = Math.min(nearestCopD, d);
    const want = Math.atan2(p.y - cop.y, p.x - cop.x);
    cop.angle = turnToward(cop.angle, want, 6 * dt);
    const spd = cop.speed * (p.inCar ? 1 : 1);
    if (d > 26) {
      cop.x += Math.cos(cop.angle) * spd * dt;
      cop.y += Math.sin(cop.angle) * spd * dt;
    }
    if (state.city) state.city.resolveCircle(cop, 10);
  }

  // Bust: a cop must hold the player close on foot for bustSeconds.
  if (!p.inCar && !p.inBoat && nearestCopD < 34) {
    police.bustTimer += dt;
    if (police.bustTimer >= WANTED.bustSeconds) {
      state.busted = true;
      police.bustTimer = 0;
    }
  } else {
    police.bustTimer = Math.max(0, police.bustTimer - dt * 2);
  }

  // Prune cruisers that fell far behind (keeps the chase tight).
  if (police.cars.length > 6) {
    police.cars = police.cars.filter((c) => c.roadblock || dist(c.x, c.y, p.x, p.y) < 1400);
    state.police.cars = police.cars;
  }
  void rng;
}

export default createPolice;
