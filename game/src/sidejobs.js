// Solmar City's side work: taxi fares and hidden Solmar Coins. Both run
// alongside the story, need no mission slot, and pay cash — the kind of
// thing a player does between jobs while the city stays alive around them.
//
// Taxi fares: while Mara drives, a passenger waves from a roadside spot.
// Drive within pickup range and the fare starts — a banner names the
// destination and a 45-second clock starts. Arrive in time and the fare
// pays $80–$150 by distance; run out of time and the passenger walks off.
// Coins: twelve gold coins hidden at seeded street points across the city.
// Walk or drive over one to pocket $25. The HUD counts them.

import { distanceBetween } from './util.js';

const COIN_COUNT = 12;
const COIN_VALUE = 25;
const FARE_TIME = 45;
const FARE_MIN = 80;
const FARE_MAX = 150;
const PICKUP_RANGE = 64;
const FARE_SPAWN_EVERY = 14;

/** Twelve coin spots, seeded with the city so every run hides them well. */
export function createSideJobs(rng, city) {
  const coins = [];
  for (let i = 0; i < COIN_COUNT; i += 1) {
    const spot = city.randomStreetPoint(rng);
    coins.push({ x: spot.x, y: spot.y, taken: false, bob: rng.range(0, Math.PI * 2) });
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

/** One line for the HUD: coins found and fares earned so far. */
export function sideJobsText(state) {
  const jobs = state.sideJobs;
  if (!jobs) return '';
  return `Coins ${jobs.coinsFound}/${jobs.coins.length}  •  Fares $${jobs.faresEarned}`;
}

function landmarkKeys(state) {
  return Object.keys(state.city.landmarks);
}

function spawnFare(state) {
  const player = state.player;
  const spot = state.city.nearestRoadPoint(
    player.x + state.rng.range(-500, 500),
    player.y + state.rng.range(-500, 500),
  );
  const keys = landmarkKeys(state);
  let destKey = keys[state.rng.int(0, keys.length - 1)];
  const dest = state.city.landmarks[destKey];
  if (distanceBetween(spot.x, spot.y, dest.x, dest.y) < 300) {
    destKey = 'safehouse';
  }
  const destination = state.city.landmarks[destKey];
  state.sideJobs.fare = {
    stage: 'waiting',
    x: spot.x,
    y: spot.y,
    destKey,
    destX: destination.x,
    destY: destination.y,
    destName: destination.name,
    pay: 0,
  };
}

/**
 * Advance fares and coins one step. Returns a short event label when
 * something paid out ('fare' or 'coin'), or null.
 */
export function stepSideJobs(state, dt) {
  const jobs = state.sideJobs;
  if (!jobs) return null;
  const player = state.player;

  // Coins: pocket any within reach, on foot, in a car or in a boat.
  for (const coin of jobs.coins) {
    if (coin.taken) continue;
    coin.bob += dt * 3;
    if (distanceBetween(player.x, player.y, coin.x, coin.y) < 32) {
      coin.taken = true;
      jobs.coinsFound += 1;
      state.money += COIN_VALUE;
      state.particles.push({
        kind: 'spark', x: coin.x, y: coin.y,
        vx: 0, vy: -40, life: 0.5, maxLife: 0.5, size: 4, color: '#f2c94c',
      });
      return 'coin';
    }
  }

  // Fares only happen while Mara is driving.
  if (!player.inCar) {
    if (jobs.fare && jobs.fare.stage === 'riding') {
      jobs.fare = null;
      jobs.fareCooldown = FARE_SPAWN_EVERY;
    }
    return null;
  }

  if (!jobs.fare) {
    jobs.fareCooldown -= dt;
    if (jobs.fareCooldown <= 0) spawnFare(state);
    return null;
  }

  const fare = jobs.fare;
  if (fare.stage === 'waiting') {
    if (distanceBetween(player.x, player.y, fare.x, fare.y) < PICKUP_RANGE) {
      fare.stage = 'riding';
      fare.timer = FARE_TIME;
      const dist = distanceBetween(fare.x, fare.y, fare.destX, fare.destY);
      fare.pay = Math.round(
        Math.min(FARE_MAX, Math.max(FARE_MIN, FARE_MIN + (dist / 2400) * (FARE_MAX - FARE_MIN))),
      );
      state.banner = {
        title: 'FARE PICKED UP',
        sub: `Take them to ${fare.destName} — $${fare.pay} if you make it in ${FARE_TIME}s`,
        t: 0,
        duration: 3.5,
      };
    }
    return null;
  }

  // Riding: the clock runs, and the destination is the target.
  fare.timer -= dt;
  if (distanceBetween(player.x, player.y, fare.destX, fare.destY) < 90) {
    state.money += fare.pay;
    jobs.faresDone += 1;
    jobs.faresEarned += fare.pay;
    state.banner = {
      title: 'FARE COMPLETE',
      sub: `+$${fare.pay}  •  Total $${state.money}`,
      t: 0,
      duration: 3.5,
    };
    jobs.fare = null;
    jobs.fareCooldown = FARE_SPAWN_EVERY;
    return 'fare';
  }
  if (fare.timer <= 0) {
    state.banner = {
      title: 'FARE LOST',
      sub: 'Too slow — the passenger got out and walked away.',
      t: 0,
      duration: 3,
    };
    jobs.fare = null;
    jobs.fareCooldown = FARE_SPAWN_EVERY;
  }
  return null;
}

/** Where the HUD arrow should point for an active fare, or null. */
export function fareMarker(state) {
  const jobs = state.sideJobs;
  if (!jobs || !jobs.fare) return null;
  const fare = jobs.fare;
  if (fare.stage === 'waiting') return { x: fare.x, y: fare.y, r: 40, kind: 'fare' };
  return { x: fare.destX, y: fare.destY, r: 90, kind: 'fare' };
}
