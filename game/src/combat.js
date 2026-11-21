// combat.js — shooting, punching and gang AI for Solmar City.
// state.combat = { bullets, enemies, gunCooldown, punchCooldown }.
// Dead enemies are LEFT in place — world.step sweeps them and counts
// the kill exactly once. stepCombat decrements both cooldowns every
// frame (old bug: the player could only shoot/punch once ever).

import { PLAYER } from './config.js';
import { randRange, pick } from './random.js';
import { clamp, dist, normalizeAngle, angleDiff } from './util.js';

const SKINS = ['#e8b98a', '#c98d5f', '#8a5a3b', '#f0c8a0', '#a06b42'];
const ENEMY_SHIRT = '#7a2d8f';

export function createCombat() {
  return {
    bullets: [],
    enemies: [],
    gunCooldown: 0,
    punchCooldown: 0,
  };
}

export function spawnGang(state, x, y, count) {
  const combat = state.combat || (state.combat = createCombat());
  const rng = state.rng;
  const made = [];
  for (let i = 0; i < count; i += 1) {
    const ex = x + (rng ? randRange(rng, -70, 70) : (Math.random() * 140 - 70));
    const ey = y + (rng ? randRange(rng, -70, 70) : (Math.random() * 140 - 70));
    const enemy = {
      x: ex,
      y: ey,
      angle: rng ? randRange(rng, 0, Math.PI * 2) : Math.random() * Math.PI * 2,
      hp: 100,
      speed: rng ? randRange(rng, 140, 170) : 140 + Math.random() * 30,
      shootCooldown: rng ? randRange(rng, 0, 1.15) : Math.random() * 1.15,
      shirt: ENEMY_SHIRT,
      skin: rng ? pick(rng, SKINS) : SKINS[0],
      wanderX: ex,
      wanderY: ey,
      wanderTimer: 0,
      anchorX: x,
      anchorY: y,
    };
    combat.enemies.push(enemy);
    made.push(enemy);
  }
  return made;
}

export function firePlayerBullet(state, x, y, angle) {
  const combat = state.combat;
  const p = state.player;
  if (!combat || !p) return false;
  if (combat.gunCooldown > 0) return false;
  if (p.ammo <= 0) return false;
  const mx = x + Math.cos(angle) * 16;
  const my = y + Math.sin(angle) * 16;
  combat.bullets.push({
    x: mx,
    y: my,
    angle,
    speed: PLAYER.bulletSpeed,
    damage: PLAYER.gunDamage,
    life: PLAYER.gunRange / PLAYER.bulletSpeed,
    from: 'player',
  });
  p.ammo -= 1;
  combat.gunCooldown = PLAYER.gunCooldown;
  return true;
}

export function meleeAttack(state) {
  const combat = state.combat;
  const p = state.player;
  if (!combat || !p) return 0;
  if (combat.punchCooldown > 0) return 0;
  combat.punchCooldown = PLAYER.punchCooldown;
  let hits = 0;
  const range = PLAYER.punchRange + 11;
  for (const e of combat.enemies) {
    if (e.hp <= 0) continue;
    const d = dist(p.x, p.y, e.x, e.y);
    if (d > range) continue;
    const toEnemy = Math.atan2(e.y - p.y, e.x - p.x);
    if (Math.abs(angleDiff(p.aimAngle, toEnemy)) > PLAYER.punchArc) continue;
    e.hp -= PLAYER.punchDamage;
    hits += 1;
  }
  return hits;
}

function bulletHitsBuilding(state, x, y) {
  const city = state.city;
  if (!city || !city.pointInBuilding) return false;
  return !!city.pointInBuilding(x, y);
}

export function stepCombat(state, dt) {
  // Substep large frames so a 0.25s dt advances 0.25s of game time
  // instead of being clamped to a single 0.05s frame.
  const total = Math.max(0.001, dt || 0.016);
  const n = Math.max(1, Math.ceil(total / 0.05));
  const sub = total / n;
  for (let i = 0; i < n; i += 1) stepCombatOnce(state, sub);
}

