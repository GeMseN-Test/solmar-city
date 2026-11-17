// The story of Solmar City: five missions that take Mara Voss from a
// nobody with empty pockets to the crew that pulled the Solmar Score, plus
// repeatable freelance runs once the story is done. Each mission is a short
// list of objectives; this module starts them, watches them, and pays out.
//
// Objectives are plain data — the world only asks "what is the current
// objective" and "where is its marker" — so the HUD, the minimap and the
// screenshot autopilot all read the same truth.

import { addWanted } from './police.js';
import { spawnGang } from './combat.js';
import { distanceBetween } from './util.js';

export const MISSIONS = [
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    briefing: "Mara needs wheels. Any car will do — walk up and press E.",
    reward: 250,
    objectives: [
      { kind: 'steal', text: 'Steal a car — walk up to one and press E' },
      { kind: 'reach', key: 'garage', text: "Drive to Ray's Garage" },
    ],
  },
  {
    id: 'harbor-run',
    title: 'Harbor Run',
    briefing: 'Three crates came in at the docks. Collect them, run them to the Marina.',
    reward: 400,
    objectives: [
      { kind: 'collect', key: 'docks', count: 3, text: 'Pick up 3 crates at the Solmar Docks (press E)' },
      { kind: 'reach', key: 'marina', text: 'Deliver the crates to the Marina' },
    ],
  },
  {
    id: 'heat-wave',
    title: 'Heat Wave',
    briefing: 'A rival tipped off the Solmar PD. Lose the heat, then lay low at the Safehouse.',
    reward: 500,
    objectives: [
      { kind: 'wanted', level: 2, text: 'The cops are on you — wanted level 2' },
      { kind: 'lose', text: 'Lose the cops — get wanted back to 0' },
      { kind: 'reach', key: 'safehouse', text: "Lay low at Mara's Safehouse" },
    ],
  },
  {
    id: 'turf-war',
    title: 'Turf War',
    briefing: 'The Vipers muscled into Old Town. Take back the turf — all four of them.',
    reward: 800,
    objectives: [
      { kind: 'reach', key: 'turf', text: "Get to the Vipers' Turf in Old Town" },
      { kind: 'defeat', count: 4, text: 'Take out 4 Vipers gang members' },
      { kind: 'reach', key: 'safehouse', text: 'Report back to the Safehouse' },
    ],
  },
  {
    id: 'solmar-score',
    title: 'The Solmar Score',
    briefing: 'The Grand Solmar Bank. One vault, one getaway, the whole city watching.',
    reward: 2500,
    objectives: [
      { kind: 'reach', key: 'bank', text: 'Get to the Grand Solmar Bank' },
      { kind: 'interact', key: 'bank', text: 'Grab the vault cash (press E at the bank)' },
      { kind: 'escape', key: 'safehouse', text: 'Escape to the Safehouse — the whole PD is coming' },
    ],
  },
];

function freelanceMission(state) {
  const keys = ['docks', 'marina', 'garage', 'turf'];
  const from = keys[state.rng.int(0, keys.length - 1)];
  let to = keys[state.rng.int(0, keys.length - 1)];
  if (to === from) to = 'safehouse';
  const fromName = state.city.landmarks[from].name;
  const toName = state.city.landmarks[to].name;
  return {
    id: 'freelance',
    title: 'Freelance Run',
    briefing: `A client needs a package moved from ${fromName} to ${toName}.`,
    reward: 150,
    objectives: [
      { kind: 'collect', key: from, count: 1, text: `Pick up the package at ${fromName} (press E)` },
      { kind: 'reach', key: to, text: `Deliver it to ${toName}` },
    ],
  };
}

export function startMission(state, index) {
  const def = index < MISSIONS.length ? MISSIONS[index] : freelanceMission(state);
  const mission = {
    def,
    index,
    objectiveIndex: 0,
    collected: 0,
    killsAtStart: state.kills,
    freelance: index >= MISSIONS.length,
  };
  state.mission = mission;
  state.missionIndex = index;
  state.crates = [];
  if (def.id === 'heat-wave') addWanted(state, 2);
  if (def.id === 'turf-war') {
    const turf = state.city.landmarks.turf;
    spawnGang(state, turf.x, turf.y, 4);
  }
  const first = def.objectives[0];
  if (first.kind === 'collect') spawnCrates(state, first);
  state.banner = { title: def.title, sub: def.briefing, t: 0, duration: 4.5 };
  return mission;
}

function spawnCrates(state, objective) {
  const spot = state.city.landmarks[objective.key];
  for (let i = 0; i < objective.count; i += 1) {
    const angle = (i / objective.count) * Math.PI * 2;
    state.crates.push({
      x: spot.x + Math.cos(angle) * 52,
      y: spot.y + Math.sin(angle) * 52,
      taken: false,
    });
  }
}

/** The mission's current objective, or null when no mission runs. */
export function currentObjective(state) {
  if (!state.mission) return null;
  return state.mission.def.objectives[state.mission.objectiveIndex] ?? null;
}

/** Where the HUD arrow and the minimap should point right now. */
export function missionMarker(state) {
  const objective = currentObjective(state);
  if (!objective) return null;
  if (objective.key) {
    const spot = state.city.landmarks[objective.key];
    return { x: spot.x, y: spot.y, r: spot.r };
  }
  if (objective.kind === 'collect') {
    const next = state.crates.find((crate) => !crate.taken);
    if (next) return { x: next.x, y: next.y, r: 40 };
  }
  if (objective.kind === 'defeat') {
    const enemy = state.combat.enemies[0];
    if (enemy) return { x: enemy.x, y: enemy.y, r: 60 };
  }
  return null;
}

