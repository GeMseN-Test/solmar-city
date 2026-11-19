// Combat: the player's gun + fists, and the gang members who
// shoot back.
//
// One rule matters more than the rest: dead enemies are LEFT in
// place here, and kills are counted exactly once by world.step
// when it sweeps the field. This module never increments
// state.kills and never removes a dead enemy — counting in two
// places is how a kill used to score twice.

import { PLAYER, WORLD_W, WORLD_H } from './config.js';
import { angleDiff, angleTo, clamp, dist } from './util.js';

const SKINS = ['#e8b98a', '#c98d5f', '#8a5a3b', '#f0c8a0'];
const ENEMY_BULLET_SPEED = 540;
const ENEMY_BULLET_DAMAGE = 9;
const GUN_COOLDOWN = 0.22;
const MELEE_COOLDOWN = 0.45;
const ENEMY_SHOOT_COOLDOWN = 1.15;
const CHASE_NEAR = 260;
const CHASE_FAR = 600;
// A firefight never needs more live rounds than this; past it the
// oldest round is dropped instead of letting the array grow.
const MAX_BULLETS = 200;

function draw(state) {
  const rng = state.rng;
  if (!rng) return Math.random();
  if (typeof rng === 'function') return rng();
  if (typeof rng.next === 'function') return rng.next();
  return Math.random();
}

export function createCombat() {
  return {
    bullets: [],
    enemies: [],
    gunCooldown: 0,
    meleeCooldown: 0,
  };
}

// Spawn `count` gang members around (x, y), scattered ±70px.
export function spawnGang(state, x, y, count) {
  const spawned = [];
  for (let i = 0; i < count; i += 1) {
    const enemy = {
      x: clamp(x + (draw(state) * 2 - 1) * 70, 24, WORLD_W - 24),
      y: clamp(y + (draw(state) * 2 - 1) * 70, 24, WORLD_H - 24),
      angle: draw(state) * Math.PI * 2,
      hp: 100,
      speed: 140 + draw(state) * 30,
      shootCooldown: draw(state) * ENEMY_SHOOT_COOLDOWN,
      shirt: '#7a2d8f',
      skin: SKINS[Math.floor(draw(state) * SKINS.length)],
      wanderX: x,
      wanderY: y,
      wanderTimer: 0,
    };
    state.combat.enemies.push(enemy);
    spawned.push(enemy);
  }
  return spawned;
}

export function spawnEnemies(state, x, y, count) {
  return spawnGang(state, x, y, count);
}

// One player bullet from (x, y) along `angle`. Needs the gun
// off cooldown and at least one round in the magazine. The muzzle
// sits 16px ahead of the shooter; the round flies 520px.
export function firePlayerBullet(state, x, y, angle) {
  const combat = state.combat;
  const p = state.player;
  if (!combat || !p) return false;
  if (combat.gunCooldown > 0) return false;
  if (p.gunCooldown !== undefined && p.gunCooldown > 0) return false;
  if (p.ammo <= 0) return false;
  const mx = x + Math.cos(angle) * 16;
  const my = y + Math.sin(angle) * 16;
  if (combat.bullets.length >= MAX_BULLETS) combat.bullets.shift();
  combat.bullets.push({
    x: mx,
    y: my,
    angle,
    vx: Math.cos(angle) * PLAYER.bulletSpeed,
    vy: Math.sin(angle) * PLAYER.bulletSpeed,
    speed: PLAYER.bulletSpeed,
    damage: PLAYER.gunDamage,
    life: PLAYER.gunRange / PLAYER.bulletSpeed,
    friendly: true,
  });
  p.ammo -= 1;
  combat.gunCooldown = GUN_COOLDOWN;
  p.gunCooldown = GUN_COOLDOWN;
  return true;
}

// A punch: 0.45s between swings, hits every living enemy within
// punch range (+ a little slack) and inside the punch arc of the
// player's aim. Returns how many enemies it caught.
export function meleeAttack(state) {
  const combat = state.combat;
  const p = state.player;
  if (!combat || !p) return 0;
  if (combat.meleeCooldown > 0) return 0;
  combat.meleeCooldown = MELEE_COOLDOWN;
  p.meleeCooldown = MELEE_COOLDOWN;
  let hits = 0;
  for (const e of combat.enemies) {
    if (e.hp <= 0) continue;
    const d = dist(p.x, p.y, e.x, e.y);
    if (d > PLAYER.punchRange + 11) continue;
    const toEnemy = angleTo(p.x, p.y, e.x, e.y);
    if (Math.abs(angleDiff(p.aimAngle, toEnemy)) > PLAYER.punchArc) continue;
    e.hp -= PLAYER.punchDamage;
    hits += 1;
  }
  return hits;
}

