// The heavy end of Solmar City's police response: roadblocks at three
// stars and up, and a police helicopter with a spotlight at four and five.
// Both live beside the cruisers and foot cops — roadblock cars are parked
// police cruisers in the normal police list (so the world already draws
// them, collides with them and rams them), and the helicopter is a visual
// hunter that hovers over the player and lights up the street below.
//
// The module only manages spawning and cleanup; the chase itself stays
// in police.js, which skips moving any cruiser flagged as a roadblock.

import { clampNumber, distanceBetween } from './util.js';

const ROADBLOCK_MIN_STARS = 3;
const HELI_MIN_STARS = 4;
const ROADBLOCK_COOLDOWN = 20;

export function createPolice2() {
  return {
    roadblocks: [],
    heli: null,
    roadblockCooldown: 0,
  };
}

/** Park two cruisers across the road ahead of the player. */
function spawnRoadblock(state) {
  const player = state.player;
  const aheadX = player.x + Math.cos(player.angle) * 420;
  const aheadY = player.y + Math.sin(player.angle) * 420;
  const spot = state.city.nearestRoadPoint(aheadX, aheadY);
  // Across the road, not along it: perpendicular to the player's heading.
  const across = player.angle + Math.PI / 2;
  const cars = [];
  for (const side of [-1, 1]) {
    const car = {
      kind: 'police',
      x: spot.x + Math.cos(across) * 34 * side,
      y: spot.y + Math.sin(across) * 34 * side,
      angle: across,
      speed: 0,
      color: '#22375e',
      model: 'police',
      lightPhase: state.rng.range(0, Math.PI * 2),
      roadblock: true,
    };
    state.police.cars.push(car);
    cars.push(car);
  }
  state.police2.roadblocks = cars;
  state.police2.roadblockCooldown = ROADBLOCK_COOLDOWN;
  state.banner = {
    title: 'ROADBLOCK AHEAD',
    sub: 'Solmar PD blocked the road — find another way around.',
    t: 0,
    duration: 3.5,
  };
}

function clearRoadblock(state) {
  for (const car of state.police2.roadblocks) {
    const index = state.police.cars.indexOf(car);
    if (index !== -1) state.police.cars.splice(index, 1);
  }
  state.police2.roadblocks = [];
}

/**
 * One step of the heavy response: keep a roadblock up at 3+ stars, keep
 * the helicopter overhead at 4–5, and clear both when the heat drops.
 */
export function stepPolice2(state, dt) {
  const police2 = state.police2;
  if (!police2) return;
  police2.roadblockCooldown = Math.max(0, police2.roadblockCooldown - dt);

  if (state.wanted >= ROADBLOCK_MIN_STARS) {
    if (police2.roadblocks.length === 0 && police2.roadblockCooldown <= 0) {
      spawnRoadblock(state);
    }
  } else if (police2.roadblocks.length > 0) {
    clearRoadblock(state);
  }

  if (state.wanted >= HELI_MIN_STARS) {
    if (!police2.heli) {
      police2.heli = {
        x: state.player.x,
        y: state.player.y - 260,
        angle: 0,
        rotor: 0,
      };
      state.banner = {
        title: 'POLICE HELICOPTER',
        sub: 'Air support is overhead — the spotlight never blinks.',
        t: 0,
        duration: 3.5,
      };
    }
    const heli = police2.heli;
    const dx = state.player.x - heli.x;
    const dy = state.player.y - 200 - heli.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      const speed = clampNumber(dist * 1.5, 60, 420);
      heli.x += (dx / dist) * speed * dt;
      heli.y += (dy / dist) * speed * dt;
    }
    heli.angle = Math.atan2(state.player.y - heli.y, state.player.x - heli.x);
    heli.rotor += dt * 22;
  } else if (police2.heli) {
    police2.heli = null;
  }
}

/** The helicopter's spotlight circle on the ground, or null. */
export function heliSpotlight(state) {
  const heli = state.police2?.heli;
  if (!heli) return null;
  return { x: state.player.x, y: state.player.y, r: 130 };
}
