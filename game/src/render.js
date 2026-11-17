// Drawing only: the world's state and the current screen in, pixels out.
// The camera follows the player across the city; the HUD, the minimap and
// the menus are drawn in screen space on top. Flat shapes, warm colours,
// canvas text — no images, no fonts fetched, nothing from a network.

import { BEACH_TOP, COLORS, GRID, ROAD_X, ROAD_Y, SEA_TOP, WORLD } from './config.js';
import { currentObjective, missionMarker } from './missions.js';
import { clampNumber, distanceBetween } from './util.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_HOWTO = 'howto';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MINIMAP = { w: 220, h: 168 };

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  let cw = 1280;
  let ch = 800;
  let dpr = 1;
  let zoom = 1;
  const fonts = new Map();

  function resize() {
    dpr = window.devicePixelRatio || 1;
    cw = window.innerWidth;
    ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    zoom = clampNumber(Math.min(cw / 1250, ch / 780), 0.7, 1.25);
  }
  window.addEventListener('resize', resize);
  resize();

  function text(value, x, y, size, color, align = 'left', weight = 400) {
    const key = `${size}:${weight}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function worldToScreenX(wx, camX) {
    return (wx - camX) * zoom + cw / 2;
  }
  function worldToScreenY(wy, camY) {
    return (wy - camY) * zoom + ch / 2;
  }

  // ---------- The city ----------

  function drawGround(state) {
    const camX = state.camera.x;
    const camY = state.camera.y;
    const left = camX - cw / 2 / zoom - 40;
    const top = camY - ch / 2 / zoom - 40;
    const right = camX + cw / 2 / zoom + 40;
    const bottom = camY + ch / 2 / zoom + 40;
    context.fillStyle = COLORS.grass;
    context.fillRect(left, top, right - left, bottom - top);
    // Beach and sea along the south edge.
    context.fillStyle = COLORS.sand;
    context.fillRect(left, BEACH_TOP, right - left, SEA_TOP - BEACH_TOP);
    context.fillStyle = COLORS.sea;
    context.fillRect(left, SEA_TOP, right - left, WORLD.height - SEA_TOP + 40);
    context.fillStyle = COLORS.seaDeep;
    context.fillRect(left, SEA_TOP + 34, right - left, 10);

    // Roads: sidewalk border, asphalt, centre dashes.
    for (const rx of ROAD_X) {
      context.fillStyle = COLORS.sidewalk;
      context.fillRect(rx - GRID.roadWidth / 2 - 6, top, GRID.roadWidth + 12, bottom - top);
      context.fillStyle = COLORS.road;
      context.fillRect(rx - GRID.roadWidth / 2, top, GRID.roadWidth, bottom - top);
    }
    for (const ry of ROAD_Y) {
      context.fillStyle = COLORS.sidewalk;
      context.fillRect(left, ry - GRID.roadWidth / 2 - 6, right - left, GRID.roadWidth + 12);
      context.fillStyle = COLORS.road;
      context.fillRect(left, ry - GRID.roadWidth / 2, right - left, GRID.roadWidth);
    }
    // Centre dashes, skipping the intersections.
    context.fillStyle = COLORS.laneDash;
    for (const rx of ROAD_X) {
      for (let y = Math.max(0, top); y < bottom; y += 46) {
        if (ROAD_Y.some((ry) => Math.abs(y + 10 - ry) < GRID.roadWidth / 2 + 12)) continue;
        context.fillRect(rx - 2, y, 4, 24);
      }
    }
    for (const ry of ROAD_Y) {
      for (let x = Math.max(0, left); x < right; x += 46) {
        if (ROAD_X.some((rx) => Math.abs(x + 10 - rx) < GRID.roadWidth / 2 + 12)) continue;
        context.fillRect(x, ry - 2, 24, 4);
      }
    }
    // Crosswalks at every intersection.
    context.fillStyle = COLORS.crosswalk;
    for (const rx of ROAD_X) {
      for (const ry of ROAD_Y) {
        for (let i = -2; i <= 2; i += 1) {
          context.fillRect(rx + i * 12 - 4, ry - GRID.roadWidth / 2 - 2, 8, 10);
          context.fillRect(rx + i * 12 - 4, ry + GRID.roadWidth / 2 - 8, 8, 10);
        }
      }
    }
  }

  function drawParksAndBuildings(state) {
    const camX = state.camera.x;
    const camY = state.camera.y;
    const left = camX - cw / 2 / zoom - 60;
    const top = camY - ch / 2 / zoom - 60;
    const right = camX + cw / 2 / zoom + 60;
    const bottom = camY + ch / 2 / zoom + 60;
    for (const park of state.city.parks) {
      if (park.x > right || park.x + park.w < left || park.y > bottom || park.y + park.h < top) continue;
      context.fillStyle = COLORS.parkGrass;
      context.fillRect(park.x, park.y, park.w, park.h);
      for (const tree of park.trees) {
        context.fillStyle = COLORS.parkTree;
        context.beginPath();
        context.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = COLORS.parkTreeLight;
        context.beginPath();
        context.arc(tree.x - 3, tree.y - 3, tree.r * 0.55, 0, Math.PI * 2);
        context.fill();
      }
    }
    for (const b of state.city.buildings) {
      if (b.x > right || b.x + b.w < left || b.y > bottom || b.y + b.h < top) continue;
      context.fillStyle = 'rgba(0,0,0,0.22)';
      context.fillRect(b.x + 5, b.y + 7, b.w, b.h);
      context.fillStyle = b.wall;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      // Rooftop detail: a darker inner court and a few vents.
      context.fillStyle = 'rgba(0,0,0,0.12)';
      context.fillRect(b.x + 14, b.y + 14, b.w - 28, b.h - 28);
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.25, 10, 8);
      context.fillRect(b.x + b.w * 0.65, b.y + b.h * 0.6, 10, 8);
      if (b.landmark) {
        context.strokeStyle = '#ffffff';
        context.lineWidth = 3;
        context.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
        const spot = state.city.landmarks[b.landmark];
        text(spot.name, b.x + b.w / 2, b.y - 10, 15, '#ffffff', 'center', 700);
      }
    }
    // The docks: wooden piers reaching up from the north edge.
    context.fillStyle = '#8a6a45';
    context.fillRect(300, 0, 26, 120);
    context.fillRect(420, 0, 26, 96);
    context.fillStyle = '#6a4f33';
    for (let y = 8; y < 116; y += 18) {
      context.fillRect(300, y, 26, 3);
      context.fillRect(420, y, 26, 3);
    }
    // Boats in the marina water.
    for (const [bx, by, bc] of [[2440, 2130, '#e8e8e8'], [2560, 2140, '#f0b070'], [2660, 2124, '#a0c4e8']]) {
      context.fillStyle = bc;
      roundRect(bx, by, 64, 20, 9);
      context.fill();
      context.fillStyle = '#40454f';
      context.fillRect(bx + 22, by - 8, 20, 10);
    }
  }

  function drawCarShape(car, isPlayerCar) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(-24, -11 + 4, 48, 24, 8);
    context.fill();
    // Wheels.
    context.fillStyle = '#1c1e22';
    context.fillRect(-17, -13, 12, 5);
    context.fillRect(7, -13, 12, 5);
    context.fillRect(-17, 8, 12, 5);
    context.fillRect(7, 8, 12, 5);
    // Body.
    context.fillStyle = car.color;
    roundRect(-23, -11, 46, 22, 8);
    context.fill();
    // Cabin and windshield.
    context.fillStyle = 'rgba(20,30,45,0.85)';
    roundRect(-6, -9, 16, 18, 5);
    context.fill();
    context.fillStyle = 'rgba(180,220,240,0.7)';
    context.fillRect(8, -8, 4, 16);
    // Headlights and tail lights.
    context.fillStyle = '#ffe9a0';
    context.fillRect(21, -8, 3, 5);
    context.fillRect(21, 3, 3, 5);
    context.fillStyle = '#d94f3d';
    context.fillRect(-23, -8, 2, 5);
    context.fillRect(-23, 3, 2, 5);
    if (car.model === 'taxi') {
      context.fillStyle = '#222222';
      for (let i = 0; i < 4; i += 1) context.fillRect(-18 + i * 10, -2, 5, 4);
      context.fillStyle = '#f2c93d';
      context.fillRect(-4, -14, 10, 4);
    }
    if (car.model === 'police') {
      const phase = Math.floor(car.lightPhase) % 2 === 0;
      context.fillStyle = phase ? '#ff3b30' : '#2f6df2';
      context.fillRect(-4, -13, 9, 5);
      context.fillStyle = phase ? '#2f6df2' : '#ff3b30';
      context.fillRect(-4, 8, 9, 5);
      context.fillStyle = '#ffffff';
      text('PD', 0, 4, 11, '#ffffff', 'center', 700);
    }
    if (isPlayerCar) {
      context.strokeStyle = '#ffffff';
      context.lineWidth = 2;
      roundRect(-25, -13, 50, 26, 9);
      context.stroke();
    }
    context.restore();
  }

  function drawPerson(x, y, angle, shirt, skin, down, isPlayer, aimAngle) {
    context.save();
    context.translate(x, y);
    if (down > 0) {
      context.rotate(angle + Math.PI / 2);
      context.fillStyle = shirt;
      roundRect(-11, -6, 22, 12, 5);
      context.fill();
      context.fillStyle = skin;
      context.beginPath();
      context.arc(13, 0, 6, 0, Math.PI * 2);
      context.fill();
      context.restore();
      return;
    }
    context.rotate(angle);
    context.fillStyle = 'rgba(0,0,0,0.22)';
    context.beginPath();
    context.ellipse(1, 3, 10, 9, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = shirt;
    context.beginPath();
    context.arc(0, 0, 9, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = skin;
    context.beginPath();
    context.arc(0, 0, 5.5, 0, Math.PI * 2);
    context.fill();
    if (isPlayer) {
      context.strokeStyle = '#222';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(8, 0);
      context.lineTo(16, 0);
      context.stroke();
      if (aimAngle !== undefined) {
        context.save();
        context.rotate(aimAngle - angle);
        context.strokeStyle = '#1c1e22';
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(10, 0);
        context.lineTo(20, 0);
        context.stroke();
        context.restore();
      }
    }
    context.restore();
  }

  function drawWorld(state) {
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = '#79b264';
    context.fillRect(0, 0, cw, ch);
    context.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * (cw / 2 - state.camera.x * zoom + shakeX), dpr * (ch / 2 - state.camera.y * zoom + shakeY));
    drawGround(state);
    drawParksAndBuildings(state);

    // Pickups and crates.
    for (const pickup of state.pickups) {
      const bobY = Math.sin(pickup.bob) * 3;
      if (pickup.kind === 'cash') {
        context.fillStyle = '#2d7a2d';
        context.beginPath();
        context.arc(pickup.x, pickup.y + bobY, 11, 0, Math.PI * 2);
        context.fill();
        text('$', pickup.x, pickup.y + bobY + 5, 14, '#f2c94c', 'center', 700);
      } else if (pickup.kind === 'health') {
        context.fillStyle = '#ffffff';
        context.beginPath();
        context.arc(pickup.x, pickup.y + bobY, 11, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#c22e2e';
        context.fillRect(pickup.x - 2, pickup.y + bobY - 7, 4, 14);
        context.fillRect(pickup.x - 7, pickup.y + bobY - 2, 14, 4);
      } else {
        context.fillStyle = '#e8a13d';
        roundRect(pickup.x - 10, pickup.y + bobY - 7, 20, 14, 3);
        context.fill();
        context.fillStyle = '#7a4d12';
        context.fillRect(pickup.x - 2, pickup.y + bobY - 7, 4, 14);
      }
    }
    for (const crate of state.crates) {
      if (crate.taken) continue;
      const pulse = 1 + Math.sin(state.time * 4) * 0.08;
      context.fillStyle = '#8a6a45';
      context.fillRect(crate.x - 11 * pulse, crate.y - 11 * pulse, 22 * pulse, 22 * pulse);
      context.strokeStyle = '#5a4028';
      context.lineWidth = 2;
      context.strokeRect(crate.x - 11 * pulse, crate.y - 11 * pulse, 22 * pulse, 22 * pulse);
      context.beginPath();
      context.moveTo(crate.x - 11, crate.y - 11);
      context.lineTo(crate.x + 11, crate.y + 11);
      context.moveTo(crate.x + 11, crate.y - 11);
      context.lineTo(crate.x - 11, crate.y + 11);
      context.stroke();
    }

    // Cars: traffic, police, then the player's ride on top.
    for (const car of state.traffic.cars) drawCarShape(car, false);
    for (const car of state.police.cars) drawCarShape(car, false);
    if (state.playerCar && state.player.inCar) drawCarShape(state.playerCar, true);

    // People: pedestrians, gang, cops, then the player.
    for (const ped of state.traffic.peds) {
      drawPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.skin, ped.down, false);
    }
    for (const enemy of state.combat.enemies) {
      drawPerson(enemy.x, enemy.y, enemy.angle, enemy.shirt, enemy.skin, 0, false);
      context.strokeStyle = '#222';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(enemy.x + Math.cos(enemy.angle) * 10, enemy.y + Math.sin(enemy.angle) * 10);
      context.lineTo(enemy.x + Math.cos(enemy.angle) * 22, enemy.y + Math.sin(enemy.angle) * 22);
      context.stroke();
    }
    for (const cop of state.police.cops) {
      drawPerson(cop.x, cop.y, cop.angle, '#22375e', '#e8b98a', 0, false);
      context.fillStyle = '#16233d';
      context.beginPath();
      context.arc(cop.x, cop.y, 6, Math.PI, 0);
      context.fill();
    }
    const player = state.player;
    if (!player.inCar) {
      const blink = player.invuln > 0 && Math.floor(player.invuln * 10) % 2 === 0;
      if (!blink) drawPerson(player.x, player.y, player.angle, '#2fae8f', '#e8b98a', 0, true, player.aimAngle);
    }

    // Bullets and particles.
    for (const b of state.combat.bullets) {
      context.strokeStyle = b.from === 'player' ? '#ffe9a0' : '#ff9a7a';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    for (const p of state.particles) {
      const alpha = clampNumber(p.life / p.maxLife, 0, 1);
      context.globalAlpha = alpha;
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size * (p.kind === 'smoke' ? 1 + (1 - alpha) : 1), 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }

    drawObjectiveMarker(state);
  }

  function drawObjectiveMarker(state) {
    const marker = missionMarker(state);
    if (!marker) return;
    const pulse = 1 + Math.sin(state.time * 5) * 0.15;
    // A beam of light so the target reads from across the city.
    context.fillStyle = 'rgba(242,201,76,0.18)';
    context.fillRect(marker.x - 16, marker.y - 260, 32, 260);
    context.save();
    context.translate(marker.x, marker.y);
    context.rotate(Math.PI / 4);
    context.fillStyle = '#f2c94c';
    context.strokeStyle = '#7a5c00';
    context.lineWidth = 2;
    context.fillRect(-11 * pulse, -11 * pulse, 22 * pulse, 22 * pulse);
    context.strokeRect(-11 * pulse, -11 * pulse, 22 * pulse, 22 * pulse);
    context.restore();
    // Off-screen: an arrow at the screen edge points the way.
    const sx = worldToScreenX(marker.x, state.camera.x);
    const sy = worldToScreenY(marker.y, state.camera.y);
    if (sx < 40 || sx > cw - 40 || sy < 40 || sy > ch - 40) {
      const cx = clampNumber(sx, 60, cw - 60);
      const cy = clampNumber(sy, 60, ch - 60);
      const angle = Math.atan2(sy - ch / 2, sx - cw / 2);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.save();
      context.translate(cx, cy);
      context.rotate(angle);
      context.fillStyle = '#f2c94c';
      context.beginPath();
      context.moveTo(18, 0);
      context.lineTo(-10, -12);
      context.lineTo(-10, 12);
      context.closePath();
      context.fill();
      context.restore();
      context.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * (cw / 2 - state.camera.x * zoom), dpr * (ch / 2 - state.camera.y * zoom));
    }
  }

  // ---------- HUD ----------

  function drawHud(state, extras) {
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const player = state.player;

    // Top-left: cash, health, ammo, mission.
    context.fillStyle = 'rgba(16,20,28,0.72)';
    roundRect(14, 12, 250, 92, 10);
    context.fill();
    text(`$${state.money.toLocaleString('en-US')}`, 28, 44, 30, '#f2c94c', 'left', 800);
    context.fillStyle = '#333';
    roundRect(28, 54, 180, 14, 7);
    context.fill();
    const hpFrac = clampNumber(player.hp / 100, 0, 1);
    context.fillStyle = hpFrac > 0.5 ? '#6ac76a' : hpFrac > 0.25 ? '#e8a13d' : '#d94f3d';
    roundRect(28, 54, 180 * hpFrac, 14, 7);
    context.fill();
    text('HP', 212, 66, 13, '#eef1f5', 'left', 700);
    text(`Ammo ${player.ammo}`, 28, 94, 15, '#eef1f5', 'left', 600);
    const mission = state.mission;
    if (mission) text(`${mission.def.title}  •  ${state.missionsDone} done`, 28, 116, 14, '#c9d2de', 'left', 600);

    // Top-right: wanted stars.
    context.fillStyle = 'rgba(16,20,28,0.72)';
    roundRect(cw - 204, 12, 190, 56, 10);
    context.fill();
    for (let i = 0; i < 5; i += 1) {
      const filled = i < state.wanted;
      const blink = state.wanted > 0 && Math.sin(state.time * 6) > 0;
      text('★', cw - 188 + i * 34, 50, 30, filled ? (blink ? '#ffd94d' : '#f2c94c') : 'rgba(255,255,255,0.25)', 'left', 800);
    }

    // Bottom-left: current objective.
    const objective = currentObjective(state);
    if (objective) {
      const marker = missionMarker(state);
      const dist = marker ? Math.round(distanceBetween(player.x, player.y, marker.x, marker.y)) : 0;
      context.fillStyle = 'rgba(16,20,28,0.72)';
      roundRect(14, ch - 86, 420, 56, 10);
      context.fill();
      text('◈  ' + objective.text, 28, ch - 58, 16, '#ffffff', 'left', 600);
      if (marker) text(`${dist}m away`, 28, ch - 36, 13, '#f2c94c', 'left', 600);
    }

    // Context prompt, bottom centre.
    const prompt = extras.prompt;
    if (prompt) {
      context.fillStyle = 'rgba(16,20,28,0.72)';
      roundRect(cw / 2 - 190, ch - 46, 380, 32, 16);
      context.fill();
      text(prompt, cw / 2, ch - 24, 16, '#ffffff', 'center', 600);
    }

    // Early-game controls hint, on a pill just above the objective box.
    if (state.playTime < 22 && extras.screen === SCREEN_PLAY) {
      const hint = 'WASD move  •  E enter / steal car  •  Click shoot  •  Space punch  •  P pause  •  M mute';
      context.font = `600 13px ${FONT}`;
      const hintWidth = context.measureText(hint).width;
      context.fillStyle = 'rgba(16,20,28,0.6)';
      roundRect(cw / 2 - hintWidth / 2 - 12, ch - 116, hintWidth + 24, 24, 12);
      context.fill();
      text(hint, cw / 2, ch - 99, 13, 'rgba(255,255,255,0.85)', 'center');
    }

    // Banner: mission starts and payouts.
    if (state.banner && state.banner.t < state.banner.duration) {
      const alpha = state.banner.t > state.banner.duration - 0.8
        ? clampNumber((state.banner.duration - state.banner.t) / 0.8, 0, 1)
        : 1;
      context.globalAlpha = alpha;
      context.fillStyle = 'rgba(16,20,28,0.78)';
      const tw = 560;
      roundRect(cw / 2 - tw / 2, 92, tw, 78, 12);
      context.fill();
      text(state.banner.title, cw / 2, 126, 26, '#f2c94c', 'center', 800);
      text(state.banner.sub, cw / 2, 154, 15, '#eef1f5', 'center');
      context.globalAlpha = 1;
    }

    // Low health: a red pulse at the edges.
    if (player.hp < 30 && player.hp > 0) {
      const pulse = 0.12 + 0.08 * Math.sin(state.time * 6);
      context.fillStyle = `rgba(217,79,61,${pulse})`;
      context.fillRect(0, 0, cw, 14);
      context.fillRect(0, ch - 14, cw, 14);
      context.fillRect(0, 0, 14, ch);
      context.fillRect(cw - 14, 0, 14, ch);
    }

    drawMinimap(state);
    if (player.inCar && player.car) {
      // Speed sits in the clear strip left of the minimap, never over the city.
      const mph = Math.round(Math.abs(player.car.speed) * 0.12);
      const label = `${mph} mph`;
      context.fillStyle = 'rgba(16,20,28,0.72)';
      const labelWidth = 92;
      roundRect(cw - MINIMAP.w - 24 - labelWidth, ch - 50, labelWidth, 34, 9);
      context.fill();
      text(label, cw - MINIMAP.w - 24, ch - 26, 22, '#ffffff', 'right', 800);
    }
    if (extras.muted) text('🔇 MUTED', cw - MINIMAP.w - 24, ch - 56, 14, '#c9d2de', 'right', 600);
  }

  function drawMinimap(state) {
    const mx = cw - MINIMAP.w - 14;
    const my = ch - MINIMAP.h - 14;
    const scaleX = MINIMAP.w / WORLD.width;
    const scaleY = MINIMAP.h / WORLD.height;
    context.fillStyle = 'rgba(16,20,28,0.78)';
    roundRect(mx - 6, my - 6, MINIMAP.w + 12, MINIMAP.h + 12, 10);
    context.fill();
    context.save();
    context.beginPath();
    context.rect(mx, my, MINIMAP.w, MINIMAP.h);
    context.clip();
    context.fillStyle = '#4a7a3f';
    context.fillRect(mx, my, MINIMAP.w, MINIMAP.h);
    context.fillStyle = COLORS.sea;
    context.fillRect(mx, my + SEA_TOP * scaleY, MINIMAP.w, MINIMAP.h - SEA_TOP * scaleY);
    context.fillStyle = COLORS.sand;
    context.fillRect(mx, my + BEACH_TOP * scaleY, MINIMAP.w, (SEA_TOP - BEACH_TOP) * scaleY);
    context.strokeStyle = '#9aa0ab';
    context.lineWidth = 2;
    for (const rx of ROAD_X) {
      context.beginPath();
      context.moveTo(mx + rx * scaleX, my);
      context.lineTo(mx + rx * scaleX, my + MINIMAP.h);
      context.stroke();
    }
    for (const ry of ROAD_Y) {
      context.beginPath();
      context.moveTo(mx, my + ry * scaleY);
      context.lineTo(mx + MINIMAP.w, my + ry * scaleY);
      context.stroke();
    }
    // Landmarks as dots, the mission target pulsing yellow.
    for (const key of Object.keys(state.city.landmarks)) {
      const spot = state.city.landmarks[key];
      context.fillStyle = '#e8e8e8';
      context.beginPath();
      context.arc(mx + spot.x * scaleX, my + spot.y * scaleY, 2.5, 0, Math.PI * 2);
      context.fill();
    }
    const marker = missionMarker(state);
    if (marker) {
      const pulse = 3 + Math.sin(state.time * 5) * 1.5;
      context.fillStyle = '#f2c94c';
      context.beginPath();
      context.arc(mx + marker.x * scaleX, my + marker.y * scaleY, pulse, 0, Math.PI * 2);
      context.fill();
    }
    for (const car of state.police.cars) {
      context.fillStyle = '#ff3b30';
      context.beginPath();
      context.arc(mx + car.x * scaleX, my + car.y * scaleY, 2.5, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#ffffff';
    context.save();
    context.translate(mx + state.player.x * scaleX, my + state.player.y * scaleY);
    context.rotate(state.player.angle);
    context.beginPath();
    context.moveTo(6, 0);
    context.lineTo(-4, -4);
    context.lineTo(-4, 4);
    context.closePath();
    context.fill();
    context.restore();
    context.restore();
    context.strokeStyle = 'rgba(255,255,255,0.35)';
    context.lineWidth = 1;
    roundRect(mx - 6, my - 6, MINIMAP.w + 12, MINIMAP.h + 12, 10);
    context.stroke();
    text('SOLMAR CITY', mx + MINIMAP.w / 2, my - 12, 11, '#c9d2de', 'center', 700);
  }

  // ---------- Menus ----------

  function drawButton(id, x, y, w, h, label, enabled) {
    context.fillStyle = enabled ? '#f2c94c' : 'rgba(255,255,255,0.18)';
    roundRect(x, y, w, h, 10);
    context.fill();
    text(label, x + w / 2, y + h / 2 + 6, 19, enabled ? '#222222' : '#8b93a3', 'center', 700);
    return { id, x, y, w, h };
  }

  function drawTitle(state, extras) {
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = 'rgba(10,14,22,0.55)';
    context.fillRect(0, 0, cw, ch);
    text('SOLMAR CITY', cw / 2, 190, 84, '#f2c94c', 'center', 900);
    text('An open-world crime story  •  a make.fun GTA 6 bounty entry', cw / 2, 232, 20, '#eef1f5', 'center');
    text('Mara Voss came home broke. The city owes her a living.', cw / 2, 262, 16, '#c9d2de', 'center');
    const buttons = [];
    const bw = 320;
    const bx = cw / 2 - bw / 2;
    let by = 320;
    buttons.push(drawButton('new', bx, by, bw, 54, '▶  New Game', true));
    by += 68;
    buttons.push(drawButton('continue', bx, by, bw, 54, '↻  Continue', extras.saveExists));
    by += 68;
    buttons.push(drawButton('howto', bx, by, bw, 54, '?  How to Play', true));
    text('Steal cars. Lose the cops. Run the missions. Take the city.', cw / 2, by + 92, 15, '#c9d2de', 'center');
    text('WASD move/drive  •  E enter & steal  •  Click shoot  •  Space punch  •  P pause', cw / 2, by + 118, 14, '#8b93a3', 'center');
    if (extras.saveExists && extras.saveInfo) {
      text(extras.saveInfo, cw / 2, by + 146, 14, '#f2c94c', 'center', 600);
    }
    return buttons;
  }

  function drawHowTo() {
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = 'rgba(10,14,22,0.72)';
    context.fillRect(0, 0, cw, ch);
    const w = 640;
    const h = 480;
    const x = cw / 2 - w / 2;
    const y = ch / 2 - h / 2;
    context.fillStyle = '#1c2230';
    roundRect(x, y, w, h, 14);
    context.fill();
    text('HOW TO PLAY', cw / 2, y + 56, 34, '#f2c94c', 'center', 800);
    const lines = [
      'Mara Voss is back in Solmar City with $50 and a grudge.',
      'Follow the yellow marker: steal cars, run jobs for cash,',
      'and finish all five story missions — ending with the',
      'Grand Solmar Bank. The whole PD will come after you.',
      '',
      'WASD / Arrows — walk and drive (Shift to run)',
      'Mouse — aim   •   Click — shoot   •   Space — punch',
      'E — steal / enter a car, pick up crates, grab the vault',
      'P / Esc — pause   •   M — mute   •   Progress auto-saves',
      '',
      'Stars mean heat: crimes raise them, hiding lowers them.',
      'Cops chase you in cars and on foot. Stay out of reach.',
    ];
    lines.forEach((line, i) => {
      text(line, cw / 2, y + 106 + i * 26, 16, i < 4 ? '#eef1f5' : '#c9d2de', 'center');
    });
    const buttons = [drawButton('back', cw / 2 - 110, y + h - 66, 220, 48, '←  Back', true)];
    return buttons;
  }

  function drawPaused(state, extras) {
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = 'rgba(10,14,22,0.6)';
    context.fillRect(0, 0, cw, ch);
    text('PAUSED', cw / 2, 200, 56, '#eef1f5', 'center', 800);
    text(`Cash $${state.money.toLocaleString('en-US')}  •  ${state.missionsDone} missions done  •  ${Math.floor(state.playTime / 60)}:${String(Math.floor(state.playTime % 60)).padStart(2, '0')} played`, cw / 2, 238, 16, '#c9d2de', 'center');
    const buttons = [];
    const bw = 320;
    const bx = cw / 2 - bw / 2;
    buttons.push(drawButton('resume', bx, 290, bw, 54, '▶  Resume', true));
    buttons.push(drawButton('restart', bx, 358, bw, 54, '↺  Restart from Save', extras.saveExists));
    buttons.push(drawButton('quit', bx, 426, bw, 54, '■  Save & Quit to Title', true));
    text(extras.muted ? 'Sound: OFF  (M to turn on)' : 'Sound: ON  (M to mute)', cw / 2, 530, 15, '#c9d2de', 'center');
    return buttons;
  }

  function drawOver(state, extras) {
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = 'rgba(20,8,8,0.62)';
    context.fillRect(0, 0, cw, ch);
    const wasted = extras.overReason === 'wasted';
    text(wasted ? 'WASTED' : 'BUSTED', cw / 2, 260, 84, '#ff5a4d', 'center', 900);
    text(wasted ? 'Mara went down. The city keeps 10% of your cash.' : 'The cops got you. $150 in fines, and a long walk home.', cw / 2, 306, 18, '#eef1f5', 'center');
    text(`Cash $${state.money.toLocaleString('en-US')}  •  ${state.missionsDone} missions done`, cw / 2, 340, 16, '#c9d2de', 'center');
    const buttons = [drawButton('respawn', cw / 2 - 160, 390, 320, 54, '↻  Back to the Safehouse', true)];
    return buttons;
  }

  /** Paint one frame. Returns the clickable buttons of the current screen. */
  function draw(state, screen, extras) {
    drawWorld(state);
    let buttons = [];
    if (screen === SCREEN_PLAY) {
      drawHud(state, extras);
    } else if (screen === SCREEN_TITLE) {
      drawHud(state, extras);
      buttons = drawTitle(state, extras);
    } else if (screen === SCREEN_HOWTO) {
      buttons = drawHowTo();
    } else if (screen === SCREEN_PAUSED) {
      drawHud(state, extras);
      buttons = drawPaused(state, extras);
    } else if (screen === SCREEN_OVER) {
      drawHud(state, extras);
      buttons = drawOver(state, extras);
    }
    return { buttons };
  }

  return {
    draw,
    /** Canvas pixels → world coordinates, for aiming with the mouse. */
    screenToWorld(mx, my, state) {
      return {
        x: state.camera.x + (mx - cw / 2) / zoom,
        y: state.camera.y + (my - ch / 2) / zoom,
      };
    },
    viewSize() {
      return { w: cw, h: ch };
    },
  };
}
