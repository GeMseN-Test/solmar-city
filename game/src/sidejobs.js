// sidejobs.js — Two side activities, always available:
//  - Solmar Coins: 12 hidden gold coins at seeded street points;
//    walk or drive over one to collect (+$25 each). HUD: "Coins n/12".
//  - Taxi fares: while driving, a waving passenger appears at a
//    roadside point; drive within 60px to pick up, deliver to a random
//    landmark within 45s, payout $80–$150 by distance.

export const COIN_COUNT = 12;
export const COIN_REWARD = 25;
export const FARE_PICKUP_RANGE = 60;
export const FARE_TIME_LIMIT = 45;
export const FARE_MIN_PAY = 80;
export const FARE_MAX_PAY = 150;
export const FARE_COOLDOWN = 14;

export function createSideJobs(rng, city) {
  const rand = rng || Math.random;
  const coins = [];
  for (let i = 0; i < COIN_COUNT; i++) {
    let x = 200 + rand() * 2480;
    let y = 200 + rand() * 1760;
    if (city && city.randomStreetPoint) {
      const pt = city.randomStreetPoint(rand);
      x = pt.x;
      y = pt.y;
    }
    coins.push({ x, y, taken: false, bob: rand() * Math.PI * 2 });
  }
  return {
    coins,
    coinsFound: 0,
    fare: null,
    fareTimer: 0,
    fareCooldown: 6 + rand() * 6,
    faresDone: 0,
    faresEarned: 0,
  };
}

export function sideJobsText(state) {
  if (!state || !state.sideJobs) return 'Coins 0/12  •  Fares $0';
  const sj = state.sideJobs;
  return 'Coins ' + sj.coinsFound + '/12  •  Fares $' + sj.faresEarned;
}

export function fareMarker(state) {
  if (!state || !state.sideJobs || !state.sideJobs.fare) return null;
  const fare = state.sideJobs.fare;
  if (fare.stage === 'waiting') {
    return { x: fare.x, y: fare.y, r: 40, kind: 'fare' };
  }
  return { x: fare.destX, y: fare.destY, r: 40, kind: 'fare-dest' };
}

function randomDestination(state, rng) {
  const landmarks = state.city ? state.city.landmarks : null;
  if (landmarks) {
    const keys = Object.keys(landmarks);
    const key = keys[Math.floor(rng() * keys.length)];
    const lm = landmarks[key];
    return { key, x: lm.x, y: lm.y, name: lm.name || key };
  }
  return { key: 'garage', x: 700, y: 830, name: "Ray's Garage" };
}

function spawnFare(state, rng) {
  const sj = state.sideJobs;
  const p = state.player;
  if (!p) return;
  let x = p.x + (rng() - 0.5) * 700;
  let y = p.y + (rng() - 0.5) * 700;
  if (state.city && state.city.randomStreetPoint) {
    const pt = state.city.randomStreetPoint(rng);
    x = pt.x;
    y = pt.y;
  }
  const dest = randomDestination(state, rng);
  const dist = Math.sqrt((dest.x - x) * (dest.x - x) + (dest.y - y) * (dest.y - y));
  const pay = Math.round(
    FARE_MIN_PAY + Math.min(1, dist / 2200) * (FARE_MAX_PAY - FARE_MIN_PAY)
  );
  sj.fare = {
    stage: 'waiting',
    x,
    y,
    destKey: dest.key,
    destX: dest.x,
    destY: dest.y,
    destName: dest.name,
    pay,
    timeLeft: FARE_TIME_LIMIT,
  };
}

export function stepSideJobs(state, dt) {
  if (!state || !state.sideJobs || !state.player) return;
  const sj = state.sideJobs;
  const p = state.player;
  const rng = state.rng || Math.random;
  // Coins: walk or drive over one to collect.
  for (let i = 0; i < sj.coins.length; i++) {
    const coin = sj.coins[i];
    if (coin.taken) continue;
    coin.bob += dt * 3;
    const dx = coin.x - p.x;
    const dy = coin.y - p.y;
    if (dx * dx + dy * dy < 28 * 28) {
      coin.taken = true;
      sj.coinsFound++;
      state.money = (state.money || 0) + COIN_REWARD;
      if (state.events) state.events |= 4; // PICKUP
      if (state.audio && state.audio.pickup) state.audio.pickup('coin');
    }
  }
  // Taxi fares only make sense while driving.
  const driving = !!(p.inCar || p.inBoat);
  if (!sj.fare) {
    if (driving) {
      sj.fareCooldown -= dt;
      if (sj.fareCooldown <= 0) {
        spawnFare(state, rng);
        sj.fareCooldown = FARE_COOLDOWN + rng() * 10;
      }
    }
    return;
  }
  const fare = sj.fare;
  if (fare.stage === 'waiting') {
    const dx = fare.x - p.x;
    const dy = fare.y - p.y;
    if (dx * dx + dy * dy < FARE_PICKUP_RANGE * FARE_PICKUP_RANGE) {
      if (driving) {
        fare.stage = 'riding';
        fare.timeLeft = FARE_TIME_LIMIT;
      }
    }
    // Passenger gives up if the player drives far away.
    const far = Math.sqrt(dx * dx + dy * dy);
    if (far > 900) {
      sj.fare = null;
      sj.fareCooldown = FARE_COOLDOWN;
    }
    return;
  }
  // Riding: deliver before the clock runs out.
  fare.timeLeft -= dt;
  const dx = fare.destX - p.x;
  const dy = fare.destY - p.y;
  if (dx * dx + dy * dy < 60 * 60) {
    state.money = (state.money || 0) + fare.pay;
    sj.faresDone++;
    sj.faresEarned += fare.pay;
    if (state.events) state.events |= 4;
    if (state.audio && state.audio.pickup) state.audio.pickup('cash');
    sj.fare = null;
    sj.fareCooldown = FARE_COOLDOWN + rng() * 8;
    return;
  }
  if (fare.timeLeft <= 0) {
    sj.fare = null;
    sj.fareCooldown = FARE_COOLDOWN;
  }
}

export function coinsRemaining(state) {
  if (!state || !state.sideJobs) return COIN_COUNT;
  return COIN_COUNT - state.sideJobs.coinsFound;
}

export default createSideJobs;
