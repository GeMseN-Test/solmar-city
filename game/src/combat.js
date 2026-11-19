// combat.js — shooting and punching. The player fires the pistol
// with the mouse and punches with Space on foot; gang members chase,
// hold their ground and shoot back. Two rules from the spec, kept
// exactly: (1) the gun/punch cooldowns tick down here every frame,
// so the player can always shoot again; (2) dead enemies are LEFT
// in place — world.step sweeps them and counts the kills, combat
// never does, so a kill is counted exactly once.

import { PLAYER } from './config.js';
import { angleDiff, clamp, dist, normalizeAngle } from './util.js';

const ENEMY_HP = 100;
const ENEMY_BULLET_DAMAGE = 9;
const ENEMY_BULLET_SPEED = 540;
const ENEMY_SHOOT_COOLDOWN = 1.15;
const ENEMY_SHOOT_RANGE = 520;
const ENEMY_HOLD_RANGE = 260;
const ENEMY_CHASE_RANGE = 600;

const SKIN_TONES = ['#e8b98a', '#c98d5f', '#8a5a33', '#f0c8a0', '#a06a42'];
const SHIRTS = ['#7a2d8f', '#8f2d2d', '#2d5a8f', '#2d8f4a'];

export function createCombat() {
  return { bullets: [], enemies: [] };
}

function combatOf(state) {
  if (!state.combat) state.combat = createCombat();
  return state.combat;
}

// Spawn `count` gang members around (x, y), scattered ~+/-70px.
// Each one walks ~140-170 px/s and starts with a random shoot
// cooldown between 0 and 1.15s so they do not all fire at once.
export function spawnGang(state, x, y, count) {
  const combat = combatOf(state);
  const made = [];
  for (let i = 0; i < count; i++) {
    const enemy = {
      x: x + (Math.random() * 140 - 70),
      y: y + (Math.random() * 140 - 70),
      angle: Math.random() * Math.PI * 2,
      hp: ENEMY_HP,
      maxHp: ENEMY_HP,
      speed: 140 + Math.random() * 30,
      shootCooldown: Math.random() * ENEMY_SHOOT_COOLDOWN,
      shirt: '#7a2d8f',
      skin: SKIN_TONES[i % SKIN_TONES.length],
      wanderX: x,
      wanderY: y,
      wanderTimer: 0,
      gunCooldown: 0,
    };
    combat.enemies.push(enemy);
    made.push(enemy);
  }
  return made;
}

// Fire one player bullet from (x, y) along `angle`. Needs the gun
// cooldown at zero and at least one bullet in the magazine: the
// muzzle sits 16px ahead of the player, the bullet flies at 760
// px/s, hits for 34 damage, and lives for 520/760 seconds.
export function firePlayerBullet(state, x, y, angle) {
  if (state.gunCooldown > 0) return false;
  const player = state.player;
  if (!player || player.ammo <= 0) return false;
  const combat = combatOf(state);
  const mx = x + Math.cos(angle) * 16;
  const my = y + Math.sin(angle) * 16;
  combat.bullets.push({
    x: mx,
    y: my,
    angle,
    speed: PLAYER.bulletSpeed,
    damage: PLAYER.gunDamage,
    life: PLAYER.gunRange / PLAYER.bulletSpeed,
    fromPlayer: true,
  });
  player.ammo -= 1;
  state.gunCooldown = PLAYER.gunCooldown;
  return true;
}

// Punch: 0.45s cooldown, hits every enemy within punchRange + ~11px
// of the player and inside the punch arc around the player's aim.
export function meleeAttack(state) {
  if (state.punchCooldown > 0) return 0;
  const player = state.player;
  if (!player) return 0;
  const combat = combatOf(state);
  state.punchCooldown = PLAYER.punchCooldown;
  let hits = 0;
  const reach = PLAYER.punchRange + 11;
  for (const enemy of combat.enemies) {
    if (enemy.hp <= 0) continue;
    const d = dist(player.x, player.y, enemy.x, enemy.y);
    if (d > reach) continue;
    const toEnemy = Math.atan2(enemy.y - player.y, enemy.x - player.x);
    const aim = player.aimAngle !== undefined ? player.aimAngle : player.angle;
    if (Math.abs(angleDiff(aim, toEnemy)) > PLAYER.punchArc) continue;
    enemy.hp -= PLAYER.punchDamage;
    hits++;
  }
  return hits;
}

// One combat frame: cooldowns tick down, bullets fly and hit,
// enemies chase / hold / shoot / wander. Dead enemies are left in
// place for world.step — they are skipped here, never removed, and
// kills are never counted here.
export function stepCombat(state, dt) {
  // Substep big frames so cooldowns and bullets advance the full dt.
  let remaining = dt;
  while (remaining > 0) {
    const chunk = Math.min(remaining, 0.05);
    stepCombatOnce(state, chunk);
    remaining -= chunk;
  }
}

