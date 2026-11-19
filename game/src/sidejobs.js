// Side jobs, always available: Solmar Coins + taxi fares.
// - 12 hidden gold coins at seeded street points; walk or drive over
//   one to collect (+$25 each). HUD: "Coins n/12".
// - Taxi fares: while driving, a waving passenger appears roadside;
//   drive within 60px to pick up, deliver to a random landmark within
//   45s, payout $80-$150 by distance.
import { SIDEJOBS } from './config.js';
import { dist } from './util.js';
import { randRange, randInt, pick } from './random.js';

export function createSideJobs(rng, city) {
  const coins = [];
  for (let i = 0; i < SIDEJOBS.coins; i++) {
    const pt = city.randomStreetPoint(rng);
    coins.push({
      x: pt.x + randRange(rng, -18, 18),
      y: pt.y + randRange(rng, -18, 18),
      taken: false,
      bob: randRange(rng, 0, Math.PI * 2),
    });
  }
  return {
    coins,
    coinsFound: 0,
    fare: null,
    fareTimer: 0,
    fareCooldown: randRange(rng, 8, 16),
    faresDone: 0,
    faresEarned: 0,
  };
}

// HUD line: "Coins n/12  •  Fares $N".
export function sideJobsText(state) {
  const sj = state.sideJobs;
  if (!sj) return '';
  return 'Coins ' + sj.coinsFound + '/' + sj.coins.length + '  •  Fares $' + sj.faresEarned;
}

// Fare marker for the renderer (passenger or destination), or null.
export function fareMarker(state) {
  const sj = state.sideJobs;
  if (!sj || !sj.fare) return null;
  const f = sj.fare;
  if (f.stage === 'waiting') {
    return { x: f.x, y: f.y, r: 40, kind: 'fare', stage: 'waiting' };
  }
  return { x: f.destX, y: f.destY, r: 40, kind: 'fare', stage: 'deliver', name: f.destName };
}

function spawnFare(state, rng) {
  const city = state.city;
  const p = state.player;
  const pt = city.randomStreetPoint(rng);
  const destKeys = Object.keys(city.landmarks);
  const destKey = pick(rng, destKeys);
  const dest = city.landmarks[destKey];
  const d = dist(pt.x, pt.y, dest.x, dest.y);
  const pay = Math.round(
    Math.min(SIDEJOBS.fareMax, Math.max(SIDEJOBS.fareMin, SIDEJOBS.fareMin + d * 0.045)),
  );
  state.sideJobs.fare = {
    stage: 'waiting',
    x: pt.x,
    y: pt.y,
    destKey,
    destX: dest.x,
    destY: dest.y,
    destName: dest.name,
    pay,
    timeLeft: SIDEJOBS.fareTimeLimit,
  };
}

export function stepSideJobs(state, dt) {
  const sj = state.sideJobs;
  const p = state.player;
  if (!sj || !p) return;
  const rng = state.rng || Math.random;

  // --- Coins: bob + collect on touch ---
  for (const coin of sj.coins) {
    if (coin.taken) continue;
    coin.bob += dt * 2.5;
    if (dist(p.x, p.y, coin.x, coin.y) < 30) {
      coin.taken = true;
      sj.coinsFound += 1;
      state.money = (state.money || 0) + SIDEJOBS.coinValue;
      state.coinPickup = (state.coinPickup || 0) + 1;
    }
  }

  // --- Taxi fares ---
  if (!sj.fare) {
    // A fare only spawns while the player is driving.
    if (p.inCar) {
      sj.fareCooldown -= dt;
      if (sj.fareCooldown <= 0) {
        spawnFare(state, rng);
      }
    }
    return;
  }

  const fare = sj.fare;
  if (fare.stage === 'waiting') {
    // Auto pickup: drive within 60px (E is busy while driving).
    if (p.inCar && dist(p.x, p.y, fare.x, fare.y) < SIDEJOBS.farePickupRange) {
      fare.stage = 'deliver';
      fare.timeLeft = SIDEJOBS.fareTimeLimit;
    }
    // Passenger gives up after a while.
    fare.timeLeft -= dt * 0.25;
    if (fare.timeLeft <= 0) {
      sj.fare = null;
      sj.fareCooldown = SIDEJOBS.fareCooldown;
    }
    return;
  }

  // Delivering: timer runs down, destination within 60px pays out.
  fare.timeLeft -= dt;
  if (fare.timeLeft <= 0) {
    sj.fare = null;
    sj.fareCooldown = SIDEJOBS.fareCooldown;
    return;
  }
  const d = dist(p.x, p.y, fare.destX, fare.destY);
  if (d < SIDEJOBS.farePickupRange) {
    state.money = (state.money || 0) + fare.pay;
    sj.faresDone += 1;
    sj.faresEarned += fare.pay;
    sj.fare = null;
    sj.fareCooldown = SIDEJOBS.fareCooldown;
    state.farePaid = fare.pay;
  }
}

export default createSideJobs;
