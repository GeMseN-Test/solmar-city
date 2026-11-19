// police2.js — deeper police: roadblocks at 3+ stars, helicopter
// at 4-5 stars. Roadblock cruisers are pushed into state.police.cars
// with roadblock: true (stepPolice skips moving them) and removed below
// 3 stars. The heli is visual only and despawns below 4 stars.

export function createPolice2() {
  return {
    roadblocks: [],
    heli: null,
    roadblockCooldown: 0,
  };
}

export function heliSpotlight(state) {
  if (!state.police2 || !state.police2.heli) return null;
  return { x: state.player.x, y: state.player.y, r: 130 };
}

function roadblockSpots(state) {
  const player = state.player;
  const city = state.city;
  const ahead = 320;
  const ax = player.x + Math.cos(player.angle) * ahead;
  const ay = player.y + Math.sin(player.angle) * ahead;
  let cx = ax;
  let cy = ay;
  // Which way does the road under that point run?
  let roadAngle = player.angle;
  if (city && city.nearestRoadPoint) {
    const pt = city.nearestRoadPoint(ax, ay);
    cx = pt.x;
    cy = pt.y;
    const movedX = Math.abs(pt.x - ax);
    const movedY = Math.abs(pt.y - ay);
    roadAngle = movedX > movedY ? Math.PI / 2 : 0;
  }
  // Two cruisers parked across the road, noses pointing across it.
  const perpX = Math.cos(roadAngle + Math.PI / 2);
  const perpY = Math.sin(roadAngle + Math.PI / 2);
  return [
    { x: cx + perpX * 30, y: cy + perpY * 30, angle: roadAngle + Math.PI / 2 },
    { x: cx - perpX * 30, y: cy - perpY * 30, angle: roadAngle + Math.PI / 2 },
  ];
}

export function stepPolice2(state, dt) {
  const p2 = state.police2;
  const police = state.police;
  const player = state.player;
  const wanted = (state.police && state.police.wanted) || 0;

  p2.roadblockCooldown -= dt;

  // Roadblocks at 3+ stars.
  if (wanted >= 3 && p2.roadblocks.length === 0 && p2.roadblockCooldown <= 0) {
    const spots = roadblockSpots(state);
    for (const s of spots) {
      const car = {
        kind: 'police',
        roadblock: true,
        x: s.x,
        y: s.y,
        angle: s.angle,
        speed: 0,
        color: '#22303e',
      };
      p2.roadblocks.push(car);
      if (police) police.cars.push(car);
    }
  }
  if (wanted < 3 && p2.roadblocks.length > 0) {
    if (police) {
      police.cars = police.cars.filter((c) => !c.roadblock);
    }
    p2.roadblocks.length = 0;
    p2.roadblockCooldown = 5;
  }

  // Helicopter at 4-5 stars, hovering above the player.
  if (wanted >= 4) {
    if (!p2.heli) {
      p2.heli = { x: player.x, y: player.y - 60, angle: 0, rotor: 0 };
    }
    p2.heli.x += (player.x - p2.heli.x) * Math.min(1, 1.5 * dt);
    p2.heli.y += (player.y - 40 - p2.heli.y) * Math.min(1, 1.5 * dt);
    p2.heli.rotor += dt * 28;
  } else if (p2.heli) {
    p2.heli = null;
  }
}
