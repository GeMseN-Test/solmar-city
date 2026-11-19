// render.js — Draws Solmar City.
//
// render(state, ctx, w, h) draws one frame:
//   1. the world (sea, beach, streets, buildings, boats, cars, peds,
//      player, enemies, pickups, coins, crates, heli, particles) in
//      world space, with the camera transform applied EXACTLY ONCE;
//   2. the HUD (money, health, ammo, wanted stars, radio line, coins,
//      objective + distance + arrow, speed) in screen space;
//   3. the live minimap and the how-to line.
//
// The camera transform is applied a single time — the old bug where
// the camera offset was subtracted twice (shifting the whole city off
// the player and hiding the sea in shot 4) must never come back:
// every world-space draw happens between one ctx.save/translate and
// its matching ctx.restore, and HUD/minimap code never touches the
// camera again.

import { currentObjective, missionMarker } from './missions.js';
import { radioName } from './radio.js';
import { sideJobsText, fareMarker } from './sidejobs.js';
import { heliSpotlight } from './police2.js';

const WORLD_W = 2880;
const WORLD_H = 2160;
const SEA_TOP = 2100;

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// ------------------------------------------------------------------
// Cars
// ------------------------------------------------------------------

// Body shapes per model: sedan (rounded saloon), van (long box),
// truck (cab + cargo box), sport (sleek + spoiler), taxi (sedan +
// checker band + roof sign), police (sedan + light bar). Drawn
// pointing along +x, centered on the car; callers rotate the ctx.
export function drawCarShape(ctx, car) {
  const model = car.model || 'sedan';
  const color = car.color || '#c0392b';
  ctx.save();
  ctx.fillStyle = color;

  if (model === 'truck') {
    ctx.fillRect(-26, -11, 30, 22);
    ctx.fillStyle = '#d7dee8';
    ctx.fillRect(4, -11, 20, 22);
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(8, -8, 10, 16);
    ctx.fillStyle = color;
    ctx.fillRect(-26, -11, 4, 22);
  } else if (model === 'van') {
    ctx.fillRect(-28, -12, 56, 24);
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(10, -9, 12, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-24, -9, 28, 6);
  } else if (model === 'sport') {
    ctx.beginPath();
    ctx.moveTo(-24, -9);
    ctx.lineTo(14, -11);
    ctx.lineTo(26, -6);
    ctx.lineTo(26, 6);
    ctx.lineTo(14, 11);
    ctx.lineTo(-24, 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-6, -8, 16, 16);
    ctx.fillStyle = color;
    ctx.fillRect(-28, -11, 5, 3);
    ctx.fillRect(-28, 8, 5, 3);
  } else {
    // sedan / taxi / police share the saloon body.
    ctx.beginPath();
    ctx.roundRect(-24, -11, 48, 22, 7);
    ctx.fill();
    ctx.fillStyle = '#22303c';
    ctx.beginPath();
    ctx.roundRect(-8, -9, 18, 18, 4);
    ctx.fill();
    if (model === 'taxi') {
      ctx.fillStyle = '#f7d117';
      ctx.fillRect(-24, -11, 48, 5);
      ctx.fillStyle = '#111';
      for (let i = 0; i < 6; i++) ctx.fillRect(-22 + i * 8, -11, 4, 5);
      ctx.fillStyle = '#f7d117';
      ctx.fillRect(-6, -15, 12, 4);
    }
    if (model === 'police' || car.roadblock) {
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-4, -13, 8, 4);
      ctx.fillStyle = '#3498db';
      ctx.fillRect(4, -13, 8, 4);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', 0, 4);
    }
  }

  // Wheels.
  ctx.fillStyle = '#111';
  ctx.fillRect(-17, -13, 9, 4);
  ctx.fillRect(-17, 9, 9, 4);
  ctx.fillRect(9, -13, 9, 4);
  ctx.fillRect(9, 9, 9, 4);
  ctx.restore();
}

function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle || 0);
  drawCarShape(ctx, car);
  ctx.restore();
}

// ------------------------------------------------------------------
// Boats, heli, people
// ------------------------------------------------------------------

