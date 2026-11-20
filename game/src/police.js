// police.js — Standard Solmar City Police Department (SCPD) patrol.
// Wanted 1–5 stars: cruisers chase the player, ram on contact, and
// bust the player after 1.6s of close contact. Wanted decays after
// 12s quiet, then one star every 8s. Roadblock cruisers (roadblock:
// true, owned by police2) are never moved by stepPolice.

export const WANTED_MAX = 5;
export const COP_CHASE_RADIUS = 900;
export const BUST_SECONDS = 1.6;
export const DECAY_DELAY = 12;
export const DECAY_EVERY = 8;

export function createPolice() {
  return {
    cars: [],
    wanted: 0,
    decayTimer: 0,
    bustTimer: 0,
    spawnCooldown: 0,
  };
}

export function addWanted(state, amount) {
  if (!state || !state.police) return 0;
  const police = state.police;
  police.wanted = Math.min(WANTED_MAX, Math.max(0, police.wanted + amount));
  police.decayTimer = 0;
  return police.wanted;
}

export function clearWanted(state) {
  if (!state || !state.police) return;
  state.police.wanted = 0;
  state.police.bustTimer = 0;
  state.police.decayTimer = 0;
}

function spawnCop(state, rng) {
  const p = state.player;
  const police = state.police;
  const rand = rng || Math.random;
  // Spawn on a road node a little away from the player.
  let x = p.x + (rand() - 0.5) * 1200;
  let y = p.y + (rand() - 0.5) * 1200;
  if (state.city && state.city.nearestRoadPoint) {
    const pt = state.city.nearestRoadPoint(x, y);
    x = pt.x;
    y = pt.y;
  }
  x = Math.max(40, Math.min(2840, x));
  y = Math.max(40, Math.min(2060, y));
  const cop = {
    kind: 'police',
    dept: 'SCPD',
    x,
    y,
    angle: Math.atan2(p.y - y, p.x - x),
    speed: 0,
    cruise: 420 + police.wanted * 30,
    color: '#1c2733',
    model: 'sedan',
    roadblock: false,
    siren: true,
  };
  police.cars.push(cop);
  return cop;
}

export function stepPolice(state, dt) {
  if (!state || !state.police || !state.player) return;
  const police = state.police;
  const p = state.player;
  const wanted = police.wanted;
  // Wanted decay: quiet for DECAY_DELAY, then -1 star every DECAY_EVERY.
  if (wanted > 0) {
    police.decayTimer += dt;
    if (police.decayTimer > DECAY_DELAY) {
      police.decayTimer = DECAY_DELAY;
      police.decayAcc = (police.decayAcc || 0) + dt;
      if (police.decayAcc >= DECAY_EVERY) {
        police.decayAcc = 0;
        police.wanted = Math.max(0, police.wanted - 1);
        police.decayTimer = 0;
        if (police.wanted === 0) police.cars = police.cars.filter((c) => c.roadblock);
      }
    }
  } else {
    police.decayTimer = 0;
    police.decayAcc = 0;
  }
  // Keep cruiser count in step with wanted level (max 5 cruisers).
  const wantCops = wanted === 0 ? 0 : Math.min(5, 1 + Math.floor(wanted / 2));
  const activeCops = police.cars.filter((c) => !c.roadblock);
  if (activeCops.length < wantCops) {
    police.spawnCooldown -= dt;
    if (police.spawnCooldown <= 0) {
      spawnCop(state, state.rng || Math.random);
      police.spawnCooldown = 2.5;
    }
  } else if (activeCops.length > wantCops) {
    // Drop the farthest active cruiser.
    let far = null;
    let farD = -1;
    for (const c of police.cars) {
      if (c.roadblock) continue;
      const d = (c.x - p.x) * (c.x - p.x) + (c.y - p.y) * (c.y - p.y);
      if (d > farD) {
        farD = d;
        far = c;
      }
    }
    if (far) police.cars.splice(police.cars.indexOf(far), 1);
  }
  // Chase the player.
  let busting = false;
  for (const cop of police.cars) {
    if (cop.roadblock) continue; // parked roadblock: police2 owns it.
    const dx = p.x - cop.x;
    const dy = p.y - cop.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (wanted === 0 || dist > COP_CHASE_RADIUS) {
      // No heat: cruise slowly back toward the road grid.
      cop.speed = Math.max(0, cop.speed - 300 * dt);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      continue;
    }
    const targetAngle = Math.atan2(dy, dx);
    let diff = targetAngle - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turnRate = 3.0;
    cop.angle += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
    cop.speed += (cop.cruise - cop.speed) * Math.min(1, 1.2 * dt);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    if (state.city && state.city.resolveCircle) {
      const out = state.city.resolveCircle(cop.x, cop.y, 12);
      cop.x = out.x;
      cop.y = out.y;
    }
    // Bust: close contact for BUST_SECONDS.
    if (dist < 46) {
      busting = true;
      police.bustTimer += dt;
    }
  }
  if (!busting) police.bustTimer = 0;
  if (police.bustTimer >= BUST_SECONDS) {
    police.bustTimer = 0;
    if (state.onBusted) state.onBusted();
    else if (typeof state.busted === 'function') state.busted();
    else state.bustedFlag = true;
  }
}

export function policeCount(state) {
  if (!state || !state.police) return 0;
  return state.police.cars.filter((c) => !c.roadblock).length;
}

export default createPolice;
