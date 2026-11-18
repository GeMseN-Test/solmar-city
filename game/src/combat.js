// Combat: the player's gun and fists, plus the gang members who shoot back.
import { GANG_SHOT_COOLDOWN, PLAYER } from './config.js';
import { angleDifference, circlesOverlap, distanceBetween } from './util.js';

const SKIN_TONES = ['#f0c8a0', '#c98a5a', '#8a5a3a', '#e8b88a'];
const GANG_SHIRT = '#7a2d8f';
const ENEMY_BULLET_SPEED = 540;
const ENEMY_BULLET_DAMAGE = 9;
const BULLET_RANGE = 520;
const MUZZLE = 16;
const CHASE_NEAR = 260;
const CHASE_FAR = 600;

export function createCombat() {
  return { bullets: [], enemies: [] };
}

// Drop `count` gang members around (x, y). They anchor to that spot and
// wander near it until the player comes into range.
export function spawnGang(state, x, y, count) {
  const rng = state.rng;
  for (let i = 0; i < count; i++) {
    const dx = rng ? rng.range(-70, 70) : Math.random() * 140 - 70;
    const dy = rng ? rng.range(-70, 70) : Math.random() * 140 - 70;
    state.combat.enemies.push({
      x: x + dx,
      y: y + dy,
      angle: rng ? rng.range(0, Math.PI * 2) : Math.random() * Math.PI * 2,
      hp: 100,
      speed: rng ? rng.range(140, 170) : 140 + Math.random() * 30,
      shootCooldown: rng ? rng.range(0, GANG_SHOT_COOLDOWN) : Math.random(),
      shirt: GANG_SHIRT,
      skin: rng ? rng.pick(SKIN_TONES) : SKIN_TONES[0],
      wanderX: x,
      wanderY: y,
      wanderTimer: rng ? rng.range(0, 2) : 1,
    });
  }
}

// Fire one player bullet from the muzzle toward `angle`. Needs a cooled
// gun and at least one round in the magazine.
export function firePlayerBullet(state, x, y, angle) {
  if (state.gunCooldown > 0 || state.player.ammo <= 0) return;
  state.combat.bullets.push({
    x: x + Math.cos(angle) * MUZZLE,
    y: y + Math.sin(angle) * MUZZLE,
    vx: Math.cos(angle) * PLAYER.bulletSpeed,
    vy: Math.sin(angle) * PLAYER.bulletSpeed,
    life: PLAYER.gunRange / PLAYER.bulletSpeed,
    from: 'player',
    damage: PLAYER.gunDamage,
  });
  state.player.ammo -= 1;
  state.gunCooldown = 0.22;
}

// Swing at everything in front of the player inside the punch arc.
export function meleeAttack(state) {
  if (state.punchCooldown > 0) return;
  state.punchCooldown = 0.45;
  const player = state.player;
  for (const enemy of state.combat.enemies) {
    if (enemy.hp <= 0) continue;
    const d = distanceBetween(player.x, player.y, enemy.x, enemy.y);
    if (d > PLAYER.punchRange + 11) continue;
    const toEnemy = Math.atan2(enemy.y - player.y, enemy.x - player.x);
    if (Math.abs(angleDifference(player.aimAngle, toEnemy)) > PLAYER.punchArc) continue;
    enemy.hp -= PLAYER.punchDamage;
  }
}

