// world.js — The simulation core of Solmar City.
//
// createWorld(seed) returns { state, reset, step }.
//   state  — the whole game state (player, city, traffic, combat,
//            police, boats, radio, side jobs, missions, pickups).
//   reset() — re-rolls the world with a fresh seed.
//   step(input, dt) — advances one frame. `input` is a plain VALUES
//            object built by main.js each frame:
//              { mx, my, aimX, aimY, actions, shooting, running,
//                steer, throttle, handbrake }
//            actions is a bitmask (CONFIRM 1, PAUSE 2, INTERACT 4,
//            PUNCH 8, MUTE 16, RADIO 32). step returns an events
//            bitmask (EV.* from missions.js).
//
// World.step is also the place where dead enemies are removed and
// kills are counted — combat only drops them to hp <= 0 and leaves
// them in place. Defeat objectives read state.kills.
//
// Mission wiring: missions2/3/4 are registered here, in order, so
// the story list is M1–M12 by the time the first frame runs.

import { buildCity } from './city.js';
import { createCombat, firePlayerBullet, meleeAttack, stepCombat } from './combat.js';
import { createTraffic, stepTraffic } from './traffic.js';
import { createBoats, stepBoating } from './boats.js';
import { createRadio, tickRadio } from './radio.js';
import { createPolice, stepPolice } from './police.js';
import { createPolice2, stepPolice2 } from './police2.js';
import { createSideJobs, stepSideJobs } from './sidejobs.js';
import { mulberry32, randRange, pick } from './random.js';
import { saveSnapshot, applySave } from './save.js';
import {
  EV,
  MISSIONS,
  startMission,
  updateMission,
  currentObjective,
  missionMarker,
  tryInteract,
  exitCar,
} from './missions.js';
import { registerStoryMissions } from './missions2.js';
import { registerNightMissions } from './missions3.js';
import { registerFinalMissions } from './missions4.js';

registerStoryMissions();
registerNightMissions();
registerFinalMissions();

// ------------------------------------------------------------------
// Tunables (same values the spec probed from the live game)
// ------------------------------------------------------------------

const WORLD_W = 2880;
const WORLD_H = 2160;
const SEA_TOP = 2100;
const BEACH_TOP = 2020;
const SPAWN_X = 1420;
const SPAWN_Y = 1230;
const WALK_SPEED = 175;
const RUN_SPEED = 268;
const PLAYER_RADIUS = 11;
const CAR_ACCEL = 640;
const CAR_BRAKE = 980;
const CAR_REVERSE = 420;
const CAR_MAX_SPEED = 560;
const CAR_MAX_REVERSE = 190;
const CAR_TURN = 2.7;
const CAR_GRIP = 3.2;
const CAR_DRAG = 0.55;
const RAM_DAMAGE = 18;
const WANTED_DECAY_DELAY = 12;
const WANTED_DECAY_EVERY = 8;
const BUST_SECONDS = 1.6;
const BUST_RANGE = 46;
const MONEY_START = 50;
const START_AMMO = 48;

const PICKUP_DEFS = [
  { kind: 'cash', count: 14, value: 60 },
  { kind: 'health', count: 8, value: 40 },
  { kind: 'ammo', count: 8, value: 36 },
];

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// ------------------------------------------------------------------
// State construction
// ------------------------------------------------------------------

