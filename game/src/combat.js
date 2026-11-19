// combat.js — shooting, melee and gang AI.
// Bullets and enemies live here; KILLS are counted by world.step, never
// here — dead enemies (hp <= 0) are left in place for world.step to
// count and remove.

import { PLAYER } from './config.js';
import { angleDiff, dist } from './util.js';

export const ENEMY_HP = 100;
export const ENEMY_BULLET_DAMAGE = 9;
export const ENEMY_BULLET_SPEED = 540;
export const ENEMY_SHOOT_COOLDOWN = 1.15;
export const ENEMY_HOLD_RANGE = 260;
export const ENEMY_CHASE_RANGE = 600;
export const ENEMY_GUN_RANGE = 520;

const SKIN_TONES = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

export function createCombat() {
  return { bullets: [], enemies: [] };
}

function rand(state) {
  const r = state.rng;
  return r ? r.next() : Math.random();
}

export function spawnGang(state, x, y, count) {
  const combat = state.combat;
  const made = [];
  for (let i = 0; i < count; i++) {
    const e = {
      x: x + (rand(state) * 2 - 1) * 70,
      y: y + (rand(state) * 2 - 1) * 70,
      angle: rand(state) * Math.PI * 2,
      hp: ENEMY_HP,
      speed: 140 + rand(state) * 30,
      shootCooldown: rand(state) * ENEMY_SHOOT_COOLDOWN,
      shirt: '#7a2d8f',
      skin: SKIN_TONES[Math.floor(rand(state) * SKIN_TONES.length)],
      anchorX: x,
      anchorY: y,
      wanderX: x,
      wanderY: y,
      wanderTimer: 0,
    };
    combat.enemies.push(e);
    made.push(e);
  }
  return made;
}

export function firePlayerBullet(state, x, y, angle) {
  const p = state.player;
  if (!p) return false;
  if ((p.gunCooldown || 0) > 0) return false;
  if ((p.ammo || 0) <= 0) return false;
  const combat = state.combat;
  const muzzle = 16;
  combat.bullets.push({
    x: x + Math.cos(angle) * muzzle,
    y: y + Math.sin(angle) * muzzle,
    vx: Math.cos(angle) * PLAYER.bulletSpeed,
    vy: Math.sin(angle) * PLAYER.bulletSpeed,
    life: PLAYER.gunRange / PLAYER.bulletSpeed,
    damage: PLAYER.gunDamage,
    fromEnemy: false,
  });
  p.ammo -= 1;
  p.gunCooldown = 0.22;
  return true;
}

export function meleeAttack(state) {
  const p = state.player;
  if (!p) return 0;
  if ((p.meleeCooldown || 0) > 0) return 0;
  p.meleeCooldown = 0.45;
  const reach = PLAYER.punchRange + 11;
  let hits = 0;
  for (const e of state.combat.enemies) {
    if (e.hp <= 0) continue;
    const d = dist(p.x, p.y, e.x, e.y);
    if (d > reach) continue;
    const toEnemy = Math.atan2(e.y - p.y, e.x - p.x);
    if (Math.abs(angleDiff(p.aimAngle || 0, toEnemy)) > PLAYER.punchArc) continue;
    e.hp -= PLAYER.punchDamage;
    hits++;
  }
  return hits;
}

export function stepCombat(state, dt) {
  const p = state.player;
  const combat = state.combat;
  const city = state.city;
  let events = 0;

  if (p) {
    if (p.gunCooldown > 0) p.gunCooldown -= dt;
    if (p.meleeCooldown > 0) p.meleeCooldown -= dt;
  }

  // Bullets move, die on buildings or at end of life, and hit things.
  for (let i = combat.bullets.length - 1; i >= 0; i--) {
    const b = combat.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && city && city.pointInBuilding && city.pointInBuilding(b.x, b.y)) {
      dead = true;
    }
    if (!dead && !b.fromEnemy) {
      for (const e of combat.enemies) {
        if (e.hp <= 0) continue;
        if (dist(b.x, b.y, e.x, e.y) < 14) {
          e.hp -= b.damage;
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.fromEnemy && p) {
      if (dist(b.x, b.y, p.x, p.y) < 12) {
        p.hp -= b.damage;
        events |= 128; // ENEMY_SHOT
        dead = true;
      }
    }
    if (dead) combat.bullets.splice(i, 1);
  }

  // Enemies: hold + shoot up close, chase at mid range, wander far away.
  for (const e of combat.enemies) {
    if (e.hp <= 0) continue;
    const d = p ? dist(e.x, e.y, p.x, p.y) : 9999;
    if (d < ENEMY_HOLD_RANGE) {
      if (p) e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      e.shootCooldown -= dt;
      if (e.shootCooldown <= 0 && d <= ENEMY_GUN_RANGE && p) {
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        combat.bullets.push({
          x: e.x + Math.cos(a) * 16,
          y: e.y + Math.sin(a) * 16,
          vx: Math.cos(a) * ENEMY_BULLET_SPEED,
          vy: Math.sin(a) * ENEMY_BULLET_SPEED,
          life: ENEMY_GUN_RANGE / ENEMY_BULLET_SPEED,
          damage: ENEMY_BULLET_DAMAGE,
          fromEnemy: true,
        });
        e.shootCooldown = ENEMY_SHOOT_COOLDOWN;
      }
    } else if (d <= ENEMY_CHASE_RANGE) {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      e.angle = a;
      e.x += Math.cos(a) * e.speed * dt;
      e.y += Math.sin(a) * e.speed * dt;
    } else {
      e.wanderTimer -= dt;
      if (e.wanderTimer <= 0) {
        e.wanderX = e.anchorX + (rand(state) * 2 - 1) * 120;
        e.wanderY = e.anchorY + (rand(state) * 2 - 1) * 120;
        e.wanderTimer = 2 + rand(state) * 2;
      }
      const wd = dist(e.x, e.y, e.wanderX, e.wanderY);
      if (wd > 8) {
        const a = Math.atan2(e.wanderY - e.y, e.wanderX - e.x);
        e.angle = a;
        e.x += Math.cos(a) * e.speed * 0.5 * dt;
        e.y += Math.sin(a) * e.speed * 0.5 * dt;
      }
    }
    if (city && city.resolveCircle) {
      const fixed = city.resolveCircle(e.x, e.y, 11);
      e.x = fixed.x;
      e.y = fixed.y;
    }
  }

  // Gang members spread out instead of piling on one pixel while chasing.
  for (let i = 0; i < combat.enemies.length; i++) {
    const a = combat.enemies[i];
    if (a.hp <= 0) continue;
    for (let j = i + 1; j < combat.enemies.length; j++) {
      const b = combat.enemies[j];
      if (b.hp <= 0) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.01 && d < 28) {
        const push = ((28 - d) / 2) * Math.min(1, 3 * dt);
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
  return events;
}
