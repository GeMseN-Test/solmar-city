// Combat: player gun + fists vs gang enemies, plus enemy return fire.
// How many gang members are still alive (hp > 0).
export function countLivingEnemies(state) {
  let n = 0;
  for (const e of state.combat.enemies) {
    if (e.hp > 0) n++;
  }
  return n;
}

// Dead enemies (hp <= 0) are LEFT in place — world.step removes them
// and counts the kill. Do not delete them here.
export function pruneDeadEnemies(state) {
  // Intentionally a no-op for combat: world.step owns removal + kill
  // counting, so defeat objectives stay in sync. Kept as a named
  // hook so a future caller cannot silently re-add deletion here.
  return state.combat.enemies.filter((e) => e.hp > 0).length;
}
import { PLAYER } from './config.js';
import { clamp, angleDiff, dist, turnToward } from './util.js';
import { randRange, pick } from './random.js';

const SKINS = ['#e8b98a', '#c98d5f', '#8a5a3b', '#f0c8a0', '#a06a42'];
const SHIRTS = ['#7a2d8f', '#8f2d2d', '#2d5f8f', '#3d7a2d', '#8f7a2d'];

export function createCombat() {
  return { bullets: [], enemies: [] };
}

// Spawn `count` gang members around (x, y), within ~+/-70px.
export function spawnGang(state, x, y, count) {
  const rng = state.rng || Math.random;
  const out = [];
  for (let i = 0; i < count; i++) {
    const e = {
      x: clamp(x + randRange(rng, -70, 70), 16, 2864),
      y: clamp(y + randRange(rng, -70, 70), 16, 2144),
      angle: randRange(rng, 0, Math.PI * 2),
      hp: 100,
      speed: randRange(rng, 140, 170),
      shootCooldown: randRange(rng, 0, 1.15),
      shirt: pick(rng, SHIRTS),
      skin: pick(rng, SKINS),
      wanderX: x,
      wanderY: y,
      wanderTimer: 0,
      dead: false,
    };
    state.combat.enemies.push(e);
    out.push(e);
  }
  return out;
}

// Player shoots toward (x, y) from the player position. Needs
// gunCooldown 0 and ammo. Returns true when a bullet was fired.
export function firePlayerBullet(state, x, y, angle) {
  const p = state.player;
  if (!p) return false;
  if (state.gunCooldown > 0) return false;
  if (p.ammo <= 0) return false;
  const a = typeof angle === 'number' ? angle : Math.atan2(y - p.y, x - p.x);
  const muzzle = 16;
  const bx = p.x + Math.cos(a) * muzzle;
  const by = p.y + Math.sin(a) * muzzle;
  state.combat.bullets.push({
    x: bx,
    y: by,
    vx: Math.cos(a) * PLAYER.bulletSpeed,
    vy: Math.sin(a) * PLAYER.bulletSpeed,
    angle: a,
    damage: PLAYER.gunDamage,
    life: PLAYER.gunRange / PLAYER.bulletSpeed,
    fromPlayer: true,
  });
  p.ammo -= 1;
  state.gunCooldown = PLAYER.gunCooldown;
  return true;
}

// Player punch: hits every living enemy within punchRange + ~11px of
// the player and within punchArc of the player's aim angle.
export function meleeAttack(state) {
  const p = state.player;
  if (!p) return 0;
  if (state.punchCooldown > 0) return 0;
  state.punchCooldown = PLAYER.punchCooldown;
  let hits = 0;
  const reach = PLAYER.punchRange + 11;
  for (const e of state.combat.enemies) {
    if (e.hp <= 0) continue;
    const d = dist(p.x, p.y, e.x, e.y);
    if (d > reach) continue;
    const ang = Math.atan2(e.y - p.y, e.x - p.x);
    if (Math.abs(angleDiff(p.aimAngle, ang)) > PLAYER.punchArc) continue;
    e.hp -= PLAYER.punchDamage;
    hits++;
  }
  return hits;
}

// One combat frame: move bullets, resolve hits, drive enemy AI.
// IMPORTANT: gunCooldown / punchCooldown are decremented here every
// step — without this the player can only shoot/punch once ever.
export function stepCombat(state, dt) {
  const p = state.player;
  const combat = state.combat;

  // Cooldowns tick down every step.
  if (state.gunCooldown > 0) state.gunCooldown = Math.max(0, state.gunCooldown - dt);
  if (state.punchCooldown > 0) state.punchCooldown = Math.max(0, state.punchCooldown - dt);

  // --- Bullets ---
  const alive = [];
  for (const b of combat.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    if (b.x < 0 || b.y < 0 || b.x > 2880 || b.y > 2160) continue;
    // Buildings stop bullets.
    if (state.city && state.city.pointInBuilding(b.x, b.y)) continue;
    let spent = false;
    if (b.fromPlayer) {
      for (const e of combat.enemies) {
        if (e.hp <= 0) continue;
        if (dist(b.x, b.y, e.x, e.y) < 16) {
          e.hp -= b.damage;
          spent = true;
          break;
        }
      }
    } else if (p && p.hp > 0) {
      if (dist(b.x, b.y, p.x, p.y) < 14) {
        p.hp -= b.damage;
        state.lastDamageFrom = 'enemy';
        spent = true;
      }
    }
    if (!spent) alive.push(b);
  }
  combat.bullets = alive;

  // --- Enemies ---
  const rng = state.rng || Math.random;
  for (const e of combat.enemies) {
    if (e.hp <= 0) continue; // dead: left in place for world.step
    e.shootCooldown = Math.max(0, e.shootCooldown - dt);
    const d = dist(e.x, e.y, p.x, p.y);
    const toPlayer = Math.atan2(p.y - e.y, p.x - e.x);
    if (d > 600) {
      // Far away: wander near the anchor point.
      e.wanderTimer -= dt;
      if (e.wanderTimer <= 0) {
        e.wanderTimer = randRange(rng, 1.5, 3.5);
        e.wanderX = clamp(e.x + randRange(rng, -90, 90), 16, 2864);
        e.wanderY = clamp(e.y + randRange(rng, -90, 90), 16, 2144);
      }
      const wa = Math.atan2(e.wanderY - e.y, e.wanderX - e.x);
      e.angle = turnToward(e.angle, wa, 3 * dt);
      const wd = dist(e.x, e.y, e.wanderX, e.wanderY);
      if (wd > 12) {
        e.x += Math.cos(e.angle) * e.speed * 0.5 * dt;
        e.y += Math.sin(e.angle) * e.speed * 0.5 * dt;
      }
    } else if (d > 260) {
      // Chase the player.
      e.angle = turnToward(e.angle, toPlayer, 4 * dt);
      e.x += Math.cos(e.angle) * e.speed * dt;
      e.y += Math.sin(e.angle) * e.speed * dt;
    } else {
      // In range: hold position and shoot.
      e.angle = turnToward(e.angle, toPlayer, 5 * dt);
      if (e.shootCooldown <= 0 && d <= PLAYER.gunRange) {
        e.shootCooldown = 1.15;
        combat.bullets.push({
          x: e.x + Math.cos(e.angle) * 16,
          y: e.y + Math.sin(e.angle) * 16,
          vx: Math.cos(e.angle) * 540,
          vy: Math.sin(e.angle) * 540,
          angle: e.angle,
          damage: 9,
          life: PLAYER.gunRange / 540,
          fromPlayer: false,
        });
        state.enemyShotFired = true;
      }
    }
    if (state.city) state.city.resolveCircle(e, 11);
  }
}

export default createCombat;