function stepCombatOnce(state, dt) {
  const step = Math.min(dt, 0.05);
  const combat = combatOf(state);
  const player = state.player;

  if (state.gunCooldown > 0) state.gunCooldown -= step;
  if (state.punchCooldown > 0) state.punchCooldown -= step;
  if (state.gunCooldown < 0) state.gunCooldown = 0;
  if (state.punchCooldown < 0) state.punchCooldown = 0;

  const city = state.city;
  for (let i = combat.bullets.length - 1; i >= 0; i--) {
    const b = combat.bullets[i];
    b.x += Math.cos(b.angle) * b.speed * step;
    b.y += Math.sin(b.angle) * b.speed * step;
    b.life -= step;
    let dead = b.life <= 0;
    if (!dead && city && city.pointInBuilding && city.pointInBuilding(b.x, b.y)) {
      dead = true;
    }
    if (!dead && b.fromPlayer) {
      for (const enemy of combat.enemies) {
        if (enemy.hp <= 0) continue;
        if (dist(b.x, b.y, enemy.x, enemy.y) < 18) {
          enemy.hp -= b.damage;
          dead = true;
          break;
        }
      }
    }
    if (!dead && !b.fromPlayer && player && player.hp > 0) {
      if (dist(b.x, b.y, player.x, player.y) < 14) {
        if (!player.invuln || player.invuln <= 0) {
          player.hp -= b.damage;
        }
        dead = true;
      }
    }
    if (dead) combat.bullets.splice(i, 1);
  }

  if (!player) return;
  for (const enemy of combat.enemies) {
    if (enemy.hp <= 0) continue;
    if (enemy.shootCooldown > 0) enemy.shootCooldown -= step;
    const d = dist(enemy.x, enemy.y, player.x, player.y);
    const toPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    if (d > ENEMY_CHASE_RANGE) {
      // Far away: wander near the anchor point.
      enemy.wanderTimer -= step;
      if (enemy.wanderTimer <= 0) {
        enemy.wanderX = enemy.x + (Math.random() * 160 - 80);
        enemy.wanderY = enemy.y + (Math.random() * 160 - 80);
        enemy.wanderTimer = 1.5 + Math.random() * 2;
      }
      const wd = dist(enemy.x, enemy.y, enemy.wanderX, enemy.wanderY);
      if (wd > 12) {
        const wa = Math.atan2(enemy.wanderY - enemy.y, enemy.wanderX - enemy.x);
        enemy.angle = wa;
        enemy.x += Math.cos(wa) * enemy.speed * 0.45 * step;
        enemy.y += Math.sin(wa) * enemy.speed * 0.45 * step;
      }
    } else if (d > ENEMY_HOLD_RANGE) {
      // Chase the player, but never through a building.
      enemy.angle = toPlayer;
      const nx = enemy.x + Math.cos(toPlayer) * enemy.speed * step;
      const ny = enemy.y + Math.sin(toPlayer) * enemy.speed * step;
      if (!city || !city.pointInBuilding || !city.pointInBuilding(nx, ny)) {
        enemy.x = nx;
        enemy.y = ny;
      }
    } else {
      // Close in: hold ground, face the player, shoot when ready.
      enemy.angle = toPlayer;
      if (enemy.shootCooldown <= 0 && d <= ENEMY_SHOOT_RANGE) {
        enemy.shootCooldown = ENEMY_SHOOT_COOLDOWN;
        combat.bullets.push({
          x: enemy.x + Math.cos(toPlayer) * 16,
          y: enemy.y + Math.sin(toPlayer) * 16,
          angle: toPlayer + (Math.random() * 0.16 - 0.08),
          speed: ENEMY_BULLET_SPEED,
          damage: ENEMY_BULLET_DAMAGE,
          life: ENEMY_SHOOT_RANGE / ENEMY_BULLET_SPEED,
          fromPlayer: false,
        });
      }
    }
    if (city && city.resolveCircle) {
      city.resolveCircle(enemy, 12);
    }
    enemy.x = clamp(enemy.x, 16, 2864);
    enemy.y = clamp(enemy.y, 16, 2144);
  }

  // Enemy separation: gang members push apart so they never stack
  // on one pixel and the player can actually tell them apart.
  for (let i = 0; i < combat.enemies.length; i++) {
    const a = combat.enemies[i];
    if (a.hp <= 0) continue;
    for (let j = i + 1; j < combat.enemies.length; j++) {
      const b = combat.enemies[j];
      if (b.hp <= 0) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0.01 && d < 26) {
        const push = (26 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
}

export default createCombat;
