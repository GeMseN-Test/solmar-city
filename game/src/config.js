// Every tunable number in Solmar City lives here, in one place.
// The world, the cars, the guns, the cops and the pickups all read
// these values — change a feel here and the whole game follows.

// World size in pixels. The sea strip sits at the bottom (y > SEA_TOP)
// and the beach is the sand band just above it.
export const WORLD_W = 2880;
export const WORLD_H = 2160;
export const SEA_TOP = 2100;
export const BEACH_TOP = 2020;

// Road grid: vertical roads at these x lines, horizontal at these y
// lines, spaced GRID_PITCH apart, each ROAD_WIDTH wide.
export const GRID_PITCH = 360;
export const ROAD_X = [180, 540, 900, 1260, 1620, 1980, 2340, 2700];
export const ROAD_Y = [180, 540, 900, 1260, 1620, 1980];
export const ROAD_WIDTH = 76;
export const NODE_COUNT_X = 8;
export const NODE_COUNT_Y = 6;

// Player on foot.
export const PLAYER_WALK_SPEED = 175;
export const PLAYER_RUN_SPEED = 268;
export const PLAYER_RADIUS = 11;
export const PLAYER_START_X = 1420;
export const PLAYER_START_Y = 1230;
export const PLAYER_START_ANGLE = -Math.PI / 2;

// Driving. Cars are quick but not arcadey-fast; boats (boats.js) are
// deliberately slower to turn and slower to get going.
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

// Guns and fists.
export const GUN_DAMAGE = 34;
export const GUN_RANGE = 520;
export const BULLET_SPEED = 760;
export const GUN_COOLDOWN = 0.22;
export const START_AMMO = 48;
export const MAX_AMMO = 240;
export const PUNCH_DAMAGE = 26;
export const PUNCH_RANGE = 36;
export const PUNCH_ARC = 1.1;
export const PUNCH_COOLDOWN = 0.45;
export const ENEMY_BULLET_DAMAGE = 9;
export const ENEMY_BULLET_SPEED = 540;
export const ENEMY_SHOOT_COOLDOWN = 1.15;

// Wanted level. Stealing a car or firing a shot draws 1 star; hurting
// a pedestrian draws more. Stars only fade when the player stays calm
// and out of trouble for a while (decay is handled by world.js).
export const WANTED_MAX = 5;
export const WANTED_STEAL_CAR = 1;
export const WANTED_SHOOT = 1;
export const WANTED_HIT_PEDESTRIAN = 1;
export const WANTED_KILL_PEDESTRIAN = 2;
export const WANTED_DECAY_DELAY = 12;
export const WANTED_DECAY_EVERY = 8;
export const COP_CHASE_RADIUS = 900;
export const BUST_SECONDS = 1.6;

// Money and population.
export const MONEY_START = 50;
export const TRAFFIC_CARS = 16;
export const PEDESTRIANS = 34;
export const PICKUP_CASH_COUNT = 14;
export const PICKUP_CASH_VALUE = 60;
export const PICKUP_HEALTH_COUNT = 8;
export const PICKUP_HEALTH_VALUE = 40;
export const PICKUP_AMMO_COUNT = 8;
export const PICKUP_AMMO_VALUE = 36;

// Side jobs (sidejobs.js).
export const COIN_COUNT = 12;
export const COIN_VALUE = 25;
export const FARE_MIN_PAY = 80;
export const FARE_MAX_PAY = 150;
export const FARE_TIME_LIMIT = 45;
export const FARE_PICKUP_RADIUS = 60;

// Save slot.
export const SAVE_KEY = 'solmar-city-save-v1';

// One object for modules that prefer a single import.
export const CONFIG = {
  WORLD_W,
  WORLD_H,
  SEA_TOP,
  BEACH_TOP,
  GRID_PITCH,
  ROAD_X,
  ROAD_Y,
  ROAD_WIDTH,
  NODE_COUNT_X,
  NODE_COUNT_Y,
  PLAYER_WALK_SPEED,
  PLAYER_RUN_SPEED,
  PLAYER_RADIUS,
  PLAYER_START_X,
  PLAYER_START_Y,
  PLAYER_START_ANGLE,
  CAR_ACCEL,
  CAR_BRAKE,
  CAR_REVERSE,
  CAR_MAX_SPEED,
  CAR_MAX_REVERSE,
  CAR_TURN_RATE,
  CAR_GRIP,
  CAR_DRAG,
  CAR_LENGTH,
  CAR_WIDTH,
  CAR_RAM_DAMAGE,
  GUN_DAMAGE,
  GUN_RANGE,
  BULLET_SPEED,
  GUN_COOLDOWN,
  START_AMMO,
  MAX_AMMO,
  PUNCH_DAMAGE,
  PUNCH_RANGE,
  PUNCH_ARC,
  PUNCH_COOLDOWN,
  ENEMY_BULLET_DAMAGE,
  ENEMY_BULLET_SPEED,
  ENEMY_SHOOT_COOLDOWN,
  WANTED_MAX,
  WANTED_STEAL_CAR,
  WANTED_SHOOT,
  WANTED_HIT_PEDESTRIAN,
  WANTED_KILL_PEDESTRIAN,
  WANTED_DECAY_DELAY,
  WANTED_DECAY_EVERY,
  COP_CHASE_RADIUS,
  BUST_SECONDS,
  MONEY_START,
  TRAFFIC_CARS,
  PEDESTRIANS,
  PICKUP_CASH_COUNT,
  PICKUP_CASH_VALUE,
  PICKUP_HEALTH_COUNT,
  PICKUP_HEALTH_VALUE,
  PICKUP_AMMO_COUNT,
  PICKUP_AMMO_VALUE,
  COIN_COUNT,
  COIN_VALUE,
  FARE_MIN_PAY,
  FARE_MAX_PAY,
  FARE_TIME_LIMIT,
  FARE_PICKUP_RADIUS,
  SAVE_KEY,
};

export default CONFIG;