function buildState(seed) {
  const rng = mulberry32(seed >>> 0);
  const city = buildCity(rng);
  const state = {
    seed: seed >>> 0,
    rng,
    city,
    traffic: createTraffic(rng, city),
    combat: createCombat(),
    police: createPolice(),
    police2: createPolice2(),
    boats: createBoats(rng),
    radio: createRadio(),
    sideJobs: createSideJobs(rng, city),
    player: {
      x: SPAWN_X,
      y: SPAWN_Y,
      angle: -Math.PI / 2,
      aimAngle: -Math.PI / 2,
      hp: 100,
      ammo: START_AMMO,
      inCar: false,
      car: null,
      inBoat: false,
      boat: null,
      invuln: 0,
    },
    money: MONEY_START,
    wanted: 0,
    crimeTimer: 0,
    wantedDecayTimer: 0,
    kills: 0,
    mission: null,
    missionIndex: 0,
    missionsDone: 0,
    storyComplete: false,
    crates: [],
    pickups: [],
    particles: [],
    camera: { x: SPAWN_X, y: SPAWN_Y },
    playTime: 0,
    gunCooldown: 0,
    punchCooldown: 0,
    bustTimer: 0,
    bannerText: '',
    bannerTimer: 0,
    muted: false,
    radioMuted: false,
  };

  for (const def of PICKUP_DEFS) {
    for (let i = 0; i < def.count; i++) {
      const pt = city.randomStreetPoint(rng);
      state.pickups.push({
        x: pt.x,
        y: pt.y,
        kind: def.kind,
        value: def.value,
        taken: false,
        bob: rng() * Math.PI * 2,
      });
    }
  }

  return state;
}

// ------------------------------------------------------------------
// Respawn
// ------------------------------------------------------------------

export function respawnPlayer(state, reason) {
  const p = state.player;
  const safe = state.city.landmarks.safehouse;
  p.x = safe ? safe.x : SPAWN_X;
  p.y = safe ? safe.y : SPAWN_Y;
  p.angle = -Math.PI / 2;
  p.hp = 100;
  p.invuln = 2;
  if (p.inBoat && p.boat) p.boat.inUse = false;
  p.inBoat = false;
  p.boat = null;
  if (p.inCar) {
    p.inCar = false;
    p.car = null;
  }
  state.wanted = 0;
  state.bustTimer = 0;
  state.crimeTimer = 0;
  if (reason === 'busted') {
    state.money = Math.max(0, (state.money || 0) - 100);
    state.bannerText = 'BUSTED — the cops took $100';
  } else {
    state.bannerText = 'WASTED — you wake up at the safehouse';
  }
  state.bannerTimer = 4;
  state.camera.x = p.x;
  state.camera.y = p.y;
}

// ------------------------------------------------------------------
// Driving
// ------------------------------------------------------------------

function stepDriving(state, input, dt) {
  const p = state.player;
  const car = p.car;
  if (!car) return 0;
  let events = 0;

  const fwdX = Math.cos(car.angle);
  const fwdY = Math.sin(car.angle);
  let speed = car.speed || 0;

  if (input.handbrake) {
    // Handbrake: hard decel + tyre smoke + a little slide.
    const old = speed;
    speed *= Math.max(0, 1 - 6 * dt);
    if (Math.abs(old) > 120) {
      state.particles.push({
        x: car.x - fwdX * 20 + (Math.random() - 0.5) * 14,
        y: car.y - fwdY * 20 + (Math.random() - 0.5) * 14,
        vx: 0, vy: -12, life: 0.7, maxLife: 0.7,
        color: 'rgba(200,200,200,0.7)', size: 7,
      });
      car.angle += input.steer * 0.5 * dt * Math.sign(speed || 1);
    }
  } else if (input.throttle > 0) {
    speed += CAR_ACCEL * input.throttle * dt;
  } else if (input.throttle < 0) {
    if (speed > 30) speed -= CAR_BRAKE * dt;
    else speed += CAR_REVERSE * input.throttle * dt;
  }

  speed *= Math.max(0, 1 - CAR_DRAG * dt);
  speed = clamp(speed, -CAR_MAX_REVERSE, CAR_MAX_SPEED);
  const grip = clamp(Math.abs(speed) / 220, 0, 1);
  car.angle += input.steer * CAR_TURN * grip * dt * (speed >= 0 ? 1 : -1);
  car.speed = speed;

  const nx = car.x + Math.cos(car.angle) * speed * dt;
  const ny = car.y + Math.sin(car.angle) * speed * dt;
  // resolveCircle takes an entity object and pushes it out of
  // buildings in place; it returns true when it hit something.
  const probe = { x: nx, y: ny };
  const hit = state.city.resolveCircle(probe, 23);
  if (hit) {
    if (Math.abs(speed) > 160) events |= EV.CRASH;
    car.speed = -speed * 0.25;
  } else {
    car.x = probe.x;
    car.y = probe.y;
  }
  car.x = clamp(car.x, 20, WORLD_W - 20);
  car.y = clamp(car.y, 20, SEA_TOP - 8);
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;

  // Ram pedestrians: they go down, the law notices.
  if (Math.abs(speed) > 60) {
    for (const ped of state.traffic.peds) {
      if (!ped.down && dist(car.x, car.y, ped.x, ped.y) < 34) {
        ped.down = true;
        ped.panic = 1;
        state.wanted = Math.min(5, state.wanted + 1);
        state.crimeTimer = 0;
        events |= EV.CRASH;
      }
    }
  }
  return events;
}

