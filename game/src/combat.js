// Combat in Solmar City: the player's pistol and fists, the bullets both
// sides fire, and the rival Vipers gang who hold the Old Town turf.
// Gang members chase the player when close, keep a shooting distance, and
// fire with a spread. Everything here is pure simulation; the world plays
// the sounds and the renderer draws the flashes.

import { GANG_SHOT_COOLDOWN, PLAYER } from './config.js';
import { circlesOverlap, distanceBetween } from './util.js';

export function createCombat() {
  return { bullets: [], enemies: [] };
}

export function spawnGang(state, x, y, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = state.rng.range(0, Math.PI * 2);
    state.combat.enemies.push({
      x: x + Math.cos(angle) * state.rng.range(20, 90),
      y: y + Math.sin(angle) * state.rng.range(20, 90),
      angle,
      hp: 100,
      speed: state.rng.range(130, 165),
      shootCooldown: state.rng.range(0.4, 1.2),
      shirt: '#7a2d8f',
      skin: state.rng.pick(['#e8b98a', '#c98a5a', '#8a5a3a']),
      wanderX: x,
      wanderY: y,
      wanderTimer: 0,
    });
  }
}

/** Fire the player's pistol toward an angle. Returns true when a shot left. */
export function firePlayerBullet(state, angle) {
  const player = state.player;
  if (player.ammo <= 0) return false;
  if (state.gunCooldown > 0) return false;
  player.ammo -= 1;
  state.gunCooldown = 0.22;
  const muzzleX = player.x + Math.cos(angle) * 16;
  const muzzleY = player.y + Math.sin(angle) * 16;
  state.combat.bullets.push({
    x: muzzleX,
    y: muzzleY,
    vx: Math.cos(angle) * PLAYER.bulletSpeed,
    vy: Math.sin(angle) * PLAYER.bulletSpeed,
    life: PLAYER.gunRange / PLAYER.bulletSpeed,
    from: 'player',
    damage: PLAYER.gunDamage,
  });
  addMuzzleFlash(state, muzzleX, muzzleY, angle);
  return true;
}

/** The player's punch: hurts anything hostile within reach and arc. */
export function meleeAttack(state) {
  if (state.punchCooldown > 0) return { hits: 0 };
  state.punchCooldown = 0.45;
  const player = state.player;
  const aim = player.aimAngle;
  let hits = 0;
  function tryHit(target, radius, onHit) {
    const d = distanceBetween(player.x, player.y, target.x, target.y);
    if (d > PLAYER.punchRange + radius) return;
    let diff = Math.atan2(target.y - player.y, target.x - player.x) - aim;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > PLAYER.punchArc) return;
    onHit(target, d);
    hits += 1;
  }
  for (const enemy of state.combat.enemies) {
    tryHit(enemy, 12, (target) => {
      target.hp -= PLAYER.punchDamage;
      knockBack(state, target, player, 260);
    });
  }
  for (const cop of state.police.cops) {
    tryHit(cop, 10, () => {
      cop.x += Math.cos(aim) * 14;
      cop.y += Math.sin(aim) * 14;
    });
  }
  for (const ped of state.traffic.peds) {
    tryHit(ped, 9, (target) => {
      target.down = 1.6;
      target.panic = 4;
      knockBack(state, target, player, 200);
    });
  }
  return { hits };
}

function knockBack(state, target, from, force) {
  const angle = Math.atan2(target.y - from.y, target.x - from.x);
  target.x += Math.cos(angle) * force * 0.06;
  target.y += Math.sin(angle) * force * 0.06;
}

