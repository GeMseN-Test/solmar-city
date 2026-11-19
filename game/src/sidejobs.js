// Side jobs for Solmar City — two activities that are always
// available, no mission needed:
//   - Taxi fares: while driving, a waving passenger appears at a
//     roadside point. Drive within 60px to pick them up, then deliver
//     them to a random landmark within 45s. Payout $80-$150 by
//     distance. (E is busy — pickup is automatic.)
//   - Solmar Coins: 12 hidden gold coins at seeded street points.
//     Walk or drive over one to collect it, +$25 each.
// HUD text comes from sideJobsText(state): "Coins n/12  •  Fares $N".

import {
  COIN_COUNT,
  COIN_VALUE,
  FARE_MIN_PAY,
  FARE_MAX_PAY,
  FARE_TIME_LIMIT,
  FARE_PICKUP_RADIUS,
} from './config.js';
import { dist, clamp } from './util.js';

export function createSideJobs(rng, city) {
  const coins = [];
  for (let i = 0; i < COIN_COUNT; i++) {
    const pt = city.randomStreetPoint(rng);
    coins.push({
      x: pt.x + rng.float(-20, 20),
      y: pt.y + rng.float(-20, 20),
      taken: false,
      bob: rng.float(0, Math.PI * 2),
    });
  }
  return {
    coins,
    coinsFound: 0,
    fare: null,
    fareTimer: 0,
    fareCooldown: 6,
    faresDone: 0,
    faresEarned: 0,
  };
}

export function sideJobsText(state) {
  const sj = state.sideJobs;
  if (!sj) return '';
  return 'Coins ' + sj.coinsFound + '/' + COIN_COUNT + '  •  Fares $' + sj.faresEarned;
}

// Marker for the renderer (waiting passenger / destination), or null.
export function fareMarker(state) {
  const sj = state.sideJobs;
  if (!sj || !sj.fare) return null;
  return { x: sj.fare.x, y: sj.fare.y, r: 40, kind: 'fare' };
}

function farePayFor(distance) {
  const t = clamp(distance / 2400, 0, 1);
  return Math.round(FARE_MIN_PAY + t * (FARE_MAX_PAY - FARE_MIN_PAY));
}

function spawnFare(state, rng) {
  const p = state.player;
  const city = state.city;
  // Passenger waits at a roadside point a short drive ahead.
  let spot = null;
  for (let tries = 0; tries < 10; tries++) {
    const pt = city.randomStreetPoint(rng);
    const d = dist(pt.x, pt.y, p.x, p.y);
    if (d > 180 && d < 900) {
      spot = pt;
      break;
    }
  }
  if (!spot) spot = city.randomStreetPoint(rng);
  const keys = Object.keys(city.landmarks);
  const destKey = rng.pick(keys);
  const dest = city.landmarks[destKey];
  const pay = farePayFor(dist(spot.x, spot.y, dest.x, dest.y));
  return {
    stage: 'waiting',
    x: spot.x,
    y: spot.y,
    destKey,
    destX: dest.x,
    destY: dest.y,
    destName: dest.name,
    pay,
  };
}

// One tick: coin collection, fare spawn / pickup / delivery / expiry.
export function stepSideJobs(state, dt) {
  const sj = state.sideJobs;
  const p = state.player;
  if (!sj || !p) return;

  for (const coin of sj.coins) {
    coin.bob += dt * 3;
    if (!coin.taken && dist(p.x, p.y, coin.x, coin.y) < 26) {
      coin.taken = true;
      sj.coinsFound += 1;
      state.money = (state.money || 0) + COIN_VALUE;
      if (state.events !== undefined) state.events.pickupCoin = true;
    }
  }

  if (sj.fareCooldown > 0) sj.fareCooldown -= dt;

  if (!sj.fare) {
    // Fares only spawn while the player is driving.
    if (p.inCar && sj.fareCooldown <= 0) {
      sj.fare = spawnFare(state, state.rng);
      sj.fareTimer = FARE_TIME_LIMIT;
    }
    return;
  }

  const fare = sj.fare;
  sj.fareTimer -= dt;
  if (sj.fareTimer <= 0) {
    // Passenger gave up waiting.
    sj.fare = null;
    sj.fareCooldown = 8;
    return;
  }

  if (fare.stage === 'waiting') {
    if (p.inCar && dist(p.x, p.y, fare.x, fare.y) < FARE_PICKUP_RADIUS) {
      fare.stage = 'riding';
      fare.x = fare.destX;
      fare.y = fare.destY;
      sj.fareTimer = FARE_TIME_LIMIT;
    }
  } else if (fare.stage === 'riding') {
    if (dist(p.x, p.y, fare.destX, fare.destY) < FARE_PICKUP_RADIUS) {
      state.money = (state.money || 0) + fare.pay;
      sj.faresDone += 1;
      sj.faresEarned += fare.pay;
      sj.fare = null;
      sj.fareCooldown = 10;
      if (state.events !== undefined) state.events.fareDone = true;
    }
  }
}

export default createSideJobs;
