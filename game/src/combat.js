// combat.js — shooting, punching and gang AI for Solmar City.
// The player fires hitscan-style bullets (fast projectiles) and can
// punch up close; gang members chase, hold their ground and shoot.
// IMPORTANT: dead enemies (hp <= 0) are LEFT in place here — kill
// counting and sweeping happen only in world.step, never here.
// Cooldowns tick down every stepCombat call: gun 0.22s, punch 0.45s.

import { PLAYER } from './config.js';
import { clamp, dist, angleDiff, turnToward, wrapAngle } from './util.js';

const SKIN_TONES = ['#e8b98a', '#c98d5f', '#8a5a3b', '#f0c8a0', '#6e4426'];
const GANG_SHIRT = '#7a2d8f';
const ENEMY_BULLET_SPEED = 540;
const ENEMY_BULLET_DAMAGE = 9;
const ENEMY_SHOOT_COOLDOWN = 1.15;
const ENEMY_CHASE_MIN = 260;
const ENEMY_CHASE_MAX = 600;

export function createCombat() {
  return {
    bullets: [],
    enemies: [],
    gunCooldown: 0,
    punchCooldown: 0,
  };
}

function combatOf(state) {
  if (!state.combat) state.combat = createCombat();
  return state.combat;
}

// Spawn `count` gang members around (x, y), scattered +/-70px.
// Each one wanders near its anchor until the player gets close.
export function spawnGang(state, x, y, count) {
  const combat = combatOf(state);
  const spawned = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 20 + Math.random() * 50;
    const enemy = {
      x: x + Math.cos(a) * r,
      y: y + Math.sin(a) * r,
      angle: Math.random() * Math.PI * 2,
      hp: 100,
      maxHp: 100,
      speed: 140 + Math.random() * 30,
      shootCooldown: Math.random() * ENEMY_SHOOT_COOLDOWN,
      shirt: GANG_SHIRT,
      skin: SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)],
      wanderX: x,
      wanderY: y,
      wanderTimer: Math.random() * 2,
      anchorX: x,
      anchorY: y,
    };
    combat.enemies.push(enemy);
    spawned.push(enemy);
  }
  return spawned;
}

// Fire one player bullet from (x, y) along `angle`. When x/y/angle are
// omitted the player's position and aim are used. Needs gunCooldown 0
// and at least 1 ammo; muzzle is 16px ahead of the shooter. Returns
// false when the player is dead, busted, or out of ammo — the gun
// never fires from an invalid state.
export function firePlayerBullet(state, x, y, angle) {
  const combat = combatOf(state);
  const p = state.player;
  if (!p) return false;
  if (p.hp <= 0) return false;
  if (state.busted) return false;
  if (combat.gunCooldown > 0) return false;
  if (p.ammo <= 0) return false;
  const ox = x != null ? x : p.x;
  const oy = y != null ? y : p.y;
  const a = angle != null ? angle : (p.aimAngle != null ? p.aimAngle : p.angle);
  const muzzle = 16;
  const bx = ox + Math.cos(a) * muzzle;
  const by = oy + Math.sin(a) * muzzle;
  combat.bullets.push({
    x: bx,
    y: by,
    angle: a,
    vx: Math.cos(a) * PLAYER.bulletSpeed,
    vy: Math.sin(a) * PLAYER.bulletSpeed,
    speed: PLAYER.bulletSpeed,
    damage: PLAYER.gunDamage,
    life: PLAYER.gunRange / PLAYER.bulletSpeed,
    maxLife: PLAYER.gunRange / PLAYER.bulletSpeed,
    from: 'player',
  });
  p.ammo -= 1;
  combat.gunCooldown = PLAYER.gunCooldown;
  return true;
}

// Punch: hits every living enemy within punchRange + 11px of the
// player and inside punchArc of the player's aim. 0.45s cooldown.
export function meleeAttack(state) {
  const combat = combatOf(state);
  const p = state.player;
  if (!p) return 0;
  if (combat.punchCooldown > 0) return 0;
  combat.punchCooldown = PLAYER.punchCooldown;
  const reach = PLAYER.punchRange + 11;
  const aim = p.aimAngle != null ? p.aimAngle : p.angle;
  let hits = 0;
  for (const e of combat.enemies) {
    if (e.hp <= 0) continue;
    const d = dist(p.x, p.y, e.x, e.y);
    if (d > reach) continue;
    const toEnemy = Math.atan2(e.y - p.y, e.x - p.x);
    if (Math.abs(angleDiff(aim, toEnemy)) > PLAYER.punchArc) continue;
    e.hp -= PLAYER.punchDamage;
    hits++;
  }
  return hits;
}

