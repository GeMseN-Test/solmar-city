// The screenshot scenes behind ?shot=start|city|chase|mission. Each one
// plays the real rules forward from a fresh world for a fixed number of
// steps, steered by a simple autopilot — drive to the next road junction,
// steal the nearest car, run from the cops — so the frame is what a short
// game really looks like, and the same seed always gives the same frame.
//
// The autopilot speaks the same input the player does: a move vector, a
// steering angle, a throttle, and one-shot action flags.

import { STEP } from './world.js';
import { addWanted } from './police.js';
import { startMission } from './missions.js';
import { boardBoat } from './boats.js';
import { cycleRadio } from './radio.js';
import { angleDifference, clampNumber, distanceBetween } from './util.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const SAMPLE = STEP;

/** Blank input: nothing held, nothing pressed. */
function emptyInput() {
  return { mx: 0, my: 0, steer: 0, throttle: 0, handbrake: false, running: false, aimX: 0, aimY: 0, shooting: false, actions: 0 };
}

/** Drive a car toward a point: steer at it, ease off when facing away. */
function driveToward(state, tx, ty) {
  const input = emptyInput();
  const car = state.player.car;
  const dx = tx - car.x;
  const dy = ty - car.y;
  const wanted = Math.atan2(dy, dx);
  const diff = angleDifference(car.angle, wanted);
  input.steer = clampNumber(diff * 2.2, -1, 1);
  if (Math.abs(diff) < 1.1) input.throttle = 1;
  else if (Math.abs(diff) > 2.3) {
    input.throttle = -0.6;
    input.steer = -input.steer;
  } else {
    input.throttle = 0.35;
  }
  input.aimX = tx;
  input.aimY = ty;
  // Brake for a pedestrian crossing ahead: a careful driver, and it keeps
  // the city scene's wanted level clean while the autopilot cruises.
  const aheadX = Math.cos(car.angle);
  const aheadY = Math.sin(car.angle);
  for (const ped of state.traffic.peds) {
    if (ped.down > 0) continue;
    const pdx = ped.x - car.x;
    const pdy = ped.y - car.y;
    const dist = Math.hypot(pdx, pdy);
    if (dist < 150 && dist > 1) {
      const dot = (pdx * aheadX + pdy * aheadY) / dist;
      if (dot > 0.86) {
        input.throttle = -0.8;
        input.steer = 0;
        return input;
      }
    }
  }
  return input;
}

/** True when the straight line between two points clears every building. */
function segmentClear(state, x1, y1, x2, y2) {
  const steps = Math.ceil(distanceBetween(x1, y1, x2, y2) / 20);
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (state.city.pointInBuilding(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 24)) return false;
  }
  return true;
}

/**
 * The next road junction on a route to a point: a breadth-first search over
 * the intersection grid, so the autopilot drives along roads instead of
 * cutting straight across blocks (and their buildings).
 */
function routeWaypoint(state, tx, ty) {
  const player = state.player;
  if (distanceBetween(player.x, player.y, tx, ty) < 70) return { x: tx, y: ty };
  // Off the road (a ram can shove a car onto the grass): get back to the
  // nearest stretch of asphalt before following the junction graph.
  if (!state.city.isRoad(player.x, player.y)) {
    return state.city.nearestRoadPoint(player.x, player.y);
  }
  const start = state.city.nearestNode(player.x, player.y);
  const goal = state.city.nearestNode(tx, ty);
  if (start.ix === goal.ix && start.iy === goal.iy) {
    // Already at the target's junction: head straight in when the way is
    // clear, or the junction itself when a building stands between.
    if (segmentClear(state, player.x, player.y, tx, ty)) return { x: tx, y: ty };
    return state.city.nodePoint(goal.ix, goal.iy);
  }
  const key = (ix, iy) => `${ix},${iy}`;
  const cameFrom = new Map();
  const queue = [{ ix: start.ix, iy: start.iy }];
  cameFrom.set(key(start.ix, start.iy), null);
  while (queue.length > 0) {
    const node = queue.shift();
    if (node.ix === goal.ix && node.iy === goal.iy) break;
    for (const next of state.city.nodeNeighbours(node.ix, node.iy)) {
      if (!cameFrom.has(key(next.ix, next.iy))) {
        cameFrom.set(key(next.ix, next.iy), node);
        queue.push(next);
      }
    }
  }
  if (!cameFrom.has(key(goal.ix, goal.iy))) return { x: tx, y: ty };
  let node = { ix: goal.ix, iy: goal.iy };
  let previous = cameFrom.get(key(node.ix, node.iy));
  while (previous && !(previous.ix === start.ix && previous.iy === start.iy)) {
    node = previous;
    previous = cameFrom.get(key(node.ix, node.iy));
  }
  return state.city.nodePoint(node.ix, node.iy);
}

