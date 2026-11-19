// world.js — Solmar City game world: state, step loop, driving, wanted.
// Written from the v2 spec only. Two hard rules live here and nowhere else:
//   1. Kill sweep + counting happens ONLY in world.step (combat leaves dead
//      enemies in place; world removes them and counts the kill, once).
//   2. Wanted decay happens ONLY in world.stepWanted (police only reads).
// Constants are inlined from the spec (same values as config.js).

import { createRng } from './random.js';
import { buildCity } from './city.js';
import { createCombat, firePlayerBullet, meleeAttack, stepCombat, spawnGang } from './combat.js';
import { createBoats, stepBoating } from './boats.js';
import { createRadio } from './radio.js';
import { createTraffic, stepTraffic } from './traffic.js';
import { createPolice, stepPolice } from './police.js';
import { createPolice2, stepPolice2 } from './police2.js';
import { createSideJobs, stepSideJobs } from './sidejobs.js';
import { createAudio } from './audio.js';
import {
  MISSIONS,
  landmark,
  updateMission,
  tryInteract,
} from './missions.js';
import { registerStoryMissions } from './missions2.js';
import { registerMissions3 } from './missions3.js';
import { registerMissions4 } from './missions4.js';

// Event bitmask (returned by step). Shared with main.js.
export const EV = {
  SHOT: 1,
  PUNCH: 2,
  PICKUP: 4,
  CRASH: 8,
  MISSION: 16,
  DIED: 32,
  BUSTED: 64,
  ENEMY_SHOT: 128,
  VAULT: 256,
  STEAL: 512,
  MISSION_COMPLETE: 1024,
};

// Spec constants (mirror config.js).
const WORLD_W = 2880;
const WORLD_H = 2160;
const SEA_TOP = 2100;
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
const WANTED_MAX = 5;
const WANTED_DECAY_DELAY = 12;
const WANTED_DECAY_EVERY = 8;
const MONEY_START = 50;
const START_AMMO = 48;
const MAX_AMMO = 240;
const MAX_HP = 100;
const PICKUP_RADIUS = 26;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

function spawnPickups(state, rng) {
  const list = [];
  const kinds = [];
  for (let i = 0; i < 14; i++) kinds.push(['cash', 60]);
  for (let i = 0; i < 8; i++) kinds.push(['health', 40]);
  for (let i = 0; i < 8; i++) kinds.push(['ammo', 36]);
  for (const [kind, amount] of kinds) {
    const pt = state.city.randomStreetPoint(rng);
    list.push({ x: pt.x, y: pt.y, kind, amount, taken: false });
  }
  return list;
}

function initWorld(seed) {
  registerStoryMissions();
  registerMissions3();
  registerMissions4();
  const rng = createRng(seed);
  const city = buildCity(rng);
  const state = {
    seed,
    rng,
    city,
    combat: createCombat(),
    traffic: createTraffic(rng, city),
    police: createPolice(),
    police2: createPolice2(),
    boats: createBoats(rng),
    radio: createRadio(),
    audio: createAudio(),
    sideJobs: createSideJobs(rng, city),
    player: {
      x: SPAWN_X,
      y: SPAWN_Y,
      angle: -Math.PI / 2,
      aimAngle: -Math.PI / 2,
      hp: MAX_HP,
      ammo: START_AMMO,
      inCar: false,
      car: null,
      inBoat: false,
      boat: null,
      invuln: 0,
      radius: PLAYER_RADIUS,
      speed: 0,
    },
    gunCooldown: 0,
    punchCooldown: 0,
    money: MONEY_START,
    wanted: 0,
    wantedTimer: 0,
    wantedDecayed: false,
    _lastWanted: 0,
    missionIndex: 0,
    missionsDone: 0,
    storyComplete: false,
    mission: null,
    kills: 0,
    playTime: 0,
    parkedCars: [],
    crates: [],
    particles: [],
    camera: { x: SPAWN_X, y: SPAWN_Y },
    shake: 0,
    dead: false,
    deadTimer: 0,
    busted: false,
    bustedTimer: 0,
    muted: false,
    banner: null,
    hint: '',
    _prevActions: 0,
    _shootWantedCd: 0,
    _crashCd: 0,
    pickups: [],
  };
  state.pickups = spawnPickups(state, rng);
  return state;
}

// ---------------------------------------------------------------------------
// Wanted — decay lives ONLY here.
// ---------------------------------------------------------------------------