// One combat tick. Returns { enemyShots } so the world can play the sound
// and raise the event when a gang member opens fire.
export function stepCombat(state, dt) {
  const combat = state.combat;
  if (!combat) return { enemyShots: 0 };
  const player = state.player;
  const city = state.city;
  let enemyShots = 0;

  // FIX (v2 retry): the cooldowns have to tick down every step. Without
  // this the player could only shoot and punch once, ever.
  if (state.gunCooldown > 0) state.gunCooldown = Math.max(0, state.gunCooldown - dt);
  if (state.punchCooldown > 0) state.punchCooldown = Math.max(0, state.punchCooldown - dt);

  for (const enemy of combat.enemies) {
    if (enemy.hp <= 0) continue;
    if (enemy.shootCooldown > 0) enemy.shootCooldown -= dt;
    const d = distanceBetween(enemy.x, enemy.y, player.x, player.y);
    const toPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    if (d > CHASE_FAR) {
      // Too far to care: drift around the anchor point.
      enemy.wanderTimer -= dt;
      if (enemy.wanderTimer <= 0) {
        const rng = state.rng;
        enemy.wanderX = enemy.x + (rng ? rng.range(-80, 80) : 0);
        enemy.wanderY = enemy.y + (rng ? rng.range(-80, 80) : 0);
        enemy.wanderTimer = rng ? rng.range(1, 3) : 2;
      }
      const wd = distanceBetween(enemy.x, enemy.y, enemy.wanderX, enemy.wanderY);
      if (wd > 8) {
        const wa = Math.atan2(enemy.wanderY - enemy.y, enemy.wanderX - enemy.x);
        enemy.angle = wa;
        enemy.x += Math.cos(wa) * enemy.speed * 0.4 * dt;
        enemy.y += Math.sin(wa) * enemy.speed * 0.4 * dt;
      }
    } else if (d > CHASE_NEAR) {
      // Chase the player.
      enemy.angle = toPlayer;
      enemy.x += Math.cos(toPlayer) * enemy.speed * dt;
      enemy.y += Math.sin(toPlayer) * enemy.speed * dt;
    } else {
      // Close enough: hold ground and shoot.
      enemy.angle = toPlayer;
      if (enemy.shootCooldown <= 0 && d <= PLAYER.gunRange) {
        combat.bullets.push({
          x: enemy.x + Math.cos(toPlayer) * MUZZLE,
          y: enemy.y + Math.sin(toPlayer) * MUZZLE,
          vx: Math.cos(toPlayer) * ENEMY_BULLET_SPEED,
          vy: Math.sin(toPlayer) * ENEMY_BULLET_SPEED,
          life: BULLET_RANGE / ENEMY_BULLET_SPEED,
          from: 'enemy',
          damage: ENEMY_BULLET_DAMAGE,
        });
        enemy.shootCooldown = GANG_SHOT_COOLDOWN;
        enemyShots += 1;
      }
    }
    if (city) city.resolveCircle(enemy, 11);
  }

  // Gang members spread out instead of stacking on one spot: each pair
  // closer than a body width pushes apart a little.
  const alive = combat.enemies.filter((e) => e.hp > 0);
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i];
      const b = alive[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.01 && d < 22) {
        const push = (22 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }

  for (const bullet of combat.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
  }

  for (const bullet of combat.bullets) {
    if (bullet.life <= 0) continue;
    if (bullet.from === 'player') {
      for (const enemy of combat.enemies) {
        if (enemy.hp <= 0) continue;
        if (circlesOverlap(bullet.x, bullet.y, 4, enemy.x, enemy.y, 13)) {
          enemy.hp -= bullet.damage;
          bullet.life = 0;
          break;
        }
      }
    } else if (!player.inCar && !player.inBoat) {
      if (circlesOverlap(bullet.x, bullet.y, 4, player.x, player.y, 12)) {
        player.hp -= bullet.damage;
        bullet.life = 0;
      }
    }
    if (bullet.life > 0 && city && city.pointInBuilding(bullet.x, bullet.y)) {
      bullet.life = 0;
    }
  }
  combat.bullets = combat.bullets.filter((b) => b.life > 0);

  // FIX (v2 retry): the dead are removed here and the kills counted.
  // world.step does not do it, so without this no defeat objective could
  // ever complete — the bodies just stayed on the ground.
  const before = combat.enemies.length;
  combat.enemies = combat.enemies.filter((e) => e.hp > 0);
  state.kills += before - combat.enemies.length;

  return { enemyShots };
}
