// sidejobs.js — two always-available side activities in Solmar City:
// taxi fares and hidden Solmar Coins. Both pay cash on the spot and
// both show up in the HUD line from sideJobsText().
//   Taxi: while driving, a waving passenger appears at a roadside
//   point after a cooldown. Drive within 60px to pick them up, then
//   deliver them to a random landmark within 45s. Pay $80–$150 by
//   distance. Auto pickup — E is busy driving.
//   Coins: 12 gold coins at seeded street points. Walk or drive over
//   one to collect it: +$25 each. HUD: "Coins n/12".

import { SIDE_JOBS } from './config.js';
import { dist } from './util.js';

const LANDMARK_KEYS = ['garage', 'safehouse', 'bank', 'turf', 'docks', 'marina', 'radio'];

export function createSideJobs(rng, city) {
  const rand = rng || { next: Math.random, int: (a, b) => Math.floor(a + Math.random() * (b - a + 1)), pick: (l) => l[Math.floor(Math.random() * l.length)] };
  const coins = [];
  for (let i = 0; i < SIDE_JOBS.coinCount; i++) {
    const pt = city && city.randomStreetPoint
      ? city.randomStreetPoint(rand)
      : { x: 300 + rand.next() * 2200, y: 300 + rand.next() * 1600 };
    coins.push({
      x: pt.x,
      y: pt.y,
      taken: false,
      bob: rand.next() * Math.PI * 2,
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

// HUD line: 'Coins n/12  •  Fares $N'.
export function sideJobsText(state) {
  const sj = state.sideJobs;
  if (!sj) return 'Coins 0/12  •  Fares $0';
  const found = sj.coinsFound || 0;
  const earned = sj.faresEarned || 0;
  return `Coins ${found}/12  •  Fares $${earned}`;
}

// Marker for the waiting passenger (or the destination while a fare
// is running), for the renderer + minimap. Null when no fare.
export function fareMarker(state) {
  const sj = state.sideJobs;
  if (!sj || !sj.fare) return null;
  const f = sj.fare;
  if (f.stage === 'waiting') return { x: f.x, y: f.y, r: 40, kind: 'fare' };
  return { x: f.destX, y: f.destY, r: 40, kind: 'fare-dest' };
}

function pickFareDestination(state, rand) {
  const city = state.city;
  const keys = LANDMARK_KEYS.slice();
  // Don't send the passenger to the landmark they are already at.
  const key = keys[Math.floor((rand ? rand.next() : Math.random()) * keys.length)];
  if (city && city.landmarks && city.landmarks[key]) {
    const lm = city.landmarks[key];
    return { destKey: key, destX: lm.x, destY: lm.y, destName: lm.name };
  }
  return { destKey: key, destX: 1420, destY: 1190, destName: "Mara's Safehouse" };
}

function spawnFare(state) {
  const sj = state.sideJobs;
  const p = state.player;
  const city = state.city;
  const rand = state.rng || null;
  const next = () => (rand ? rand.next() : Math.random());
  // Roadside point ahead of the player so the fare is always findable.
  let fx;
  let fy;
  if (city && city.randomStreetPoint && rand) {
    const pt = city.randomStreetPoint(rand);
    fx = pt.x;
    fy = pt.y;
  } else {
    fx = p.x + (next() - 0.5) * 700;
    fy = p.y + (next() - 0.5) * 500;
  }
  const dest = pickFareDestination(state, rand);
  const d = dist(fx, fy, dest.destX, dest.destY);
  // Pay scales with distance: $80 for a short hop, up to $150 cross-town.
  const pay = Math.round(
    SIDE_JOBS.fareMinPay +
    (SIDE_JOBS.fareMaxPay - SIDE_JOBS.fareMinPay) * Math.min(1, d / 2200),
  );
  sj.fare = {
    stage: 'waiting',
    x: fx,
    y: fy,
    destKey: dest.destKey,
    destX: dest.destX,
    destY: dest.destY,
    destName: dest.destName,
    pay,
    timeLeft: SIDE_JOBS.fareTimeLimit,
  };
  sj.fareTimer = 0;
}

export function stepSideJobs(state, dt) {
  const step = dt || 0.016;
  const sj = state.sideJobs;
  const p = state.player;
  if (!sj || !p) return;
  const city = state.city;

  // --- Coins: walk or drive over one to collect it. ------------------
  for (const coin of sj.coins) {
    if (coin.taken) continue;
    coin.bob += step * 2;
    const pickupRange = p.inCar || p.inBoat ? 30 : 26;
    if (dist(p.x, p.y, coin.x, coin.y) <= pickupRange) {
      coin.taken = true;
      sj.coinsFound = (sj.coinsFound || 0) + 1;
      state.money = (state.money || 0) + SIDE_JOBS.coinValue;
      if (state.events != null) state.events |= 4; // PICKUP
    }
  }

  // --- Taxi fares -----------------------------------------------------
  if (sj.fare) {
    const f = sj.fare;
    if (f.stage === 'waiting') {
      // Auto pickup: drive within 60px while in a car.
      if (p.inCar && dist(p.x, p.y, f.x, f.y) <= SIDE_JOBS.farePickupRange) {
        f.stage = 'riding';
        f.timeLeft = SIDE_JOBS.fareTimeLimit;
      }
    } else if (f.stage === 'riding') {
      f.timeLeft -= step;
      if (dist(p.x, p.y, f.destX, f.destY) <= SIDE_JOBS.farePickupRange) {
        // Delivered: pay out, count the fare, schedule the next one.
        state.money = (state.money || 0) + f.pay;
        sj.faresDone = (sj.faresDone || 0) + 1;
        sj.faresEarned = (sj.faresEarned || 0) + f.pay;
        sj.fare = null;
        sj.fareCooldown = SIDE_JOBS.fareCooldown;
        if (state.events != null) state.events |= 4; // PICKUP
      } else if (f.timeLeft <= 0) {
        // Too slow: the passenger bails, no pay.
        sj.fare = null;
        sj.fareCooldown = SIDE_JOBS.fareCooldown;
      }
    }
  } else {
    // No active fare: spawn one while the player is driving, after
    // the cooldown. Fares only appear on the road, never on foot.
    sj.fareCooldown -= step;
    if (p.inCar && sj.fareCooldown <= 0) {
      spawnFare(state);
    }
  }
  void city;
}

export default {
  createSideJobs,
  stepSideJobs,
  sideJobsText,
  fareMarker,
};
