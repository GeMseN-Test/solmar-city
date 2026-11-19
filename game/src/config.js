// Every tuning number for Solmar City lives here, in one place,
// so a balance tweak never means hunting through game logic.
// Values are the probed v1 numbers plus the v2 bumps (more traffic,
// more pedestrians).

export const WORLD_W = 2880;
export const WORLD_H = 2160;

export const SEA_TOP = 2100;
export const BEACH_TOP = 2020;

export const GRID_PITCH = 360;
export const ROAD_WIDTH = 76;

// Road centre lines: 8 vertical, 6 horizontal.
export const ROAD_XS = [180, 540, 900, 1260, 1620, 1980, 2340, 2700];
export const ROAD_YS = [180, 540, 900, 1260, 1620, 1980];

export const CAR = {
  accel: 640,
  brake: 980,
  reverse: 420,
  maxSpeed: 560,
  maxReverse: 190,
  turnRate: 2.7,
  grip: 3.2,
  drag: 0.55,
  length: 46,
  width: 22,
  ramDamage: 18,
};

export const PLAYER = {
  walkSpeed: 175,
  runSpeed: 268,
  radius: 11,
  maxHp: 100,
  gunDamage: 34,
  gunRange: 520,
  bulletSpeed: 760,
  startAmmo: 48,
  maxAmmo: 240,
  punchDamage: 26,
  punchRange: 36,
  punchArc: 1.1,
};

export const WANTED = {
  max: 5,
  stealCar: 1,
  shoot: 1,
  hitPedestrian: 1,
  killPedestrian: 2,
  decayDelay: 12,
  decayEvery: 8,
  copChaseRadius: 900,
  bustSeconds: 1.6,
};

export const MONEY_START = 50;
export const TRAFFIC_CARS = 16;
export const PEDESTRIANS = 34;

export const PICKUPS = {
  cash: { count: 14, value: 60 },
  health: { count: 8, value: 40 },
  ammo: { count: 8, value: 36 },
};

export const SAVE_KEY = 'solmar-city-save-v1';

// Boats are slower to get going than cars and top out lower;
// each hull then multiplies this base speed (jetski fastest).
export const BOAT_BASE_SPEED = 320;
export const BOAT_ACCEL = 300;

export const CONFIG = {
  WORLD_W,
  WORLD_H,
  SEA_TOP,
  BEACH_TOP,
  GRID_PITCH,
  ROAD_WIDTH,
  ROAD_XS,
  ROAD_YS,
  CAR,
  PLAYER,
  WANTED,
  MONEY_START,
  TRAFFIC_CARS,
  PEDESTRIANS,
  PICKUPS,
  SAVE_KEY,
  BOAT_BASE_SPEED,
  BOAT_ACCEL,
};
