// config.js — every tuning number for Solmar City in one place.
export const WORLD_W = 2880;
export const WORLD_H = 2160;
export const SEA_TOP = 2100;
export const BEACH_TOP = 2020;
export const GRID_PITCH = 360;
export const ROAD_X_MIN = 180;
export const ROAD_X_MAX = 2700;
export const ROAD_Y_MIN = 180;
export const ROAD_Y_MAX = 1980;
export const ROAD_WIDTH = 76;

export const PLAYER_WALK = 175;
export const PLAYER_RUN = 268;
export const PLAYER_RADIUS = 11;
export const PLAYER_SPAWN_X = 1420;
export const PLAYER_SPAWN_Y = 1230;
export const PLAYER_SPAWN_ANGLE = -Math.PI / 2;

export const CAR_ACCEL = 640;
export const CAR_BRAKE = 980;
export const CAR_REVERSE = 420;
export const CAR_MAX_SPEED = 560;
export const CAR_MAX_REVERSE = 190;
export const CAR_TURN_RATE = 2.7;
export const CAR_GRIP = 3.2;
export const CAR_DRAG = 0.55;
export const CAR_LENGTH = 46;
export const CAR_WIDTH = 22;
export const CAR_RAM_DAMAGE = 18;

export const GUN_DAMAGE = 34;
export const GUN_RANGE = 520;
export const BULLET_SPEED = 760;
export const START_AMMO = 48;
export const MAX_AMMO = 240;
export const PUNCH_DAMAGE = 26;
export const PUNCH_RANGE = 36;
export const PUNCH_ARC = 1.1;
export const GUN_COOLDOWN = 0.22;
export const PUNCH_COOLDOWN = 0.45;
export const ENEMY_BULLET_DAMAGE = 9;
export const ENEMY_BULLET_SPEED = 540;

export const WANTED_MAX = 5;
export const WANTED_STEAL_CAR = 1;
export const WANTED_SHOOT = 1;
export const WANTED_HIT_PED = 1;
export const WANTED_KILL_PED = 2;
export const WANTED_DECAY_DELAY = 12;
export const WANTED_DECAY_EVERY = 8;
export const COP_CHASE_RADIUS = 900;
export const BUST_SECONDS = 1.6;

export const MONEY_START = 50;
export const TRAFFIC_CARS = 16;
export const PEDESTRIANS = 34;
export const PICKUP_CASH_COUNT = 14;
export const PICKUP_CASH_VALUE = 60;
export const PICKUP_HEALTH_COUNT = 8;
export const PICKUP_HEALTH_VALUE = 40;
export const PICKUP_AMMO_COUNT = 8;
export const PICKUP_AMMO_VALUE = 36;

export const SAVE_KEY = 'solmar-city-save-v1';

export const BOAT_BASE_SPEED = 320;
export const BOAT_ACCEL = 300;
export const BOAT_TURN_RATE = 1.6;

export const COIN_COUNT = 12;
export const COIN_VALUE = 25;
export const FARE_MIN_PAY = 80;
export const FARE_MAX_PAY = 150;
export const FARE_TIME_LIMIT = 45;
export const FARE_PICKUP_RADIUS = 60;

export const CONFIG = {
  WORLD_W, WORLD_H, SEA_TOP, BEACH_TOP, GRID_PITCH,
  ROAD_X_MIN, ROAD_X_MAX, ROAD_Y_MIN, ROAD_Y_MAX, ROAD_WIDTH,
  PLAYER_WALK, PLAYER_RUN, PLAYER_RADIUS,
  CAR_ACCEL, CAR_BRAKE, CAR_REVERSE, CAR_MAX_SPEED, CAR_MAX_REVERSE,
  CAR_TURN_RATE, CAR_GRIP, CAR_DRAG, CAR_LENGTH, CAR_WIDTH, CAR_RAM_DAMAGE,
  GUN_DAMAGE, GUN_RANGE, BULLET_SPEED, START_AMMO, MAX_AMMO,
  PUNCH_DAMAGE, PUNCH_RANGE, PUNCH_ARC,
  WANTED_MAX, WANTED_DECAY_DELAY, WANTED_DECAY_EVERY,
  COP_CHASE_RADIUS, BUST_SECONDS,
  MONEY_START, TRAFFIC_CARS, PEDESTRIANS, SAVE_KEY,
};
export default CONFIG;
