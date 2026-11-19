// render.js — Solmar City canvas renderer: city, cars, boats, HUD, minimap.
// Written from the v2 spec only. All world drawing happens in world
// coordinates (camera translated once); HUD is drawn in screen space.
// Defensive field access: building/park shapes may spell w/h either way.

import { currentObjective, currentMissionDef, missionMarker } from './missions.js';
import { radioName } from './radio.js';
import { heliSpotlight } from './police2.js';
import { sideJobsText } from './sidejobs.js';

const WORLD_W = 2880;
const WORLD_H = 2160;
const SEA_TOP = 2100;
const BEACH_TOP = 2020;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function moneyText(n) {
  return '$' + Math.floor(n || 0).toLocaleString('en-US');
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

// ---------------------------------------------------------------------------
// Car shapes by model (sport / van / truck get their own silhouettes).
// ---------------------------------------------------------------------------

export function drawCarShape(ctx, car) {
  const model = car.model || 'sedan';
  const color = car.color || '#c0392b';
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle || 0);
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.5;

  if (model === 'truck') {
    rr(ctx, -24, -11, 30, 22, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d7dbe0';
    rr(ctx, 8, -10, 16, 20, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2c3e50';
    rr(ctx, 10, -8, 12, 16, 2);
    ctx.fill();
  } else if (model === 'van') {
    rr(ctx, -26, -11, 52, 22, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#b8d4e8';
    rr(ctx, -14, -9, 18, 18, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(8, -9, 2, 18);
    ctx.fillRect(16, -9, 2, 18);
  } else if (model === 'sport') {
    ctx.beginPath();
    ctx.moveTo(-24, -8);
    ctx.lineTo(-14, -11);
    ctx.lineTo(12, -11);
    ctx.lineTo(24, -6);
    ctx.lineTo(24, 6);
    ctx.lineTo(12, 11);
    ctx.lineTo(-14, 11);
    ctx.lineTo(-24, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#101418';
    rr(ctx, -6, -8, 16, 16, 4);
    ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(-25, -10, 4, 20);
  } else if (model === 'taxi') {
    rr(ctx, -23, -11, 46, 22, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#101418';
    rr(ctx, -8, -9, 16, 18, 3);
    ctx.fill();
    ctx.fillStyle = '#f7f7f7';
    ctx.fillRect(-2, -11, 6, 4);
    ctx.fillRect(2, 7, 6, 4);
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(-4, -14, 10, 4);
  } else {
    // sedan (default)
    rr(ctx, -23, -11, 46, 22, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#b8d4e8';
    rr(ctx, -10, -9, 18, 18, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(-2, -9, 2, 18);
  }

  // Wheels.
  ctx.fillStyle = '#141414';
  ctx.fillRect(-16, -13, 9, 4);
  ctx.fillRect(-16, 9, 9, 4);
  ctx.fillRect(8, -13, 9, 4);
  ctx.fillRect(8, 9, 9, 4);
  ctx.restore();
}

function drawPoliceCar(ctx, car, now) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle || 0);
  ctx.fillStyle = '#f4f6f7';
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1.5;
  rr(ctx, -23, -11, 46, 22, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-6, -11, 14, 22);
  ctx.fillStyle = '#b8d4e8';
  rr(ctx, -12, -9, 14, 18, 3);
  ctx.fill();
  // Flashing light bar.
  const flash = Math.floor(now * 6) % 2 === 0;
  ctx.fillStyle = flash ? '#ff2d2d' : '#2d7dff';
  ctx.fillRect(-4, -13, 8, 4);
  ctx.fillStyle = flash ? '#2d7dff' : '#ff2d2d';
  ctx.fillRect(-4, 9, 8, 4);
  ctx.fillStyle = '#141414';
  ctx.fillRect(-16, -13, 9, 4);
  ctx.fillRect(-16, 9, 9, 4);
  ctx.fillRect(8, -13, 9, 4);
  ctx.fillRect(8, 9, 9, 4);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Ground
// ---------------------------------------------------------------------------

function drawGround(ctx, state) {
  // Grass.
  ctx.fillStyle = '#4d7a3d';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // Mowing stripes for a little texture.
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let x = 0; x < WORLD_W; x += 240) ctx.fillRect(x, 0, 120, BEACH_TOP);

  // Roads: vertical x-lines, horizontal y-lines, width 76.
  ctx.fillStyle = '#3b3b42';
  for (let x = 180; x <= 2700; x += 360) ctx.fillRect(x - 38, 0, 76, BEACH_TOP);
  for (let y = 180; y <= 1980; y += 360) ctx.fillRect(0, y - 38, WORLD_W, 76);
  // Dashed centre lines.
  ctx.fillStyle = '#d8c95a';
  for (let x = 180; x <= 2700; x += 360) {
    for (let y = 0; y < BEACH_TOP; y += 48) ctx.fillRect(x - 2, y, 4, 24);
  }
  for (let y = 180; y <= 1980; y += 360) {
    for (let x = 0; x < WORLD_W; x += 48) ctx.fillRect(x, y - 2, 24, 4);
  }

  // Parks.
  const parks = (state.city && state.city.parks) || [];
  for (const pk of parks) {
    const px = pk.x ?? 0;
    const py = pk.y ?? 0;
    const pr = pk.r ?? pk.radius ?? 120;
    const pw = pk.w ?? pk.width;
    const ph = pk.h ?? pk.height;
    ctx.fillStyle = '#3d6b2f';
    if (pw && ph) {
      rr(ctx, px - pw / 2, py - ph / 2, pw, ph, 18);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
    // Trees.
    ctx.fillStyle = '#2c5222';
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.5;
      const tx = px + Math.cos(a) * pr * 0.55;
      const ty = py + Math.sin(a) * pr * 0.55;
      ctx.beginPath();
      ctx.arc(tx, ty, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Beach + sea.
  ctx.fillStyle = '#d9c27a';
  ctx.fillRect(0, BEACH_TOP, WORLD_W, SEA_TOP - BEACH_TOP);
  ctx.fillStyle = '#1e5f8a';
  ctx.fillRect(0, SEA_TOP, WORLD_W, WORLD_H - SEA_TOP);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let y = SEA_TOP + 24; y < WORLD_H; y += 36) {
    ctx.beginPath();
    for (let x = 0; x <= WORLD_W; x += 60) {
      const yy = y + Math.sin(x * 0.02 + y) * 4;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  // Buildings.
  const buildings = (state.city && state.city.buildings) || [];
  for (const b of buildings) {
    const bx = b.x ?? 0;
    const by = b.y ?? 0;
    const bw = b.w ?? b.width ?? 120;
    const bh = b.h ?? b.height ?? 90;
    ctx.fillStyle = b.color || '#8a7f70';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(bx + 6, by + 6, bw - 12, bh - 12);
    // Windows.
    ctx.fillStyle = 'rgba(255,240,180,0.5)';
    for (let wx = bx + 14; wx < bx + bw - 14; wx += 26) {
      for (let wy = by + 14; wy < by + bh - 14; wy += 26) {
        ctx.fillRect(wx, wy, 10, 12);
      }
    }
  }

  // Landmarks: pin + name.
  const lms = (state.city && state.city.landmarks) || {};
  const pinColors = {
    garage: '#e67e22',
    safehouse: '#27ae60',
    bank: '#f1c40f',
    turf: '#8e44ad',
    docks: '#3498db',
    marina: '#16a085',
    radio: '#e74c3c',
    island: '#f39c12',
  };
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px monospace';
  for (const key of Object.keys(lms)) {
    const lm = lms[key];
    if (!lm) continue;
    ctx.fillStyle = pinColors[key] || '#ecf0f1';
    ctx.beginPath();
    ctx.arc(lm.x, lm.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.fillText((lm.name || key)[0], lm.x, lm.y + 4);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    const label = lm.name || key;
    const tw = ctx.measureText(label).width + 10;
    rr(ctx, lm.x - tw / 2, lm.y + 16, tw, 18, 9);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(label, lm.x, lm.y + 29);
  }
}

// ---------------------------------------------------------------------------
// World objects
// ---------------------------------------------------------------------------

function drawPickups(ctx, state, now) {
  for (const pk of state.pickups || []) {
    if (pk.taken) continue;
    const bob = Math.sin(now * 3 + pk.x) * 2;
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#2ecc71';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bob, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1e8449';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('$', pk.x, pk.y + bob + 4);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#fff';
      rr(ctx, pk.x - 10, pk.y + bob - 10, 20, 20, 3);
      ctx.fill();
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(pk.x - 3, pk.y + bob - 7, 6, 14);
      ctx.fillRect(pk.x - 7, pk.y + bob - 3, 14, 6);
    } else {
      ctx.fillStyle = '#f1c40f';
      rr(ctx, pk.x - 9, pk.y + bob - 7, 18, 14, 2);
      ctx.fill();
      ctx.fillStyle = '#7d6608';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('AMMO', pk.x, pk.y + bob + 3);
    }
  }
}

function drawCrates(ctx, state) {
  for (const c of state.crates || []) {
    if (c.taken) continue;
    ctx.fillStyle = '#a67c52';
    ctx.fillRect(c.x - 11, c.y - 11, 22, 22);
    ctx.strokeStyle = '#6e4f2a';
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x - 11, c.y - 11, 22, 22);
    ctx.beginPath();
    ctx.moveTo(c.x - 11, c.y - 11);
    ctx.lineTo(c.x + 11, c.y + 11);
    ctx.moveTo(c.x + 11, c.y - 11);
    ctx.lineTo(c.x - 11, c.y + 11);
    ctx.stroke();
  }
}

function drawCoins(ctx, state, now) {
  const jobs = state.sideJobs;
  if (!jobs || !jobs.coins) return;
  for (const coin of jobs.coins) {
    if (coin.taken) continue;
    const bob = Math.sin(now * 2 + (coin.bob || 0)) * 3;
    ctx.fillStyle = '#f7dc6f';
    ctx.beginPath();
    ctx.arc(coin.x, coin.y + bob, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b7950b';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#7d6608';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('C', coin.x, coin.y + bob + 4);
  }
}

function drawFare(ctx, state, now) {
  const jobs = state.sideJobs;
  if (!jobs || !jobs.fare) return;
  const fare = jobs.fare;
  if (fare.stage === 'waiting') {
    const pulse = 26 + Math.sin(now * 5) * 5;
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(fare.x, fare.y, pulse, 0, Math.PI * 2);
    ctx.stroke();
    // Waving passenger.
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.arc(fare.x, fare.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7e5109';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fare.x + 6, fare.y - 6);
    ctx.lineTo(fare.x + 16, fare.y - 18 + Math.sin(now * 8) * 4);
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', fare.x, fare.y - 24);
  } else if (fare.destX !== undefined && fare.destY !== undefined) {
    const pulse = 22 + Math.sin(now * 5) * 4;
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(fare.destX, fare.destY, pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(fare.destName || 'DROP OFF', fare.destX, fare.destY - 28);
  }
}

function drawBoats(ctx, state, now) {
  for (const boat of state.boats || []) {
    // Wake.
    const speed = Math.abs(boat.speed || 0);
    if (speed > 20) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 1; i <= 3; i++) {
        const wx = boat.x - Math.cos(boat.angle) * i * 18;
        const wy = boat.y - Math.sin(boat.angle) * i * 18;
        ctx.beginPath();
        ctx.arc(wx, wy, 3 + i * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(boat.angle || 0);
    const len = boat.kind === 'jetski' ? 26 : boat.kind === 'yacht' ? 64 : 44;
    const wid = boat.kind === 'jetski' ? 12 : 16;
    ctx.fillStyle = boat.color || '#ecf0f1';
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(len / 2, 0);
    ctx.lineTo(len / 4, -wid / 2);
    ctx.lineTo(-len / 2, -wid / 2);
    ctx.lineTo(-len / 2, wid / 2);
    ctx.lineTo(len / 4, wid / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-len / 4, -wid / 2 + 2, len / 2, wid - 4);
    if (boat.inUse) {
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawTraffic(ctx, state) {
  const traffic = state.traffic;
  if (!traffic) return;
  for (const car of traffic.cars || []) drawCarShape(ctx, car);
  for (const ped of traffic.peds || []) {
    if (ped.gone) continue;
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.down) {
      ctx.rotate(ped.angle || 0);
      ctx.fillStyle = ped.shirt || '#95a5a6';
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.skin || '#e8b98a';
      ctx.beginPath();
      ctx.arc(14, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = ped.shirt || '#95a5a6';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.skin || '#e8b98a';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      if (ped.panic) {
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, -10);
        ctx.lineTo(10, -14);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

function drawPolice(ctx, state, now) {
  const police = state.police;
  if (police) {
    for (const car of police.cars || []) drawPoliceCar(ctx, car, now);
  }
  const p2 = state.police2;
  if (p2 && p2.heli) {
    const spot = heliSpotlight(state);
    if (spot) {
      ctx.fillStyle = 'rgba(255,244,150,0.22)';
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, spot.r, 0, Math.PI * 2);
      ctx.fill();
    }
    const h = p2.heli;
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.angle || 0);
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#ecf0f1';
    ctx.lineWidth = 3;
    const rotor = (h.rotor || 0) + now * 20;
    ctx.beginPath();
    ctx.moveTo(Math.cos(rotor) * -34, Math.sin(rotor) * -34);
    ctx.lineTo(Math.cos(rotor) * 34, Math.sin(rotor) * 34);
    ctx.stroke();
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawCombat(ctx, state) {
  const combat = state.combat;
  if (!combat) return;
  for (const b of combat.bullets || []) {
    const vx = b.vx !== undefined ? b.vx : Math.cos(b.angle || 0) * 760;
    const vy = b.vy !== undefined ? b.vy : Math.sin(b.angle || 0) * 760;
    const len = Math.sqrt(vx * vx + vy * vy) || 1;
    ctx.strokeStyle = b.enemy ? '#ff6b6b' : '#ffe95e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - (vx / len) * 12, b.y - (vy / len) * 12);
    ctx.stroke();
  }
  for (const e of combat.enemies || []) {
    ctx.fillStyle = e.shirt || '#7a2d8f';
    ctx.beginPath();
    ctx.arc(e.x, e.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = e.skin || '#e8b98a';
    ctx.beginPath();
    ctx.arc(e.x, e.y, 5, 0, Math.PI * 2);
    ctx.fill();
    // Gun direction.
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x + Math.cos(e.angle || 0) * 16, e.y + Math.sin(e.angle || 0) * 16);
    ctx.stroke();
    // HP bar when hurt.
    if (e.hp < 100) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(e.x - 12, e.y - 20, 24, 5);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(e.x - 12, e.y - 20, 24 * Math.max(0, e.hp / 100), 5);
    }
  }
}

function drawPlayer(ctx, state, now) {
  const p = state.player;
  if (p.inCar && p.car) {
    drawCarShape(ctx, p.car);
    return;
  }
  if (p.inBoat) return; // drawn as the yellow dot on the boat
  const blink = p.invuln > 0 && Math.floor(now * 10) % 2 === 0;
  if (blink) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle || 0);
  ctx.fillStyle = '#2e86c1';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1a5276';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  // Gun.
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(18, 0);
  ctx.stroke();
  ctx.restore();
  // Aim reticle.
  const ax = p.x + Math.cos(p.aimAngle || 0) * 26;
  const ay = p.y + Math.sin(p.aimAngle || 0) * 26;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(ax, ay, 5, 0, Math.PI * 2);
  ctx.stroke();
}

function drawParticles(ctx, state) {
  for (const pt of state.particles || []) {
    const a = Math.max(0, pt.life / (pt.max || 0.5));
    if (pt.kind === 'smoke') {
      ctx.fillStyle = 'rgba(200,200,200,' + (a * 0.7).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 8 + (1 - a) * 10, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(231,76,60,' + a.toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 6 + (1 - a) * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawMissionBeacon(ctx, state, now, view) {
  const marker = missionMarker(state);
  if (!marker) return;
  const pulse = 30 + Math.sin(now * 4) * 8;
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(241,196,15,0.25)';
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, pulse * 0.6, 0, Math.PI * 2);
  ctx.fill();
  // Beam.
  ctx.fillStyle = 'rgba(241,196,15,0.12)';
  ctx.fillRect(marker.x - 6, marker.y - 160, 12, 160);
  // Edge arrow when the target is off-screen.
  const cam = state.camera;
  const sx = marker.x - (cam.x - view.w / 2);
  const sy = marker.y - (cam.y - view.h / 2);
  if (sx < 40 || sx > view.w - 40 || sy < 40 || sy > view.h - 40) {
    const cx = clamp(sx, 60, view.w - 60) + (cam.x - view.w / 2);
    const cy = clamp(sy, 60, view.h - 60) + (cam.y - view.h / 2);
    const ang = Math.atan2(marker.y - cy, marker.x - cx);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

function drawHUD(ctx, state, w, h, now) {
  const p = state.player;
  // Top-left status panel.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  rr(ctx, 12, 12, 252, 132, 10);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 24px monospace';
  ctx.fillText(moneyText(state.money), 24, 42);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  rr(ctx, 24, 52, 150, 12, 6);
  ctx.fill();
  ctx.fillStyle = p.hp > 40 ? '#2ecc71' : '#e74c3c';
  rr(ctx, 24, 52, 150 * Math.max(0, p.hp / 100), 12, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('HP ' + Math.ceil(p.hp), 182, 63);
  ctx.fillStyle = '#f1c40f';
  ctx.fillText('AMMO ' + p.ammo, 24, 86);
  // Wanted stars.
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < (state.wanted || 0) ? '★' : '☆';
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(stars, 24, 110);
  // Radio + side jobs.
  ctx.fillStyle = '#9ecbff';
  ctx.font = 'bold 13px monospace';
  let radioLine = '♪ ' + radioName(state.radio);
  ctx.fillText(radioLine, 24, 132);
  ctx.fillStyle = '#f7dc6f';
  ctx.fillText(sideJobsText(state), 130, 110);

  // Objective panel.
  const def = currentMissionDef(state);
  const obj = currentObjective(state);
  if (def && obj) {
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    rr(ctx, 12, 152, 340, 56, 10);
    ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('M' + (state.missionIndex + 1) + ' · ' + def.title + '  ·  $' + def.reward.toLocaleString('en-US'), 24, 174);
    ctx.fillStyle = '#fff';
    ctx.font = '13px monospace';
    const marker = missionMarker(state);
    let distText = '';
    if (marker) {
      const d = Math.hypot(p.x - marker.x, p.y - marker.y);
      distText = '  ·  ' + Math.round(d / 10) + 'm';
    }
    ctx.fillText(obj.text + distText, 24, 194);
  } else if (state.storyComplete) {
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    rr(ctx, 12, 152, 340, 40, 10);
    ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('STORY COMPLETE — Solmar is yours!', 24, 178);
  } else {
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    rr(ctx, 12, 152, 340, 40, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '13px monospace';
    ctx.fillText('No active mission — press Enter for the next one.', 24, 178);
  }

  // Speed (bottom-right).
  if (p.inCar || p.inBoat) {
    const speed = Math.abs(p.speed || 0);
    const label = p.inBoat
      ? Math.round(speed * 0.18) + ' kn'
      : Math.round(speed * 0.2) + ' km/h';
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    rr(ctx, w - 150, h - 52, 138, 40, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(label, w - 24, h - 24);
    ctx.textAlign = 'left';
  }

  // Hint (bottom-centre).
  if (state.hint) {
    ctx.font = 'bold 15px monospace';
    const tw = ctx.measureText(state.hint).width + 24;
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    rr(ctx, (w - tw) / 2, h - 44, tw, 32, 16);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(state.hint, w / 2, h - 22);
    ctx.textAlign = 'left';
  }

  // Mission-complete banner.
  if (state.banner) {
    ctx.fillStyle = 'rgba(10,14,20,0.8)';
    const bw = 520;
    rr(ctx, (w - bw) / 2, 90, bw, 76, 12);
    ctx.fill();
    ctx.fillStyle = state.banner.story ? '#f1c40f' : '#7ee787';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(state.banner.text, w / 2, 122);
    ctx.fillStyle = '#fff';
    ctx.font = '15px monospace';
    ctx.fillText(state.banner.sub, w / 2, 148);
    ctx.textAlign = 'left';
  }

  // Minimap (top-right).
  const mw = 176;
  const mh = 132;
  const mx = w - mw - 12;
  const my = 12;
  ctx.fillStyle = 'rgba(10,14,20,0.75)';
  rr(ctx, mx, my, mw, mh, 8);
  ctx.fill();
  const sx = mw / WORLD_W;
  const sy = mh / WORLD_H;
  ctx.save();
  ctx.beginPath();
  rr(ctx, mx, my, mw, mh, 8);
  ctx.clip();
  ctx.fillStyle = '#1e5f8a';
  ctx.fillRect(mx, my + SEA_TOP * sy, mw, mh - SEA_TOP * sy);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
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
  const marker = missionMarker(state);
  if (marker) {
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(mx + marker.x * sx, my + marker.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const boat of state.boats || []) {
    ctx.fillStyle = '#7fe7f7';
    ctx.fillRect(mx + boat.x * sx - 1, my + boat.y * sy - 1, 3, 3);
  }
  if (state.police) {
    ctx.fillStyle = '#ff5b5b';
    for (const car of state.police.cars || []) {
      ctx.fillRect(mx + car.x * sx - 1, my + car.y * sy - 1, 3, 3);
    }
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(mx + p.x * sx, my + p.y * sy, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export function drawGame(ctx, state, now) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const t = now || 0;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0b0f14';
  ctx.fillRect(0, 0, w, h);

  const shakeX = state.shake ? (Math.random() - 0.5) * state.shake : 0;
  const shakeY = state.shake ? (Math.random() - 0.5) * state.shake : 0;
  const camX = state.camera.x + shakeX;
  const camY = state.camera.y + shakeY;

  ctx.save();
  ctx.translate(w / 2 - camX, h / 2 - camY);
  drawGround(ctx, state);
  drawPickups(ctx, state, t);
  drawCrates(ctx, state);
  drawCoins(ctx, state, t);
  drawFare(ctx, state, t);
  drawBoats(ctx, state, t);
  drawTraffic(ctx, state);
  drawPolice(ctx, state, t);
  drawCombat(ctx, state);
  drawPlayer(ctx, state, t);
  drawParticles(ctx, state);
  drawMissionBeacon(ctx, state, t, { w, h });
  ctx.restore();

  drawHUD(ctx, state, w, h, t);

  // WASTED / BUSTED overlays.
  if (state.dead || state.busted) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = state.dead ? '#e74c3c' : '#3498db';
    ctx.font = 'bold 72px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(state.dead ? 'WASTED' : 'BUSTED', w / 2, h / 2);
    ctx.fillStyle = '#fff';
    ctx.font = '18px monospace';
    ctx.fillText("Back to Mara's Safehouse…", w / 2, h / 2 + 40);
    ctx.textAlign = 'left';
  }
}

// ---------------------------------------------------------------------------
// Title + pause screens
// ---------------------------------------------------------------------------

export function drawTitleScreen(ctx, w, h, saveText) {
  ctx.fillStyle = '#0b0f14';
  ctx.fillRect(0, 0, w, h);
  // Sunset band.
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#1a1a40');
  grad.addColorStop(0.55, '#7a2d8f');
  grad.addColorStop(1, '#e67e22');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h * 0.62);
  ctx.fillStyle = '#f7dc6f';
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.34, 64, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1e5f8a';
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  for (let x = 0; x < w; x += 90) ctx.fillRect(x, h * 0.66, 44, 3);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 84px monospace';
  ctx.fillText('SOLMAR CITY', w / 2, 150);
  ctx.font = 'bold 22px monospace';
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText('An open-world crime game — a make.fun GTA6 entry', w / 2, 190);
  ctx.font = '16px monospace';
  ctx.fillStyle = '#fff';
  ctx.fillText('Mara Voss. 12 story missions. Steal cars, sail boats, outrun the law.', w / 2, 222);

  const buttons = [];
  const bw = 280;
  const bh = 54;
  const bx = (w - bw) / 2;
  let by = 300;
  const labels = saveText
    ? [['new', 'NEW GAME'], ['continue', 'CONTINUE — ' + saveText]]
    : [['new', 'NEW GAME']];
  for (const [id, label] of labels) {
    ctx.fillStyle = id === 'new' ? '#27ae60' : '#2980b9';
    rr(ctx, bx, by, bw, bh, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(label, w / 2, by + 35);
    buttons.push({ id, x: bx, y: by, w: bw, h: bh });
    by += 68;
  }

  ctx.font = '15px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const lines = [
    'WASD / Arrows — move & drive   ·   Mouse — aim & shoot   ·   Space — punch / handbrake',
    'E — steal car · board boat · grab crates & vault   ·   Shift — run',
    'Q — cycle radio (5 stations)   ·   M — mute   ·   P / Esc — pause',
    'Boats in the harbor (E to board)  ·  Taxi fares while driving  ·  12 hidden Solmar Coins',
  ];
  let ly = by + 30;
  for (const line of lines) {
    ctx.fillText(line, w / 2, ly);
    ly += 26;
  }
  ctx.textAlign = 'left';
  return buttons;
}

export function drawPauseOverlay(ctx, w, h) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 54px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', w / 2, h / 2 - 10);
  ctx.font = '17px monospace';
  ctx.fillText('P / Esc — resume   ·   M — mute   ·   Q — radio', w / 2, h / 2 + 30);
  ctx.textAlign = 'left';
}
