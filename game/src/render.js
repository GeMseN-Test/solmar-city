// render.js — everything the player sees in Solmar City.
// One entry point, render(ctx, state, view), called every frame by main.js.
// Draws the city (roads, buildings, parks, sea, beach, landmarks), the
// boats in the harbor, traffic, pedestrians, police (cruisers, roadblocks,
// helicopter + spotlight), enemies, bullets, pickups, Solmar Coins, the
// taxi fare, the player, particles, the HUD (cash, health, ammo, stars,
// radio station, coins, objective + distance + arrow, speed), the minimap,
// and the title / pause / WASTED / BUSTED screens.
//
// `view` is { mode, prompt, saveInfo, buttons, mouse } where mode is
// 'title', 'game', 'paused', 'wasted' or 'busted'.

import { radioName } from './radio.js';
import { sideJobsText, fareMarker } from './sidejobs.js';
import { currentObjective, missionMarker } from './missions.js';

const VIEW_W = 1280;
const VIEW_H = 800;
const WORLD_W = 2880;
const WORLD_H = 2160;
const SEA_TOP = 2100;
const BEACH_TOP = 2020;
const ROAD_W = 76;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function money(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCarShape(ctx, car) {
  const model = car.model || 'sedan';
  const color = car.color || '#c0392b';
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle || 0);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-24, -12, 48, 24);
  if (model === 'truck') {
    ctx.fillStyle = color;
    rr(ctx, -24, -13, 30, 26, 3);
    ctx.fill();
    ctx.fillStyle = '#d8d8d8';
    rr(ctx, 8, -11, 16, 22, 3);
    ctx.fill();
    ctx.fillStyle = '#223344';
    ctx.fillRect(10, -8, 8, 16);
  } else if (model === 'van') {
    ctx.fillStyle = color;
    rr(ctx, -24, -13, 48, 26, 6);
    ctx.fill();
    ctx.fillStyle = '#223344';
    rr(ctx, -14, -9, 26, 18, 3);
    ctx.fill();
  } else if (model === 'sport') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-24, -8);
    ctx.lineTo(-14, -12);
    ctx.lineTo(14, -12);
    ctx.lineTo(24, -6);
    ctx.lineTo(24, 6);
    ctx.lineTo(14, 12);
    ctx.lineTo(-14, 12);
    ctx.lineTo(-24, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#111827';
    rr(ctx, -6, -8, 16, 16, 3);
    ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.fillRect(-26, -11, 4, 22);
  } else {
    // sedan + taxi share the sedan body; the taxi gets a roof sign.
    ctx.fillStyle = color;
    rr(ctx, -23, -11, 46, 22, 7);
    ctx.fill();
    ctx.fillStyle = '#223344';
    rr(ctx, -8, -8, 16, 16, 3);
    ctx.fill();
    ctx.fillStyle = '#cfe8ff';
    ctx.fillRect(-4, -8, 8, 16);
    if (model === 'taxi') {
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-6, -13, 12, 5);
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 5px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, -9);
    }
  }
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(20, -9, 2, 4);
  ctx.fillRect(20, 5, 2, 4);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-24, -9, 2, 4);
  ctx.fillRect(-24, 5, 2, 4);
  ctx.restore();
}

