// Combat for Solmar City: the player's gun and fists, plus the gang
// members who shoot back. Two hard rules live here:
//   - Kills are counted by world.step, NEVER here. Dead enemies are
//     left in the enemies list for world.step to collect.
//   - Cooldowns (gun + melee) tick down every stepCombat call, so a
//     stalled cooldown can never jam the trigger.
//
// Enemy shape: { x, y, angle, hp: 100, speed, shootCooldown,
//   shirt, skin, wanderX, wanderY, wanderTimer }

import {
  GUN_DAMAGE,
  GUN_RANGE,
  BULLET_SPEED,
  GUN_COOLDOWN,
  PUNCH_DAMAGE,
  PUNCH_RANGE,
  PUNCH_ARC,
  PUNCH_COOLDOWN,
  ENEMY_BULLET_DAMAGE,
  ENEMY_BULLET_SPEED,
  ENEMY_SHOOT_COOLDOWN,
} from './config.js';
import { clamp, dist, angleDiff, wrapAngle } from './util.js';

const SKIN_TONES = ['#e8b98d', '#c98d5f', '#8d5a3b', '#f0c8a0', '#a06a42'];
const GANG_SHIRT = '#7a2d8f';
// Hard cap so a stuck trigger (or a long firefight) can never grow
// the bullet list without bound; oldest bullets drop first.
const MAX_BULLETS = 240;

export function createCombat() {
  return {
    bullets: [],
    enemies: [],
  };
}

// Spawn `count` gang members around (x, y), scattered +/-70px, each
// with its own speed, skin tone and a random first-shot delay.
export function spawnGang(state, x, y, count) {
  const made = [];
  for (let i = 0; i < count; i++) {
    const enemy = {
      x: x + (Math.random() * 2 - 1) * 70,
      y: y + (Math.random() * 2 - 1) * 70,
      angle: Math.random() * Math.PI * 2,
      hp: 100,
      speed: 140 + Math.random() * 30,
      shootCooldown: Math.random() * ENEMY_SHOOT_COOLDOWN,
      shirt: GANG_SHIRT,
      skin: SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)],
      wanderX: x,
      wanderY: y,
      wanderTimer: 0,
    };
    state.combat.enemies.push(enemy);
    made.push(enemy);
  }
  return made;
}

// Fire one player bullet from the gun muzzle, 16px ahead of the
// player. Needs a cooled-down gun and at least 1 ammo; otherwise
// nothing happens. Returns true when a bullet actually left the gun.
export function firePlayerBullet(state, x, y, angle) {
  const p = state.player;
  if (!p) return false;
  if ((p.gunCooldown || 0) > 0) return false;
  if ((p.ammo || 0) <= 0) return false;
  const mx = x + Math.cos(angle) * 16;
  const my = y + Math.sin(angle) * 16;
  if (state.combat.bullets.length >= MAX_BULLETS) state.combat.bullets.shift();
  state.combat.bullets.push({
    x: mx,
    y: my,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    angle,
    damage: GUN_DAMAGE,
    life: GUN_RANGE / BULLET_SPEED,
    fromPlayer: true,
  });
  p.ammo -= 1;
  p.gunCooldown = GUN_COOLDOWN;
  return true;
}

// A punch: 0.45s cooldown, hits every enemy within punch range (+ a
// small grace) and inside the punch arc around the player's aim.
// Returns how many enemies were hit.
export function meleeAttack(state) {
  const p = state.player;
  if (!p) return 0;
  if ((p.meleeCooldown || 0) > 0) return 0;
  p.meleeCooldown = PUNCH_COOLDOWN;
  let hits = 0;
  for (const e of state.combat.enemies) {
    if (e.hp <= 0) continue;
    const d = dist(p.x, p.y, e.x, e.y);
    if (d > PUNCH_RANGE + 11) continue;
    const toEnemy = Math.atan2(e.y - p.y, e.x - p.x);
    if (Math.abs(angleDiff(p.aimAngle, toEnemy)) > PUNCH_ARC) continue;
    e.hp -= PUNCH_DAMAGE;
    hits++;
  }
  return hits;
}

function stepBullets(state, dt) {
  const city = state.city;
  const bullets = state.combat.bullets;
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && city && city.pointInBuilding(b.x, b.y)) dead = true;
    if (!dead && b.fromPlayer) {
      for (const e of state.combat.enemies) {
        if (e.hp <= 0) continue;
        if (dist(b.x, b.y, e.x, e.y) < 14) {
          e.hp -= b.damage;
          dead = true;
          break;
        }
      }
    } else if (!dead && !b.fromPlayer) {
      const p = state.player;
      if (p.hp > 0 && dist(b.x, b.y, p.x, p.y) < 13) {
        p.hp -= b.damage;
        dead = true;
      }
    }
    if (dead) bullets.splice(i, 1);
  }
}

function stepEnemies(state, dt) {
  const p = state.player;
  const city = state.city;
  for (const e of state.combat.enemies) {
    if (e.hp <= 0) continue;
    e.shootCooldown -= dt;
    const d = dist(e.x, e.y, p.x, p.y);
    if (d < 260) {
      // Hold ground and shoot, but only inside gun range.
      e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      if (d <= GUN_RANGE && e.shootCooldown <= 0) {
        e.shootCooldown = ENEMY_SHOOT_COOLDOWN;
        state.combat.bullets.push({
          x: e.x + Math.cos(e.angle) * 16,
          y: e.y + Math.sin(e.angle) * 16,
          vx: Math.cos(e.angle) * ENEMY_BULLET_SPEED,
          vy: Math.sin(e.angle) * ENEMY_BULLET_SPEED,
          angle: e.angle,
          damage: ENEMY_BULLET_DAMAGE,
          life: GUN_RANGE / ENEMY_BULLET_SPEED,
          fromPlayer: false,
        });
      }
    } else if (d < 600) {
      // Chase the player.
      e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      e.x += Math.cos(e.angle) * e.speed * dt;
      e.y += Math.sin(e.angle) * e.speed * dt;
    } else {
      // Too far to care: wander near the anchor point.
      e.wanderTimer -= dt;
      if (e.wanderTimer <= 0) {
        e.wanderTimer = 2 + Math.random() * 2;
        e.wanderX = clamp(e.x + (Math.random() * 2 - 1) * 90, 40, 2840);
        e.wanderY = clamp(e.y + (Math.random() * 2 - 1) * 90, 40, 2060);
      }
      const wd = dist(e.x, e.y, e.wanderX, e.wanderY);
      if (wd > 8) {
        const wa = Math.atan2(e.wanderY - e.y, e.wanderX - e.x);
        e.angle = wa;
        e.x += Math.cos(wa) * e.speed * 0.5 * dt;
        e.y += Math.sin(wa) * e.speed * 0.5 * dt;
      }
    }
    if (city) {
      const fixed = city.resolveCircle(e.x, e.y, 11);
      e.x = fixed.x;
      e.y = fixed.y;
    }
    e.angle = wrapAngle(e.angle);
  }
}

// One combat tick. Cooldowns always tick down first — even on frames
// where nothing else happens — so the gun can never jam.
export function stepCombat(state, dt) {
  const p = state.player;
  if (p) {
    if (p.gunCooldown > 0) p.gunCooldown = Math.max(0, p.gunCooldown - dt);
    if (p.meleeCooldown > 0) p.meleeCooldown = Math.max(0, p.meleeCooldown - dt);
  }
  stepBullets(state, dt);
  stepEnemies(state, dt);
}

export default createCombat;
