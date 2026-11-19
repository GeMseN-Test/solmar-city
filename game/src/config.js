// config.js — every tunable number for Solmar City in one place.

export const WORLD_W = 2880;
export const WORLD_H = 2160;
export const SEA_TOP = 2100;
export const BEACH_TOP = 2020;

export const GRID_PITCH = 360;
export const ROAD_X0 = 180;
export const ROAD_Y0 = 180;
export const ROAD_COUNT_X = 8;
export const ROAD_COUNT_Y = 6;
export const ROAD_WIDTH = 76;

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
  gunDamage: 34,
  gunRange: 520,
  bulletSpeed: 760,
  startAmmo: 48,
  maxAmmo: 240,
  punchDamage: 26,
  punchRange: 36,
  punchArc: 1.1,
  spawnX: 1420,
  spawnY: 1230,
  spawnAngle: -Math.PI / 2,
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

export const CONFIG = {
  WORLD_W,
  WORLD_H,
  SEA_TOP,
  BEACH_TOP,
  GRID_PITCH,
  ROAD_X0,
  ROAD_Y0,
  ROAD_COUNT_X,
  ROAD_COUNT_Y,
  ROAD_WIDTH,
  CAR,
  PLAYER,
  WANTED,
  MONEY_START,
  TRAFFIC_CARS,
  PEDESTRIANS,
  PICKUPS,
  SAVE_KEY,
};

export default CONFIG;
