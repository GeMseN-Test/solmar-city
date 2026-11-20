// combat.js — Guns, punches and gang enemies.
// Player: gunDamage 34, gunRange 520, bulletSpeed 760, startAmmo 48,
// punchDamage 26, punchRange 36, punchArc 1.1. Enemy bullets deal 9
// damage at speed 540. Dead enemies are left in place for world.step
// to count kills — combat never removes them itself.

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
export const ENEMY_HOLD_RANGE = 260;
export const ENEMY_CHASE_RANGE = 600;

const SKINS = ['#e8b98a', '#c98d5f', '#8a5a3b', '#f0c8a0'];
const SHIRTS = ['#7a2d8f', '#8f2d2d', '#2d5a8f', '#3f7a2d'];

export function createCombat() {
  return { bullets: [], enemies: [] };
}

export function spawnGang(state, x, y, count) {
  if (!state) return [];
  if (!state.combat) state.combat = createCombat();
  const spawned = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 20 + Math.random() * 50;
    const ex = x + Math.cos(a) * r;
    const ey = y + Math.sin(a) * r;
    const enemy = {
      x: ex,
      y: ey,
      angle: Math.random() * Math.PI * 2,
      hp: 100,
      maxHp: 100,
      speed: 140 + Math.random() * 30,
      shootCooldown: Math.random() * ENEMY_SHOOT_COOLDOWN,
      shirt: SHIRTS[i % SHIRTS.length],
      skin: SKINS[i % SKINS.length],
      wanderX: ex,
      wanderY: ey,
      wanderTimer: 0,
      dead: false,
    };
    state.combat.enemies.push(enemy);
    spawned.push(enemy);
  }
  return spawned;
}

export function firePlayerBullet(state, x, y, angle) {
  if (!state || !state.combat) return false;
  const p = state.player;
  if (!p) return false;
  if ((p.gunCooldown || 0) > 0) return false;
  if ((p.ammo || 0) <= 0) return false;
  const muzzle = 16;
  const bx = x + Math.cos(angle) * muzzle;
  const by = y + Math.sin(angle) * muzzle;
  state.combat.bullets.push({
    x: bx,
    y: by,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    angle,
    damage: GUN_DAMAGE,
    life: GUN_RANGE / BULLET_SPEED,
    fromPlayer: true,
    radius: 3,
  });
  p.ammo -= 1;
  p.gunCooldown = GUN_COOLDOWN;
  return true;
}

export function meleeAttack(state) {
  if (!state || !state.player) return 0;
  const p = state.player;
  if ((p.punchCooldown || 0) > 0) return 0;
  p.punchCooldown = PUNCH_COOLDOWN;
  if (!state.combat) return 0;
  let hits = 0;
  const aim = p.aimAngle !== undefined ? p.aimAngle : p.angle;
  for (let i = 0; i < state.combat.enemies.length; i++) {
    const e = state.combat.enemies[i];
    if (e.hp <= 0) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > PUNCH_RANGE + 11) continue;
    const toEnemy = Math.atan2(dy, dx);
    let diff = toEnemy - aim;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > PUNCH_ARC) continue;
    e.hp -= PUNCH_DAMAGE;
    hits++;
  }
  return hits;
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  const cx = x1 + dx * t;
  const cy = y1 + dy * t;
  return Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
}

