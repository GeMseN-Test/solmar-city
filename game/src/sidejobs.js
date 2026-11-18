// Side activities, always available alongside the story:
//   - Solmar Coins: 12 hidden gold coins on seeded street points.
//     Walk or drive over one: +$25 each. HUD shows "Coins n/12".
//   - Taxi fares: while driving, a waving passenger appears at a
//     roadside point. Drive within 60px to pick them up, then deliver
//     them to a random landmark within 45s for $80-$150 by distance.
import { COIN_COUNT, COIN_VALUE, FARE_MAX_PAY, FARE_MIN_PAY, FARE_PICKUP_RADIUS, FARE_TIME_LIMIT } from './config.js';
import { clamp, dist } from './util.js';

export function createSideJobs(rng, city) {
  const coins = [];
  for (let i = 0; i < COIN_COUNT; i++) {
    const spot = city.randomStreetPoint(rng);
    coins.push({ x: spot.x, y: spot.y, taken: false, bob: rng.range(0, Math.PI * 2) });
  }
  return {
    coins,
    coinsFound: 0,
    fare: null,
    fareTimer: 0,
    fareCooldown: 8,
    faresDone: 0,
    faresEarned: 0,
  };
}

export function sideJobsText(state) {
  const sj = state.sideJobs;
  return 'Coins ' + sj.coinsFound + '/' + COIN_COUNT + '  •  Fares $' + sj.faresEarned;
}

// The fare marker for the HUD arrow / minimap: the waiting passenger,
// or the destination while a fare is riding. Null when no fare.
export function fareMarker(state) {
  const fare = state.sideJobs.fare;
  if (!fare) return null;
  if (fare.stage === 'waiting') return { x: fare.x, y: fare.y, r: 40, kind: 'fare' };
  return { x: fare.destX, y: fare.destY, r: 40, kind: 'fare' };
}

function spawnFare(state) {
  const rng = state.rng;
  const city = state.city;
  const p = state.player;
  const keys = Object.keys(city.landmarks);
  const destKey = rng.pick(keys);
  const dest = city.landmarks[destKey];
  // Passenger waits at a roadside point somewhere near the player.
  let px = p.x;
  let py = p.y;
  for (let tries = 0; tries < 12; tries++) {
    const spot = city.randomStreetPoint(rng);
    if (dist(spot.x, spot.y, p.x, p.y) > 200 && dist(spot.x, spot.y, p.x, p.y) < 700) {
      px = spot.x;
      py = spot.y;
      break;
    }
  }
  const d = dist(px, py, dest.x, dest.y);
  const pay = Math.round(clamp(FARE_MIN_PAY + d / 28, FARE_MIN_PAY, FARE_MAX_PAY));
  state.sideJobs.fare = {
    stage: 'waiting',
    x: px, y: py,
    destKey, destX: dest.x, destY: dest.y, destName: dest.name,
    pay,
  };
}

// Returns an events bitmask (PICKUP = 4 when a coin or fare pays out).
export function stepSideJobs(state, dt) {
  let events = 0;
  const sj = state.sideJobs;
  const p = state.player;

  // Coins bob and wait to be collected.
  for (const coin of sj.coins) {
    coin.bob += dt * 2;
    if (!coin.taken && dist(p.x, p.y, coin.x, coin.y) < 26) {
      coin.taken = true;
      sj.coinsFound += 1;
      state.money += COIN_VALUE;
      events |= 4;
    }
  }

  // Taxi fares only appear while the player is driving.
  if (!sj.fare) {
    if (p.inCar) {
      sj.fareCooldown -= dt;
      if (sj.fareCooldown <= 0) spawnFare(state);
    }
    return events;
  }

  const fare = sj.fare;
  if (fare.stage === 'waiting') {
    if (p.inCar && dist(p.x, p.y, fare.x, fare.y) < FARE_PICKUP_RADIUS) {
      fare.stage = 'riding';
      sj.fareTimer = FARE_TIME_LIMIT;
    } else if (!p.inCar && dist(p.x, p.y, fare.x, fare.y) < FARE_PICKUP_RADIUS) {
      // On foot the passenger just waits — no pickup without a car.
    }
    return events;
  }

  // Riding: the clock is running.
  if (!p.inCar) {
    // Passenger bails when the ride ends without a car.
    sj.fare = null;
    sj.fareCooldown = 8;
    return events;
  }
  sj.fareTimer -= dt;
  if (dist(p.x, p.y, fare.destX, fare.destY) < 55) {
    state.money += fare.pay;
    sj.faresDone += 1;
    sj.faresEarned += fare.pay;
    sj.fare = null;
    sj.fareCooldown = 10;
    events |= 4;
  } else if (sj.fareTimer <= 0) {
    sj.fare = null;
    sj.fareCooldown = 12;
  }
  return events;
}
