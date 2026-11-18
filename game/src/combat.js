// Combat: the player's gun + fists, and the gang members who shoot
// back. Cooldowns live on the state and are decremented here every
// step — a missed decrement once meant the player could only ever fire
// a single shot. Dead enemies are removed here and counted into
// state.kills, which is what defeat objectives read.
import { PLAYER } from './config.js';
import { angleDiff, clamp, dist } from './util.js';

const SKIN_TONES = ['#e8b98a', '#c98d5f', '#8a5a3b', '#f0c8a0'];
const ENEMY_BULLET_DAMAGE = 9;
const ENEMY_BULLET_SPEED = 540;
const ENEMY_SHOOT_COOLDOWN = 1.15;
const ENEMY_CHASE_MIN = 260;
const ENEMY_CHASE_MAX = 600;

export function createCombat() {
  return { bullets: [], enemies: [] };
}

// Spawn `count` gang members around (x, y), scattered +/-70px. They
// anchor to the spawn point and wander there until the player comes
// close enough to fight.
export function spawnGang(state, x, y, count) {
  const rng = state.rng;
  for (let i = 0; i < count; i++) {
    const gx = x + (rng ? rng.range(-70, 70) : (i * 37) % 140 - 70);
    const gy = y + (rng ? rng.range(-70, 70) : (i * 53) % 140 - 70);
    state.combat.enemies.push({
      x: gx, y: gy,
      angle: rng ? rng.range(0, Math.PI * 2) : 0,
      hp: 100,
      speed: rng ? rng.range(140, 170) : 150,
      shootCooldown: rng ? rng.range(0, ENEMY_SHOOT_COOLDOWN) : 0.5,
      shirt: '#7a2d8f',
      skin: rng ? rng.pick(SKIN_TONES) : SKIN_TONES[0],
      anchorX: x, anchorY: y,
      wanderX: gx, wanderY: gy,
      wanderTimer: rng ? rng.range(0, 2) : 1,
    });
  }
  return state.combat.enemies.length;
}

export function firePlayerBullet(state, x, y, angle) {
  if (state.gunCooldown > 0) return false;
  if (state.player.ammo <= 0) return false;
  const mx = x + Math.cos(angle) * 16;
  const my = y + Math.sin(angle) * 16;
  state.combat.bullets.push({
    x: mx, y: my, angle,
    speed: PLAYER.bulletSpeed,
    damage: PLAYER.gunDamage,
    life: PLAYER.gunRange / PLAYER.bulletSpeed,
    fromPlayer: true,
  });
  state.player.ammo -= 1;
  state.gunCooldown = PLAYER.gunCooldown;
  return true;
}

// A punch hits every enemy within punch range (+11px of grace) whose
// direction from the player sits inside the punch arc of the aim.
export function meleeAttack(state) {
  if (state.punchCooldown > 0) return 0;
  state.punchCooldown = PLAYER.punchCooldown;
  const p = state.player;
  const reach = PLAYER.punchRange + 11;
  let hits = 0;
  for (const e of state.combat.enemies) {
    const d = dist(p.x, p.y, e.x, e.y);
    if (d > reach) continue;
    const toEnemy = Math.atan2(e.y - p.y, e.x - p.x);
    if (Math.abs(angleDiff(p.aimAngle, toEnemy)) > PLAYER.punchArc) continue;
    e.hp -= PLAYER.punchDamage;
    hits++;
  }
  return hits;
}

function enemyShoot(state, e) {
  const p = state.player;
  const d = dist(e.x, e.y, p.x, p.y);
  if (d > PLAYER.gunRange) return false;
  const spread = (state.rng ? state.rng.range(-0.09, 0.09) : 0);
  const angle = Math.atan2(p.y - e.y, p.x - e.x) + spread;
  state.combat.bullets.push({
    x: e.x + Math.cos(angle) * 16,
    y: e.y + Math.sin(angle) * 16,
    angle,
    speed: ENEMY_BULLET_SPEED,
    damage: ENEMY_BULLET_DAMAGE,
    life: PLAYER.gunRange / ENEMY_BULLET_SPEED,
    fromPlayer: false,
  });
  e.shootCooldown = ENEMY_SHOOT_COOLDOWN;
  return true;
}

