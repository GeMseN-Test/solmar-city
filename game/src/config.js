// Solmar City — every tuning number in one place. The world is a
// 2880x2160 island city: a road grid on land, a beach strip, then the
// harbor sea along the bottom edge where the boats live.

export const WORLD_W = 2880;
export const WORLD_H = 2160;
export const SEA_TOP = 2100;
export const BEACH_TOP = 2020;

export const GRID_PITCH = 360;
export const ROAD_XS = [180, 540, 900, 1260, 1620, 1980, 2340, 2700];
export const ROAD_YS = [180, 540, 900, 1260, 1620, 1980];
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
  startX: 1420,
  startY: 1230,
  startAngle: -Math.PI / 2,
  maxHp: 100,
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
  cashCount: 14,
  cashValue: 60,
  healthCount: 8,
  healthValue: 40,
  ammoCount: 8,
  ammoValue: 36,
};

export const COIN_VALUE = 25;
export const COIN_COUNT = 12;
export const FARE_MIN_PAY = 80;
export const FARE_MAX_PAY = 150;
export const FARE_TIME_LIMIT = 45;
export const FARE_PICKUP_RADIUS = 60;

export const BOAT = {
  accel: 300,
  maxSpeed: 340,
  turnRate: 1.6,
  drag: 0.35,
};

export const SAVE_KEY = 'solmar-city-save-v1';
