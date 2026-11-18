// combat.js — shooting, punching, and the gang members who shoot back.
//
// The rules of a firefight in Solmar City:
//
//   - The player fires with the mouse (firePlayerBullet). One bullet
//     costs one ammo and a short cooldown; it flies straight until it
//     hits a building, an enemy, or runs out of range.
//   - Space punches (meleeAttack): a short arc in front of where the
//     player is AIMING (the mouse), with its own cooldown.
//   - Gang members spawn in a pack (spawnGang), wander near where they
//     were dropped, chase the player when they spot them, and stand off
//     and shoot when they get close.
//
// Two deliberate splits: this module never removes a dead enemy and
// never counts a kill — the world step does that, so a mission can
// count the kill exactly once. And bullets never know about the world
// beyond the city (buildings stop them) and the two things they can hit.

import { GANG_SHOT_COOLDOWN, PLAYER } from './config.js';
import { angleDifference, circlesOverlap, distanceBetween, turnToward } from './util.js';

// Enemy bullets are weaker than the player's: they sting, they don't
// delete you in one drive-by.
const ENEMY_BULLET_DAMAGE = 9;
const ENEMY_BULLET_SPEED = 540;
const ENEMY_BODY_RADIUS = 11;
const BULLET_RADIUS = 3;

// How far away an enemy notices you, and how close they get before
// they plant their feet and start shooting.
const ENEMY_SPOT_RANGE = 600;
const ENEMY_HOLD_RANGE = 260;

const SKIN_TONES = ['#c98a5a', '#e8b98a', '#8a5a3a', '#f0c8a0'];
const GANG_SHIRT = '#7a2d8f';

// A fresh combat state: no bullets in the air, no gang on the street.
export function createCombat() {
  return { bullets: [], enemies: [] };
}

// Drop `count` gang members around (x, y). They arrive a little
// scattered (up to ~70px off the drop point), each with their own pace
// and their own moment to start shooting.
export function spawnGang(state, x, y, count) {
  const rng = state.rng;
  for (let i = 0; i < count; i++) {
    const ex = x + (rng.next() - 0.5) * 140;
    const ey = y + (rng.next() - 0.5) * 140;
    state.combat.enemies.push({
      x: ex,
      y: ey,
      angle: rng.next() * Math.PI * 2,
      hp: 100,
      speed: 140 + rng.next() * 30,
      shootCooldown: rng.next() * GANG_SHOT_COOLDOWN,
      shirt: GANG_SHIRT,
      skin: rng.pick(SKIN_TONES),
      wanderX: x,
      wanderY: y,
      wanderTimer: rng.next() * 2,
    });
  }
}

// Fire one player bullet from (x, y) along `angle`. The muzzle sits a
// little ahead of the shooter so the shot never starts inside them.
// Returns the bullet, or null when the gun is cooling down or dry.
export function firePlayerBullet(state, x, y, angle) {
  if (state.gunCooldown > 0) return null;
  if (state.player.ammo <= 0) return null;
  state.player.ammo -= 1;
  state.gunCooldown = 0.22;
  const bullet = {
    x: x + Math.cos(angle) * 16,
    y: y + Math.sin(angle) * 16,
    vx: Math.cos(angle) * PLAYER.bulletSpeed,
    vy: Math.sin(angle) * PLAYER.bulletSpeed,
    life: PLAYER.gunRange / PLAYER.bulletSpeed,
    from: 'player',
    damage: PLAYER.gunDamage,
  };
  state.combat.bullets.push(bullet);
  return bullet;
}

// Throw a punch. It lands on every living enemy inside the arc the
// player is aiming along — punch range plus a body's width, and the
// punch arc around the aim angle. Fists have a short recovery, so
// mashing Space does not machine-gun anyone.
export function meleeAttack(state) {
  const player = state.player;
  if (player.inCar || player.inBoat) return false;
  if (state.punchCooldown > 0) return false;
  state.punchCooldown = 0.45;
  let hitAnything = false;
  for (const enemy of state.combat.enemies) {
    if (enemy.hp <= 0) continue;
    const dist = distanceBetween(player.x, player.y, enemy.x, enemy.y);
    if (dist > PLAYER.punchRange + ENEMY_BODY_RADIUS) continue;
    const direction = Math.atan2(enemy.y - player.y, enemy.x - player.x);
    if (Math.abs(angleDifference(player.aimAngle, direction)) > PLAYER.punchArc) continue;
    enemy.hp -= PLAYER.punchDamage;
    hitAnything = true;
  }
  return hitAnything;
}

// One step of the firefight: fly the bullets, run the gang AI.
// Returns how many shots the gang fired this step, so the world can
// raise the ENEMY_SHOT event (and the sound) for them.
export function stepCombat(state, dt) {
  // The player's own timers run down here, every step, so the gun
  // and the fists are ready again shortly after each use.
  if (state.gunCooldown > 0) state.gunCooldown = Math.max(0, state.gunCooldown - dt);
  if (state.punchCooldown > 0) state.punchCooldown = Math.max(0, state.punchCooldown - dt);
  stepBullets(state, dt);
  const enemyShots = stepEnemies(state, dt);
  return { enemyShots };
}

