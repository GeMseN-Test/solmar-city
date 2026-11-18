// Side work, always available: taxi fares and hidden Solmar Coins.
// Fares: while driving, a waving passenger appears at a roadside point.
// Drive within range to pick them up, then deliver to a landmark in
// time. Coins: twelve gold coins on seeded street points, +$25 each.
import { distanceBetween } from './util.js';

const COIN_COUNT = 12;
const COIN_VALUE = 25;
const COIN_RANGE = 22;
const FARE_PICKUP_RANGE = 60;
const FARE_DELIVER_RANGE = 60;
const FARE_TIME_LIMIT = 45;

export function createSideJobs(rng, city) {
  const coins = [];
  for (let i = 0; i < COIN_COUNT; i++) {
    const p = city.randomStreetPoint(rng);
    coins.push({ x: p.x, y: p.y, taken: false, bob: rng.range(0, Math.PI * 2) });
  }
  return {
    coins,
    coinsFound: 0,
    fare: null,
    fareTimer: 0,
    fareCooldown: rng.range(8, 16),
    faresDone: 0,
    faresEarned: 0,
  };
}

// "Coins n/12  •  Fares $N" for the HUD.
export function sideJobsText(state) {
  const sj = state.sideJobs;
  return `Coins ${sj.coinsFound}/12  •  Fares $${sj.faresEarned}`;
}

// Where the fare passenger (or their destination) is, for the map marker.
export function fareMarker(state) {
  const fare = state.sideJobs.fare;
  if (!fare) return null;
  if (fare.stage === 'waiting') return { x: fare.x, y: fare.y, r: 40, kind: 'fare' };
  return { x: fare.destX, y: fare.destY, r: 40, kind: 'fare' };
}

// A street point a short drive from the player, for a fare pickup.
function nearbyStreetPoint(state) {
  const city = state.city;
  const player = state.player;
  for (let tries = 0; tries < 16; tries++) {
    const p = city.randomStreetPoint(state.rng);
    const d = distanceBetween(p.x, p.y, player.x, player.y);
    if (d > 180 && d < 700) return p;
  }
  return city.randomStreetPoint(state.rng);
}

// A random landmark to deliver to.
function pickFareDestination(state) {
  const landmarks = Object.values(state.city.landmarks);
  const rng = state.rng;
  if (rng) return landmarks[rng.int(0, landmarks.length)];
  return landmarks[0];
}

export function stepSideJobs(state, dt) {
  const sj = state.sideJobs;
  const player = state.player;

  for (const coin of sj.coins) {
    if (coin.taken) continue;
    coin.bob += dt * 2;
    if (distanceBetween(player.x, player.y, coin.x, coin.y) < COIN_RANGE) {
      coin.taken = true;
      sj.coinsFound += 1;
      state.money += COIN_VALUE;
    }
  }

  if (!sj.fare) {
    // Fares only appear while the player is driving.
    if (player.inCar) {
      sj.fareCooldown -= dt;
      if (sj.fareCooldown <= 0) {
        const spot = nearbyStreetPoint(state);
        const dest = pickFareDestination(state);
        sj.fare = {
          stage: 'waiting',
          x: spot.x,
          y: spot.y,
          destKey: dest.key,
          destX: dest.x,
          destY: dest.y,
          destName: dest.name,
          pay: 0,
        };
      }
    }
    return;
  }

  const fare = sj.fare;
  if (fare.stage === 'waiting') {
    // Pickup is automatic — just drive up to the waving passenger.
    if (player.inCar && distanceBetween(player.x, player.y, fare.x, fare.y) < FARE_PICKUP_RANGE) {
      fare.stage = 'riding';
      fare.fareTimer = FARE_TIME_LIMIT;
      const leg = distanceBetween(fare.x, fare.y, fare.destX, fare.destY);
      fare.pay = 80 + Math.min(70, Math.round(leg / 40));
    }
    return;
  }

  fare.fareTimer -= dt;
  if (distanceBetween(player.x, player.y, fare.destX, fare.destY) < FARE_DELIVER_RANGE) {
    // One rider in ten is feeling generous and tips on top of the fare.
    const tip = state.rng && state.rng.chance(0.1) ? 25 : 0;
    state.money += fare.pay + tip;
    sj.faresDone += 1;
    sj.faresEarned += fare.pay + tip;
    sj.fare = null;
    sj.fareCooldown = 12 + (state.rng ? state.rng.range(0, 10) : 5);
    return;
  }
  if (fare.fareTimer <= 0) {
    // Too slow: the passenger gives up and the fare is gone.
    sj.fare = null;
    sj.fareCooldown = 10;
  }
}