function drawBoatShape(ctx, boat) {
  ctx.save();
  ctx.translate(boat.x, boat.y);
  ctx.rotate(boat.angle || 0);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.ellipse(-6, 0, 34, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = boat.color || '#ffffff';
  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.lineTo(16, -9);
  ctx.lineTo(-26, -9);
  ctx.lineTo(-30, 0);
  ctx.lineTo(-26, 9);
  ctx.lineTo(16, 9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-12, -5, 18, 10);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-10, -3, 6, 6);
  if (boat.inUse) {
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, shirt, skin, down) {
  ctx.save();
  ctx.translate(x, y);
  if (down) {
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(11, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.rotate(angle);
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(3, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(7, -2, 1.5, 0, Math.PI * 2);
    ctx.arc(7, 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawLandmark(ctx, lm, key) {
  const x = typeof lm.x === 'number' ? lm.x : lm[0];
  const y = typeof lm.y === 'number' ? lm.y : lm[1];
  const name = lm.name || lm.label || key;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const glyph = { garage: 'G', safehouse: 'H', bank: '$', turf: 'V', docks: 'D', marina: 'M', radio: 'R', island: 'I' }[key] || '*';
  ctx.fillText(glyph, 0, 1);
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const w = ctx.measureText(name).width + 12;
  rr(ctx, -w / 2, 20, w, 18, 9);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(name, 0, 29);
  ctx.restore();
}

function drawWorld(ctx, state) {
  const cam = state.camera;
  const ox = VIEW_W / 2 - cam.x;
  const oy = VIEW_H / 2 - cam.y;
  ctx.save();
  ctx.translate(ox, oy);

  // Ground: city blocks, then the beach, then the sea.
  ctx.fillStyle = '#1d2436';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.fillStyle = '#e7d8a8';
  ctx.fillRect(0, BEACH_TOP, WORLD_W, SEA_TOP - BEACH_TOP);
  ctx.fillStyle = '#1e5f8a';
  ctx.fillRect(0, SEA_TOP, WORLD_W, WORLD_H - SEA_TOP);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (let i = 0; i < 40; i++) {
    const wx = ((i * 173) % WORLD_W) + 20;
    const wy = SEA_TOP + 12 + ((i * 47) % 130);
    ctx.fillRect(wx, wy, 60, 2);
  }

  // Roads on the 360px grid.
  ctx.fillStyle = '#333a4d';
  for (let x = 180; x <= 2700; x += 360) {
    ctx.fillRect(x - ROAD_W / 2, 0, ROAD_W, BEACH_TOP);
  }
  for (let y = 180; y <= 1980; y += 360) {
    ctx.fillRect(0, y - ROAD_W / 2, WORLD_W, ROAD_W);
  }
  ctx.strokeStyle = '#e8c85a';
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 18]);
  for (let x = 180; x <= 2700; x += 360) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, BEACH_TOP);
    ctx.stroke();
  }
  for (let y = 180; y <= 1980; y += 360) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD_W, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Parks.
  for (const park of (state.city && state.city.parks) || []) {
    const px = typeof park.x === 'number' ? park.x : park[0];
    const py = typeof park.y === 'number' ? park.y : park[1];
    const pw = park.w || park.width || 160;
    const ph = park.h || park.height || 120;
    ctx.fillStyle = '#2c5a34';
    rr(ctx, px - pw / 2, py - ph / 2, pw, ph, 10);
    ctx.fill();
    ctx.fillStyle = '#3d7a45';
    ctx.beginPath();
    ctx.arc(px - pw / 4, py, 18, 0, Math.PI * 2);
    ctx.arc(px + pw / 4, py - 10, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  // Buildings.
  for (const b of (state.city && state.city.buildings) || []) {
    const bx = typeof b.x === 'number' ? b.x : b.cx;
    const by = typeof b.y === 'number' ? b.y : b.cy;
    const bw = b.w || b.width || 120;
    const bh = b.h || b.height || 120;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(bx - bw / 2 + 5, by - bh / 2 + 6, bw, bh);
    ctx.fillStyle = b.color || '#2a2f45';
    rr(ctx, bx - bw / 2, by - bh / 2, bw, bh, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(250,204,21,0.75)';
    for (let wy = -bh / 2 + 16; wy < bh / 2 - 10; wy += 26) {
      for (let wx = -bw / 2 + 14; wx < bw / 2 - 10; wx += 24) {
        ctx.fillRect(bx + wx, by + wy, 12, 8);
      }
    }
  }

  // Landmarks.
  const landmarks = (state.city && state.city.landmarks) || {};
  for (const key of Object.keys(landmarks)) {
    drawLandmark(ctx, landmarks[key], key);
  }

  // Pickups on the street: cash, health, ammo.
  for (const pk of state.pickups || []) {
    if (pk.taken) continue;
    ctx.save();
    ctx.translate(pk.x, pk.y);
    ctx.fillStyle = pk.kind === 'cash' ? '#22c55e' : pk.kind === 'health' ? '#ef4444' : '#f59e0b';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pk.kind === 'cash' ? '$' : pk.kind === 'health' ? '+' : 'A', 0, 0);
    ctx.restore();
  }

  // Crates for the collect missions.
  for (const crate of state.crates || []) {
    if (crate.taken) continue;
    ctx.save();
    ctx.translate(crate.x, crate.y);
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(-9, -9, 18, 18);
    ctx.strokeStyle = '#5d3a1a';
    ctx.lineWidth = 2;
    ctx.strokeRect(-9, -9, 18, 18);
    ctx.beginPath();
    ctx.moveTo(-9, -9);
    ctx.lineTo(9, 9);
    ctx.moveTo(9, -9);
    ctx.lineTo(-9, 9);
    ctx.stroke();
    ctx.restore();
  }

  // Solmar Coins — hidden gold, bobbing gently.
  for (const coin of (state.sideJobs && state.sideJobs.coins) || []) {
    if (coin.taken) continue;
    const bob = Math.sin(state.time * 2 + (coin.bob || 0)) * 3;
    ctx.save();
    ctx.translate(coin.x, coin.y + bob);
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#a16207';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('C', 0, 0);
    ctx.restore();
  }

  // Taxi fare: the waving passenger and the destination flag.
  const fare = fareMarker(state);
  if (fare) {
    ctx.save();
    ctx.translate(fare.x, fare.y);
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, 0, fare.r || 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI?', 0, -24);
    drawPerson(ctx, 0, 0, -Math.PI / 2, '#f97316', '#e8b88a', false);
    ctx.restore();
  }
  const sj = state.sideJobs;
  if (sj && sj.fare && sj.fare.stage === 'riding') {
    ctx.save();
    ctx.translate(sj.fare.destX, sj.fare.destY);
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(10, -8);
    ctx.lineTo(-10, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sj.fare.destName || 'Drop-off', 0, 18);
    ctx.restore();
  }

  // Parked cars the player left behind.
  for (const car of state.parkedCars || []) drawCarShape(ctx, car);

  // Traffic.
  for (const car of (state.traffic && state.traffic.cars) || []) drawCarShape(ctx, car);
  for (const ped of (state.traffic && state.traffic.peds) || []) {
    drawPerson(ctx, ped.x, ped.y, ped.angle || 0, ped.shirt || '#888888', ped.skin || '#e8b88a', !!ped.down);
  }

  // Boats in the harbor (the fixed decorative boats are gone — these are
  // the real, boardable ones from state.boats).
  for (const boat of state.boats || []) drawBoatShape(ctx, boat);

  // Police cruisers, roadblocks included (they sit in state.police.cars
  // with roadblock: true and never move).
  for (const car of (state.police && state.police.cars) || []) {
    drawCarShape(ctx, { ...car, model: 'sedan', color: '#1e3a5f' });
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle || 0);
    ctx.fillStyle = (Math.floor(state.time * 4) % 2 === 0) ? '#ef4444' : '#3b82f6';
    ctx.fillRect(-4, -12, 8, 5);
    ctx.restore();
    if (car.roadblock) {
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.fillStyle = 'rgba(239,68,68,0.9)';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ROADBLOCK', 0, -22);
      ctx.restore();
    }
  }
  for (const cop of (state.police && state.police.cops) || []) {
    drawPerson(ctx, cop.x, cop.y, cop.angle || 0, '#1e3a5f', '#e8b88a', false);
  }

  // Police helicopter + its spotlight on the ground.
  const heli = state.police2 && state.police2.heli;
  if (heli) {
    ctx.save();
    ctx.fillStyle = 'rgba(250,204,21,0.13)';
    ctx.beginPath();
    ctx.arc(heli.x, heli.y, 130, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(250,204,21,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.translate(heli.x, heli.y);
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    const rotor = heli.rotor || 0;
    ctx.beginPath();
    ctx.moveTo(Math.cos(rotor) * 34, Math.sin(rotor) * 6);
    ctx.lineTo(-Math.cos(rotor) * 34, -Math.sin(rotor) * 6);
    ctx.stroke();
    ctx.restore();
  }

  // Gang enemies, with a thin health bar.
  for (const e of (state.combat && state.combat.enemies) || []) {
    if (e.hp <= 0) continue;
    drawPerson(ctx, e.x, e.y, e.angle || 0, e.shirt || '#7a2d8f', e.skin || '#c98a5a', false);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(e.x - 14, e.y - 22, 28, 4);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(e.x - 14, e.y - 22, 28 * clamp(e.hp / 100, 0, 1), 4);
  }

  // Bullets.
  for (const b of (state.combat && state.combat.bullets) || []) {
    ctx.fillStyle = b.friendly === false ? '#f87171' : '#facc15';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Particles: tyre smoke and boat wakes.
  for (const pt of state.particles || []) {
    const a = clamp(pt.life / (pt.maxLife || 1), 0, 1);
    ctx.fillStyle = pt.kind === 'wake'
      ? 'rgba(255,255,255,' + (a * 0.5).toFixed(2) + ')'
      : 'rgba(160,160,160,' + (a * 0.55).toFixed(2) + ')';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.kind === 'wake' ? 7 : 5 + (1 - a) * 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // The player: in a car, on a boat, or on foot with a gun.
  const p = state.player;
  if (p.inCar && p.car) {
    drawCarShape(ctx, p.car);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (p.inBoat && p.boat) {
    drawBoatShape(ctx, p.boat);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    drawPerson(ctx, p.x, p.y, p.angle, '#22c55e', '#e8b88a', false);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.aimAngle || 0);
    ctx.fillStyle = '#111827';
    ctx.fillRect(6, -2, 14, 4);
    ctx.restore();
    if (p.invuln > 0 && Math.floor(state.time * 6) % 2 === 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(250,204,21,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Objective arrow: a yellow chevron circling the player, pointing at
  // the current target.
  const marker = missionMarker(state);
  if (marker && state.mission) {
    const ang = Math.atan2(marker.y - p.y, marker.x - p.x);
    const ax = p.x + Math.cos(ang) * 52;
    const ay = p.y + Math.sin(ang) * 52;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, -9);
    ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(marker.x, marker.y);
    const pulse = 1 + Math.sin(state.time * 4) * 0.15;
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawMinimap(ctx, state) {
  const mw = 208;
  const mh = 156;
  const mx = VIEW_W - mw - 14;
  const my = 14;
  const sx = mw / WORLD_W;
  const sy = mh / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,24,0.85)';
  rr(ctx, mx, my, mw, mh, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#1e5f8a';
  ctx.fillRect(mx, my + SEA_TOP * sy, mw, mh - SEA_TOP * sy);
  ctx.strokeStyle = '#4b5563';
  ctx.lineWidth = 1;
  for (let x = 180; x <= 2700; x += 360) {
    ctx.beginPath();
    ctx.moveTo(mx + x * sx, my);
    ctx.lineTo(mx + x * sx, my + BEACH_TOP * sy);
    ctx.stroke();
  }
  for (let y = 180; y <= 1980; y += 360) {
    ctx.beginPath();
    ctx.moveTo(mx, my + y * sy);
    ctx.lineTo(mx + mw, my + y * sy);
    ctx.stroke();
  }
  const landmarks = (state.city && state.city.landmarks) || {};
  ctx.fillStyle = '#facc15';
  for (const key of Object.keys(landmarks)) {
    const lm = landmarks[key];
    const lx = typeof lm.x === 'number' ? lm.x : lm[0];
    const ly = typeof lm.y === 'number' ? lm.y : lm[1];
    ctx.fillRect(mx + lx * sx - 2, my + ly * sy - 2, 4, 4);
  }
  const marker = missionMarker(state);
  if (marker && state.mission) {
    const pulse = 3 + Math.sin(state.time * 5) * 1.5;
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(mx + marker.x * sx, my + marker.y * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ef4444';
  for (const car of (state.police && state.police.cars) || []) {
    ctx.fillRect(mx + car.x * sx - 1, my + car.y * sy - 1, 3, 3);
  }
  const p = state.player;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(mx + p.x * sx, my + p.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawHud(ctx, state, view) {
  const p = state.player;
  // Top-left panel: cash, health, ammo, wanted stars, radio, coins.
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,24,0.82)';
  rr(ctx, 14, 14, 250, 132, 10);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(money(state.money), 28, 42);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#9ca3af';
  ctx.fillText('Mara Voss  •  ' + fmtTime(state.playTime), 28, 60);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  rr(ctx, 28, 68, 120, 10, 5);
  ctx.fill();
  ctx.fillStyle = p.hp > 50 ? '#22c55e' : p.hp > 25 ? '#f59e0b' : '#ef4444';
  rr(ctx, 28, 68, 120 * clamp(p.hp / 100, 0, 1), 10, 5);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px sans-serif';
  ctx.fillText('HP ' + Math.ceil(p.hp), 154, 77);
  ctx.fillText('Ammo ' + p.ammo, 28, 96);
  // Wanted stars.
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < state.wanted ? '\u2605' : '\u2606';
  ctx.fillStyle = '#facc15';
  ctx.font = '18px sans-serif';
  ctx.fillText(stars, 28, 118);
  // Radio station + coins, one line each.
  let radioLine = '';
  try {
    radioLine = radioName(state.radio);
  } catch (err) {
    radioLine = '';
  }
  ctx.fillStyle = '#7dd3fc';
  ctx.font = '12px sans-serif';
  if (radioLine) ctx.fillText('\u266A ' + radioLine, 28, 138);
  let coinsLine = '';
  try {
    coinsLine = sideJobsText(state);
  } catch (err) {
    coinsLine = '';
  }
  if (coinsLine) {
    ctx.fillStyle = '#facc15';
    ctx.fillText(coinsLine, 150, 96);
  }
  ctx.restore();

  drawMinimap(ctx, state);

  // Objective panel, bottom-left.
  const obj = currentObjective(state);
  if (obj && state.mission) {
    const marker = missionMarker(state);
    const d = marker ? Math.round(Math.sqrt((marker.x - p.x) ** 2 + (marker.y - p.y) ** 2)) : null;
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,24,0.82)';
    rr(ctx, 14, VIEW_H - 76, 460, 62, 10);
    ctx.fill();
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(state.mission.title + '  •  ' + money(state.mission.reward), 28, VIEW_H - 52);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px sans-serif';
    ctx.fillText(obj.text + (d !== null ? '  —  ' + d + 'm' : ''), 28, VIEW_H - 30);
    ctx.restore();
  }

  // Speed, bottom-right. km/h in a car, knots in a boat.
  if (p.inCar && p.car) {
    const kmh = Math.round(Math.abs(p.car.speed || 0) * 0.36);
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,24,0.82)';
    rr(ctx, VIEW_W - 134, VIEW_H - 76, 120, 62, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(kmh), VIEW_W - 74, VIEW_H - 40);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('km/h', VIEW_W - 74, VIEW_H - 24);
    ctx.restore();
  } else if (p.inBoat && p.boat) {
    const kn = Math.round(Math.abs(p.boat.speed || 0) * 0.18);
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,24,0.82)';
    rr(ctx, VIEW_W - 134, VIEW_H - 76, 120, 62, 10);
    ctx.fill();
    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(kn), VIEW_W - 74, VIEW_H - 40);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('knots', VIEW_W - 74, VIEW_H - 24);
    ctx.restore();
  }

  // Context prompt ("E — Steal car") above the bottom edge, centered.
  if (view.prompt) {
    ctx.save();
    ctx.font = 'bold 15px sans-serif';
    const w = ctx.measureText(view.prompt).width + 28;
    ctx.fillStyle = 'rgba(10,14,24,0.85)';
    rr(ctx, (VIEW_W - w) / 2, VIEW_H - 118, w, 30, 15);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(view.prompt, VIEW_W / 2, VIEW_H - 97);
    ctx.restore();
  }

  // Mission banner, top-center, while it is alive.
  const banner = state.missionBanner;
  if (banner && banner.timer > 0) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10,14,24,0.88)';
    ctx.font = 'bold 20px sans-serif';
    const tw = ctx.measureText(banner.title).width + 40;
    rr(ctx, (VIEW_W - tw) / 2, 150, tw, 40, 10);
    ctx.fill();
    ctx.fillStyle = '#facc15';
    ctx.fillText(banner.title, VIEW_W / 2, 178);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#ffffff';
    const bw = ctx.measureText(banner.text).width + 40;
    ctx.fillStyle = 'rgba(10,14,24,0.7)';
    rr(ctx, (VIEW_W - bw) / 2, 194, bw, 30, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(banner.text, VIEW_W / 2, 214);
    ctx.restore();
  }

  // Story complete ribbon.
  if (state.storyComplete) {
    ctx.save();
    ctx.fillStyle = 'rgba(250,204,21,0.92)';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STORY COMPLETE — SOLMAR IS YOURS', VIEW_W / 2, 34);
    ctx.restore();
  }
}

function drawButton(ctx, b, hover) {
  ctx.save();
  ctx.fillStyle = hover ? '#facc15' : 'rgba(250,204,21,0.85)';
  rr(ctx, b.x, b.y, b.w, b.h, 8);
  ctx.fill();
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
  ctx.restore();
}

function drawTitle(ctx, state, view) {
  ctx.save();
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#1e5f8a';
  ctx.fillRect(0, 560, VIEW_W, 240);
  ctx.fillStyle = '#e7d8a8';
  ctx.fillRect(0, 540, VIEW_W, 20);
  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 84px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SOLMAR CITY', VIEW_W / 2, 210);
  ctx.fillStyle = '#7dd3fc';
  ctx.font = '20px sans-serif';
  ctx.fillText('An open-world crime game — 12 story missions, boats, radio, and the whole city to steal.', VIEW_W / 2, 260);
  ctx.fillStyle = '#9ca3af';
  ctx.font = '15px sans-serif';
  ctx.fillText('Mara Voss is back in town. The city is yours to take.', VIEW_W / 2, 292);

  const buttons = view.buttons || [];
  for (const b of buttons) {
    const hover = view.mouse && view.mouse.x >= b.x && view.mouse.x <= b.x + b.w
      && view.mouse.y >= b.y && view.mouse.y <= b.y + b.h;
    drawButton(ctx, b, hover);
  }
  if (view.saveInfo) {
    ctx.fillStyle = '#9ca3af';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Saved game: ' + view.saveInfo, VIEW_W / 2, 470);
  }

  ctx.fillStyle = '#e5e7eb';
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WASD move  •  Mouse aim, click to shoot  •  E steal car / board boat  •  Space punch / handbrake', VIEW_W / 2, 620);
  ctx.fillText('Q change radio station  •  M mute  •  P pause  •  Shift run  •  Boats wait in the harbor — press E to sail', VIEW_W / 2, 648);
  ctx.fillStyle = '#6b7280';
  ctx.font = '13px sans-serif';
  ctx.fillText('12 story missions  •  5 radio stations  •  6 boats  •  taxi fares  •  12 hidden Solmar Coins  •  police roadblocks & helicopter', VIEW_W / 2, 690);
  ctx.restore();
}

function drawOverlay(ctx, title, lines) {
  ctx.save();
  ctx.fillStyle = 'rgba(5,8,16,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = title === 'WASTED' ? '#ef4444' : title === 'BUSTED' ? '#3b82f6' : '#facc15';
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, VIEW_W / 2, 330);
  ctx.fillStyle = '#ffffff';
  ctx.font = '17px sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, VIEW_W / 2, 390 + i * 28);
  });
  ctx.restore();
}

// The only thing main.js calls. `view.mode` picks the screen.
export function render(ctx, state, view) {
  const v = view || {};
  if (v.mode === 'title') {
    drawTitle(ctx, state, v);
    return;
  }
  drawWorld(ctx, state);
  drawHud(ctx, state, v);
  if (v.mode === 'paused') {
    drawOverlay(ctx, 'PAUSED', ['P or Esc to keep playing', 'Your progress is saved when you pause.']);
  } else if (v.mode === 'wasted') {
    drawOverlay(ctx, 'WASTED', ['Mara woke up at the Safehouse.']);
  } else if (v.mode === 'busted') {
    drawOverlay(ctx, 'BUSTED', ['The cops dropped Mara at the Safehouse.']);
  }
}