export function stepWanted(state, dt) {
  if (state.wanted !== state._lastWanted) {
    // Wanted changed somewhere (steal, vault, shot, ped hit): restart clock.
    state._lastWanted = state.wanted;
    state.wantedTimer = 0;
    state.wantedDecayed = false;
  }
  if (state.wanted <= 0) return;
  state.wantedTimer += dt;
  const threshold = state.wantedDecayed ? WANTED_DECAY_EVERY : WANTED_DECAY_DELAY;
  if (state.wantedTimer >= threshold) {
    state.wanted = Math.max(0, state.wanted - 1);
    state._lastWanted = state.wanted;
    state.wantedTimer = 0;
    state.wantedDecayed = true;
  }
}

function addWanted(state, n) {
  state.wanted = clamp((state.wanted || 0) + n, 0, WANTED_MAX);
}

// ---------------------------------------------------------------------------
// Respawn (WASTED / BUSTED go back to the Safehouse)
// ---------------------------------------------------------------------------

export function respawnPlayer(state, reason) {
  const p = state.player;
  const safe = landmark(state, 'safehouse');
  if (p.inCar && p.car) {
    if (!state.parkedCars) state.parkedCars = [];
    p.car.speed = 0;
    state.parkedCars.push(p.car);
  }
  if (p.inBoat && p.boat) p.boat.inUse = false;
  p.inCar = false;
  p.car = null;
  p.inBoat = false;
  p.boat = null;
  p.x = safe ? safe.x : SPAWN_X;
  p.y = safe ? safe.y : SPAWN_Y;
  p.angle = -Math.PI / 2;
  p.aimAngle = -Math.PI / 2;
  p.hp = MAX_HP;
  p.ammo = Math.max(p.ammo, START_AMMO);
  p.invuln = 2;
  p.speed = 0;
  state.wanted = 0;
  state.wantedTimer = 0;
  state.dead = false;
  state.deadTimer = 0;
  state.busted = false;
  state.bustedTimer = 0;
  if (state.police && Array.isArray(state.police.cars)) state.police.cars = [];
  // Gang members scatter on respawn; if a defeat objective is still
  // open, re-spawn the ones still missing at the mission landmark.
  if (state.combat) state.combat.enemies = [];
  if (state.mission) {
    const def = MISSIONS[state.mission.index];
    if (def) {
      const defeat = def.objectives.find((o) => o.kind === 'defeat');
      if (defeat) {
        const done = (state.kills || 0) - (state.mission.killsAtStart || 0);
        const left = (defeat.count || 1) - done;
        if (left > 0) {
          const reach = def.objectives.find((o) => o.kind === 'reach' && o.key);
          const lm = reach ? landmark(state, reach.key) : null;
          if (lm) spawnGang(state, lm.x, lm.y, left);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

function walkPlayer(state, input, dt) {
  const p = state.player;
  let mx = input.mx || 0;
  let my = input.my || 0;
  const len = Math.sqrt(mx * mx + my * my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  const speed = input.running ? RUN_SPEED : WALK_SPEED;
  p.x += mx * speed * dt;
  p.y += my * speed * dt;
  p.speed = len > 0.01 ? speed : 0;
  if (len > 0.01) p.angle = Math.atan2(my, mx);
  if (state.city.resolveCircle) {
    p.radius = PLAYER_RADIUS;
    state.city.resolveCircle(p);
  }
  p.x = clamp(p.x, 16, WORLD_W - 16);
  p.y = clamp(p.y, 16, SEA_TOP - 4);
}

function driveCar(state, input, dt) {
  const p = state.player;
  const car = p.car;
  if (!car) return 0;
  let events = 0;
  let speed = car.speed || 0;
  const throttle = input.throttle || 0;
  const steer = input.steer || 0;

  if (throttle > 0) speed += CAR_ACCEL * dt;
  else if (throttle < 0) {
    if (speed > 0) speed -= CAR_BRAKE * dt;
    else speed -= CAR_REVERSE * dt;
  } else {
    speed -= speed * 1.1 * dt;
    if (Math.abs(speed) < 4) speed = 0;
  }

  // Handbrake: hard stop + tyre smoke + a little slide.
  if (input.handbrake && Math.abs(speed) > 30) {
    speed -= Math.sign(speed) * 1500 * dt;
    car.angle += steer * CAR_TURN * 0.35 * dt * Math.sign(speed || 1);
    const bx = car.x - Math.cos(car.angle) * 20;
    const by = car.y - Math.sin(car.angle) * 20;
    state.particles.push({ x: bx, y: by, life: 0.5, max: 0.5, kind: 'smoke' });
    if (state.particles.length > 120) state.particles.shift();
  }

  speed = clamp(speed, -CAR_MAX_REVERSE, CAR_MAX_SPEED);
  car.angle += steer * CAR_TURN * dt * clamp(speed / 200, -1, 1);
  car.x += Math.cos(car.angle) * speed * dt;
  car.y += Math.sin(car.angle) * speed * dt;
  car.speed = speed;

  if (state.city.resolveCircle) {
    car.radius = 23;
    const ox = car.x;
    const oy = car.y;
    state.city.resolveCircle(car);
    if ((car.x !== ox || car.y !== oy) && Math.abs(speed) > 220 && state._crashCd <= 0) {
      events |= EV.CRASH;
      state._crashCd = 0.6;
      state.shake = 6;
      if (state.audio) state.audio.crash(Math.abs(speed) / CAR_MAX_SPEED);
    }
  }
  const cx = clamp(car.x, 16, WORLD_W - 16);
  const cy = clamp(car.y, 16, SEA_TOP - 4);
  if (cx !== car.x || cy !== car.y) speed *= 0.4;
  car.x = cx;
  car.y = cy;
  car.speed = speed;

  // Bump traffic cars aside; hard hits crash.
  if (state.traffic) {
    for (const t of state.traffic.cars) {
      const d = dist(car.x, car.y, t.x, t.y);
      if (d < 44 && d > 0.01) {
        const push = (44 - d) / 2;
        const nx = (car.x - t.x) / d;
        const ny = (car.y - t.y) / d;
        t.x -= nx * push;
        t.y -= ny * push;
        if (Math.abs(speed) > 180 && state._crashCd <= 0) {
          events |= EV.CRASH;
          state._crashCd = 0.6;
          state.shake = 6;
          if (state.audio) state.audio.crash(Math.abs(speed) / CAR_MAX_SPEED);
        }
      }
    }
    // Running over pedestrians: +1 wanted for a hit, +2 for a kill.
    for (const ped of state.traffic.peds) {
      if (ped.gone) continue;
      if (dist(car.x, car.y, ped.x, ped.y) < 30 && Math.abs(speed) > 40) {
        if (!ped.down) {
          ped.down = true;
          ped.panic = 1;
          addWanted(state, 1);
        } else if (!ped.countedKill) {
          ped.countedKill = true;
          ped.gone = true;
          addWanted(state, 2);
        }
      }
    }
  }

  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.aimAngle = car.angle;
  p.speed = Math.abs(speed);
  return events;
}

// ---------------------------------------------------------------------------
// World factory — step closes over the live state object.
// ---------------------------------------------------------------------------

export function createWorld(seed) {
  const state = initWorld(seed || 1);

  function reset() {
    const fresh = initWorld(state.seed + 1);
    for (const k of Object.keys(state)) delete state[k];
    Object.assign(state, fresh);
  }

  function step(input, dt) {
    dt = Math.min(Math.max(dt || 0, 0), 0.05);
    if (dt <= 0) return 0;
    let events = 0;

    // WASTED / BUSTED: wait out the timer, then respawn at the Safehouse.
    if (state.dead) {
      state.deadTimer -= dt;
      if (state.deadTimer <= 0) respawnPlayer(state, 'wasted');
      return 0;
    }
    if (state.busted) {
      state.bustedTimer -= dt;
      if (state.bustedTimer <= 0) respawnPlayer(state, 'busted');
      return 0;
    }

    state.playTime += dt;
    state.gunCooldown = Math.max(0, state.gunCooldown - dt);
    state.punchCooldown = Math.max(0, state.punchCooldown - dt);
    state.player.invuln = Math.max(0, state.player.invuln - dt);
    state._shootWantedCd = Math.max(0, (state._shootWantedCd || 0) - dt);
    state._crashCd = Math.max(0, (state._crashCd || 0) - dt);
    state.shake = Math.max(0, state.shake - dt * 14);
    if (state.banner) {
      state.banner.timer -= dt;
      if (state.banner.timer <= 0) state.banner = null;
    }

    const p = state.player;
    const interactPressed = (input.actions & 4) !== 0 && (state._prevActions & 4) === 0;
    state._prevActions = input.actions || 0;

    // --- movement ---
    if (p.inBoat && p.boat) {
      stepBoating(state, input, dt);
      p.x = p.boat.x;
      p.y = p.boat.y;
      p.angle = p.boat.angle;
      p.aimAngle = p.boat.angle;
      p.speed = Math.abs(p.boat.speed || 0);
    } else if (p.inCar && p.car) {
      events |= driveCar(state, input, dt);
    } else {
      walkPlayer(state, input, dt);
    }

    // Aim follows the mouse on foot; the car/boat faces where it goes.
    if (!p.inCar && !p.inBoat && input.aimX !== undefined && input.aimY !== undefined) {
      p.aimAngle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
    }

    // --- combat: shoot / punch (on foot only) ---
    if (input.shooting && !p.inCar && !p.inBoat) {
      const ammoBefore = p.ammo;
      firePlayerBullet(state, p.x, p.y, p.aimAngle);
      if (p.ammo < ammoBefore) {
        events |= EV.SHOT;
        if (state.audio) state.audio.shot();
        // Shooting in public draws heat: wanted at least 1, once per 3s.
        if (state._shootWantedCd <= 0) {
          if ((state.wanted || 0) < 1) state.wanted = 1;
          state._shootWantedCd = 3;
        }
      }
    }
    if ((input.actions & 8) !== 0 && !p.inCar && !p.inBoat) {
      const cdBefore = state.punchCooldown;
      meleeAttack(state);
      if (cdBefore <= 0) {
        events |= EV.PUNCH;
        if (state.audio) state.audio.punch();
      }
    }

    // --- enemies move + shoot; world sweeps the dead (exactly once) ---
    const bulletsBefore = state.combat.bullets.length;
    stepCombat(state, dt);
    if (state.combat.bullets.length > bulletsBefore && (events & EV.SHOT) === 0) {
      events |= EV.ENEMY_SHOT;
    }
    const alive = [];
    for (const e of state.combat.enemies) {
      if (e.hp <= 0) {
        state.kills += 1;
        state.particles.push({ x: e.x, y: e.y, life: 0.6, max: 0.6, kind: 'puff' });
      } else {
        alive.push(e);
      }
    }
    state.combat.enemies = alive;

    // --- city life ---
    stepTraffic(state.traffic, state.city, state.rng, dt);
    stepPolice(state, dt);
    stepPolice2(state, dt);
    stepSideJobs(state, dt);

    // Bust: the police module flags it, world owns the consequence.
    if (state.police && state.police.busted && !state.busted) {
      state.police.busted = false;
      state.busted = true;
      state.bustedTimer = 2.2;
      events |= EV.BUSTED;
      if (state.audio) state.audio.busted();
    }

    // WASTED.
    if (p.hp <= 0 && !state.dead) {
      p.hp = 0;
      state.dead = true;
      state.deadTimer = 2.2;
      events |= EV.DIED;
    }

    // --- pickups (cash / health / ammo) ---
    if (!p.inBoat) {
      for (const pk of state.pickups) {
        if (pk.taken) continue;
        if (dist(p.x, p.y, pk.x, pk.y) < PICKUP_RADIUS) {
          pk.taken = true;
          if (pk.kind === 'cash') state.money += pk.amount;
          else if (pk.kind === 'health') p.hp = Math.min(MAX_HP, p.hp + pk.amount);
          else if (pk.kind === 'ammo') p.ammo = Math.min(MAX_AMMO, p.ammo + pk.amount);
          events |= EV.PICKUP;
          if (state.audio) state.audio.pickup(pk.kind);
        }
      }
    }

    // --- interact (E, edge-triggered) ---
    if (interactPressed) {
      const ev = tryInteract(state);
      events |= ev;
      if (ev & EV.VAULT) {
        if (state.audio) state.audio.pickup('vault');
      } else if (ev & EV.STEAL) {
        if (state.audio) state.audio.pickup('steal');
      } else if (ev & EV.PICKUP) {
        if (state.audio) state.audio.pickup('crate');
      }
    }

    // --- missions ---
    const mev = updateMission(state);
    events |= mev;
    if (mev & EV.MISSION_COMPLETE) {
      if (state.audio) state.audio.missionComplete();
    }

    // --- wanted decay: ONLY here ---
    stepWanted(state, dt);

    // --- ambience ---
    if (state.audio) {
      state.audio.siren((state.wanted || 0) > 0);
      const norm = p.inCar
        ? Math.abs((p.car && p.car.speed) || 0) / CAR_MAX_SPEED
        : p.inBoat
          ? Math.abs((p.boat && p.boat.speed) || 0) / 520
          : 0;
      state.audio.engine(norm);
    }

    // --- particles ---
    for (let i = state.particles.length - 1; i >= 0; i--) {
      state.particles[i].life -= dt;
      if (state.particles[i].life <= 0) state.particles.splice(i, 1);
    }

    // --- camera (boat gets a lookahead) ---
    let tx = p.x;
    let ty = p.y;
    if (p.inBoat && p.boat) {
      tx += Math.cos(p.boat.angle) * 70;
      ty += Math.sin(p.boat.angle) * 70;
    }
    const k = Math.min(1, dt * 5);
    state.camera.x += (tx - state.camera.x) * k;
    state.camera.y += (ty - state.camera.y) * k;
    state.camera.x = clamp(state.camera.x, 640, WORLD_W - 640);
    state.camera.y = clamp(state.camera.y, 400, WORLD_H - 400);

    return events;
  }

  return { state, reset, step };
}
