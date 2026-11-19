// Side activities, always available alongside the story:
// taxi fares and hidden Solmar Coins.
//
// - Coins: 12 gold coins at seeded street points. Walk or drive
//   over one to collect it (+$25 each). HUD reads "Coins n/12".
// - Fares: while driving, a waving passenger appears at a
//   roadside point after a cooldown. Drive within 60px to pick
//   them up — no key press, E is busy — then deliver them to a
//   random landmark within 45s. Payout is $80–$150 by distance.
//
// State lives in state.sideJobs; the rng is kept on the object
// because stepSideJobs only receives (state, dt).

import { clamp } from './util.js';

const COIN_VALUE = 25;
const COIN_COUNT = 12;
const FARE_PICKUP_RANGE = 60;
const FARE_DELIVER_RANGE = 70;
const FARE_TIME_LIMIT = 45;
const FARE_PAY_MIN = 80;
const FARE_PAY_MAX = 150;

function draw(sj) {
  const rng = sj.rng;
  if (!rng) return Math.random();
  if (typeof rng === 'function') return rng();
  if (typeof rng.next === 'function') return rng.next();
  return Math.random();
}

export function createSideJobs(rng, city) {
  const coins = [];
  for (let i = 0; i < COIN_COUNT; i += 1) {
    const at = city.randomStreetPoint(rng);
    coins.push({ x: at.x, y: at.y, taken: false, bob: draw({ rng }) * Math.PI * 2 });
  }
  return {
    coins,
    coinsFound: 0,
    fare: null,
    fareTimer: 0,
    fareCooldown: 8,
    faresDone: 0,
    faresEarned: 0,
    rng: rng || null,
  };
}

export function sideJobsText(state) {
  const sj = state.sideJobs;
  if (!sj) return 'Coins 0/12  •  Fares $0';
  return 'Coins ' + sj.coinsFound + '/12  •  Fares $' + sj.faresEarned;
}

// The fare marker the renderer draws: the waiting passenger, or
// the destination once they are aboard. Null when no fare runs.
export function fareMarker(state) {
  const sj = state.sideJobs;
  if (!sj || !sj.fare) return null;
  if (sj.fare.stage === 'waiting') {
    return { x: sj.fare.x, y: sj.fare.y, r: 40, kind: 'fare' };
  }
  return { x: sj.fare.destX, y: sj.fare.destY, r: 40, kind: 'fare' };
}

function pickDestination(state, sj) {
  const city = state.city;
  const p = state.player;
  const landmarks = city && city.landmarkList ? city.landmarkList : [];
  const far = landmarks.filter((lm) => {
    const dx = lm.x - p.x;
    const dy = lm.y - p.y;
    return dx * dx + dy * dy > 300 * 300;
  });
  const pool = far.length > 0 ? far : landmarks;
  if (pool.length === 0) return null;
  return pool[Math.floor(draw(sj) * pool.length)];
}

function spawnFare(state, sj) {
  const city = state.city;
  const p = state.player;
  if (!city) return;
  // A roadside point near the player, but not on top of them.
  let spot = null;
  for (let tries = 0; tries < 8; tries += 1) {
    const cand = city.randomStreetPoint(sj.rng);
    const dx = cand.x - p.x;
    const dy = cand.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 120 && d < 500) {
      spot = cand;
      break;
    }
    if (!spot) spot = cand;
  }
  const dest = pickDestination(state, sj);
  if (!spot || !dest) return;
  const dx = dest.x - spot.x;
  const dy = dest.y - spot.y;
  const trip = Math.sqrt(dx * dx + dy * dy);
  const pay = clamp(FARE_PAY_MIN + Math.floor(trip / 20), FARE_PAY_MIN, FARE_PAY_MAX);
  sj.fare = {
    stage: 'waiting',
    x: spot.x,
    y: spot.y,
    destKey: dest.key,
    destX: dest.x,
    destY: dest.y,
    destName: dest.name,
    pay,
  };
}

// One frame of coins + fares. Returns an events bitmask; PICKUP
// (4) fires when a coin is collected or a fare pays out, so the
// world can play the pickup sound. Large dt is split so a hitch
// never skips a pickup radius.
export function stepSideJobs(state, dt) {
  const sj = state.sideJobs;
  const p = state.player;
  if (!sj || !p) return 0;
  let events = 0;
  let remaining = dt;
  while (remaining > 0) {
    const h = Math.min(remaining, 1 / 30);
    remaining -= h;

    for (const coin of sj.coins) {
      coin.bob += h * 3;
      if (coin.taken) continue;
      const dx = coin.x - p.x;
      const dy = coin.y - p.y;
      if (dx * dx + dy * dy < 30 * 30) {
        coin.taken = true;
        sj.coinsFound += 1;
        state.money = (state.money || 0) + COIN_VALUE;
        events |= 4;
      }
    }

    const fare = sj.fare;
    if (fare) {
      const dx = p.x - (fare.stage === 'waiting' ? fare.x : fare.destX);
      const dy = p.y - (fare.stage === 'waiting' ? fare.y : fare.destY);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (fare.stage === 'waiting') {
        // Auto pickup while driving: E is busy with the car.
        if (p.inCar && d < FARE_PICKUP_RANGE) {
          fare.stage = 'riding';
          sj.fareTimer = FARE_TIME_LIMIT;
        }
      } else {
        sj.fareTimer -= h;
        if (d < FARE_DELIVER_RANGE) {
          state.money = (state.money || 0) + fare.pay;
          sj.faresDone += 1;
          sj.faresEarned += fare.pay;
          sj.fare = null;
          sj.fareCooldown = 18 + draw(sj) * 10;
          events |= 4;
        } else if (sj.fareTimer <= 0) {
          sj.fare = null;
          sj.fareCooldown = 15;
        }
      }
    } else {
      sj.fareCooldown -= h;
      if (sj.fareCooldown <= 0 && p.inCar) {
        spawnFare(state, sj);
        sj.fareCooldown = 10;
      }
    }
  }
  return events;
}