export function stepCombat(state, dt) {
  if (!state || !state.combat) return;
  const p = state.player;
  const combat = state.combat;
  const city = state.city;
  // Move bullets, resolve hits.
  for (let i = combat.bullets.length - 1; i >= 0; i--) {
    const b = combat.bullets[i];
    const nx = b.x + b.vx * dt;
    const ny = b.y + b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && city && city.pointInBuilding) {
      if (city.pointInBuilding(nx, ny)) dead = true;
    }
    if (!dead && b.fromPlayer) {
      for (let j = 0; j < combat.enemies.length; j++) {
        const e = combat.enemies[j];
        if (e.hp <= 0) continue;
        const d = distToSegment(e.x, e.y, b.x, b.y, nx, ny);
        if (d < 13) {
          e.hp -= b.damage;
          dead = true;
          break;
        }
      }
    } else if (!dead && !b.fromPlayer && p) {
      const d = distToSegment(p.x, p.y, b.x, b.y, nx, ny);
      if (d < 12 && !(p.invuln > 0)) {
        p.hp -= b.damage;
        dead = true;
      }
    }
    if (dead) {
      combat.bullets.splice(i, 1);
    } else {
      b.x = nx;
      b.y = ny;
    }
  }
  // Enemy AI: chase, hold and shoot, or wander near anchor.
  if (p) {
    for (let i = 0; i < combat.enemies.length; i++) {
      const e = combat.enemies[i];
      if (e.hp <= 0) continue;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      e.shootCooldown -= dt;
      if (dist < ENEMY_HOLD_RANGE) {
        e.angle = Math.atan2(dy, dx);
        if (dist < GUN_RANGE && e.shootCooldown <= 0 && dist > 40) {
          // Lead the target slightly: aim where the player is heading.
          const lead = 0.12;
          const aimX = p.x + (p.vx || 0) * lead;
          const aimY = p.y + (p.vy || 0) * lead;
          const a = Math.atan2(aimY - e.y, aimX - e.x) + (Math.random() - 0.5) * 0.12;
          combat.bullets.push({
            x: e.x + Math.cos(a) * 16,
            y: e.y + Math.sin(a) * 16,
            vx: Math.cos(a) * ENEMY_BULLET_SPEED,
            vy: Math.sin(a) * ENEMY_BULLET_SPEED,
            angle: a,
            damage: ENEMY_BULLET_DAMAGE,
            life: GUN_RANGE / ENEMY_BULLET_SPEED,
            fromPlayer: false,
            radius: 3,
          });
          e.shootCooldown = ENEMY_SHOOT_COOLDOWN;
        }
      } else if (dist < ENEMY_CHASE_RANGE) {
        e.angle = Math.atan2(dy, dx);
        const step = e.speed * dt;
        let nx = e.x + Math.cos(e.angle) * step;
        let ny = e.y + Math.sin(e.angle) * step;
        if (city && city.resolveCircle) {
          const out = city.resolveCircle(nx, ny, 11);
          nx = out.x;
          ny = out.y;
        }
        e.x = nx;
        e.y = ny;
      } else {
        // Wander near the anchor point.
        e.wanderTimer -= dt;
        if (e.wanderTimer <= 0) {
          e.wanderX = e.x + (Math.random() - 0.5) * 160;
          e.wanderY = e.y + (Math.random() - 0.5) * 160;
          e.wanderTimer = 1.5 + Math.random() * 2;
        }
        const wx = e.wanderX - e.x;
        const wy = e.wanderY - e.y;
        const wd = Math.sqrt(wx * wx + wy * wy);
        if (wd > 12) {
          e.angle = Math.atan2(wy, wx);
          const step = e.speed * 0.45 * dt;
          let nx = e.x + Math.cos(e.angle) * step;
          let ny = e.y + Math.sin(e.angle) * step;
          if (city && city.resolveCircle) {
            const out = city.resolveCircle(nx, ny, 11);
            nx = out.x;
            ny = out.y;
          }
          e.x = nx;
          e.y = ny;
        }
      }
    }
  }
  // Cooldowns tick down.
  if (p) {
    if (p.gunCooldown > 0) p.gunCooldown -= dt;
    if (p.punchCooldown > 0) p.punchCooldown -= dt;
  }
}

export function livingEnemies(state) {
  if (!state || !state.combat) return 0;
  let n = 0;
  for (const e of state.combat.enemies) if (e.hp > 0) n++;
  return n;
}

// Direct damage helper used by scripted playthroughs and tests: applies
// damage to one enemy and returns its remaining hp (never below 0).
export function damageEnemy(enemy, amount) {
  if (!enemy) return 0;
  enemy.hp = Math.max(0, enemy.hp - amount);
  return enemy.hp;
}

// Reset a combat arena without dropping the object identity world.js
// already holds a reference to.
export function resetCombat(state) {
  if (!state) return null;
  state.combat = createCombat();
  return state.combat;
}

export default createCombat;
