// render.js — Solmar City canvas renderer.
// Written from the v2 spec only. Draws the city, boats, police heli +
// spotlight, coins, taxi fares, and the full HUD (radio, coins, boat speed).
import { radioName } from './radio.js';
import { sideJobsText, fareMarker } from './sidejobs.js';
import { heliSpotlight } from './police2.js';
import { missionMarker, currentObjective } from './missions.js';

const WORLD_W = 2880;
const WORLD_H = 2160;
const SEA_TOP = 2100;
const BEACH_TOP = 2020;

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
}

// Body shapes per model: sedan, van, truck (cab + bed), sport (sleek +
// spoiler), taxi (sedan + checker strip). Drawn pointing +x, rotated by angle.
export function drawCarShape(ctx, x, y, angle, model, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color || '#c0c0c0';
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.5;
  if (model === 'van') {
    rr(ctx, -26, -12, 52, 24, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(180,220,255,0.85)';
    rr(ctx, 8, -9, 12, 18, 3);
    ctx.fill();
  } else if (model === 'truck') {
    rr(ctx, -26, -11, 30, 22, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5a5f66';
    rr(ctx, 4, -11, 24, 22, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(180,220,255,0.85)';
    rr(ctx, 16, -8, 9, 16, 2);
    ctx.fill();
  } else if (model === 'sport') {
    rr(ctx, -24, -10, 48, 20, 9);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(20,20,30,0.9)';
    rr(ctx, -4, -8, 16, 16, 4);
    ctx.fill();
    ctx.fillStyle = color || '#c0c0c0';
    ctx.fillRect(-26, -11, 4, 22);
  } else {
    // sedan + taxi share the base shape
    rr(ctx, -23, -11, 46, 22, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(180,220,255,0.85)';
    rr(ctx, -6, -8, 14, 16, 3);
    ctx.fill();
    if (model === 'taxi') {
      ctx.fillStyle = '#111';
      for (let i = 0; i < 6; i++) {
        if (i % 2 === 0) ctx.fillRect(-20 + i * 7, -11, 7, 4);
        else ctx.fillRect(-20 + i * 7, -7, 7, 4);
      }
    }
  }
  // Headlights + taillights so cars read at a glance.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(20, -9, 3, 5);
  ctx.fillRect(20, 4, 3, 5);
  ctx.fillStyle = '#ff4444';
  ctx.fillRect(-24, -9, 3, 5);
  ctx.fillRect(-24, 4, 3, 5);
  ctx.restore();
}

function drawPoliceCar(ctx, car, time) {
  drawCarShape(ctx, car.x, car.y, car.angle, 'sedan', '#e8e8e8');
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = '#111';
  ctx.fillRect(-14, -11, 22, 22);
  ctx.restore();
  // Flashing light bar, alternating with time.
  const red = Math.floor(time * 4) % 2 === 0;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = red ? '#ff2222' : '#2266ff';
  circle(ctx, -4, -6, 4);
  ctx.fill();
  ctx.fillStyle = red ? '#2266ff' : '#ff2222';
  circle(ctx, -4, 6, 4);
  ctx.fill();
  ctx.restore();
}

function drawBoatShape(ctx, boat, time) {
  ctx.save();
  ctx.translate(boat.x, boat.y);
  ctx.rotate(boat.angle || 0);
  const len = boat.kind === 'yacht' ? 64 : boat.kind === 'jetski' ? 34 : 52;
  const wid = boat.kind === 'jetski' ? 16 : 22;
  // Wake behind a moving boat.
  if (boat.inUse && Math.abs(boat.speed || 0) > 30) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 1; i <= 3; i++) {
      circle(ctx, -len / 2 - i * 12, (i % 2 === 0 ? 6 : -6), 5 + i * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = boat.color || '#fff';
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1.5;
  rr(ctx, -len / 2, -wid / 2, len, wid, wid / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(20,40,60,0.85)';
  rr(ctx, -len / 4, -wid / 2 + 4, len / 2.4, wid - 8, 4);
  ctx.fill();
  if (boat.kind === 'yacht') {
    ctx.fillStyle = '#fff';
    rr(ctx, -8, -wid / 2 - 4, 16, wid + 8, 3);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawPed(ctx, ped) {
  if (ped.down) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.rotate(ped.angle || 0);
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.stroke();
    ctx.restore();
    return;
  }
  circle(ctx, ped.x, ped.y, 7);
  ctx.fillStyle = ped.shirt || '#888';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.stroke();
  circle(ctx, ped.x, ped.y - 2, 3.5);
  ctx.fillStyle = ped.skin || '#e8b98a';
  ctx.fill();
}

function drawEnemy(ctx, e) {
  circle(ctx, e.x, e.y, 10);
  ctx.fillStyle = e.shirt || '#7a2d8f';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.stroke();
  // Gun pointing at the player.
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle || 0);
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(18, 0);
  ctx.stroke();
  ctx.restore();
  // Health bar.
  const w = 22;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(e.x - w / 2, e.y - 20, w, 4);
  ctx.fillStyle = '#ff4444';
  ctx.fillRect(e.x - w / 2, e.y - 20, w * Math.max(0, (e.hp || 0) / 100), 4);
}

function drawPlayerOnFoot(ctx, p, time) {
  circle(ctx, p.x, p.y, 11);
  ctx.fillStyle = '#e33f5f';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Aim line + gun.
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.aimAngle || 0);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(26, 0);
  ctx.stroke();
  ctx.restore();
  if (p.invuln > 0 && Math.floor(time * 8) % 2 === 0) {
    circle(ctx, p.x, p.y, 16);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawLandmarkLabel(ctx, lm, time) {
  ctx.save();
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const w = ctx.measureText(lm.name).width + 12;
  rr(ctx, lm.x - w / 2, lm.y - 34, w, 20, 9);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(lm.name, lm.x, lm.y - 20);
  ctx.restore();
}

function drawMinimap(ctx, state, x, y, w, h) {
  const sx = w / WORLD_W;
  const sy = h / WORLD_H;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  rr(ctx, -4, -4, w + 8, h + 8, 8);
  ctx.fill();
  ctx.fillStyle = '#2c5d34';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#2b6cb0';
  ctx.fillRect(0, SEA_TOP * sy, w, h - SEA_TOP * sy);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  for (let gx = 180; gx <= 2700; gx += 360) {
    ctx.beginPath();
    ctx.moveTo(gx * sx, 0);
    ctx.lineTo(gx * sx, BEACH_TOP * sy);
    ctx.stroke();
  }
  for (let gy = 180; gy <= 1980; gy += 360) {
    ctx.beginPath();
    ctx.moveTo(0, gy * sy);
    ctx.lineTo(w, gy * sy);
    ctx.stroke();
  }
  const dot = (px, py, r, color) => {
    circle(ctx, px * sx, py * sy, r);
    ctx.fillStyle = color;
    ctx.fill();
  };
  for (const b of state.boats || []) dot(b.x, b.y, 2.5, '#4dd0e1');
  const marker = missionMarker(state);
  if (marker) dot(marker.x, marker.y, 4, '#ffd54a');
  const pol = state.police;
  if (pol && pol.cars) for (const c of pol.cars) dot(c.x, c.y, 2.5, '#ff5252');
  dot(state.player.x, state.player.y, 4, '#fff');
  ctx.restore();
}

export function renderGame(ctx, state, opts) {
  const o = opts || {};
  const w = o.w || 1280;
  const h = o.h || 800;
  const scale = o.scale || 1;
  const camX = o.camX || state.player.x;
  const camY = o.camY || state.player.y;
  const time = state.time || 0;
  const p = state.player;

  ctx.save();
  ctx.fillStyle = '#101418';
  ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);
  ctx.scale(scale, scale);
  ctx.translate(-camX, -camY);

  const vx0 = camX - w / 2 / scale - 40;
  const vy0 = camY - h / 2 / scale - 40;
  const vx1 = camX + w / 2 / scale + 40;
  const vy1 = camY + h / 2 / scale + 40;

  // Ground: grass, beach, sea.
  ctx.fillStyle = '#2c5d34';
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  ctx.fillStyle = '#e0c98f';
  ctx.fillRect(vx0, BEACH_TOP, vx1 - vx0, SEA_TOP - BEACH_TOP);
  ctx.fillStyle = '#1e5f8a';
  ctx.fillRect(vx0, SEA_TOP, vx1 - vx0, WORLD_H - SEA_TOP + 60);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 24; i++) {
    const wx = 60 + i * 120;
    const wy = SEA_TOP + 24 + (i % 3) * 14 + Math.sin(time + i) * 3;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(wx + 34, wy);
    ctx.stroke();
  }

  // Roads.
  ctx.fillStyle = '#3a3a40';
  for (let gx = 180; gx <= 2700; gx += 360) {
    ctx.fillRect(gx - 38, 0, 76, BEACH_TOP);
  }
  for (let gy = 180; gy <= 1980; gy += 360) {
    ctx.fillRect(0, gy - 38, WORLD_W, 76);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 22]);
  for (let gx = 180; gx <= 2700; gx += 360) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, BEACH_TOP);
    ctx.stroke();
  }
  for (let gy = 180; gy <= 1980; gy += 360) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(WORLD_W, gy);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Parks.
  for (const park of (state.city && state.city.parks) || []) {
    const pw = park.w || park.width || 200;
    const ph = park.h || park.height || 160;
    ctx.fillStyle = '#3f8f4f';
    ctx.fillRect(park.x - pw / 2, park.y - ph / 2, pw, ph);
    ctx.fillStyle = '#2f7a3e';
    for (let i = 0; i < 5; i++) {
      circle(ctx, park.x - pw / 2 + 30 + i * 36, park.y - ph / 2 + 26 + (i % 2) * 60, 12);
      ctx.fill();
    }
  }

  // Gull Island in the sea.
  ctx.fillStyle = '#e0c98f';
  ctx.beginPath();
  ctx.ellipse(1440, 2130, 90, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3f8f4f';
  circle(ctx, 1410, 2126, 10);
  ctx.fill();
  circle(ctx, 1470, 2134, 10);
  ctx.fill();

  // Docks + marina piers reaching into the sea.
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(330, 1980, 60, 130);
  ctx.fillRect(2490, 1900, 60, 130);
  ctx.fillRect(690, 2010, 120, 18);

  // Buildings.
  for (const b of (state.city && state.city.buildings) || []) {
    const bw = b.w || b.width || 120;
    const bh = b.h || b.height || 90;
    ctx.fillStyle = b.color || '#8a7f70';
    ctx.fillRect(b.x - bw / 2, b.y - bh / 2, bw, bh);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x - bw / 2, b.y - bh / 2, bw, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(b.x - bw / 2 + 8, b.y - bh / 2 + 8, bw - 16, 12);
  }

  // Landmark labels.
  const lms = (state.city && state.city.landmarks) || {};
  for (const key of Object.keys(lms)) {
    const lm = lms[key];
    if (lm && typeof lm.x === 'number') drawLandmarkLabel(ctx, lm, time);
  }

  // Solmar Coins (hidden gold coins on the streets).
  const coins = (state.sideJobs && state.sideJobs.coins) || [];
  for (const c of coins) {
    if (c.taken) continue;
    const bob = Math.sin(time * 3 + (c.bob || 0)) * 3;
    circle(ctx, c.x, c.y + bob, 9);
    ctx.fillStyle = '#ffd54a';
    ctx.fill();
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#b8860b';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('S', c.x, c.y + bob + 4);
  }

  // Taxi fare: waving passenger + destination flag.
  const fare = fareMarker(state);
  if (fare) {
    const sj = state.sideJobs;
    const pulse = 1 + Math.sin(time * 5) * 0.15;
    circle(ctx, fare.x, fare.y, 12 * pulse);
    ctx.fillStyle = '#ff9800';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', fare.x, fare.y + 5);
    if (sj && sj.fare && sj.fare.stage === 'riding') {
      const dx = sj.fare.destX;
      const dy = sj.fare.destY;
      ctx.fillStyle = '#4caf50';
      ctx.beginPath();
      ctx.moveTo(dx, dy - 16);
      ctx.lineTo(dx + 12, dy - 8);
      ctx.lineTo(dx, dy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    }
  }

  // Mission crates.
  for (const c of state.crates || []) {
    if (c.taken) continue;
    ctx.fillStyle = '#a4713a';
    ctx.fillRect(c.x - 12, c.y - 12, 24, 24);
    ctx.strokeStyle = '#5f3d16';
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x - 12, c.y - 12, 24, 24);
    ctx.beginPath();
    ctx.moveTo(c.x - 12, c.y - 12);
    ctx.lineTo(c.x + 12, c.y + 12);
    ctx.moveTo(c.x + 12, c.y - 12);
    ctx.lineTo(c.x - 12, c.y + 12);
    ctx.stroke();
  }

  // Street pickups.
  for (const pk of state.pickups || []) {
    if (pk.taken) continue;
    if (pk.kind === 'cash') {
      circle(ctx, pk.x, pk.y, 8);
      ctx.fillStyle = '#4caf50';
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', pk.x, pk.y + 4);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(pk.x - 8, pk.y - 3, 16, 6);
      ctx.fillRect(pk.x - 3, pk.y - 8, 6, 16);
    } else {
      ctx.fillStyle = '#ffd54a';
      ctx.fillRect(pk.x - 7, pk.y - 3, 14, 6);
    }
  }

  // Boats in the harbor (from state, not fixed decoration).
  for (const boat of state.boats || []) drawBoatShape(ctx, boat, time);

  // Traffic cars, then pedestrians.
  for (const car of (state.traffic && state.traffic.cars) || []) {
    drawCarShape(ctx, car.x, car.y, car.angle, car.model, car.color);
  }
  for (const ped of (state.traffic && state.traffic.peds) || []) drawPed(ctx, ped);

  // Police cruisers (roadblock cars sit still among them).
  const pol = state.police;
  if (pol && pol.cars) {
    for (const car of pol.cars) drawPoliceCar(ctx, car, time);
  }

  // Police helicopter + spotlight (4–5 stars).
  const heli = state.police2 && state.police2.heli;
  if (heli) {
    const spot = heliSpotlight(state);
    if (spot) {
      const g = ctx.createRadialGradient(spot.x, spot.y, 10, spot.x, spot.y, spot.r);
      g.addColorStop(0, 'rgba(255,255,200,0.35)');
      g.addColorStop(1, 'rgba(255,255,200,0)');
      ctx.fillStyle = g;
      circle(ctx, spot.x, spot.y, spot.r);
      ctx.fill();
    }
    ctx.save();
    // Drawn 320 above the heli anchor (360 above the player): clear of
    // the roadblock line 300 ahead, so heli and roadblocks never stack.
    ctx.translate(heli.x, heli.y - 320);
    ctx.fillStyle = '#22303a';
    rr(ctx, -26, -10, 52, 20, 9);
    ctx.fill();
    ctx.strokeStyle = '#0c1418';
    ctx.stroke();
    const rotor = (heli.rotor || 0) + time * 20;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-44 * Math.cos(rotor * 0.3), -12);
    ctx.lineTo(44 * Math.cos(rotor * 0.3), -12);
    ctx.stroke();
    ctx.restore();
  }

  // Gang enemies.
  for (const e of (state.combat && state.combat.enemies) || []) drawEnemy(ctx, e);

  // Bullets.
  ctx.fillStyle = '#ffe082';
  for (const b of (state.combat && state.combat.bullets) || []) {
    circle(ctx, b.x, b.y, 3);
    ctx.fill();
  }

  // Smoke particles (handbrake).
  for (const pt of state.particles || []) {
    const a = Math.max(0, pt.life / (pt.maxLife || 0.6)) * 0.5;
    circle(ctx, pt.x, pt.y, 8 + (1 - a) * 10);
    ctx.fillStyle = `rgba(200,200,200,${a})`;
    ctx.fill();
  }

  // The player: in a car, on a boat, or on foot.
  if (p.inCar && p.car) {
    drawCarShape(ctx, p.car.x, p.car.y, p.car.angle, p.car.model || 'sedan', '#e33f5f');
    ctx.save();
    ctx.translate(p.car.x, p.car.y);
    ctx.rotate(p.car.angle);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    rr(ctx, -24, -12, 48, 24, 7);
    ctx.stroke();
    ctx.restore();
  } else if (p.inBoat && p.boat) {
    circle(ctx, p.x, p.y, 8);
    ctx.fillStyle = '#e33f5f';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    drawPlayerOnFoot(ctx, p, time);
  }

  // Mission marker: pulsing diamond + an arrow from the player.
  const marker = missionMarker(state);
  if (marker) {
    const pulse = 1 + Math.sin(time * 4) * 0.2;
    ctx.save();
    ctx.translate(marker.x, marker.y - 30);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd54a';
    const s = 10 * pulse;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.restore();
    const ang = Math.atan2(marker.y - p.y, marker.x - p.x);
    ctx.save();
    ctx.translate(p.x + Math.cos(ang) * 34, p.y + Math.sin(ang) * 34);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(255,213,74,0.9)';
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-6, -7);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();

  // ---- HUD (screen space) ----
  const obj = currentObjective(state);
  const distToMarker = marker ? Math.round(Math.hypot(marker.x - p.x, marker.y - p.y)) : 0;

  ctx.save();
  // Top-left panel: cash, mission, radio, coins.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  rr(ctx, 12, 12, 330, 128, 10);
  ctx.fill();
  ctx.fillStyle = '#7CFC00';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('$' + Math.floor(state.money).toLocaleString('en-US'), 24, 44);
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  const missionLine = state.storyComplete
    ? 'Cerita TAMAT — Kamu Raja Solmar!'
    : state.mission
      ? `${state.mission.title} — ${obj ? obj.text : ''}`
      : 'Tidak ada misi';
  ctx.fillText(missionLine.slice(0, 52), 24, 66);
  if (marker && !state.storyComplete) {
    ctx.fillStyle = '#ffd54a';
    ctx.fillText(`Target ${distToMarker}m`, 24, 86);
  }
  ctx.fillStyle = '#4dd0e1';
  ctx.fillText(`♪ ${radioName(state.radio)}`, 24, 106);
  ctx.fillStyle = '#ffd54a';
  // Coins/fares on their own line: the station name is wide enough to
  // run into a same-line coins counter.
  ctx.fillText(sideJobsText(state), 24, 126);

  // Top-right: wanted stars, health, ammo.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  rr(ctx, w - 212, 12, 200, 84, 10);
  ctx.fill();
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'left';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < (state.wanted || 0) ? '★' : '☆';
  ctx.fillStyle = '#ffd54a';
  ctx.fillText(stars, w - 200, 42);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(w - 200, 54, 176, 10);
  ctx.fillStyle = p.hp > 30 ? '#4caf50' : '#ff5252';
  ctx.fillRect(w - 200, 54, 176 * Math.max(0, p.hp / 100), 10);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText(`HP ${Math.ceil(p.hp)}   •   Peluru ${p.ammo}`, w - 200, 84);

  // Bottom-left: speed when driving or boating.
  if (p.inCar && p.car) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    rr(ctx, 12, h - 56, 150, 40, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`${Math.round(Math.abs(p.car.speed || 0) * 0.36)} km/h`, 24, h - 28);
  } else if (p.inBoat && p.boat) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    rr(ctx, 12, h - 56, 150, 40, 10);
    ctx.fill();
    ctx.fillStyle = '#4dd0e1';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`${Math.round(Math.abs(p.boat.speed || 0) * 0.18)} kn`, 24, h - 28);
  }

  // Minimap bottom-right.
  drawMinimap(ctx, state, w - 202, h - 154, 190, 142);

  // Prompt line bottom-center.
  if (o.prompt) {
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    const pw = ctx.measureText(o.prompt).width + 28;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    rr(ctx, w / 2 - pw / 2, h - 44, pw, 30, 15);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(o.prompt, w / 2, h - 23);
  }

  // Controls hint.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WASD jalan • E interaksi • Q radio • Spasi pukul / rem tangan • M suara • P jeda', 14, h - 64);

  // Banner (mission complete / story complete / wasted / busted).
  if (o.banner) {
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    const bw = ctx.measureText(o.banner).width + 48;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    rr(ctx, w / 2 - bw / 2, 140, bw, 52, 12);
    ctx.fill();
    ctx.fillStyle = '#ffd54a';
    ctx.fillText(o.banner, w / 2, 176);
  }

  // Paused overlay.
  if (o.paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('JEDA', w / 2, h / 2 - 10);
    ctx.font = '16px sans-serif';
    ctx.fillText('Tekan P untuk lanjut — progres tersimpan', w / 2, h / 2 + 24);
  }
  ctx.restore();
}