/**
 * Advance the mission from what the player just did. Returns 'complete'
 * when the last objective finished, 'advanced' when an objective finished,
 * or null. The world calls this every step and after every interaction.
 */
export function updateMission(state) {
  const mission = state.mission;
  if (!mission) return null;
  const objective = currentObjective(state);
  if (!objective) return null;
  const player = state.player;
  let done = false;

  if (objective.kind === 'steal') {
    done = player.inCar;
  } else if (objective.kind === 'reach' || objective.kind === 'escape') {
    const spot = state.city.landmarks[objective.key];
    done = distanceBetween(player.x, player.y, spot.x, spot.y) < spot.r;
  } else if (objective.kind === 'wanted') {
    done = state.wanted >= objective.level;
  } else if (objective.kind === 'lose') {
    done = state.wanted === 0;
  } else if (objective.kind === 'defeat') {
    done = state.kills - mission.killsAtStart >= objective.count;
  } else if (objective.kind === 'collect') {
    done = mission.collected >= objective.count;
  }
  // 'interact' objectives finish in tryInteract(), which calls this again.

  if (!done) return null;
  mission.objectiveIndex += 1;
  const next = currentObjective(state);
  if (next && next.kind === 'collect') spawnCrates(state, next);
  if (!next) {
    completeMission(state);
    return 'complete';
  }
  state.banner = { title: mission.def.title, sub: next.text, t: 0, duration: 3.5 };
  return 'advanced';
}

function completeMission(state) {
  const mission = state.mission;
  state.money += mission.def.reward;
  state.missionsDone += 1;
  state.banner = {
    title: `${mission.def.title} — Done!`,
    sub: `+$${mission.def.reward}  •  Total $${state.money}`,
    t: 0,
    duration: 4,
  };
  state.mission = null;
  state.crates = [];
  if (mission.index < MISSIONS.length - 1) {
    startMission(state, mission.index + 1);
  } else if (!mission.freelance) {
    state.storyComplete = true;
    startMission(state, MISSIONS.length);
    // The story banner goes up last, so the freelance briefing that
    // startMission posts does not cover it.
    state.banner = {
      title: 'STORY COMPLETE — The Solmar Score!',
      sub: `Mara owns this city now. Freelance runs pay $150 each. Total $${state.money}`,
      t: 0,
      duration: 6,
    };
  } else {
    startMission(state, MISSIONS.length);
  }
}

/**
 * The E key: steal/enter a car, pick up a crate, or grab the vault cash.
 * Returns a short label of what happened, for the HUD prompt.
 */
export function tryInteract(state) {
  const player = state.player;
  const objective = currentObjective(state);

  // Vault grab: the Score's interact objective.
  if (objective && objective.kind === 'interact') {
    const spot = state.city.landmarks[objective.key];
    if (distanceBetween(player.x, player.y, spot.x, spot.y) < spot.r + 20) {
      state.mission.objectiveIndex += 1;
      addWanted(state, 4);
      state.banner = { title: 'THE VAULT IS OPEN', sub: 'Four stars. Run for the Safehouse!', t: 0, duration: 4 };
      return 'vault';
    }
  }

  // Crate pickup.
  if (objective && objective.kind === 'collect') {
    for (const crate of state.crates) {
      if (!crate.taken && distanceBetween(player.x, player.y, crate.x, crate.y) < 48) {
        crate.taken = true;
        state.mission.collected += 1;
        updateMission(state);
        return 'crate';
      }
    }
  }

  // Cars: enter a nearby one (stealing a traffic car is a crime).
  if (!player.inCar) {
    const car = nearestStealableCar(state);
    if (car) {
      // enterCar() re-labels a stolen car as the player's, so read the
      // kind before it changes — otherwise a steal never reports as one.
      const wasTraffic = car.kind === 'traffic';
      enterCar(state, car);
      return wasTraffic ? 'steal' : 'enter';
    }
    return null;
  }
  return null;
}

export function nearestStealableCar(state) {
  const player = state.player;
  let best = null;
  let bestD = 64;
  for (const car of state.traffic.cars) {
    const d = distanceBetween(player.x, player.y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (!best && state.playerCar) {
    const d = distanceBetween(player.x, player.y, state.playerCar.x, state.playerCar.y);
    if (d < 64) return state.playerCar;
  }
  return best;
}

function enterCar(state, car) {
  const player = state.player;
  const ownCar = car === state.playerCar;
  if (car.kind === 'traffic' && !ownCar) {
    // A traffic car leaves the flow and becomes the player's ride.
    const index = state.traffic.cars.indexOf(car);
    if (index !== -1) state.traffic.cars.splice(index, 1);
    state.playerCar = car;
    car.kind = 'player';
    addWanted(state, 1);
  }
  player.inCar = true;
  player.car = car;
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  updateMission(state);
}

/** Step out of the car, onto the street beside it. */
export function exitCar(state) {
  const player = state.player;
  if (!player.inCar || !player.car) return;
  const side = state.rng.chance(0.5) ? 1 : -1;
  player.x = player.car.x + Math.cos(player.car.angle + (Math.PI / 2) * side) * 30;
  player.y = player.car.y + Math.sin(player.car.angle + (Math.PI / 2) * side) * 30;
  player.angle = player.car.angle;
  player.inCar = false;
  player.car = null;
  state.city.resolveCircle(player, 11);
}
