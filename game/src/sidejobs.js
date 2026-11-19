// sidejobs.js — the two side activities that are always on:
// taxi fares while driving, and 12 hidden Solmar Coins around the
// streets. A fare pays $80-$150 by distance; a coin pays $25.

import { dist } from './util.js';
import { randRange } from './random.js';

export const COIN_COUNT = 12;
export const COIN_VALUE = 25;
export const FARE_TIME_LIMIT = 45;
export const FARE_PICKUP_RANGE = 60;

export function createSideJobs(rng, city) {
  const coins = [];
  const used = [];
  for (let i = 0; i < COIN_COUNT; i++) {
    let pt = city.randomStreetPoint(rng);
    // Keep coins spread out: retry if one lands on another.
    let tries = 0;
    while (tries < 12 && used.some((u) => dist(u.x, u.y, pt.x, pt.y) < 260)) {
      pt = city.randomStreetPoint(rng);
      tries++;
    }
    used.push(pt);
    coins.push({
      x: pt.x,
      y: pt.y,
      taken: false,
      bob: randRange(rng, 0, Math.PI * 2),
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
    rng,
    city,
  };
}

// HUD line: "Coins n/12  •  Fares $N".
export function sideJobsText(state) {
  const sj = state.sideJobs;
  if (!sj) return 'Coins 0/12  •  Fares $0';
  return 'Coins ' + sj.coinsFound + '/' + COIN_COUNT + '  •  Fares $' + sj.faresEarned;
}

// Marker for the waiting passenger (or the destination, once the
// passenger is aboard), or null when there is no active fare.
export function fareMarker(state) {
  const sj = state.sideJobs;
  if (!sj || !sj.fare) return null;
  if (sj.fare.stage === 'waiting') {
    return { x: sj.fare.x, y: sj.fare.y, r: 40, kind: 'fare' };
  }
  return { x: sj.fare.destX, y: sj.fare.destY, r: 40, kind: 'fare-dest' };
}

function spawnFare(state) {
  const sj = state.sideJobs;
  const player = state.player;
  const city = sj.city || state.city;
  if (!city) return;
  // Passenger at a roadside point near the player.
  const pt = city.randomStreetPoint(sj.rng);
  const landmarks = city.landmarkList || Object.values(city.landmarks || {});
  const dest = landmarks.length
    ? landmarks[Math.floor(sj.rng() * landmarks.length)]
    : { key: 'safehouse', name: "Mara's Safehouse", x: 1420, y: 1190 };
  const distance = dist(pt.x, pt.y, dest.x, dest.y);
  const pay = Math.round(80 + Math.min(70, distance / 40));
  sj.fare = {
    stage: 'waiting',
    x: pt.x,
    y: pt.y,
    destKey: dest.key,
    destX: dest.x,
    destY: dest.y,
    destName: dest.name,
    pay,
    timer: FARE_TIME_LIMIT,
  };
}

export function stepSideJobs(state, dt) {
  let remaining = dt;
  while (remaining > 0) {
    const chunk = Math.min(remaining, 0.05);
    stepSideJobsOnce(state, chunk);
    remaining -= chunk;
  }
}

function stepSideJobsOnce(state, dt) {
  const step = Math.min(dt, 0.05);
  const sj = state.sideJobs;
  if (!sj) return;
  const player = state.player;
  if (!player) return;

  // Coins bob gently, and walking or driving over one collects it.
  for (const coin of sj.coins) {
    coin.bob += step * 2;
    if (coin.taken) continue;
    if (dist(player.x, player.y, coin.x, coin.y) < 26) {
      coin.taken = true;
      sj.coinsFound += 1;
      state.money = (state.money || 0) + COIN_VALUE;
      if (state.audio) state.audio.pickup('cash');
    }
  }

  // Fares only spawn while driving, after a cooldown.
  if (sj.fareCooldown > 0) sj.fareCooldown -= step;
  if (!sj.fare && player.inCar && sj.fareCooldown <= 0) {
    spawnFare(state);
  }

  if (!sj.fare) return;
  const fare = sj.fare;
  if (fare.stage === 'waiting') {
    // Auto pickup — E is busy stealing cars. Drive within 60px.
    if (player.inCar && dist(player.x, player.y, fare.x, fare.y) < FARE_PICKUP_RANGE) {
      fare.stage = 'riding';
      fare.timer = FARE_TIME_LIMIT;
    }
  } else if (fare.stage === 'riding') {
    fare.timer -= step;
    if (dist(player.x, player.y, fare.destX, fare.destY) < 60) {
      state.money = (state.money || 0) + fare.pay;
      sj.faresDone += 1;
      sj.faresEarned += fare.pay;
      sj.fare = null;
      sj.fareCooldown = 10;
      if (state.audio) state.audio.pickup('cash');
    } else if (fare.timer <= 0) {
      // Too slow — the passenger bails.
      sj.fare = null;
      sj.fareCooldown = 12;
    }
  }
}

export default createSideJobs;
