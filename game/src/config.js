// config.js — every tuning number for Solmar City in one place.
// Nothing here reads game state; other modules import these values
// so a balance tweak only ever needs one edit.

// The world is 2880 wide, 2160 tall. The sea is the strip at the
// bottom (y past 2100); the beach is the strip just above it.
export const WORLD_W = 2880;
export const WORLD_H = 2160;
export const WORLD_WIDTH = WORLD_W;
export const WORLD_HEIGHT = WORLD_H;
export const SEA_TOP = 2100;
export const BEACH_TOP = 2020;

// Streets form a grid: vertical roads at x = 180, 540, ... 2700 and
// horizontal roads at y = 180, 540, ... 1980. Each road is 76px wide.
export const GRID_PITCH = 360;
export const ROAD_X0 = 180;
export const ROAD_Y0 = 180;
export const ROAD_X1 = 2700;
export const ROAD_Y1 = 1980;
export const ROAD_WIDTH = 76;
export const NODE_COUNT_X = 8;
export const NODE_COUNT_Y = 6;

// Cars: how fast they speed up, brake, reverse and turn.
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

// The player on foot and with the pistol.
export const PLAYER = {
  walkSpeed: 175,
  runSpeed: 268,
  radius: 11,
  spawnX: 1420,
  spawnY: 1230,
  spawnAngle: -Math.PI / 2,
  maxHp: 100,
  gunDamage: 34,
  gunRange: 520,
  bulletSpeed: 760,
  startAmmo: 48,
  maxAmmo: 240,
  gunCooldown: 0.22,
  punchDamage: 26,
  punchRange: 36,
  punchArc: 1.1,
  punchCooldown: 0.45,
};

// Wanted stars: what earns them, how they fade, how the bust works.
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

// Money and crowds.
export const MONEY_START = 50;
export const TRAFFIC_CARS = 16;
export const PEDESTRIANS = 34;

// Pickups scattered around the city: 14 cash ($60 each), 8 health
// (+40 HP each), 8 ammo (+36 bullets each).
export const PICKUPS = {
  cash: { count: 14, value: 60 },
  health: { count: 8, value: 40 },
  ammo: { count: 8, value: 36 },
};

// Local-storage key for the save game.
export const SAVE_KEY = 'solmar-city-save-v1';

// One object with everything, for callers that prefer a single import.
export const CONFIG = {
  WORLD_W,
  WORLD_H,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  SEA_TOP,
  BEACH_TOP,
  GRID_PITCH,
  ROAD_X0,
  ROAD_Y0,
  ROAD_X1,
  ROAD_Y1,
  ROAD_WIDTH,
  NODE_COUNT_X,
  NODE_COUNT_Y,
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