// ------------------------------------------------------------------
// On foot
// ------------------------------------------------------------------

function stepWalking(state, input, dt) {
  const p = state.player;
  let mx = input.mx || 0;
  let my = input.my || 0;
  const len = Math.sqrt(mx * mx + my * my);
  if (len > 1) { mx /= len; my /= len; }
  const speed = input.running ? RUN_SPEED : WALK_SPEED;
  const nx = p.x + mx * speed * dt;
  const ny = p.y + my * speed * dt;
  if (mx !== 0 || my !== 0) p.angle = Math.atan2(my, mx);
  // resolveCircle takes an entity object and pushes it out of
  // buildings in place; it returns true when it hit something.
  const probe = { x: nx, y: ny };
  const hit = state.city.resolveCircle(probe, PLAYER_RADIUS);
  if (!hit) {
    p.x = clamp(probe.x, 16, WORLD_W - 16);
    // The sea stops a walker at the beach.
    p.y = clamp(probe.y, 16, BEACH_TOP + 78);
  } else {
    const hx = { x: nx, y: p.y };
    if (!state.city.resolveCircle(hx, PLAYER_RADIUS)) p.x = clamp(hx.x, 16, WORLD_W - 16);
    else {
      const hy = { x: p.x, y: ny };
      if (!state.city.resolveCircle(hy, PLAYER_RADIUS)) p.y = clamp(hy.y, 16, BEACH_TOP + 78);
    }
  }
}

// ------------------------------------------------------------------
// createWorld
// ------------------------------------------------------------------

