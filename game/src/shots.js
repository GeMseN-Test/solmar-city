// shots.js — Screenshot staging for Solmar City.
// Each shot is a fully-staged gameplay moment: real HUD data, a real
// mission, real coins / radio / Grand Prix countdown — never an empty
// title screen. stageShot(state, name) mutates a fresh world state
// into the scene; shots.json lists the four shots the dossier uses.

export const SHOTS = [
  {
    id: 'downtown',
    name: 'Downtown action',
    query: '?shot=downtown&seed=1',
    caption: 'Downtown Solmar: 12 missions, SCPD heat, live radio.',
  },
  {
    id: 'chase',
    name: 'SCPD chase',
    query: '?shot=chase&seed=1',
    caption: 'Three-star SCPD chase with roadblocks ahead.',
  },
  {
    id: 'night',
    name: 'Neon night',
    query: '?shot=night&seed=1',
    caption: 'Midnight Drive on the radio, Grand Prix countdown ticking.',
  },
  {
    id: 'harbor',
    name: 'Harbor',
    query: '?shot=harbor&seed=1',
    caption: 'M6 Harbor Lights: aboard the Scarlet Speedboat, radio on.',
  },
];

function setHud(state, opts) {
  state.money = opts.money;
  state.missionTitle = opts.missionTitle;
  if (state.sideJobs) {
    state.sideJobs.coinsFound = opts.coinsFound;
    state.sideJobs.faresEarned = opts.faresEarned;
  }
  if (state.radio) {
    state.radio.stationIndex = opts.stationIndex;
    state.radioName = opts.radioName;
  }
  if (state.police) state.police.wanted = opts.wanted;
  // Finisher fix: world.step now mirrors state.wanted into police.wanted
  // every frame, so staged scenes must set the source value too or the
  // staged stars would be wiped on the first stepped frame.
  state.wanted = opts.wanted;
  state.grandPrix = { startsIn: opts.startsIn };
}

export function stageShot(state, name) {
  if (!state || !state.player) return state;
  const p = state.player;
  if (name === 'downtown') {
    // SHOT 1 — full gameplay HUD with example data: money, active
    // mission, coins, radio station, Grand Prix countdown, wanted.
    p.x = 1420;
    p.y = 1230;
    p.angle = -Math.PI / 2;
    p.hp = 100;
    p.ammo = 48;
    setHud(state, {
      money: 2450,
      missionTitle: 'M3 — Grand Solmar Bank Heist ($2,500)',
      coinsFound: 5,
      faresEarned: 230,
      stationIndex: 0,
      radioName: 'SOLMAR FM — sunny pop',
      wanted: 2,
      startsIn: 7320,
    });
    if (state.combat) {
      state.combat.enemies = [
        { x: 1500, y: 1150, angle: 0, hp: 66, maxHp: 100, speed: 150, shootCooldown: 0.5, shirt: '#7a2d8f', skin: '#e8b98a' },
        { x: 1340, y: 1300, angle: 0, hp: 100, maxHp: 100, speed: 150, shootCooldown: 0.9, shirt: '#8f2d2d', skin: '#c98d5f' },
      ];
    }
    state.banner = 'Mission started: Grand Solmar Bank Heist';
  } else if (name === 'chase') {
    p.x = 1800;
    p.y = 1190;
    p.angle = 0;
    p.hp = 82;
    p.ammo = 36;
    setHud(state, {
      money: 3120,
      missionTitle: 'M8 — The Grand Finale ($5,000)',
      coinsFound: 8,
      faresEarned: 410,
      stationIndex: 2,
      radioName: 'NEON NIGHTS — synthwave',
      wanted: 3,
      startsIn: 5400,
    });
    if (state.police2) {
      state.police2.roadblocks = [
        { kind: 'police', dept: 'SCPD', x: 2050, y: 1150, angle: Math.PI / 2, speed: 0, color: '#1c2733', model: 'sedan', roadblock: true },
        { kind: 'police', dept: 'SCPD', x: 2050, y: 1230, angle: Math.PI / 2, speed: 0, color: '#1c2733', model: 'sedan', roadblock: true },
      ];
      if (state.police) {
        for (const rb of state.police2.roadblocks) {
          if (!state.police.cars.includes(rb)) state.police.cars.push(rb);
        }
      }
    }
  } else if (name === 'night') {
    p.x = 2520;
    p.y = 130;
    p.angle = Math.PI;
    p.hp = 100;
    p.ammo = 48;
    setHud(state, {
      money: 5680,
      missionTitle: 'M7 — On Air ($1,200)',
      coinsFound: 10,
      faresEarned: 640,
      stationIndex: 4,
      radioName: 'MIDNIGHT DRIVE — night cruise',
      wanted: 1,
      startsIn: 3661,
    });
    if (state.combat) {
      state.combat.enemies = [
        { x: 2460, y: 180, angle: 0, hp: 100, maxHp: 100, speed: 150, shootCooldown: 0.4, shirt: '#7a2d8f', skin: '#e8b98a' },
        { x: 2580, y: 190, angle: 0, hp: 74, maxHp: 100, speed: 160, shootCooldown: 0.7, shirt: '#2d5a8f', skin: '#f0c8a0' },
        { x: 2520, y: 240, angle: 0, hp: 100, maxHp: 100, speed: 145, shootCooldown: 1.0, shirt: '#8f2d2d', skin: '#8a5a3b' },
      ];
    }
  } else if (name === 'harbor') {
    // SHOT 4 — harbor: M6 in a boat, radio on, Grand Prix countdown.
    const boat = state.boats && state.boats[3];
    if (boat) {
      p.inBoat = true;
      p.boat = boat;
      boat.inUse = true;
      boat.speed = 210;
      p.x = boat.x;
      p.y = boat.y;
      p.angle = boat.angle;
    } else {
      p.x = 1500;
      p.y = 2135;
    }
    p.hp = 100;
    p.ammo = 48;
    setHud(state, {
      money: 1900,
      missionTitle: 'M6 — Harbor Lights ($900)',
      coinsFound: 3,
      faresEarned: 150,
      stationIndex: 1,
      radioName: 'HARBOR 98 — late-night swing',
      wanted: 0,
      startsIn: 7200,
    });
    state.banner = 'M6 Harbor Lights — sail to Gull Island';
  } else {
    // Unknown shot name: fall back to the downtown scene.
    return stageShot(state, 'downtown');
  }
  return state;
}

export function shotById(id) {
  for (const s of SHOTS) if (s.id === id) return s;
  return SHOTS[0];
}

export function shotQuery(name) {
  const s = shotById(name);
  return s.query;
}

export default stageShot;