function stepBullets(state, dt) {
  const { bullets } = state.combat;
  const player = state.player;
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    let dead = bullet.life <= 0;
    // Walls eat bullets.
    if (!dead && state.city.pointInBuilding(bullet.x, bullet.y)) dead = true;
    if (!dead && bullet.from === 'player') {
      for (const enemy of state.combat.enemies) {
        if (enemy.hp <= 0) continue;
        if (circlesOverlap(bullet.x, bullet.y, BULLET_RADIUS, enemy.x, enemy.y, ENEMY_BODY_RADIUS)) {
          enemy.hp -= bullet.damage;
          dead = true;
          break;
        }
      }
    }
    if (!dead && bullet.from === 'enemy') {
      if (
        player.invuln <= 0 &&
        circlesOverlap(bullet.x, bullet.y, BULLET_RADIUS, player.x, player.y, PLAYER.radius)
      ) {
        player.hp -= bullet.damage;
        dead = true;
      }
    }
    if (dead) bullets.splice(i, 1);
  }
}

function stepEnemies(state, dt) {
  const player = state.player;
  const { enemies } = state.combat;
  let enemyShots = 0;
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue; // down; swept away below
    const dist = distanceBetween(enemy.x, enemy.y, player.x, player.y);
    if (dist > ENEMY_SPOT_RANGE) {
      wanderGangMember(state, enemy, dt);
    } else if (dist > ENEMY_HOLD_RANGE) {
      chasePlayer(enemy, player, dt);
    } else {
      enemyShots += holdAndShoot(state, enemy, player, dt);
    }
  }
  // The fallen: take them off the street and count the kill. The
  // missions watch state.kills to know when a gang is cleared.
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].hp <= 0) {
      enemies.splice(i, 1);
      state.kills += 1;
    }
  }
  separateGangMembers(enemies);
  return enemyShots;
}

// Drift around the drop point. When the current stroll target is
// reached (or the timer runs out), pick a new one nearby.
function wanderGangMember(state, enemy, dt) {
  enemy.wanderTimer -= dt;
  const dx = enemy.wanderX - enemy.x;
  const dy = enemy.wanderY - enemy.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 12 || enemy.wanderTimer <= 0) {
    const rng = state.rng;
    enemy.wanderX = enemy.x + (rng.next() - 0.5) * 160;
    enemy.wanderY = enemy.y + (rng.next() - 0.5) * 160;
    enemy.wanderTimer = 2 + rng.next() * 2;
    return;
  }
  const heading = Math.atan2(dy, dx);
  enemy.angle = turnToward(enemy.angle, heading, 4 * dt);
  const pace = enemy.speed * 0.4;
  enemy.x += Math.cos(enemy.angle) * pace * dt;
  enemy.y += Math.sin(enemy.angle) * pace * dt;
}

// Run straight at the player. The feet point where the body is going.
function chasePlayer(enemy, player, dt) {
  const heading = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  enemy.angle = turnToward(enemy.angle, heading, 5 * dt);
  enemy.x += Math.cos(enemy.angle) * enemy.speed * dt;
  enemy.y += Math.sin(enemy.angle) * enemy.speed * dt;
}

// Stand off and shoot. The gun only opens up inside its own range, and
// every shot wobbles a little — gang members are not marksmen.
// Returns 1 when a shot was fired, 0 otherwise.
function holdAndShoot(state, enemy, player, dt) {
  const heading = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  enemy.angle = turnToward(enemy.angle, heading, 6 * dt);
  enemy.shootCooldown -= dt;
  const dist = distanceBetween(enemy.x, enemy.y, player.x, player.y);
  if (enemy.shootCooldown > 0 || dist > PLAYER.gunRange) return 0;
  enemy.shootCooldown = GANG_SHOT_COOLDOWN;
  const spread = (state.rng.next() - 0.5) * 0.2;
  const shotAngle = heading + spread;
  state.combat.bullets.push({
    x: enemy.x + Math.cos(shotAngle) * 16,
    y: enemy.y + Math.sin(shotAngle) * 16,
    vx: Math.cos(shotAngle) * ENEMY_BULLET_SPEED,
    vy: Math.sin(shotAngle) * ENEMY_BULLET_SPEED,
    life: PLAYER.gunRange / ENEMY_BULLET_SPEED,
    from: 'enemy',
    damage: ENEMY_BULLET_DAMAGE,
  });
  return 1;
}

// Gang members are not a conga line: gently push apart any two that
// end up standing in each other.
function separateGangMembers(enemies) {
  for (let i = 0; i < enemies.length; i++) {
    for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i];
      const b = enemies[j];
      if (a.hp <= 0 || b.hp <= 0) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minGap = 26;
      if (dist === 0 || dist >= minGap) continue;
      const push = (minGap - dist) / 2;
      const nx = dx / dist;
      const ny = dy / dist;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
    }
  }
}