function fireEnemyBullet(state, enemy, angle) {
  if (state.combat.bullets.length >= MAX_BULLETS) state.combat.bullets.shift();
  state.combat.bullets.push({
    x: enemy.x + Math.cos(angle) * 16,
    y: enemy.y + Math.sin(angle) * 16,
    angle,
    vx: Math.cos(angle) * ENEMY_BULLET_SPEED,
    vy: Math.sin(angle) * ENEMY_BULLET_SPEED,
    speed: ENEMY_BULLET_SPEED,
    damage: ENEMY_BULLET_DAMAGE,
    life: PLAYER.gunRange / ENEMY_BULLET_SPEED,
    friendly: false,
  });
}

function stepEnemy(state, e, h) {
  const p = state.player;
  const d = dist(e.x, e.y, p.x, p.y);
  if (d > CHASE_FAR) {
    // Too far to care: wander slowly around the anchor point.
    e.wanderTimer -= h;
    const wd = dist(e.x, e.y, e.wanderX, e.wanderY);
    if (e.wanderTimer <= 0 || wd < 12) {
      e.wanderX = clamp(e.x + (draw(state) * 2 - 1) * 80, 24, WORLD_W - 24);
      e.wanderY = clamp(e.y + (draw(state) * 2 - 1) * 80, 24, WORLD_H - 24);
      e.wanderTimer = 2 + draw(state) * 2;
    }
    const a = angleTo(e.x, e.y, e.wanderX, e.wanderY);
    e.angle = a;
    e.x += Math.cos(a) * e.speed * 0.35 * h;
    e.y += Math.sin(a) * e.speed * 0.35 * h;
    return;
  }
  if (d > CHASE_NEAR) {
    // Close the distance.
    const a = angleTo(e.x, e.y, p.x, p.y);
    e.angle = a;
    e.x += Math.cos(a) * e.speed * h;
    e.y += Math.sin(a) * e.speed * h;
    return;
  }
  // In range: hold position and shoot, but only inside gun range
  // and only while the player is still standing.
  e.angle = angleTo(e.x, e.y, p.x, p.y);
  e.shootCooldown -= h;
  if (e.shootCooldown <= 0 && d <= PLAYER.gunRange && p.hp > 0) {
    fireEnemyBullet(state, e, e.angle);
    e.shootCooldown = ENEMY_SHOOT_COOLDOWN;
  }
}

// Bullets fly, enemies chase / hold / wander. Dead enemies are
// left exactly where they fell — world.step sweeps them up and
// counts the kill once. Large dt is split so a hitch never lets
// a bullet jump clean through a wall.
export function stepCombat(state, dt) {
  const combat = state.combat;
  const p = state.player;
  if (!combat || !p) return 0;
  let remaining = dt;
  while (remaining > 0) {
    const h = Math.min(remaining, 1 / 30);
    remaining -= h;

    if (combat.gunCooldown > 0) combat.gunCooldown = Math.max(0, combat.gunCooldown - h);
    if (combat.meleeCooldown > 0) combat.meleeCooldown = Math.max(0, combat.meleeCooldown - h);
    if (p.gunCooldown !== undefined && p.gunCooldown > 0) p.gunCooldown = Math.max(0, p.gunCooldown - h);
    if (p.meleeCooldown !== undefined && p.meleeCooldown > 0) p.meleeCooldown = Math.max(0, p.meleeCooldown - h);

    const city = state.city;
    for (let i = combat.bullets.length - 1; i >= 0; i -= 1) {
      const b = combat.bullets[i];
      b.x += b.vx * h;
      b.y += b.vy * h;
      b.life -= h;
      let dead = b.life <= 0;
      if (!dead && (b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H)) dead = true;
      if (!dead && city && city.pointInBuilding(b.x, b.y)) dead = true;
      if (!dead && b.friendly) {
        for (const e of combat.enemies) {
          if (e.hp <= 0) continue;
          if (dist(b.x, b.y, e.x, e.y) < 14) {
            e.hp -= b.damage;
            dead = true;
            break;
          }
        }
      }
      if (!dead && !b.friendly) {
        if (dist(b.x, b.y, p.x, p.y) < 13 && !(p.invuln > 0)) {
          p.hp -= b.damage;
          dead = true;
        }
      }
      if (dead) combat.bullets.splice(i, 1);
    }

    for (const e of combat.enemies) {
      if (e.hp <= 0) continue;
      stepEnemy(state, e, h);
      if (city) city.resolveCircle(e, PLAYER.radius);
    }
  }
  return 0;
}
