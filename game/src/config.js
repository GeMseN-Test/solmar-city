// Solmar City — tuning constants. One place for every magic number
// the gameplay modules share, so balance tweaks never need a hunt.

export const WORLD = { w: 2880, h: 2160 };
export const WORLD_W = 2880;
export const WORLD_H = 2160;

export const SEA_TOP = 2100;
export const BEACH_TOP = 2020;

// Road grid: vertical roads at x = 180 + 360*i, horizontal at y = 180 + 360*j.
export const ROAD_X0 = 180;
export const ROAD_Y0 = 180;
export const ROAD_STEP = 360;
export const ROAD_COUNT_X = 8;
export const ROAD_COUNT_Y = 6;
export const ROAD_WIDTH = 76;
export const ROAD_X = [180, 540, 900, 1260, 1620, 1980, 2340, 2700];
export const ROAD_Y = [180, 540, 900, 1260, 1620, 1980];

// Cars.
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

// Player on foot.
export const PLAYER = {
  walkSpeed: 175,
  runSpeed: 268,
  radius: 11,
  maxHp: 100,
  gunDamage: 34,
  gunRange: 520,
  bulletSpeed: 760,
  punchDamage: 26,
  punchRange: 36,
  punchArc: 1.1,
  startAmmo: 48,
  maxAmmo: 240,
  gunCooldown: 0.22,
  punchCooldown: 0.45,
};

// Wanted level.
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

// Economy / world population.
export const MONEY_START = 50;
export const TRAFFIC_CARS = 16;
export const PEDESTRIANS = 34;
export const PICKUPS = { cash: 14, cashValue: 60, health: 8, healthValue: 40, ammo: 8, ammoValue: 36 };

// Save.
export const SAVE_KEY = 'solmar-city-save-v1';

// Spawn.
export const SPAWN = { x: 1420, y: 1230, angle: -Math.PI / 2 };

// Boats.
export const BOAT = {
  seaMinX: 16,
  seaMaxX: 2864,
  seaMinY: 2116,
  seaMaxY: 2144,
  boardRange: 70,
  baseTopSpeed: 320,
  accel: 260,
  turnRate: 1.6,
};

// Side jobs.
export const SIDEJOBS = {
  coins: 12,
  coinValue: 25,
  fareMin: 80,
  fareMax: 150,
  farePickupRange: 60,
  fareTimeLimit: 45,
  fareCooldown: 20,
};

// Radio.
export const RADIO_STATION_COUNT = 5;

export default {
  WORLD,
  WORLD_W,
  WORLD_H,
  SEA_TOP,
  BEACH_TOP,
  ROAD_X0,
  ROAD_Y0,
  ROAD_STEP,
  ROAD_COUNT_X,
  ROAD_COUNT_Y,
  ROAD_WIDTH,
  ROAD_X,
  ROAD_Y,
  CAR,
  PLAYER,
  WANTED,
  MONEY_START,
  TRAFFIC_CARS,
  PEDESTRIANS,
  PICKUPS,
  SAVE_KEY,
  SPAWN,
  BOAT,
  SIDEJOBS,
  RADIO_STATION_COUNT,
};
