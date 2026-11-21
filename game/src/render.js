// render.js — Solmar City renderer: world, cars, boats, heli, HUD, screens.
// Written from the v2 spec only.
//   - drawCarShape: sport / van / truck body shapes (plus sedan / taxi).
//   - Boats drawn from state.boats (replaces fixed decorative boats).
//   - Police heli + spotlight, Solmar Coins, fare passenger / marker.
//   - HUD: radio line via radioName(state.radio) — NEVER state.radioName —
//     coins counter, boat speed, SCPD stars, Grand Prix countdown HH:MM:SS.
//   - How-to mentions Q / boats / handbrake.
import { radioName } from './radio.js';
import { fareMarker, sideJobsText } from './sidejobs.js';
import { heliSpotlight } from './police2.js';
import { currentObjective, currentMission, missionMarker } from './missions.js';

const WORLD_W = 2880;
const WORLD_H = 2160;
const SEA_TOP = 2100;
const BEACH_TOP = 2020;

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function fmtClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return pad(h) + ':' + pad(m) + ':' + pad(ss);
}

function moneyText(n) {
  return '$' + Math.floor(n || 0).toLocaleString('en-US');
}

// ---- Car bodies ----------------------------------------------------------
// Drawn at the origin, facing +X, length 46 x width 22 (spec).
export function drawCarShape(ctx, car) {
  const model = car.model || 'sedan';
  const color = car.color || '#d23b3b';
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle || 0);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-22, -9, 46, 24);
  ctx.fillStyle = color;
  if (model === 'sport') {
    // Sleek low body + spoiler + hood scoop.
    ctx.beginPath();
    ctx.moveTo(-22, -10);
    ctx.lineTo(10, -11);
    ctx.lineTo(22, -6);
    ctx.lineTo(22, 6);
    ctx.lineTo(10, 11);
    ctx.lineTo(-22, 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(-6, -8, 16, 16); // canopy
    ctx.fillStyle = color;
    ctx.fillRect(-24, -12, 4, 24); // spoiler
    ctx.fillStyle = '#ffd94a';
    ctx.fillRect(20, -7, 2, 4);
    ctx.fillRect(20, 3, 2, 4);
  } else if (model === 'van') {
    // Tall boxy van.
    ctx.fillRect(-23, -11, 46, 22);
    ctx.fillStyle = '#cfe8ff';
    ctx.fillRect(12, -8, 8, 16); // windshield
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-20, -8, 26, 4);
  } else if (model === 'truck') {
    // Cab + flat bed.
    ctx.fillStyle = color;
    ctx.fillRect(8, -11, 15, 22); // cab
    ctx.fillStyle = '#5a4632';
    ctx.fillRect(-23, -11, 29, 22); // bed
    ctx.fillStyle = '#cfe8ff';
    ctx.fillRect(18, -8, 4, 16); // windshield
    ctx.fillStyle = '#8a7a5a';
    ctx.fillRect(-21, -9, 25, 3);
    ctx.fillRect(-21, 6, 25, 3);
  } else {
    // Sedan / taxi: body + cabin + windows.
    ctx.beginPath();
    ctx.moveTo(-23, -10);
    ctx.quadraticCurveTo(0, -12, 20, -8);
    ctx.lineTo(23, -4);
    ctx.lineTo(23, 4);
    ctx.lineTo(20, 8);
    ctx.quadraticCurveTo(0, 12, -23, 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1c2733';
    ctx.fillRect(-4, -8, 14, 16); // cabin glass
    if (model === 'taxi') {
      ctx.fillStyle = '#ffd94a';
      ctx.fillRect(-2, -11, 10, 3);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 7px sans-serif';
      ctx.fillText('TAXI', -1, -12);
    }
    ctx.fillStyle = '#fff8c0';
    ctx.fillRect(21, -7, 2, 4);
    ctx.fillRect(21, 3, 2, 4);
  }
  // Wheels.
  ctx.fillStyle = '#111';
  ctx.fillRect(-16, -12, 9, 3);
  ctx.fillRect(-16, 9, 9, 3);
  ctx.fillRect(9, -12, 9, 3);
  ctx.fillRect(9, 9, 9, 3);
  if (car.roadblock) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCPD', 0, -14);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

function drawBoatShape(ctx, boat) {
  ctx.save();
  ctx.translate(boat.x, boat.y);
  ctx.rotate(boat.angle || 0);
  const len = boat.kind === 'jetski' ? 26 : boat.kind === 'yacht' ? 64 : 46;
  const wid = boat.kind === 'jetski' ? 12 : boat.kind === 'yacht' ? 22 : 18;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(0, 6, len / 2, wid / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = boat.color || '#fff';
  ctx.beginPath();
  ctx.moveTo(-len / 2, -wid / 2);
  ctx.lineTo(len / 2 - 6, -wid / 2);
  ctx.lineTo(len / 2, 0);
  ctx.lineTo(len / 2 - 6, wid / 2);
  ctx.lineTo(-len / 2, wid / 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-len / 4, -wid / 4, len / 2, wid / 2);
  if (boat.inUse) {
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('YOU', 0, -wid / 2 - 6);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

function drawWorld(ctx, state, cam, vw, vh) {
  const x0 = cam.x;
  const y0 = cam.y;
  const x1 = cam.x + vw;
  const y1 = cam.y + vh;
  // Grass base.
  ctx.fillStyle = '#2e6b34';
  ctx.fillRect(0, 0, vw, vh);
  // Sea + beach (world coords).
  if (y1 > SEA_TOP) {
    ctx.fillStyle = '#1455a0';
    ctx.fillRect(0, SEA_TOP - y0, vw, vh - (SEA_TOP - y0));
  }
  if (y1 > BEACH_TOP && y0 < SEA_TOP) {
    ctx.fillStyle = '#d9c27a';
    ctx.fillRect(0, Math.max(0, BEACH_TOP - y0), vw, Math.min(vh, SEA_TOP - Math.max(y0, BEACH_TOP)));
  }
  // Roads: grid x [180..2700 step 360], y [180..1980 step 360], width 76.
  ctx.fillStyle = '#3a3f46';
  for (let x = 180; x <= 2700; x += 360) {
    if (x + 38 >= x0 && x - 38 <= x1) ctx.fillRect(x - 38 - x0, 0, 76, vh);
  }
  for (let y = 180; y <= 1980; y += 360) {
    if (y + 38 >= y0 && y - 38 <= y1) ctx.fillRect(0, y - 38 - y0, vw, 76);
  }
  // Road dashes.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 22]);
  ctx.beginPath();
  for (let x = 180; x <= 2700; x += 360) {
    if (x >= x0 && x <= x1) { ctx.moveTo(x - x0, 0); ctx.lineTo(x - x0, vh); }
  }
  for (let y = 180; y <= 1980; y += 360) {
    if (y >= y0 && y <= y1) { ctx.moveTo(0, y - y0); ctx.lineTo(vw, y - y0); }
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Parks.
  if (state.city && state.city.parks) {
    ctx.fillStyle = '#3f8f46';
    for (const pk of state.city.parks) {
      ctx.fillRect(pk.x - x0, pk.y - y0, pk.w || 200, pk.h || 140);
    }
  }
  // Buildings.
  if (state.city && state.city.buildings) {
    for (const b of state.city.buildings) {
      const bx = (b.x ?? 0) - x0;
      const by = (b.y ?? 0) - y0;
      const bw = b.w || b.width || 90;
      const bh = b.h || b.height || 90;
      if (bx + bw < 0 || by + bh < 0 || bx > vw || by > vh) continue;
      ctx.fillStyle = b.color || '#7a6a58';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = 'rgba(255,240,180,0.5)';
      for (let wx = bx + 10; wx < bx + bw - 8; wx += 22) {
        for (let wy = by + 10; wy < by + bh - 8; wy += 22) {
          ctx.fillRect(wx, wy, 8, 8);
        }
      }
    }
  }
  // Landmarks.
  if (state.city && state.city.landmarks) {
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    for (const key of Object.keys(state.city.landmarks)) {
      const lm = state.city.landmarks[key];
      const lx = lm.x - x0;
      const ly = lm.y - y0;
      if (lx < -40 || ly < -40 || lx > vw + 40 || ly > vh + 40) continue;
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.arc(lx, ly, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.fillText('◆', lx, ly + 4);
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 3;
      ctx.strokeText(lm.name || key, lx, ly - 12);
      ctx.fillText(lm.name || key, lx, ly - 12);
    }
    ctx.textAlign = 'left';
    ctx.lineWidth = 1;
  }
  // Pickups.
  if (state.pickups) {
    for (const pk of state.pickups) {
      const px = pk.x - x0;
      const py = pk.y - y0 + Math.sin((state.playTime + (pk.bob || 0)) * 3) * 2;
      if (px < -20 || py < -20 || px > vw + 20 || py > vh + 20) continue;
      if (pk.kind === 'cash') {
        ctx.fillStyle = '#2fae4e';
        ctx.fillRect(px - 9, py - 6, 18, 12);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText('$', px - 3, py + 3);
      } else if (pk.kind === 'health') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(px - 8, py - 8, 16, 16);
        ctx.fillStyle = '#e33';
        ctx.fillRect(px - 2, py - 6, 4, 12);
        ctx.fillRect(px - 6, py - 2, 12, 4);
      } else {
        ctx.fillStyle = '#ffd94a';
        ctx.fillRect(px - 8, py - 5, 16, 10);
        ctx.fillStyle = '#111';
        ctx.font = 'bold 8px sans-serif';
        ctx.fillText('AMMO', px - 7, py + 3);
      }
    }
  }
  // Solmar Coins (12 hidden gold coins).
  if (state.sideJobs && state.sideJobs.coins) {
    for (const c of state.sideJobs.coins) {
      if (c.taken) continue;
      const cx = c.x - x0;
      const cy = c.y - y0 + Math.sin(state.playTime * 2 + (c.bob || 0)) * 3;
      if (cx < -20 || cy < -20 || cx > vw + 20 || cy > vh + 20) continue;
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#a67c00';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#a67c00';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('S', cx, cy + 3);
      ctx.textAlign = 'left';
      ctx.lineWidth = 1;
    }
  }
  // Taxi fare passenger / marker.
  const fare = state.sideJobs ? fareMarker(state) : null;
  if (fare) {
    const fx = fare.x - x0;
    const fy = fare.y - y0;
    ctx.fillStyle = '#ff8c1a';
    ctx.beginPath();
    ctx.arc(fx, fy, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', fx, fy + 4);
    ctx.textAlign = 'left';
    if (fare.destX != null) {
      ctx.strokeStyle = 'rgba(255,140,26,0.8)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fare.destX - x0, fare.destY - y0);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  // Boats from state.boats.
  if (state.boats) {
    for (const b of state.boats) {
      if (b.x < x0 - 80 || b.y < y0 - 80 || b.x > x1 + 80 || b.y > y1 + 80) continue;
      ctx.save();
      ctx.translate(-x0, -y0);
      drawBoatShape(ctx, b);
      ctx.restore();
    }
  }
  // Parked cars.
  if (state.parkedCars) {
    for (const c of state.parkedCars) {
      ctx.save();
      ctx.translate(-x0, -y0);
      drawCarShape(ctx, c);
      ctx.restore();
    }
  }
  // Traffic cars.
  if (state.traffic && state.traffic.cars) {
    for (const c of state.traffic.cars) {
      ctx.save();
      ctx.translate(-x0, -y0);
      drawCarShape(ctx, c);
      ctx.restore();
    }
  }
  // Police cars (roadblocks included — drawn with SCPD tag).
  if (state.police && state.police.cars) {
    for (const c of state.police.cars) {
      ctx.save();
      ctx.translate(-x0, -y0);
      drawCarShape(ctx, { ...c, color: '#1a1a2e', model: c.model || 'sedan' });
      ctx.restore();
      // Light bar.
      ctx.fillStyle = (Math.floor(state.playTime * 6) % 2 === 0) ? '#ff2222' : '#2244ff';
      ctx.fillRect(c.x - x0 - 8, c.y - y0 - 14, 16, 4);
    }
  }
  // Foot cops.
  if (state.police && state.police.cops) {
    for (const cop of state.police.cops) {
      const cx = cop.x - x0;
      const cy = cop.y - y0;
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath();
      ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#9ecbff';
      ctx.beginPath();
      ctx.arc(cx, cy - 4, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Pedestrians.
  if (state.traffic && state.traffic.peds) {
    for (const pd of state.traffic.peds) {
      if (pd.down) continue;
      const px = pd.x - x0;
      const py = pd.y - y0;
      ctx.fillStyle = pd.shirt || '#c96';
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pd.skin || '#e8b98a';
      ctx.beginPath();
      ctx.arc(px, py - 3, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Gang enemies.
  if (state.combat && state.combat.enemies) {
    for (const e of state.combat.enemies) {
      const ex = e.x - x0;
      const ey = e.y - y0;
      ctx.fillStyle = e.shirt || '#7a2d8f';
      ctx.beginPath();
      ctx.arc(ex, ey, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = e.skin || '#e8b98a';
      ctx.beginPath();
      ctx.arc(ex, ey - 3, 5, 0, Math.PI * 2);
      ctx.fill();
      // HP bar.
      ctx.fillStyle = '#111';
      ctx.fillRect(ex - 12, ey - 20, 24, 4);
      ctx.fillStyle = '#e33';
      ctx.fillRect(ex - 12, ey - 20, 24 * clamp((e.hp || 0) / 100, 0, 1), 4);
    }
  }
  // Bullets.
  if (state.combat && state.combat.bullets) {
    ctx.fillStyle = '#ffe14a';
    for (const b of state.combat.bullets) {
      ctx.beginPath();
      ctx.arc(b.x - x0, b.y - y0, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Player car or player on foot / in boat.
  const p = state.player;
  if (p.inCar && p.car) {
    ctx.save();
    ctx.translate(-x0, -y0);
    drawCarShape(ctx, { ...p.car, color: p.car.color || '#d23b3b' });
    ctx.restore();
  } else if (p.inBoat && p.boat) {
    // Player rides the boat already drawn above; draw a marker ring.
    ctx.strokeStyle = '#ffd94a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x - x0, p.y - y0, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
  } else {
    const px = p.x - x0;
    const py = p.y - y0;
    ctx.fillStyle = '#e33';
    ctx.beginPath();
    ctx.arc(px, py, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(px, py - 3, 5, 0, Math.PI * 2);
    ctx.fill();
    // Aim line.
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(p.aimAngle) * 26, py + Math.sin(p.aimAngle) * 26);
    ctx.stroke();
  }
  // Heli + spotlight.
  const spot = state.police2 ? heliSpotlight(state) : null;
  if (spot) {
    ctx.fillStyle = 'rgba(255,255,200,0.18)';
    ctx.beginPath();
    ctx.arc(spot.x - x0, spot.y - y0, spot.r || 130, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,200,0.5)';
    ctx.beginPath();
    ctx.arc(spot.x - x0, spot.y - y0, spot.r || 130, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (state.police2 && state.police2.heli) {
    const h = state.police2.heli;
    const hx = h.x - x0;
    const hy = h.y - y0;
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.ellipse(hx, hy, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 3;
    const ra = (h.rotor || 0);
    ctx.beginPath();
    ctx.moveTo(hx - Math.cos(ra) * 34, hy - Math.sin(ra) * 34);
    ctx.lineTo(hx + Math.cos(ra) * 34, hy + Math.sin(ra) * 34);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCPD AIR', hx, hy - 18);
    ctx.textAlign = 'left';
  }
  // Mission marker arrow + ring.
  const marker = missionMarker(state);
  if (marker) {
    const mx = marker.x - x0;
    const my = marker.y - y0;
    ctx.strokeStyle = '#ffd94a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(mx, my, 26 + Math.sin(state.playTime * 4) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
  }
}

function drawHud(ctx, state, opts, vw, vh) {
  const p = state.player;
  const wanted = state.wanted || 0;
  // Top-left panel.
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fillRect(10, 10, 300, 132);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(moneyText(state.money), 22, 36);
  // HP bar.
  ctx.fillStyle = '#333';
  ctx.fillRect(22, 46, 150, 10);
  ctx.fillStyle = p.hp > 30 ? '#3fae4e' : '#e33';
  ctx.fillRect(22, 46, 150 * clamp(p.hp / 100, 0, 1), 10);
  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  ctx.fillText('HP ' + Math.ceil(p.hp) + '   AMMO ' + p.ammo, 22, 72);
  // SCPD stars.
  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = '#ffd94a';
  ctx.fillText('SCPD ' + '★'.repeat(wanted) + '☆'.repeat(5 - wanted), 22, 94);
  // Radio line — via radioName(), never state.radioName.
  const station = state.radio ? radioName(state.radio) : null;
  ctx.fillStyle = '#9ecbff';
  ctx.font = '13px sans-serif';
  ctx.fillText(station ? '♪ ' + station : '♪ RADIO OFF  (Q to tune)', 22, 114);
  // Coins + fares.
  ctx.fillStyle = '#ffd700';
  ctx.fillText(sideJobsText(state), 22, 132);
  // Grand Prix countdown (top-right).
  const gp = state.grandPrix ? state.grandPrix.startsIn : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fillRect(vw - 250, 10, 240, 56);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('GRAND PRIX STARTS IN', vw - 238, 30);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(fmtClock(gp), vw - 238, 56);
  // Objective (bottom-left) + distance + arrow.
  const obj = currentObjective(state);
  const mission = currentMission(state);
  if (mission && obj) {
    const mk = missionMarker(state);
    let line = mission.title + ': ' + obj.text;
    if (mk) {
      const d = Math.round(Math.sqrt((p.x - mk.x) ** 2 + (p.y - mk.y) ** 2));
      line += '  •  ' + d + 'm';
    }
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(10, vh - 66, Math.min(560, ctx.measureText(line).width + 90), 30);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('★ ' + line, 22, vh - 46);
    // Arrow toward the marker.
    if (mk) {
      const ang = Math.atan2(mk.y - p.y, mk.x - p.x);
      const ax = 34;
      const ay = vh - 96;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-8, -8);
      ctx.lineTo(-8, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  } else if (state.storyComplete) {
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('★ STORY COMPLETE — You are the King of Solmar!', 22, vh - 46);
  }
  // Speed (bottom-right).
  let speed = 0;
  let speedLabel = '';
  if (p.inCar && p.car) { speed = Math.abs(p.car.speed || 0); speedLabel = ' km/h'; }
  else if (p.inBoat && p.boat) { speed = Math.abs(p.boat.speed || 0); speedLabel = ' kn'; }
  else { speed = 0; }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(Math.round(speed * 0.22) + speedLabel, vw - 22, vh - 46);
  if (p.inBoat) {
    ctx.font = '13px sans-serif';
    ctx.fillText('BOAT ' + Math.round(speed) + ' px/s', vw - 22, vh - 24);
  }
  ctx.textAlign = 'left';
  // How-to footer.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '12px sans-serif';
  ctx.fillText('WASD move • E interact / board boats • Click shoot • Space punch / handbrake • Q radio • M mute • P pause', 22, vh - 12);
  // Prompt line (from main.js).
  if (opts && opts.prompt) {
    ctx.fillStyle = '#111';
    const w = ctx.measureText(opts.prompt).width + 24;
    ctx.fillStyle = 'rgba(255,217,74,0.95)';
    ctx.fillRect(vw / 2 - w / 2, vh - 100, w, 26);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.prompt, vw / 2, vh - 82);
    ctx.textAlign = 'left';
  }
  // Mission-complete banner.
  if (opts && opts.banner) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(vw / 2 - 260, 90, 520, 64);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.banner, vw / 2, 118);
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText(opts.bannerSub || '', vw / 2, 140);
    ctx.textAlign = 'left';
  }
}

function drawMinimap(ctx, state, vw, vh) {
  const mw = 190;
  const mh = 142;
  const mx = vw - mw - 12;
  const my = vh - mh - 12;
  const sx = mw / WORLD_W;
  const sy = mh / WORLD_H;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
  ctx.fillStyle = '#1d5c26';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#1455a0';
  ctx.fillRect(mx, my + SEA_TOP * sy, mw, mh - SEA_TOP * sy);
  ctx.fillStyle = '#3a3f46';
  for (let x = 180; x <= 2700; x += 360) ctx.fillRect(mx + x * sx - 1, my, 2, mh);
  for (let y = 180; y <= 1980; y += 360) ctx.fillRect(mx, my + y * sy - 1, mw, 2);
  if (state.city && state.city.landmarks) {
    ctx.fillStyle = '#ffd94a';
    for (const key of Object.keys(state.city.landmarks)) {
      const lm = state.city.landmarks[key];
      ctx.fillRect(mx + lm.x * sx - 2, my + lm.y * sy - 2, 4, 4);
    }
  }
  const marker = missionMarker(state);
  if (marker) {
    ctx.fillStyle = '#ff5a5a';
    ctx.beginPath();
    ctx.arc(mx + marker.x * sx, my + marker.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player dot.
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd94a';
  ctx.stroke();
}

function drawStartScreen(ctx, state, vw, vh, saveText) {
  ctx.fillStyle = '#0d1526';
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SOLMAR CITY', vw / 2, 150);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('12 story missions  •  SCPD police  •  Grand Prix countdown', vw / 2, 196);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#9ecbff';
  ctx.fillText('5 radio stations  •  6 boats  •  taxi fares  •  12 Solmar Coins', vw / 2, 226);
  ctx.fillText('Roadblocks + police heli  •  handbrake  •  saves', vw / 2, 252);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('[ ENTER ]  New Game', vw / 2, 340);
  if (saveText) {
    ctx.fillStyle = '#fff';
    ctx.fillText('[ C ]  Continue  —  ' + saveText, vw / 2, 380);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '15px sans-serif';
  ctx.fillText('WASD move  •  E interact / steal car / board boat  •  Click shoot', vw / 2, 470);
  ctx.fillText('Space punch (on foot) / handbrake (driving)  •  Q radio  •  M mute  •  P pause', vw / 2, 496);
  ctx.fillText('You are Mara Voss. Take Solmar City, one mission at a time.', vw / 2, 540);
  ctx.textAlign = 'left';
}

function drawOverlay(ctx, title, sub, vw, vh) {
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, vw / 2, vh / 2 - 10);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  ctx.fillText(sub, vw / 2, vh / 2 + 30);
  ctx.fillText('Press ENTER to continue', vw / 2, vh / 2 + 60);
  ctx.textAlign = 'left';
}

// Main entry: draw one frame.
// cam = { x, y } top-left world coords. opts = { mode, banner, bannerSub,
// prompt, saveText }.
export function draw(ctx, state, cam, opts) {
  const vw = ctx.canvas.width;
  const vh = ctx.canvas.height;
  const mode = (opts && opts.mode) || 'game';
  if (mode === 'start') {
    drawStartScreen(ctx, state, vw, vh, opts && opts.saveText);
    return;
  }
  drawWorld(ctx, state, cam, vw, vh);
  drawMinimap(ctx, state, vw, vh);
  drawHud(ctx, state, opts || {}, vw, vh);
  if (mode === 'pause') drawOverlay(ctx, 'PAUSED', 'Take a breath. Solmar waits.', vw, vh);
  else if (mode === 'wasted') drawOverlay(ctx, 'WASTED', 'Mara wakes up at the Safehouse.', vw, vh);
  else if (mode === 'busted') drawOverlay(ctx, 'BUSTED', 'The SCPD took $100. Back to the Safehouse.', vw, vh);
}