/** Drive a car toward a point by way of the road grid. */
function driveTo(state, tx, ty) {
  const waypoint = routeWaypoint(state, tx, ty);
  return driveToward(state, waypoint.x, waypoint.y);
}

/**
 * A driver that also notices when the car is wedged: if full throttle
 * cannot get it past 30 px/s for a whole second, it backs out for a
 * moment and tries again, instead of grinding against the same wall.
 */
function makeDriver() {
  let stuckSteps = 0;
  let reverseSteps = 0;
  return function drive(state, tx, ty) {
    const car = state.player.car;
    if (!car) return emptyInput();
    if (reverseSteps > 0) {
      reverseSteps -= 1;
      const input = emptyInput();
      input.throttle = -0.7;
      input.steer = 0.6;
      input.aimX = tx;
      input.aimY = ty;
      return input;
    }
    const input = driveTo(state, tx, ty);
    if (input.throttle === 1 && Math.abs(car.speed) < 30) stuckSteps += 1;
    else stuckSteps = 0;
    if (stuckSteps > 60) {
      stuckSteps = 0;
      reverseSteps = 45;
      const backing = emptyInput();
      backing.throttle = -0.7;
      backing.steer = 0.6;
      backing.aimX = tx;
      backing.aimY = ty;
      return backing;
    }
    return input;
  };
}

/** Walk toward a point on foot, by way of the roads when it is far. */
function walkToward(state, tx, ty) {
  const input = emptyInput();
  let target = { x: tx, y: ty };
  if (distanceBetween(state.player.x, state.player.y, tx, ty) > 110) {
    target = routeWaypoint(state, tx, ty);
  }
  const dx = target.x - state.player.x;
  const dy = target.y - state.player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) return input;
  input.mx = dx / dist;
  input.my = dy / dist;
  input.running = true;
  input.aimX = target.x;
  input.aimY = target.y;
  return input;
}

/** Put the player behind the wheel of a nearby traffic car, no questions. */
function stageIntoCar(state, near) {
  const player = state.player;
  const spot = near ?? state.city.randomStreetPoint(state.rng);
  const car = state.traffic.cars.reduce((best, candidate) => {
    const d = distanceBetween(spot.x, spot.y, candidate.x, candidate.y);
    const bestD = best ? distanceBetween(spot.x, spot.y, best.x, best.y) : Infinity;
    return d < bestD ? candidate : best;
  }, null);
  if (!car) return false;
  const index = state.traffic.cars.indexOf(car);
  if (index !== -1) state.traffic.cars.splice(index, 1);
  state.playerCar = car;
  car.kind = 'player';
  car.x = spot.x;
  car.y = spot.y;
  car.speed = 0;
  player.inCar = true;
  player.car = car;
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  return true;
}

/** The next junction on a loop around downtown, for the city drive. */
function nextDowntownJunction(state) {
  const loop = [
    { ix: 2, iy: 2 }, { ix: 5, iy: 2 }, { ix: 5, iy: 3 },
    { ix: 2, iy: 3 }, { ix: 2, iy: 2 },
  ];
  const node = state.city.nearestNode(state.player.x, state.player.y);
  for (let i = 0; i < loop.length; i += 1) {
    if (loop[i].ix === node.ix && loop[i].iy === node.iy) {
      return state.city.nodePoint(loop[(i + 1) % loop.length].ix, loop[(i + 1) % loop.length].iy);
    }
  }
  return state.city.nodePoint(loop[0].ix, loop[0].iy);
}

