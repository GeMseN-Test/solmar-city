// sidejobs.js — two side activities, always available:
// taxi fares (while driving) + 12 hidden Solmar Coins (+$25 each).
import { COIN_COUNT, COIN_VALUE, FARE_MIN_PAY, FARE_MAX_PAY, FARE_TIME_LIMIT, FARE_PICKUP_RADIUS } from './config.js';
import { randRange, randInt, pick } from './random.js';
import { dist } from './util.js';

export function createSideJobs(rng, city) {
  const rand = typeof rng === 'function' ? rng : Math.random;
  const coins = [];
  for (let i = 0; i < COIN_COUNT; i++) {
    const pt = city.randomStreetPoint(rand);
    coins.push({ x: pt.x, y: pt.y, taken: false, bob: randRange(rand, 0, Math.PI * 2) });
  }
  return {
    coins,
    coinsFound: 0,
    fare: null,
    fareTimer: 0,
    fareCooldown: randRange(rand, 8, 20),
    faresDone: 0,
    faresEarned: 0,
  };
}

export function sideJobsText(state) {
  const sj = state.sideJobs;
  if (!sj) return 'Coins 0/12  •  Fares $0';
  return 'Coins ' + sj.coinsFound + '/' + COIN_COUNT + '  •  Fares $' + (sj.faresEarned || 0);
}

export function fareMarker(state) {
  const sj = state.sideJobs;
  if (!sj || !sj.fare) return null;
  const f = sj.fare;
  if (f.stage === 'waiting') return { x: f.x, y: f.y, r: 40, kind: 'fare' };
  return { x: f.destX, y: f.destY, r: 40, kind: 'fare-dest' };
}

function spawnFare(state, rng) {
  const city = state.city;
  const p = state.player;
  const rand = typeof rng === 'function' ? rng : Math.random;
  const pt = city.randomStreetPoint(rand);
  const landmarks = Object.values(city.landmarks).filter((lm) => lm.y < 2100);
  const dest = pick(rand, landmarks);
  const d = dist(pt.x, pt.y, dest.x, dest.y);
  const pay = Math.round(Math.min(FARE_MAX_PAY, Math.max(FARE_MIN_PAY, 80 + d / 25)));
  state.sideJobs.fare = {
    stage: 'waiting', x: pt.x, y: pt.y,
    destKey: dest.key, destX: dest.x, destY: dest.y, destName: dest.name,
    pay, timer: FARE_TIME_LIMIT,
  };
}

export function stepSideJobs(state, dt) {
  const sj = state.sideJobs;
  if (!sj) return;
  const p = state.player;
  if (!p) return;
  let remaining = dt;
  while (remaining > 0) {
    const h = Math.min(remaining, 0.05);
    remaining -= h;
    // Coins: walk or drive over one to collect.
    for (const coin of sj.coins) {
      if (coin.taken) continue;
      coin.bob += h * 3;
      if (dist(p.x, p.y, coin.x, coin.y) < 30) {
        coin.taken = true;
        sj.coinsFound += 1;
        state.money = (state.money || 0) + COIN_VALUE;
        state.lastCoinAt = state.playTime || 0;
      }
    }
    // Taxi fare: spawns while driving, after a cooldown.
    if (!sj.fare) {
      sj.fareCooldown -= h;
      if (sj.fareCooldown <= 0 && (p.inCar || p.inBoat)) {
        spawnFare(state, state.rng);
      }
      continue;
    }
    const f = sj.fare;
    if (f.stage === 'waiting') {
      if (dist(p.x, p.y, f.x, f.y) < FARE_PICKUP_RADIUS) {
        f.stage = 'riding';
        f.timer = FARE_TIME_LIMIT;
      }
    } else if (f.stage === 'riding') {
      f.timer -= h;
      if (dist(p.x, p.y, f.destX, f.destY) < 60) {
        state.money = (state.money || 0) + f.pay;
        sj.faresDone += 1;
        sj.faresEarned += f.pay;
        sj.fare = null;
        sj.fareCooldown = randRange(state.rng || Math.random, 15, 30);
      } else if (f.timer <= 0) {
        sj.fare = null;
        sj.fareCooldown = randRange(state.rng || Math.random, 10, 20);
      }
    }
  }
}

export function coinsLeft(state) {
  const sj = state.sideJobs;
  if (!sj) return COIN_COUNT;
  return sj.coins.filter((c) => !c.taken).length;
}
export default createSideJobs;
