// combat.js — shooting, punching, gang enemies.
// RULE: world.step counts kills + sweeps dead enemies — NOT combat.
// stepCombat leaves dead enemies (hp <= 0) in place for world.step.
// Cooldowns MUST decrease every frame (a past bug left them frozen,
// so the player could only shoot/punch once ever).
import { GUN_DAMAGE, GUN_RANGE, BULLET_SPEED, GUN_COOLDOWN, PUNCH_DAMAGE, PUNCH_RANGE, PUNCH_ARC, PUNCH_COOLDOWN, ENEMY_BULLET_DAMAGE, ENEMY_BULLET_SPEED } from './config.js';
import { randRange, pick } from './random.js';
import { dist, angleTo, normalizeAngle } from './util.js';

const SKINS = ['#e8b98a', '#c98d5f', '#8a5a3b', '#f0c8a0'];
const GANG_SHIRT = '#7a2d8f';

export function createCombat() {
  return { bullets: [], enemies: [] };
}

export function spawnGang(state, x, y, count) {
  const combat = state.combat || (state.combat = createCombat());
  const rng = state.rng || Math.random;
  const spawned = [];
  for (let i = 0; i < count; i++) {
    const e = {
      x: x + randRange(rng, -70, 70),
      y: y + randRange(rng, -70, 70),
      angle: randRange(rng, 0, Math.PI * 2),
      hp: 100,
      speed: randRange(rng, 140, 170),
      shootCooldown: randRange(rng, 0, 1.15),
      shirt: GANG_SHIRT,
      skin: pick(rng, SKINS),
      wanderX: x,
      wanderY: y,
      wanderTimer: 0,
      radius: 11,
    };
    combat.enemies.push(e);
    spawned.push(e);
  }
  return spawned;
}

export function firePlayerBullet(state, x, y, angle) {
  const p = state.player;
  if (!p) return false;
  if ((state.gunCooldown || 0) > 0) return false;
  if ((p.ammo || 0) <= 0) return false;
  const combat = state.combat || (state.combat = createCombat());
  const muzzle = 16;
  combat.bullets.push({
    x: x + Math.cos(angle) * muzzle,
    y: y + Math.sin(angle) * muzzle,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    angle,
    damage: GUN_DAMAGE,
    life: GUN_RANGE / BULLET_SPEED,
    fromPlayer: true,
    radius: 3,
  });
  p.ammo -= 1;
  state.gunCooldown = GUN_COOLDOWN;
  return true;
}

export function meleeAttack(state) {
  const p = state.player;
  if (!p) return 0;
  if ((state.punchCooldown || 0) > 0) return 0;
  state.punchCooldown = PUNCH_COOLDOWN;
  const combat = state.combat;
  if (!combat) return 0;
  let hits = 0;
  for (const e of combat.enemies) {
    if (e.hp <= 0) continue;
    const d = dist(p.x, p.y, e.x, e.y);
    if (d > PUNCH_RANGE + 11) continue;
    const ang = angleTo(p.x, p.y, e.x, e.y);
    if (Math.abs(normalizeAngle(ang - p.aimAngle)) > PUNCH_ARC) continue;
    e.hp -= PUNCH_DAMAGE;
    hits++;
  }
  return hits;
}

export function enemyCount(state) {
  const combat = state.combat;
  if (!combat) return 0;
  return combat.enemies.filter((e) => e.hp > 0).length;
}

export function aliveEnemies(state) {
  const combat = state.combat;
  if (!combat) return [];
  return combat.enemies.filter((e) => e.hp > 0);
}

function bulletHitsBuilding(city, x, y) {
  if (!city || !city.pointInBuilding) return false;
  return !!city.pointInBuilding(x, y, 0);
}

export function stepCombat(state, dt) {
  // Cooldowns tick down EVERY frame — never freeze them.
  if (state.gunCooldown > 0) state.gunCooldown = Math.max(0, state.gunCooldown - dt);
  if (state.punchCooldown > 0) state.punchCooldown = Math.max(0, state.punchCooldown - dt);
  const combat = state.combat;
  if (!combat) return;
  const p = state.player;
  const city = state.city;
  let remaining = dt;
  while (remaining > 0) {
    const h = Math.min(remaining, 0.05);
    remaining -= h;
    // Move bullets.
    for (const b of combat.bullets) {
      b.x += b.vx * h;
      b.y += b.vy * h;
      b.life -= h;
      if (bulletHitsBuilding(city, b.x, b.y)) b.life = 0;
    }
    combat.bullets = combat.bullets.filter((b) => b.life > 0);
    // Resolve bullet hits.
    for (const b of combat.bullets) {
      if (b.life <= 0) continue;
      if (b.fromPlayer) {
        for (const e of combat.enemies) {
          if (e.hp <= 0) continue;
          if (dist(b.x, b.y, e.x, e.y) < 14) {
            e.hp -= b.damage;
            b.life = 0;
            break;
          }
        }
      } else if (p && p.hp > 0) {
        if (dist(b.x, b.y, p.x, p.y) < 13) {
          p.hp -= ENEMY_BULLET_DAMAGE;
          b.life = 0;
        }
      }
    }
    combat.bullets = combat.bullets.filter((b) => b.life > 0);
    // Enemy AI: chase at 260-600px, hold + shoot inside ~260px,
    // wander near anchor when far away.
    if (p) {
      for (const e of combat.enemies) {
        if (e.hp <= 0) continue;
        e.shootCooldown = Math.max(0, (e.shootCooldown || 0) - h);
        const d = dist(e.x, e.y, p.x, p.y);
        const ang = angleTo(e.x, e.y, p.x, p.y);
        if (d > 600) {
          e.wanderTimer -= h;
          if (e.wanderTimer <= 0) {
            e.wanderTimer = 2 + Math.random() * 2;
            e.wanderX = e.x + randRange(Math.random, -60, 60);
            e.wanderY = e.y + randRange(Math.random, -60, 60);
          }
          const wa = angleTo(e.x, e.y, e.wanderX, e.wanderY);
          e.angle = wa;
          e.x += Math.cos(wa) * e.speed * 0.4 * h;
          e.y += Math.sin(wa) * e.speed * 0.4 * h;
        } else if (d > 260) {
          e.angle = ang;
          e.x += Math.cos(ang) * e.speed * h;
          e.y += Math.sin(ang) * e.speed * h;
        } else {
          e.angle = ang;
          if (d < 120) {
            e.x -= Math.cos(ang) * e.speed * 0.4 * h;
            e.y -= Math.sin(ang) * e.speed * 0.4 * h;
          }
          if (e.shootCooldown <= 0 && d <= GUN_RANGE) {
            e.shootCooldown = 1.15;
            combat.bullets.push({
              x: e.x + Math.cos(ang) * 16,
              y: e.y + Math.sin(ang) * 16,
              vx: Math.cos(ang) * ENEMY_BULLET_SPEED,
              vy: Math.sin(ang) * ENEMY_BULLET_SPEED,
              angle: ang,
              damage: ENEMY_BULLET_DAMAGE,
              life: GUN_RANGE / ENEMY_BULLET_SPEED,
              fromPlayer: false,
              radius: 3,
            });
            state.enemyShotFired = true;
          }
        }
        if (city && city.resolveCircle) city.resolveCircle(e);
      }
    }
  }
  // NOTE: dead enemies are NOT removed here and kills are NOT counted
  // here — world.step sweeps them and counts kills exactly once.
}
export default createCombat;
