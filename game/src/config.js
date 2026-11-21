// config.js — all tuning numbers for Solmar City in one place.

export const WORLD_WIDTH = 2880;
export const WORLD_HEIGHT = 2160;
export const WORLD = { width: WORLD_WIDTH, height: WORLD_HEIGHT };
export const SEA_TOP = 2100;
export const BEACH_TOP = 2020;
export const GRID_PITCH = 360;
export const ROAD_WIDTH = 76;

export const ROADS_X = [180, 540, 900, 1260, 1620, 1980, 2340, 2700];
export const ROADS_Y = [180, 540, 900, 1260, 1620, 1980];

export const TRAFFIC_CARS = 16;
export const PEDESTRIANS = 34;

export const MONEY_START = 50;
export const SAVE_KEY = 'solmar-city-save-v1';

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
  gunCooldown: 0.22,
  punchCooldown: 0.45,
  maxHp: 100,
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

export const PICKUPS = {
  cashCount: 14,
  cashValue: 60,
  healthCount: 8,
  healthValue: 40,
  ammoCount: 8,
  ammoValue: 36,
};

export const BOAT = {
  baseTopSpeed: 320,
  accel: 260,
  turnRate: 1.6,
  drag: 0.4,
};

export const MISSION_PAYOUTS = [200, 400, 600, 800, 2500, 900, 1200, 5000, 1500, 7500, 3000, 10000];
export const TOTAL_MISSION_PAYOUT = 33600;

export const CONFIG = {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD,
  SEA_TOP,
  BEACH_TOP,
  GRID_PITCH,
  ROAD_WIDTH,
  ROADS_X,
  ROADS_Y,
  TRAFFIC_CARS,
  PEDESTRIANS,
  MONEY_START,
  SAVE_KEY,
  CAR,
  PLAYER,
  WANTED,
  PICKUPS,
  BOAT,
  MISSION_PAYOUTS,
  TOTAL_MISSION_PAYOUT,
};

export default CONFIG;
