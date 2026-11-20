// config.js — every tunable number for Solmar City in one place.
// The world is 2880x2160. Roads form a grid (pitch 360, width 76) with
// intersections at x = 180 + 360k and y = 180 + 360j. The sea strip is
// everything below y = 2100; the beach runs from 2020 to 2100.

export const WORLD_WIDTH = 2880;
export const WORLD_HEIGHT = 2160;
export const WORLD_W = WORLD_WIDTH;
export const WORLD_H = WORLD_HEIGHT;
export const SEA_TOP = 2100;
export const BEACH_TOP = 2020;
export const GRID_PITCH = 360;
export const ROAD_WIDTH = 76;
export const ROAD_X = [180, 540, 900, 1260, 1620, 1980, 2340, 2700];
export const ROAD_Y = [180, 540, 900, 1260, 1620, 1980];
export const NODE_COUNT_X = 8;
export const NODE_COUNT_Y = 6;

// --- Player on foot -------------------------------------------------
export const PLAYER = {
  walkSpeed: 175,
  runSpeed: 268,
  radius: 11,
  spawnX: 1420,
  spawnY: 1230,
  spawnAngle: -Math.PI / 2,
  hpMax: 100,
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
};

// --- Driving --------------------------------------------------------
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

// --- Wanted / police ------------------------------------------------
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

// --- Economy / world population --------------------------------------
export const MONEY_START = 50;
export const TRAFFIC_CARS = 16;
export const PEDESTRIANS = 34;
export const PICKUPS = {
  cashCount: 14,
  cashValue: 60,
  healthCount: 8,
  healthValue: 40,
  ammoCount: 8,
  ammoValue: 36,
};

// --- Save ------------------------------------------------------------
export const SAVE_KEY = 'solmar-city-save-v1';

// --- Boats -----------------------------------------------------------
export const BOAT = {
  // Sea lane the boats are clamped to (strict bounds, see boats.js).
  minX: 16,
  maxX: 2864,
  minY: 2116,
  maxY: 2144,
  boardRange: 70,
  baseAccel: 260,
  baseMaxSpeed: 300,
  turnRate: 1.1,
};

// --- Grand Prix ------------------------------------------------------
// The big race event of Solmar City. The countdown ticks down in the
// HUD (rendered by render.js from state.grandPrix); the race itself is
// the fastest way to earn street cred — every lap past the Marina
// grandstand pays out. startsIn is seconds until the green light.
export const GRAND_PRIX = {
  name: 'Solmar Grand Prix',
  shortName: 'GRAND PRIX',
  startsIn: 3600,
  laps: 3,
  lapReward: 500,
  winReward: 2500,
  // The circuit runs along the beach road and the harbor straight.
  circuit: [
    { x: 180, y: 1980 },
    { x: 2700, y: 1980 },
    { x: 2700, y: 2130 },
    { x: 180, y: 2130 },
  ],
};

// --- Radio -----------------------------------------------------------
export const RADIO_STATION_COUNT = 5;

// --- Side jobs -------------------------------------------------------
export const SIDE_JOBS = {
  coinCount: 12,
  coinValue: 25,
  fareMinPay: 80,
  fareMaxPay: 150,
  farePickupRange: 60,
  fareTimeLimit: 45,
  fareCooldown: 18,
};

// One object with everything, for callers that prefer a single import.
export const CONFIG = {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  SEA_TOP,
  BEACH_TOP,
  GRID_PITCH,
  ROAD_WIDTH,
  ROAD_X,
  ROAD_Y,
  NODE_COUNT_X,
  NODE_COUNT_Y,
  PLAYER,
  CAR,
  WANTED,
  MONEY_START,
  TRAFFIC_CARS,
  PEDESTRIANS,
  PICKUPS,
  SAVE_KEY,
  BOAT,
  GRAND_PRIX,
  RADIO_STATION_COUNT,
  SIDE_JOBS,
};

export default CONFIG;
