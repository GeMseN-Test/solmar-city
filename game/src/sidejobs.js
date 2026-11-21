// sidejobs.js — two always-on side activities: Solmar Coins and taxi fares.
// Coins: 12 hidden gold coins at seeded street points, +$25 each.
// Fares: while driving, a waving passenger appears roadside; pick them
// up within 60px, deliver to a landmark within 45s, earn $80–$150.

import { randRange, randInt, pick } from './random.js';
import { dist, clamp } from './util.js';

const COIN_VALUE = 25;
const COIN_COUNT = 12;
const FARE_PICKUP_DIST = 60;
const FARE_TIME_LIMIT = 45;
const FARE_MIN_PAY = 80;
const FARE_MAX_PAY = 150;

export function createSideJobs(rng, city) {
  const coins = [];
  for (let i = 0; i < COIN_COUNT; i += 1) {
    const pt = city.randomStreetPoint(rng);
    coins.push({
      x: clamp(pt.x, 60, 2820),
      y: clamp(pt.y, 60, 2000),
      taken: false,
      bob: randRange(rng, 0, Math.PI * 2),
    });
  }
  return {
    coins,
    coinsFound: 0,
    fare: null,
    fareTimer: 0,
    fareCooldown: randRange(rng, 6, 14),
    faresDone: 0,
    faresEarned: 0,
  };
}

export function sideJobsText(state) {
  const sj = state.sideJobs;
  if (!sj) return 'Coins 0/12  •  Fares $0';
  return 'Coins ' + sj.coinsFound + '/12  •  Fares $' + (sj.faresEarned || 0);
}

export function fareMarker(state) {
  const sj = state.sideJobs;
  if (!sj || !sj.fare) return null;
  if (sj.fare.stage !== 'waiting') return null;
  return { x: sj.fare.x, y: sj.fare.y, r: 40, kind: 'fare' };
}

function pickFareDestination(state, rng) {
  const city = state.city;
  const keys = Object.keys(city.landmarks || {});
  if (keys.length === 0) return null;
  const destKey = pick(rng, keys);
  const lm = city.landmarks[destKey];
  return { destKey, destX: lm.x, destY: lm.y, destName: lm.name };
}

function spawnFare(state) {
  const sj = state.sideJobs;
  const p = state.player;
  const city = state.city;
  const rng = state.rng;
  if (!sj || !p || !city || !rng) return;
  // Passenger waits at a roadside point ahead of the driving player.
  const ahead = 260 + rng.next() * 320;
  const px = p.x + Math.cos(p.angle || 0) * ahead;
  const py = p.y + Math.sin(p.angle || 0) * ahead;
  const road = city.nearestRoadPoint ? city.nearestRoadPoint(px, py) : { x: px, y: py };
  const dest = pickFareDestination(state, rng);
  if (!dest) return;
  const d = dist(road.x, road.y, dest.destX, dest.destY);
  const pay = Math.round(clamp(FARE_MIN_PAY + d / 28, FARE_MIN_PAY, FARE_MAX_PAY));
  sj.fare = {
    stage: 'waiting',
    x: clamp(road.x, 60, 2820),
    y: clamp(road.y, 60, 2000),
    destKey: dest.destKey,
    destX: dest.destX,
    destY: dest.destY,
    destName: dest.destName,
    pay,
  };
  sj.fareTimer = 0;
}

export function stepSideJobs(state, dt) {
  const total = Math.max(0.001, dt || 0.016);
  const n = Math.max(1, Math.ceil(total / 0.05));
  const sub = total / n;
  for (let i = 0; i < n; i += 1) stepSideJobsOnce(state, sub);
}

function stepSideJobsOnce(state, step) {
  const sj = state.sideJobs;
  const p = state.player;
  if (!sj || !p) return;

  // Coins bob gently; walking or driving over one collects it.
  for (const coin of sj.coins) {
    coin.bob += step * 2;
    if (coin.taken) continue;
    if (dist(p.x, p.y, coin.x, coin.y) < 28) {
      coin.taken = true;
      sj.coinsFound += 1;
      state.money = (state.money || 0) + COIN_VALUE;
    }
  }

  const driving = !!p.inCar;
  if (!sj.fare) {
    // A fare only spawns while driving, after the cooldown.
    sj.fareCooldown -= step;
    if (driving && sj.fareCooldown <= 0) spawnFare(state);
    return;
  }

  const fare = sj.fare;
  if (fare.stage === 'waiting') {
    if (dist(p.x, p.y, fare.x, fare.y) < FARE_PICKUP_DIST) {
      fare.stage = 'riding';
      sj.fareTimer = FARE_TIME_LIMIT;
    }
    return;
  }

  // Riding: the clock runs down; reach the destination in time.
  sj.fareTimer -= step;
  if (sj.fareTimer <= 0) {
    sj.fare = null;
    sj.fareCooldown = randRange(state.rng, 8, 18);
    return;
  }
  if (dist(p.x, p.y, fare.destX, fare.destY) < 60) {
    state.money = (state.money || 0) + fare.pay;
    sj.faresDone += 1;
    sj.faresEarned += fare.pay;
    sj.fare = null;
    sj.fareCooldown = randRange(state.rng, 10, 22);
  }
  void randInt;
}

export default { createSideJobs, stepSideJobs, sideJobsText, fareMarker };
