// sidejobs.js — the money on the side: Solmar Coins and taxi fares.
//
// Two ways to earn outside the story:
//
//   - Solmar Coins: 12 gold coins hidden on the streets. Walk or
//     drive over one and it is yours (+$25). They bob gently so they
//     catch the eye; the HUD counts them.
//   - Taxi fares: get behind the wheel and a passenger will flag you
//     down after a few seconds. Pick them up, then reach the
//     destination they name within 45 seconds. The longer the ride,
//     the bigger the pay ($80-$150). Step out of the car mid-ride and
//     the passenger walks away — the fare is lost.
//
//   createSideJobs(rng, city) -> { coins, coinsFound, fare,
//                                  fareTimer, fareCooldown,
//                                  faresDone, faresEarned }
//   fareMarker(state) -> { x, y, r, kind: 'fare' } | null
//   sideJobsText(state) -> 'Coins n/12 • Fares $N'
//   stepSideJobs(state, dt) -> 'coin' | 'fare' | null

import { distanceBetween } from './util.js';

const COIN_COUNT = 12;
const COIN_VALUE = 25;
const COIN_RANGE = 30;
const FIRST_FARE_COOLDOWN = 6;
const FARE_COOLDOWN_MIN = 8;
const FARE_COOLDOWN_MAX = 15;
const FARE_PICKUP_RANGE = 60;
const FARE_DELIVERY_RANGE = 90;
const FARE_TIME_LIMIT = 45;
const FARE_PAY_MIN = 80;
const FARE_PAY_MAX = 150;
const WAITING_MARKER_RADIUS = 40;
const RIDING_MARKER_RADIUS = 90;

// The places a passenger can ask for. Gull Island is left out —
// no road leads there, and a cab cannot swim.
const FARE_DESTINATIONS = ['garage', 'safehouse', 'bank', 'turf', 'docks', 'marina', 'radio'];

export function createSideJobs(rng, city) {
  const coins = [];
  for (let i = 0; i < COIN_COUNT; i++) {
    const spot = city.randomStreetPoint(rng);
    coins.push({
      x: spot.x,
      y: spot.y,
      taken: false,
      bob: rng.next() * Math.PI * 2,
    });
  }
  return {
    coins,
    coinsFound: 0,
    fare: null,
    fareTimer: 0,
    fareCooldown: FIRST_FARE_COOLDOWN,
    faresDone: 0,
    faresEarned: 0,
  };
}

// Where the current fare is drawn: the waiting passenger's corner,
// or the destination ring once they are in the cab.
export function fareMarker(state) {
  const fare = state.sideJobs.fare;
  if (!fare) return null;
  if (fare.stage === 'waiting') {
    return { x: fare.x, y: fare.y, r: WAITING_MARKER_RADIUS, kind: 'fare' };
  }
  return { x: fare.destX, y: fare.destY, r: RIDING_MARKER_RADIUS, kind: 'fare' };
}

export function sideJobsText(state) {
  const jobs = state.sideJobs;
  return `Coins ${jobs.coinsFound}/${jobs.coins.length}  •  Fares $${jobs.faresEarned}`;
}

export function stepSideJobs(state, dt) {
  const jobs = state.sideJobs;
  const player = state.player;

  // Coins bob on their street corners; step on one to pocket it.
  for (const coin of jobs.coins) {
    coin.bob += dt * 2;
    if (
      !coin.taken &&
      distanceBetween(player.x, player.y, coin.x, coin.y) < COIN_RANGE
    ) {
      coin.taken = true;
      jobs.coinsFound += 1;
      state.money += COIN_VALUE;
      return 'coin';
    }
  }

  // No cab, no fares: a passenger only flags down a moving car.
  if (!player.inCar) {
    if (jobs.fare && jobs.fare.stage === 'riding') {
      // Stepped out mid-ride: the passenger leaves and the fare dies.
      jobs.fare = null;
      jobs.fareCooldown = nextFareCooldown(state);
    }
    return null;
  }

  if (!jobs.fare) {
    jobs.fareCooldown -= dt;
    if (jobs.fareCooldown <= 0) {
      jobs.fare = spawnFare(state);
    }
    return null;
  }

  const fare = jobs.fare;
  if (fare.stage === 'waiting') {
    if (distanceBetween(player.x, player.y, fare.x, fare.y) < FARE_PICKUP_RANGE) {
      fare.stage = 'riding';
      fare.pay = farePay(state, fare);
      fareTimerReset(jobs);
    }
    return null;
  }

  // Riding: the clock runs, and the ring at the destination pays out.
  jobs.fareTimer += dt;
  if (jobs.fareTimer > FARE_TIME_LIMIT) {
    jobs.fare = null;
    jobs.fareCooldown = nextFareCooldown(state);
    return null;
  }
  if (distanceBetween(player.x, player.y, fare.destX, fare.destY) < FARE_DELIVERY_RANGE) {
    state.money += fare.pay;
    jobs.faresDone += 1;
    jobs.faresEarned += fare.pay;
    jobs.fare = null;
    jobs.fareCooldown = nextFareCooldown(state);
    return 'fare';
  }
  return null;
}

// A passenger appears at a street corner and names a landmark.
function spawnFare(state) {
  const rng = state.rng;
  const city = state.city;
  const spot = city.randomStreetPoint(rng);
  const dest = pickDestination(state, spot);
  return {
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

// Pick a landmark that is not the one the passenger is standing at.
function pickDestination(state, spot) {
  const landmarks = state.city.landmarks;
  const options = FARE_DESTINATIONS.map((key) => landmarks[key]).filter(Boolean);
  let best = options[0];
  let bestDist = -1;
  for (const option of options) {
    const dist = distanceBetween(spot.x, spot.y, option.x, option.y);
    if (dist > bestDist) {
      best = option;
      bestDist = dist;
    }
  }
  // Shuffle the choice a little so every ride is not the same trip.
  const shuffled = options[Math.floor(state.rng.next() * options.length)];
  return distanceBetween(spot.x, spot.y, shuffled.x, shuffled.y) > 400 ? shuffled : best;
}

// Longer ride, bigger pay, clamped to the taxi meter's range.
function farePay(state, fare) {
  const dist = distanceBetween(fare.x, fare.y, fare.destX, fare.destY);
  const pay = FARE_PAY_MIN + (dist / 2400) * (FARE_PAY_MAX - FARE_PAY_MIN);
  return Math.round(Math.max(FARE_PAY_MIN, Math.min(FARE_PAY_MAX, pay)));
}

function fareTimerReset(jobs) {
  jobs.fareTimer = 0;
}

function nextFareCooldown(state) {
  return FARE_COOLDOWN_MIN + state.rng.next() * (FARE_COOLDOWN_MAX - FARE_COOLDOWN_MIN);
}