function stepCombatOnce(state, step) {
  const combat = state.combat;
  const p = state.player;
  if (!combat || !p) return;
  // Cooldowns tick down every frame — this is the fix for the
  // "shoot once ever" bug.
  if (combat.gunCooldown > 0) combat.gunCooldown = Math.max(0, combat.gunCooldown - step);
  if (combat.punchCooldown > 0) combat.punchCooldown = Math.max(0, combat.punchCooldown - step);

  // Move bullets, resolve hits, drop the dead ones.
  const alive = [];
  for (const b of combat.bullets) {
    b.x += Math.cos(b.angle) * b.speed * step;
    b.y += Math.sin(b.angle) * b.speed * step;
    b.life -= step;
    if (b.life <= 0) continue;
    if (bulletHitsBuilding(state, b.x, b.y)) continue;
    if (b.from === 'player') {
      let hit = false;
      for (const e of combat.enemies) {
        if (e.hp <= 0) continue;
        if (dist(b.x, b.y, e.x, e.y) < 16) {
          e.hp -= b.damage;
          hit = true;
          break;
        }
      }
      if (hit) continue;
    } else {
      if (dist(b.x, b.y, p.x, p.y) < 14) {
        if (!p.invuln || p.invuln <= 0) {
          p.hp = Math.max(0, (p.hp || 100) - b.damage);
          p.invuln = 0.3;
        }
        continue;
      }
    }
    alive.push(b);
  }
  combat.bullets = alive;

  // Enemy AI: chase at 260–600px, hold and shoot under ~260px,
  // wander near the anchor when far away.
  for (const e of combat.enemies) {
    if (e.hp <= 0) continue;
    const d = dist(e.x, e.y, p.x, p.y);
    const toPlayer = Math.atan2(p.y - e.y, p.x - e.x);
    if (d < 260) {
      e.angle = toPlayer;
      if (e.shootCooldown > 0) e.shootCooldown -= step;
      if (e.shootCooldown <= 0 && d < PLAYER.gunRange) {
        e.shootCooldown = 1.15;
        combat.bullets.push({
          x: e.x + Math.cos(toPlayer) * 16,
          y: e.y + Math.sin(toPlayer) * 16,
          angle: toPlayer,
          speed: 540,
          damage: 9,
          life: PLAYER.gunRange / 540,
          from: 'enemy',
        });
      }
    } else if (d < 600) {
      e.angle = toPlayer;
      e.x += Math.cos(toPlayer) * e.speed * step;
      e.y += Math.sin(toPlayer) * e.speed * step;
    } else {
      e.wanderTimer -= step;
      if (e.wanderTimer <= 0) {
        const rng = state.rng;
        const ax = e.anchorX !== undefined ? e.anchorX : e.x;
        const ay = e.anchorY !== undefined ? e.anchorY : e.y;
        e.wanderX = ax + (rng ? randRange(rng, -90, 90) : (Math.random() * 180 - 90));
        e.wanderY = ay + (rng ? randRange(rng, -90, 90) : (Math.random() * 180 - 90));
        e.wanderTimer = rng ? randRange(rng, 1.5, 3.5) : 2 + Math.random() * 2;
      }
      const wd = dist(e.x, e.y, e.wanderX, e.wanderY);
      if (wd > 8) {
        const wa = Math.atan2(e.wanderY - e.y, e.wanderX - e.x);
        e.angle = wa;
        e.x += Math.cos(wa) * e.speed * 0.45 * step;
        e.y += Math.sin(wa) * e.speed * 0.45 * step;
      }
    }
    // Keep enemies out of buildings and inside the world.
    if (state.city && state.city.resolveCircle) {
      const fixed = state.city.resolveCircle(e.x, e.y, 12);
      e.x = fixed.x;
      e.y = fixed.y;
    }
    e.x = clamp(e.x, 12, 2868);
    e.y = clamp(e.y, 12, 2148);
  }

  // Gang separation: living enemies push apart so they never stack
  // on one pixel and read as a single shooter.
  const living = combat.enemies.filter((e) => e.hp > 0);
  for (let i = 0; i < living.length; i += 1) {
    for (let j = i + 1; j < living.length; j += 1) {
      const a = living[i];
      const b = living[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 24 * 24 && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (24 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
  void normalizeAngle;
}

export default { createCombat, spawnGang, firePlayerBullet, meleeAttack, stepCombat };