function runSteps(world, seconds, drive) {
  const count = Math.round(seconds / SAMPLE);
  for (let i = 0; i < count; i += 1) {
    world.step(drive(world.state), SAMPLE);
  }
}

/**
 * Set `world` to the named scene (start, city, chase, mission or harbor;
 * any other name is start) and return the screen to draw over it.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;

  if (name !== 'city' && name !== 'chase' && name !== 'mission' && name !== 'harbor') {
    // Title backdrop: the city idles for a few seconds under the menu.
    runSteps(world, 6, () => emptyInput());
    state.camera.x = state.player.x;
    state.camera.y = state.player.y - 260;
    return { screen: SCREEN_TITLE };
  }

  if (name === 'city') {
    stageIntoCar(state);
    const drive = makeDriver();
    let target = nextDowntownJunction(state);
    runSteps(world, 20, () => {
      if (distanceBetween(state.player.x, state.player.y, target.x, target.y) < 70) {
        target = nextDowntownJunction(state);
      }
      return drive(state, target.x, target.y);
    });
    return { screen: SCREEN_PLAY };
  }

  if (name === 'chase') {
    stageIntoCar(state);
    addWanted(state, 3);
    const drive = makeDriver();
    let target = nextDowntownJunction(state);
    let retargetIn = 0;
    runSteps(world, 10, (current) => {
      retargetIn -= SAMPLE;
      if (retargetIn <= 0) {
        retargetIn = 2.5;
        // Flee around the downtown loop: pick the loop junction farthest
        // from the nearest cruiser, so the car keeps circulating instead
        // of getting boxed into a map edge.
        let nearest = null;
        let nearestD = Infinity;
        for (const copCar of current.police.cars) {
          const d = distanceBetween(current.player.x, current.player.y, copCar.x, copCar.y);
          if (d < nearestD) {
            nearestD = d;
            nearest = copCar;
          }
        }
        const loop = [
          { ix: 2, iy: 2 }, { ix: 5, iy: 2 }, { ix: 5, iy: 3 }, { ix: 2, iy: 3 },
        ].map((n) => current.city.nodePoint(n.ix, n.iy));
        let best = loop[0];
        let bestD = -1;
        for (const point of loop) {
          const d = nearest ? distanceBetween(point.x, point.y, nearest.x, nearest.y) : 0;
          if (d > bestD) {
            bestD = d;
            best = point;
          }
        }
        target = best;
      }
      if (distanceBetween(current.player.x, current.player.y, target.x, target.y) < 70) {
        target = nextDowntownJunction(current);
      }
      return drive(current, target.x, target.y);
    });
    return { screen: SCREEN_PLAY };
  }

  if (name === 'harbor') {
    // Harbor Lights: Mara at the helm off the Marina, the radio on, Gull
    // Island ahead — the boat, the sea and the v2 HUD in one frame.
    startMission(state, 5);
    boardBoat(state, state.boats[0]);
    cycleRadio(state.radio);
    runSteps(world, 2, () => {
      const input = emptyInput();
      input.throttle = 0.6;
      input.steer = 0.08;
      input.aimX = state.player.x + 200;
      input.aimY = state.player.y;
      return input;
    });
    return { screen: SCREEN_PLAY };
  }

  // Mission: Harbor Run — Mara already has wheels for this one, so the
  // frame catches her arriving at the crates: the objective marker, the
  // docks, and the "Pick up 3 crates" job on the HUD.
  startMission(state, 1);
  stageIntoCar(state, state.city.nearestRoadPoint(700, 180));
  const drive = makeDriver();
  runSteps(world, 16, (current) => {
    const crate = current.crates.find((c) => !c.taken);
    if (!crate) return drive(current, current.city.landmarks.marina.x, current.city.landmarks.marina.y);
    return drive(current, crate.x, crate.y);
  });
  return { screen: SCREEN_PLAY };
}