// Returns an events bitmask (ENEMY_SHOT = 128 when a gang member fires).
export function stepCombat(state, dt) {
  let events = 0;
  // Cooldowns tick down every step, on foot or in a car.
  if (state.gunCooldown > 0) state.gunCooldown = Math.max(0, state.gunCooldown - dt);
  if (state.punchCooldown > 0) state.punchCooldown = Math.max(0, state.punchCooldown - dt);

  const p = state.player;
  const city = state.city;

  // Bullets fly, die on walls, and hurt whoever they hit.
  const bullets = state.combat.bullets;
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && city.pointInBuilding(b.x, b.y)) dead = true;
    if (!dead && (b.x < 0 || b.x > 2880 || b.y < 0 || b.y > 2160)) dead = true;
    if (!dead && b.fromPlayer) {
      for (const e of state.combat.enemies) {
        if (e.hp <= 0) continue;
        if (dist(b.x, b.y, e.x, e.y) < 14) {
          e.hp -= b.damage;
          dead = true;
          break;
        }
      }
    }
    if (!dead && !b.fromPlayer) {
      const pr = p.inCar ? 24 : PLAYER.radius;
      if (dist(b.x, b.y, p.x, p.y) < pr + 4) {
        if (p.invuln <= 0) p.hp -= b.damage;
        dead = true;
      }
    }
    if (dead) bullets.splice(i, 1);
  }

  // Gang members: chase, hold + shoot, or wander near their anchor.
  for (const e of state.combat.enemies) {
    if (e.hp <= 0) continue;
    if (e.shootCooldown > 0) e.shootCooldown -= dt;
    const d = dist(e.x, e.y, p.x, p.y);
    if (d > ENEMY_CHASE_MAX) {
      // Wander near the anchor point.
      e.wanderTimer -= dt;
      if (e.wanderTimer <= 0 || dist(e.x, e.y, e.wanderX, e.wanderY) < 12) {
        e.wanderX = e.anchorX + (state.rng ? state.rng.range(-80, 80) : 0);
        e.wanderY = e.anchorY + (state.rng ? state.rng.range(-80, 80) : 0);
        e.wanderTimer = state.rng ? state.rng.range(1.5, 3.5) : 2;
      }
      const a = Math.atan2(e.wanderY - e.y, e.wanderX - e.x);
      e.angle = a;
      e.x += Math.cos(a) * e.speed * 0.4 * dt;
      e.y += Math.sin(a) * e.speed * 0.4 * dt;
    } else if (d > ENEMY_CHASE_MIN) {
      // Close the distance.
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      e.angle = a;
      e.x += Math.cos(a) * e.speed * dt;
      e.y += Math.sin(a) * e.speed * dt;
    } else {
      // Hold ground and shoot.
      e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      if (e.shootCooldown <= 0 && enemyShoot(state, e)) events |= 128;
    }
    const fixed = city.resolveCircle(e.x, e.y, 11);
    e.x = fixed.x;
    e.y = fixed.y;
    e.x = clamp(e.x, 12, 2868);
    e.y = clamp(e.y, 12, 2148);
  }

  // Gang members spread out: without this they stack on one point
  // while chasing and look (and fight) like a single enemy.
  const foes = state.combat.enemies;
  for (let i = 0; i < foes.length; i++) {
    for (let j = i + 1; j < foes.length; j++) {
      const a = foes[i];
      const b = foes[j];
      if (a.hp <= 0 || b.hp <= 0) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 400 && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (20 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }

  // The dead leave the street and count toward defeat objectives.
  // (world.step does NOT do this — it only reads state.kills.)
  for (let i = state.combat.enemies.length - 1; i >= 0; i--) {
    if (state.combat.enemies[i].hp <= 0) {
      state.combat.enemies.splice(i, 1);
      state.kills += 1;
    }
  }
  return events;
}
