// Solmar City — one place for every number the game tunes by.
// Nothing here knows about the canvas or the loop; the other modules
// read these constants so a tweak in one place retunes the whole city.

export const WORLD = { width: 2880, height: 2160 };

// The city is a grid: roads run every GRID.pitch pixels, GRID.roadWidth wide,
// centred on the ROAD_X / ROAD_Y lines. Blocks between the roads hold the
// buildings, parks and landmarks. The sea sits along the south edge.
export const GRID = { pitch: 360, roadWidth: 76, firstRoad: 180 };
export const ROAD_X = [180, 540, 900, 1260, 1620, 1980, 2340, 2700];
export const ROAD_Y = [180, 540, 900, 1260, 1620, 1980];
export const BEACH_TOP = 2020;
export const SEA_TOP = 2100;

// Sun-soaked coastal palette: warm sand, teal sea, pastel blocks.
export const COLORS = {
  grass: '#79b264',
  parkGrass: '#5da24e',
  sand: '#e9d29b',
  sea: '#2f9fc2',
  seaDeep: '#1f7ea6',
  road: '#40454f',
  roadEdge: '#2f333c',
  sidewalk: '#b7ad97',
  laneDash: '#e8e4d2',
  crosswalk: '#d8d2bd',
  buildingRoofs: ['#e8a0a0', '#a0c4e8', '#e8d29a', '#b5d8a0', '#d8a0d0', '#f0b070', '#9ad0c8', '#c8b8e8'],
  buildingWalls: ['#f2c9c9', '#c9dcf2', '#f2e3bd', '#d2e8c2', '#e8c9e8', '#f6d3a8', '#bfe8e0', '#ddd2f2'],
  parkTree: '#3f7d3a',
  parkTreeLight: '#57a04c',
};

// On foot.
export const PLAYER = {
  walkSpeed: 175,
  runSpeed: 268,
  radius: 11,
  maxHealth: 100,
  punchDamage: 26,
  punchRange: 36,
  punchArc: 1.1,
  gunDamage: 34,
  gunRange: 520,
  bulletSpeed: 760,
  startAmmo: 48,
  maxAmmo: 240,
};

// Driving: arcade handling, quick to pick up, with a little slide.
export const CAR = {
  accel: 640,
  brake: 980,
  reverseAccel: 420,
  maxSpeed: 560,
  maxReverse: 190,
  turnRate: 2.7,
  grip: 3.2,
  drag: 0.55,
  length: 46,
  width: 22,
  ramDamage: 18,
};

// Wanted level: 0 to 5 stars. Crimes add stars; hiding sheds them.
export const WANTED = {
  max: 5,
  stealCar: 1,
  shoot: 1,
  hitPedestrian: 1,
  killPedestrian: 2,
  killGang: 0,
  decayDelay: 12,
  decayEvery: 8,
  copChaseRadius: 900,
  bustSeconds: 1.6,
};

export const TRAFFIC_CARS = 16;
export const PEDESTRIANS = 34;
export const GANG_SHOT_COOLDOWN = 1.15;

export const SAVE_KEY = 'solmar-city-save-v1';
export const MONEY_START = 50;

// Pickups scattered around the city.
export const PICKUPS = {
  cash: { count: 14, value: 60 },
  health: { count: 8, heal: 40 },
  ammo: { count: 8, amount: 36 },
};

// v2 retry (18 Nov 2026): pickup counts verified against the live game — 14 cash, 8 health, 8 ammo.