function drawBoat(ctx, boat) {
  ctx.save();
  ctx.translate(boat.x, boat.y);
  ctx.rotate(boat.angle || 0);
  ctx.fillStyle = boat.color || '#fff';
  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.lineTo(14, -11);
  ctx.lineTo(-26, -11);
  ctx.lineTo(-30, 0);
  ctx.lineTo(-26, 11);
  ctx.lineTo(14, 11);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-16, -7, 22, 14);
  ctx.fillStyle = '#22303c';
  ctx.fillRect(-2, -5, 10, 10);
  if (boat.inUse) {
    ctx.fillStyle = '#ffd54a';
    ctx.beginPath();
    ctx.arc(24, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, shirt, skin, down) {
  ctx.save();
  ctx.translate(x, y);
  if (down) {
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(angle || 0);
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin || '#e8b98a';
  ctx.beginPath();
  ctx.arc(5, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------------
// World
// ------------------------------------------------------------------

function drawWorld(state, ctx) {
  const city = state.city;
  const cam = state.camera;

  // Ground: grass, then the beach strip, then the sea.
  ctx.fillStyle = '#3f7a4a';
  ctx.fillRect(cam.x - 700, cam.y - 500, 1400, 1000);
  ctx.fillStyle = '#e8d9a0';
  ctx.fillRect(cam.x - 700, 2020, 1400, 90);
  const seaGrad = ctx.createLinearGradient(0, 2100, 0, 2160);
  seaGrad.addColorStop(0, '#1d6fb8');
  seaGrad.addColorStop(1, '#0d4a86');
  ctx.fillStyle = seaGrad;
  ctx.fillRect(cam.x - 700, 2100, 1400, 70);

  // Roads.
  ctx.fillStyle = '#3a3f46';
  for (let x = 180; x <= 2700; x += 360) ctx.fillRect(x - 38, 0, 76, 2100);
  for (let y = 180; y <= 1980; y += 360) ctx.fillRect(0, y - 38, 2880, 76);
  ctx.strokeStyle = 'rgba(240,200,60,0.7)';
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 18]);
  ctx.beginPath();
  for (let x = 180; x <= 2700; x += 360) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 2100);
  }
  for (let y = 180; y <= 1980; y += 360) {
    ctx.moveTo(0, y);
    ctx.lineTo(2880, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Parks.
  for (const park of city.parks || []) {
    ctx.fillStyle = '#57a05e';
    ctx.fillRect(park.x - park.w / 2, park.y - park.h / 2, park.w, park.h);
    ctx.fillStyle = '#2e7d32';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(park.x - park.w / 3 + i * 26, park.y - 8 + (i % 2) * 18, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Buildings with roofs and windows.
  for (const b of city.buildings || []) {
    ctx.fillStyle = '#5d6d7e';
    ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
    ctx.fillStyle = b.roof || '#7f8c8d';
    ctx.fillRect(b.x - b.w / 2 + 4, b.y - b.h / 2 + 4, b.w - 8, b.h - 8);
    ctx.fillStyle = 'rgba(255,230,120,0.75)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if ((i + j) % 2 === 0) {
          ctx.fillRect(b.x - b.w / 2 + 9 + i * 26, b.y - b.h / 2 + 9 + j * 26, 8, 8);
        }
      }
    }
  }

  // Landmarks: labeled pads so every mission destination is visible.
  const lmColors = {
    garage: '#e67e22', safehouse: '#27ae60', bank: '#f1c40f',
    turf: '#8e44ad', docks: '#3498db', marina: '#16a085',
    radio: '#e84393', island: '#00b894',
  };
  for (const [key, lm] of Object.entries(city.landmarks || {})) {
    ctx.fillStyle = lmColors[key] || '#888';
    ctx.beginPath();
    ctx.arc(lm.x, lm.y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(lm.x, lm.y, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(lm.name || key, lm.x, lm.y + 42);
  }

  // Gull Island sand.
  const island = city.landmarks && city.landmarks.island;
  if (island) {
    ctx.fillStyle = '#e8d9a0';
    ctx.beginPath();
    ctx.ellipse(island.x, island.y, 90, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2e7d32';
    ctx.beginPath();
    ctx.arc(island.x - 30, island.y - 4, 10, 0, Math.PI * 2);
    ctx.arc(island.x + 24, island.y + 2, 12, 0, Math.PI * 2);
    ctx.fill();
  }

  // Boats from state.boats (replaces the old fixed decorative boats).
  for (const boat of state.boats || []) drawBoat(ctx, boat);

  // Pickups.
  for (const pk of state.pickups || []) {
    if (pk.taken) continue;
    const bobY = Math.sin((state.playTime || 0) * 3 + pk.bob) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bobY);
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(-9, -6, 18, 12);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 4);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-9, -9, 18, 18);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-2, -7, 4, 14);
      ctx.fillRect(-7, -2, 14, 4);
    } else {
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(-7, -7, 14, 14);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('A', 0, 3);
    }
    ctx.restore();
  }

  // Solmar Coins (gold, bobbing).
  const jobs = state.sideJobs;
  if (jobs) {
    for (const coin of jobs.coins || []) {
      if (coin.taken) continue;
      const bobY = Math.sin((state.playTime || 0) * 2.5 + (coin.bob || 0)) * 3;
      ctx.save();
      ctx.translate(coin.x, coin.y + bobY);
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b8860b';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('S', 0, 3.5);
      ctx.restore();
    }
  }

  // Taxi fare: waving passenger + destination marker.
  const fare = fareMarker(state);
  if (fare) {
    ctx.save();
    ctx.translate(fare.x, fare.y);
    ctx.strokeStyle = '#f7d117';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 26 + Math.sin((state.playTime || 0) * 5) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f7d117';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', 0, -32);
    ctx.restore();
    if (jobs && jobs.fare && jobs.fare.stage === 'riding') {
      ctx.save();
      ctx.translate(jobs.fare.destX, jobs.fare.destY);
      ctx.fillStyle = '#f7d117';
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(18, 0);
      ctx.lineTo(0, 26);
      ctx.lineTo(-18, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DROP', 0, 4);
      ctx.restore();
    }
  }
  if (jobs && jobs.fare && jobs.fare.stage === 'waiting') {
    drawPerson(ctx, jobs.fare.x, jobs.fare.y, -Math.PI / 2, '#f7d117', '#e8b98a', false);
  }

  // Mission crates.
  for (const c of state.crates || []) {
    if (c.taken) continue;
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(c.x - 11, c.y - 11, 22, 22);
    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x - 11, c.y - 11, 22, 22);
    ctx.beginPath();
    ctx.moveTo(c.x - 11, c.y - 11);
    ctx.lineTo(c.x + 11, c.y + 11);
    ctx.moveTo(c.x + 11, c.y - 11);
    ctx.lineTo(c.x - 11, c.y + 11);
    ctx.stroke();
  }

  // Traffic cars + pedestrians.
  for (const car of (state.traffic && state.traffic.cars) || []) drawCar(ctx, car);
  for (const ped of (state.traffic && state.traffic.peds) || []) {
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.shirt, ped.skin, ped.down);
  }

  // Police cars (roadblocks drawn as parked cruisers with cones).
  for (const cop of (state.police && state.police.cars) || []) {
    drawCar(ctx, cop);
    if (cop.roadblock) {
      ctx.fillStyle = '#ff6b35';
      ctx.beginPath();
      ctx.moveTo(cop.x - 46, cop.y - 18);
      ctx.lineTo(cop.x - 38, cop.y - 18);
      ctx.lineTo(cop.x - 42, cop.y - 30);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cop.x - 46, cop.y + 18);
      ctx.lineTo(cop.x - 38, cop.y + 18);
      ctx.lineTo(cop.x - 42, cop.y + 30);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Enemies.
  for (const e of (state.combat && state.combat.enemies) || []) {
    drawPerson(ctx, e.x, e.y, e.angle, e.shirt || '#7a2d8f', e.skin, false);
    ctx.fillStyle = '#111';
    ctx.fillRect(e.x - 14, e.y - 20, 28, 4);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(e.x - 14, e.y - 20, 28 * clamp(e.hp / 100, 0, 1), 4);
  }

  // Bullets.
  for (const b of (state.combat && state.combat.bullets) || []) {
    ctx.fillStyle = b.friendly === false ? '#ff5a4e' : '#ffe14d';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player: on foot, in a car, or in a boat.
  const p = state.player;
  if (p.inBoat && p.boat) {
    drawBoat(ctx, p.boat);
    drawPerson(ctx, p.x, p.y, p.angle, '#2980b9', '#e8b98a', false);
  } else if (p.inCar && p.car) {
    drawCar(ctx, p.car);
  } else {
    const blink = p.invuln > 0 && Math.floor((state.playTime || 0) * 10) % 2 === 0;
    if (!blink) drawPerson(ctx, p.x, p.y, p.angle, '#e74c3c', '#e8b98a', false);
    // Aim line while shooting is available.
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.aimAngle) * 26, p.y + Math.sin(p.aimAngle) * 26);
    ctx.stroke();
  }

  // Helicopter + spotlight at 4–5 stars (visual only).
  const heli = state.police2 && state.police2.heli;
  if (heli) {
    const spot = heliSpotlight(state);
    if (spot) {
      const g = ctx.createRadialGradient(spot.x, spot.y, 10, spot.x, spot.y, spot.r);
      g.addColorStop(0, 'rgba(255,255,200,0.35)');
      g.addColorStop(1, 'rgba(255,255,200,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, spot.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(heli.x, heli.y);
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    const rotor = (heli.rotor || 0) % (Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(Math.cos(rotor) * -34, Math.sin(rotor) * -8);
    ctx.lineTo(Math.cos(rotor) * 34, Math.sin(rotor) * 8);
    ctx.stroke();
    ctx.restore();
  }

  // Particles (tyre smoke, boat wake, muzzle puffs).
  for (const pt of state.particles || []) {
    ctx.globalAlpha = clamp(pt.life / (pt.maxLife || 0.7), 0, 1);
    ctx.fillStyle = pt.color || 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size || 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Mission marker: pulsing ring + beacon line from the player.
  const marker = missionMarker(state);
  if (marker) {
    const pulse = 30 + Math.sin((state.playTime || 0) * 4) * 6;
    ctx.strokeStyle = '#ffd54a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd54a';
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ------------------------------------------------------------------
// HUD + minimap (screen space — no camera here)
// ------------------------------------------------------------------

function drawHUD(state, ctx, w, h) {
  const p = state.player;
  ctx.textAlign = 'left';

  // Top-left panel: money, health, ammo, stars, radio, coins.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(12, 12, 250, 150);
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('$' + (state.money || 0).toLocaleString('en-US'), 22, 40);
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.fillText('HP', 22, 64);
  ctx.fillStyle = '#333';
  ctx.fillRect(52, 52, 120, 12);
  ctx.fillStyle = p.hp > 30 ? '#2ecc71' : '#e74c3c';
  ctx.fillRect(52, 52, 120 * clamp(p.hp / 100, 0, 1), 12);
  ctx.fillStyle = '#fff';
  ctx.fillText('Ammo ' + p.ammo, 22, 86);
  // Wanted stars.
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < (state.wanted || 0) ? '#ffd54a' : 'rgba(255,255,255,0.25)';
    ctx.font = '18px sans-serif';
    ctx.fillText('★', 22 + i * 22, 110);
  }
  ctx.fillStyle = '#9fd8ff';
  ctx.font = '13px sans-serif';
  ctx.fillText('♪ ' + radioName(state.radio), 22, 132);
  if (state.sideJobs) {
    ctx.fillStyle = '#ffd700';
    // Own line: the station name is too long to share the radio line.
    ctx.fillText(sideJobsText(state), 22, 152);
  }

  // Objective panel (top center): text + distance + arrow.
  const obj = currentObjective(state);
  if (obj) {
    const marker = missionMarker(state);
    let line = obj.text;
    let arrow = '';
    if (marker) {
      const d = Math.round(dist(p.x, p.y, marker.x, marker.y));
      line += '  •  ' + d + 'm';
      const a = Math.atan2(marker.y - p.y, marker.x - p.x);
      const dirs = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
      // Normalize to [0, 2π): a negative angle made the index
      // negative and dirs[negative] is undefined on screen.
      const norm = (((a + Math.PI / 8) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      arrow = ' ' + dirs[Math.round(norm / (Math.PI / 4)) % 8];
    }
    ctx.font = 'bold 16px sans-serif';
    const tw = ctx.measureText(line + arrow).width;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect((w - tw) / 2 - 14, 12, tw + 28, 34);
    ctx.fillStyle = '#ffd54a';
    ctx.textAlign = 'center';
    ctx.fillText(line + arrow, w / 2, 36);
    ctx.textAlign = 'left';
  }

  // Speed (driving / boating).
  if (p.inCar && p.car) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(w - 132, h - 58, 120, 34);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(Math.abs(p.car.speed || 0) * 0.18) + ' km/h', w - 22, h - 34);
    ctx.textAlign = 'left';
  } else if (p.inBoat && p.boat) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(w - 132, h - 58, 120, 34);
    ctx.fillStyle = '#9fd8ff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(Math.abs(p.boat.speed || 0) * 0.18) + ' kn', w - 22, h - 34);
    ctx.textAlign = 'left';
  }

  // Banner (mission start / complete / story complete).
  if (state.bannerTimer > 0 && state.bannerText) {
    ctx.font = 'bold 20px sans-serif';
    const bw = ctx.measureText(state.bannerText).width;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect((w - bw) / 2 - 16, h - 150, bw + 32, 40);
    ctx.fillStyle = '#ffd54a';
    ctx.textAlign = 'center';
    ctx.fillText(state.bannerText, w / 2, h - 123);
    ctx.textAlign = 'left';
  }

  // How-to line (bottom).
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(12, h - 30, w - 24, 22);
  ctx.fillStyle = '#ddd';
  ctx.font = '13px sans-serif';
  ctx.fillText(
    'WASD move • Mouse aim + click shoot • E interact / steal car / board boat • Space punch (hold to handbrake while driving) • Q radio • M mute • P pause',
    20, h - 14,
  );
}

function drawMinimap(state, ctx, w, h) {
  const scale = 150 / WORLD_W;
  const ox = w - 172;
  const oy = h - 178;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(ox - 6, oy - 6, 162, 128);
  // Sea strip at the bottom.
  ctx.fillStyle = '#1d6fb8';
  const seaY = oy + SEA_TOP * (112 / WORLD_H);
  ctx.fillRect(ox, seaY, 150, 112 - (SEA_TOP * 112) / WORLD_H + 6);
  // Roads.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  for (let x = 180; x <= 2700; x += 360) {
    ctx.beginPath();
    ctx.moveTo(ox + x * scale, oy);
    ctx.lineTo(ox + x * scale, oy + 112);
    ctx.stroke();
  }
  for (let y = 180; y <= 1980; y += 360) {
    ctx.beginPath();
    ctx.moveTo(ox, oy + y * (112 / WORLD_H));
    ctx.lineTo(ox + 150, oy + y * (112 / WORLD_H));
    ctx.stroke();
  }
  // Boats.
  ctx.fillStyle = '#9fd8ff';
  for (const boat of state.boats || []) {
    ctx.fillRect(ox + boat.x * scale - 2, oy + boat.y * (112 / WORLD_H) - 2, 4, 4);
  }
  // Mission marker.
  const marker = missionMarker(state);
  if (marker) {
    ctx.fillStyle = '#ffd54a';
    ctx.beginPath();
    ctx.arc(ox + marker.x * scale, oy + marker.y * (112 / WORLD_H), 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const p = state.player;
  ctx.save();
  ctx.translate(ox + p.x * scale, oy + p.y * (112 / WORLD_H));
  ctx.rotate(p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -4);
  ctx.lineTo(-5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------------
// Entry point
// ------------------------------------------------------------------

export function render(state, ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, w, h);

  // Camera transform, applied exactly once for the whole world.
  const cam = state.camera;
  ctx.save();
  ctx.translate(Math.round(w / 2 - cam.x), Math.round(h / 2 - cam.y));
  drawWorld(state, ctx);
  ctx.restore();

  drawHUD(state, ctx, w, h);
  drawMinimap(state, ctx, w, h);
}