export function createWorld(seed) {
  const state = buildState(seed == null ? 1 : seed);

  function reset() {
    const fresh = buildState((Math.random() * 0x7fffffff) | 0);
    for (const k of Object.keys(state)) delete state[k];
    Object.assign(state, fresh);
  }

  function step(input, dt) {
    dt = Math.min(Math.max(dt || 0, 0), 0.05);
    let events = 0;
    const p = state.player;
    state.playTime += dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (state.gunCooldown > 0) state.gunCooldown -= dt;
    if (state.punchCooldown > 0) state.punchCooldown -= dt;

    // Aim follows the mouse (world coords, supplied by main).
    if (input.aimX != null && input.aimY != null) {
      p.aimAngle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
    }

    const actions = input.actions || 0;

    // E — interact: steal a car, board a boat, grab a crate, vault.
    if (actions & 4) events |= tryInteract(state);

    // Space on foot — punch. Space while driving is the handbrake.
    if ((actions & 8) && !p.inCar && !p.inBoat) {
      const hit = meleeAttack(state);
      if (hit) events |= EV.PUNCH;
    }

    // Mouse held — fire toward the aim angle.
    if (input.shooting && !p.inCar && !p.inBoat) {
      const fired = firePlayerBullet(state, p.x, p.y, p.aimAngle);
      if (fired) events |= EV.SHOT;
    }

    // Movement: boat, car, or feet.
    if (p.inBoat) {
      stepBoating(state, input, dt);
    } else if (p.inCar) {
      events |= stepDriving(state, input, dt);
    } else {
      stepWalking(state, input, dt);
    }

    // Combat moves bullets and enemies; the dead are swept HERE.
    stepCombat(state, dt);
    if (state.combat && state.combat.enemies) {
      const alive = [];
      for (const e of state.combat.enemies) {
        if (e.hp <= 0) state.kills += 1;
        else alive.push(e);
      }
      state.combat.enemies = alive;
    }

    stepTraffic(state.traffic, state.city, state.rng, dt);

    // Police chase + roadblocks/heli, then side jobs (taxi + coins).
    const pev = stepPolice(state, dt);
    if (typeof pev === 'number') events |= pev;
    stepPolice2(state, dt);
    const sev = stepSideJobs(state, dt);
    if (typeof sev === 'number') events |= sev;

    // Radio scheduler ticks every frame (no-op until a gesture).
    tickRadio(state.radio);

    // Pickups: cash / health / ammo on the street.
    for (const pk of state.pickups) {
      if (!pk.taken && dist(p.x, p.y, pk.x, pk.y) < 34) {
        pk.taken = true;
        if (pk.kind === 'cash') state.money += pk.value;
        else if (pk.kind === 'health') p.hp = Math.min(100, p.hp + pk.value);
        else if (pk.kind === 'ammo') p.ammo = Math.min(240, p.ammo + pk.value);
        events |= EV.PICKUP;
      }
    }

    // Mission crates.
    for (const c of state.crates || []) {
      if (!c.taken && dist(p.x, p.y, c.x, c.y) < 40) {
        c.taken = true;
        if (state.mission) state.mission.collected += 1;
        events |= EV.PICKUP;
      }
    }

    // Wanted decay: 12s clear, then one star every 8s.
    if (state.wanted > 0) {
      state.crimeTimer += dt;
      if (state.crimeTimer > WANTED_DECAY_DELAY) {
        state.wantedDecayTimer += dt;
        if (state.wantedDecayTimer >= WANTED_DECAY_EVERY) {
          state.wantedDecayTimer = 0;
          state.wanted -= 1;
        }
      }
    } else {
      state.wantedDecayTimer = 0;
    }

    // Busted: a cop car sits on the player for 1.6s.
    if (state.wanted > 0 && state.police && state.police.cars) {
      let pressed = false;
      for (const cop of state.police.cars) {
        if (!cop.roadblock && dist(p.x, p.y, cop.x, cop.y) < BUST_RANGE) {
          pressed = true;
          break;
        }
      }
      if (pressed && !p.inCar) {
        state.bustTimer += dt;
        if (state.bustTimer >= BUST_SECONDS) {
          events |= EV.BUSTED;
          respawnPlayer(state, 'busted');
        }
      } else {
        state.bustTimer = 0;
      }
    }

    // Wasted.
    if (p.hp <= 0) {
      events |= EV.DIED;
      respawnPlayer(state, 'wasted');
    }

    // Missions.
    const outcome = updateMission(state);
    if (outcome === 'advanced') events |= EV.MISSION;
    else if (outcome === 'complete') events |= EV.MISSION_COMPLETE;

    // Particles age out.
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const pt = state.particles[i];
      pt.life -= dt;
      pt.x += (pt.vx || 0) * dt;
      pt.y += (pt.vy || 0) * dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }

    // Camera follows the player, with a lookahead in the direction
    // of travel — further ahead in a boat, so the sea stays visible.
    const look = p.inBoat ? 110 : p.inCar ? 70 : 34;
    const tx = p.x + Math.cos(p.angle) * look;
    const ty = p.y + Math.sin(p.angle) * look;
    state.camera.x += (tx - state.camera.x) * Math.min(1, 6 * dt);
    state.camera.y += (ty - state.camera.y) * Math.min(1, 6 * dt);

    return events;
  }

  return { state, reset, step };
}

// Save helpers: saveSnapshot / applySave live in save.js; world just
// wires them to the live state so main.js has one place to call.
export function snapshot(state) {
  return saveSnapshot(state);
}

export function applySnapshot(state, save) {
  applySave(state, save);
}

// Re-exported for callers that only import world.js.
export { EV, MISSIONS, startMission, currentObjective, missionMarker, exitCar };