export function stepCombat(state, dt) {
  const player = state.player;
  state.gunCooldown = Math.max(0, state.gunCooldown - dt);
  state.punchCooldown = Math.max(0, state.punchCooldown - dt);

  // Gang members: close in, hold a shooting distance, fire with a spread.
  let enemyShots = 0;
  for (let i = state.combat.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = state.combat.enemies[i];
    if (enemy.hp <= 0) {
      addDeathBurst(state, enemy.x, enemy.y);
      state.combat.enemies.splice(i, 1);
      state.kills += 1;
      state.money += 40;
      if (state.rng.chance(0.5)) spawnPickupNear(state, enemy.x, enemy.y, 'ammo');
      continue;
    }
    const dist = distanceBetween(enemy.x, enemy.y, player.x, player.y);
    enemy.shootCooldown -= dt;
    if (dist < 560 && player.hp > 0) {
      const aim = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      enemy.angle = aim;
      if (dist > 300) {
        enemy.x += Math.cos(aim) * enemy.speed * dt;
        enemy.y += Math.sin(aim) * enemy.speed * dt;
      } else if (dist < 190) {
        enemy.x -= Math.cos(aim) * enemy.speed * 0.6 * dt;
        enemy.y -= Math.sin(aim) * enemy.speed * 0.6 * dt;
      }
      if (enemy.shootCooldown <= 0 && dist < 460) {
        enemy.shootCooldown = GANG_SHOT_COOLDOWN + state.rng.range(0, 0.5);
        const spread = state.rng.range(-0.12, 0.12);
        state.combat.bullets.push({
          x: enemy.x + Math.cos(aim) * 16,
          y: enemy.y + Math.sin(aim) * 16,
          vx: Math.cos(aim + spread) * 540,
          vy: Math.sin(aim + spread) * 540,
          life: 0.9,
          from: 'enemy',
          damage: 9,
        });
        enemyShots += 1;
      }
    } else {
      // Idle near the turf: drift to a nearby wander point.
      enemy.wanderTimer -= dt;
      if (enemy.wanderTimer <= 0) {
        enemy.wanderX = enemy.x + state.rng.range(-90, 90);
        enemy.wanderY = enemy.y + state.rng.range(-90, 90);
        enemy.wanderTimer = state.rng.range(2, 5);
      }
      const dx = enemy.wanderX - enemy.x;
      const dy = enemy.wanderY - enemy.y;
      const d = Math.hypot(dx, dy);
      if (d > 10) {
        enemy.x += (dx / d) * 42 * dt;
        enemy.y += (dy / d) * 42 * dt;
        enemy.angle = Math.atan2(dy, dx);
      }
    }
    state.city.resolveCircle(enemy, 11);
  }

  // Bullets fly, spark on walls, and land on whoever they meet.
  for (let i = state.combat.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.combat.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && state.city.pointInBuilding(b.x, b.y, 0)) {
      addSpark(state, b.x, b.y);
      dead = true;
    }
    if (!dead && b.from === 'player') {
      for (const enemy of state.combat.enemies) {
        if (circlesOverlap(b.x, b.y, 4, enemy.x, enemy.y, 12)) {
          enemy.hp -= b.damage;
          addBlood(state, enemy.x, enemy.y);
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const cop of state.police.cops) {
          if (circlesOverlap(b.x, b.y, 4, cop.x, cop.y, 10)) {
            cop.x += (b.vx / 760) * 10;
            cop.y += (b.vy / 760) * 10;
            addBlood(state, cop.x, cop.y);
            dead = true;
            break;
          }
        }
      }
    }
    if (!dead && b.from === 'enemy') {
      if (circlesOverlap(b.x, b.y, 4, player.x, player.y, PLAYER.radius)) {
        player.hp -= b.damage;
        state.shake = Math.min(10, state.shake + 3);
        addBlood(state, player.x, player.y);
        dead = true;
      }
    }
    if (dead) state.combat.bullets.splice(i, 1);
  }

  return { enemyShots };
}

function spawnPickupNear(state, x, y, kind) {
  state.pickups.push({ kind, x: x + state.rng.range(-24, 24), y: y + state.rng.range(-24, 24), bob: 0 });
}

function addMuzzleFlash(state, x, y, angle) {
  state.particles.push({
    kind: 'flash', x, y,
    vx: Math.cos(angle) * 60, vy: Math.sin(angle) * 60,
    life: 0.07, maxLife: 0.07, size: 9, color: '#ffd94d',
  });
}

function addSpark(state, x, y) {
  state.particles.push({
    kind: 'spark', x, y,
    vx: state.rng.range(-120, 120), vy: state.rng.range(-120, 120),
    life: 0.3, maxLife: 0.3, size: 3, color: '#ffd94d',
  });
}

function addBlood(state, x, y) {
  for (let i = 0; i < 5; i += 1) {
    state.particles.push({
      kind: 'blood', x, y,
      vx: state.rng.range(-90, 90), vy: state.rng.range(-90, 90),
      life: 0.4, maxLife: 0.4, size: 3, color: '#c22e2e',
    });
  }
}

function addDeathBurst(state, x, y) {
  for (let i = 0; i < 14; i += 1) {
    state.particles.push({
      kind: 'blood', x, y,
      vx: state.rng.range(-150, 150), vy: state.rng.range(-150, 150),
      life: state.rng.range(0.3, 0.7), maxLife: 0.7, size: state.rng.range(2, 5), color: '#c22e2e',
    });
  }
}