// One frame of combat. Cooldowns tick down FIRST so the player can
// always fire again after 0.22s. Bullets move and expire; enemies
// chase (260-600px), hold and shoot inside ~260px (1.15s cadence,
// gun range 520), and wander near their anchor when far away.
// Dead enemies are deliberately left in the list for world.step.
export function stepCombat(state, dt) {
  const combat = combatOf(state);
  const step = dt || 0.016;
  let events = 0;

  // Cooldowns MUST decrease every step — otherwise the gun fires once
  // and then never again (the old bug this rewrite fixes). Both timers
  // are clamped at zero so a long frame can never drive them negative
  // and a short frame still counts down proportionally.
  if (combat.gunCooldown > 0) combat.gunCooldown = Math.max(0, combat.gunCooldown - step);
  if (combat.punchCooldown > 0) combat.punchCooldown = Math.max(0, combat.punchCooldown - step);

  const p = state.player;
  const city = state.city;

  // --- Bullets -------------------------------------------------------
  for (let i = combat.bullets.length - 1; i >= 0; i--) {
    const b = combat.bullets[i];
    b.life -= step;
    b.x += b.vx * step;
    b.y += b.vy * step;
    let dead = b.life <= 0;
    if (!dead && city && city.pointInBuilding && city.pointInBuilding(b.x, b.y)) dead = true;
    if (!dead && (b.x < 0 || b.x > 2880 || b.y < 0 || b.y > 2160)) dead = true;
    if (!dead && b.from === 'player') {
      for (const e of combat.enemies) {
        if (e.hp <= 0) continue;
        if (dist(b.x, b.y, e.x, e.y) <= 14) {
          e.hp -= b.damage;
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from === 'enemy' && p && p.hp > 0) {
      const radius = p.inCar || p.inBoat ? 22 : 11;
      if (dist(b.x, b.y, p.x, p.y) <= radius + 4) {
        if (!p.invuln || p.invuln <= 0) {
          p.hp = Math.max(0, p.hp - b.damage);
        }
        dead = true;
      }
    }
    if (dead) combat.bullets.splice(i, 1);
  }

  // --- Enemies -------------------------------------------------------
  if (p) {
    for (const e of combat.enemies) {
      if (e.hp <= 0) continue;
      if (e.shootCooldown > 0) e.shootCooldown -= step;
      const d = dist(e.x, e.y, p.x, p.y);
      const toPlayer = Math.atan2(p.y - e.y, p.x - e.x);
      if (d > ENEMY_CHASE_MAX) {
        // Wander near the anchor point.
        e.wanderTimer -= step;
        if (e.wanderTimer <= 0) {
          e.wanderTimer = 1.5 + Math.random() * 2;
          const a = Math.random() * Math.PI * 2;
          e.wanderX = e.anchorX + Math.cos(a) * 60;
          e.wanderY = e.anchorY + Math.sin(a) * 60;
        }
        const toWander = Math.atan2(e.wanderY - e.y, e.wanderX - e.x);
        e.angle = turnToward(e.angle, toWander, 2.4 * step);
        const wd = dist(e.x, e.y, e.wanderX, e.wanderY);
        if (wd > 12) {
          e.x += Math.cos(e.angle) * e.speed * 0.45 * step;
          e.y += Math.sin(e.angle) * e.speed * 0.45 * step;
        }
      } else if (d > ENEMY_CHASE_MIN) {
        // Chase the player.
        e.angle = turnToward(e.angle, toPlayer, 3.2 * step);
        e.x += Math.cos(e.angle) * e.speed * step;
        e.y += Math.sin(e.angle) * e.speed * step;
      } else {
        // Hold ground and shoot (only inside gun range).
        e.angle = turnToward(e.angle, toPlayer, 4 * step);
        if (d <= PLAYER.gunRange && e.shootCooldown <= 0) {
          e.shootCooldown = ENEMY_SHOOT_COOLDOWN;
          combat.bullets.push({
            x: e.x + Math.cos(e.angle) * 16,
            y: e.y + Math.sin(e.angle) * 16,
            angle: e.angle,
            vx: Math.cos(e.angle) * ENEMY_BULLET_SPEED,
            vy: Math.sin(e.angle) * ENEMY_BULLET_SPEED,
            speed: ENEMY_BULLET_SPEED,
            damage: ENEMY_BULLET_DAMAGE,
            life: PLAYER.gunRange / ENEMY_BULLET_SPEED,
            maxLife: PLAYER.gunRange / ENEMY_BULLET_SPEED,
            from: 'enemy',
          });
          events |= 128; // ENEMY_SHOT
        }
      }
      // Stay out of walls.
      if (city && city.resolveCircle) city.resolveCircle(e, 11);
      e.x = clamp(e.x, 16, 2864);
      e.y = clamp(e.y, 16, 2096);
    }
  }
  return events;
}

// How many gang members are still standing (hp > 0).
export function enemiesAlive(state) {
  const combat = combatOf(state);
  let n = 0;
  for (const e of combat.enemies) if (e.hp > 0) n++;
  return n;
}

export default {
  createCombat,
  spawnGang,
  firePlayerBullet,
  meleeAttack,
  stepCombat,
  enemiesAlive,
};
