// Solmar City — tuning constants. One place for every magic number so
// the world, the car, the player and the police all agree with each
// other. Values are the probed v1 numbers (see the spec).

// The city is 2880 wide, 2160 tall. The sea strip starts at y 2100;
// the beach runs from y 2020 down to the water.
export const WORLD_W = 2880;
export const WORLD_H = 2160;
export const SEA_TOP = 2100;
export const BEACH_TOP = 2020;

// Road grid: 8 vertical roads, 6 horizontal roads, 360px apart,
// each 76px wide. Intersections are the traffic graph nodes.
export const GRID_PITCH = 360;
export const ROAD_X = [180, 540, 900, 1260, 1620, 1980, 2340, 2700];
export const ROAD_Y = [180, 540, 900, 1260, 1620, 1980];
export const ROAD_WIDTH = 76;
export const ROAD_HALF = ROAD_WIDTH / 2;
export const NODE_COUNT_X = ROAD_X.length;
export const NODE_COUNT_Y = ROAD_Y.length;

// Driving: px/s, px/s^2, radians. A car is 46 long, 22 wide.
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

// On foot: walk 175 px/s, run 268 px/s. The gun reaches 520px.
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
};

// Wanted stars: 0..5. Stealing a car, firing a shot or hitting a
// pedestrian each add heat; stars decay after 12 quiet seconds, one
// star every 8 seconds after that.
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

// Economy and population.
export const MONEY_START = 50;
export const TRAFFIC_CARS = 16;
export const PEDESTRIANS = 34;
export const PICKUPS = {
  cash: { count: 14, amount: 60 },
  health: { count: 8, amount: 40 },
  ammo: { count: 8, amount: 36 },
};

// Save slot in localStorage.
export const SAVE_KEY = 'solmar-city-save-v1';

// The Grand Prix countdown shown in the HUD: 6 hours, in seconds.
// It ticks down in world.step and wraps back to a full 6 hours.
export const GRAND_PRIX_SECONDS = 21600;

// Events bitmask returned by world.step each frame.
export const EV = {
  SHOT: 1,
  PUNCH: 2,
  PICKUP: 4,
  CRASH: 8,
  MISSION: 16,
  DIED: 32,
  BUSTED: 64,
  ENEMY_SHOT: 128,
  VAULT: 256,
  STEAL: 512,
  MISSION_COMPLETE: 1024,
};

// Where Mara Voss starts: outside the safehouse, facing north.
export const SPAWN = { x: 1420, y: 1230, angle: -Math.PI / 2 };
