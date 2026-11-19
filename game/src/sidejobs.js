// sidejobs.js — two side activities, always available:
// - Taxi fares: while driving, a waving passenger appears at a roadside
//   point; drive within 60px to pick up, deliver to a random landmark
//   within 45s, payout $80-$150 by distance.
// - Solmar Coins: 12 hidden gold coins at seeded street points; walk or
//   drive over one to collect (+$25 each).

import { clamp } from './util.js';

export const COIN_COUNT = 12;
export const COIN_VALUE = 25;
export const FARE_MIN_PAY = 80;
export const FARE_MAX_PAY = 150;
export const FARE_PICKUP_RANGE = 60;
export const FARE_DELIVER_RANGE = 70;
export const FARE_TIME_LIMIT = 45;

export function createSideJobs(rng, city) {
  const coins = [];
  let guard = 0;
  while (coins.length < COIN_COUNT && guard < 500) {
    guard++;
    const pt = city.randomStreetPoint(rng);
    let ok = true;
    for (const c of coins) {
      if (Math.hypot(c.x - pt.x, c.y - pt.y) < 180) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    coins.push({ x: pt.x, y: pt.y, taken: false, bob: rng.range(0, Math.PI * 2) });
  }
  // If the spread rule starved us, fill the rest without it.
  while (coins.length < COIN_COUNT) {
    const pt = city.randomStreetPoint(rng);
    coins.push({ x: pt.x, y: pt.y, taken: false, bob: rng.range(0, Math.PI * 2) });
  }
  return {
    coins,
    coinsFound: 0,
    fare: null,
    fareTimer: 0,
    fareCooldown: 8 + rng.range(0, 10),
    faresDone: 0,
    faresEarned: 0,
    rng,
  };
}

export function sideJobsText(state) {
  const sj = state.sideJobs;
  if (!sj) return '';
  return 'Coins ' + sj.coinsFound + '/' + sj.coins.length + '  •  Fares $' + sj.faresEarned;
}

export function fareMarker(state) {
  const sj = state.sideJobs;
  if (!sj || !sj.fare) return null;
  const f = sj.fare;
  if (f.stage === 'riding') {
    return { x: f.destX, y: f.destY, r: 40, kind: 'fare', stage: 'riding' };
  }
  return { x: f.x, y: f.y, r: 40, kind: 'fare', stage: 'waiting' };
}

function spawnFare(state, rnd) {
  const city = state.city;
  const p = state.player;
  const rng = state.sideJobs.rng;
  let pick = city.randomStreetPoint(rng);
  // Prefer a pickup a short drive away, not on top of the player.
  for (let i = 0; i < 10; i++) {
    const d = Math.hypot(pick.x - p.x, pick.y - p.y);
    if (d > 200 && d < 900) break;
    pick = city.randomStreetPoint(rng);
  }
  // Any landmark except the island (no road there — it's in the sea).
  const keys = Object.keys(city.landmarks).filter((k) => k !== 'island');
  const destKey = keys[Math.floor(rnd() * keys.length)];
  const dest = city.landmarks[destKey];
  const d = Math.hypot(dest.x - pick.x, dest.y - pick.y);
  const pay = clamp(Math.round(80 + d * 0.045), FARE_MIN_PAY, FARE_MAX_PAY);
  return {
    stage: 'waiting',
    x: pick.x,
    y: pick.y,
    destKey,
    destX: dest.x,
    destY: dest.y,
    destName: dest.name,
    pay,
  };
}

export function stepSideJobs(state, dt) {
  const sj = state.sideJobs;
  if (!sj) return;
  const p = state.player;
  const rng = sj.rng || null;
  const rnd = () => (rng ? rng.next() : Math.random());

  // Coins: walk or drive over one to collect it.
  for (const coin of sj.coins) {
    coin.bob += dt * 2;
    if (coin.taken) continue;
    if (Math.hypot(p.x - coin.x, p.y - coin.y) < 30) {
      coin.taken = true;
      sj.coinsFound += 1;
      state.money = (state.money || 0) + COIN_VALUE;
    }
  }

  // Taxi fares: only while driving.
  if (!sj.fare) {
    if (p.inCar) {
      sj.fareCooldown -= dt;
      if (sj.fareCooldown <= 0) {
        sj.fare = spawnFare(state, rnd);
      }
    }
    return;
  }

  const fare = sj.fare;
  if (fare.stage === 'waiting') {
    if (p.inCar && Math.hypot(p.x - fare.x, p.y - fare.y) < FARE_PICKUP_RANGE) {
      fare.stage = 'riding';
      sj.fareTimer = FARE_TIME_LIMIT;
    }
    return;
  }

  // Riding: beat the clock to the destination.
  sj.fareTimer -= dt;
  if (!p.inCar) {
    // The passenger bails when you leave the car.
    sj.fare = null;
    sj.fareCooldown = 15;
    return;
  }
  if (Math.hypot(p.x - fare.destX, p.y - fare.destY) < FARE_DELIVER_RANGE) {
    state.money = (state.money || 0) + fare.pay;
    sj.faresDone += 1;
    sj.faresEarned += fare.pay;
    sj.fare = null;
    sj.fareCooldown = 20 + rnd() * 20;
    return;
  }
  if (sj.fareTimer <= 0) {
    sj.fare = null;
    sj.fareCooldown = 15;
  }
}