// Title screen button rects (canvas is 1280x800).
export function titleButtons(w, h) {
  return {
    newGame: { x: w / 2 - 130, y: h / 2 + 10, w: 260, h: 52 },
    continueGame: { x: w / 2 - 130, y: h / 2 + 74, w: 260, h: 52 },
  };
}

export function drawTitle(ctx, w, h, saveInfo, hasSave) {
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0d1b2a');
  g.addColorStop(0.55, '#14273a');
  g.addColorStop(1, '#0a0f16');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Simple skyline silhouette.
  ctx.fillStyle = '#0a1420';
  for (let i = 0; i < 14; i++) {
    const bw = 60 + ((i * 37) % 50);
    const bh = 120 + ((i * 53) % 180);
    ctx.fillRect(i * 92, h - 260 - bh, bw, bh + 260);
  }
  ctx.fillStyle = '#ffd54a';
  circle(ctx, w - 220, 130, 46);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SOLMAR CITY', w / 2, h / 2 - 90);
  ctx.fillStyle = '#4dd0e1';
  ctx.font = '20px sans-serif';
  ctx.fillText('Kota terbuka • 12 misi cerita • radio, perahu, taksi & koin', w / 2, h / 2 - 52);
  const btns = titleButtons(w, h);
  ctx.fillStyle = '#e33f5f';
  rr(ctx, btns.newGame.x, btns.newGame.y, btns.newGame.w, btns.newGame.h, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('▶  New Game', w / 2, btns.newGame.y + 34);
  if (hasSave) {
    ctx.fillStyle = '#2b6cb0';
    rr(ctx, btns.continueGame.x, btns.continueGame.y, btns.continueGame.w, btns.continueGame.h, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText('↻  Continue', w / 2, btns.continueGame.y + 34);
    if (saveInfo) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '14px sans-serif';
      ctx.fillText(saveInfo, w / 2, btns.continueGame.y + 78);
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '14px sans-serif';
  ctx.fillText('WASD jalan • Klik kiri tembak • E curi mobil / naik perahu • Q ganti radio • Spasi pukul / rem tangan', w / 2, h - 60);
  ctx.fillText('Game buatan penggemar — bukan GTA VI, tanpa aset Rockstar.', w / 2, h - 36);
  ctx.restore();
}
