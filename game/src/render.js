// Solmar City — canvas renderer.
// Written from v2-spec.md only. render(state, ctx) draws the whole frame:
// city, boats, cars, people, police heli, HUD, minimap, and the title
// screen. The HUD always shows live data — on the title screen the
// staged sample values, so shot 1 is never an empty screen.
import { radioName } from './radio.js';
import { currentObjective, missionMarker } from './missions.js';

const VIEW_W = 1280;
const VIEW_H = 800;
const WORLD_W = 2880;
const WORLD_H = 2160;
const SEA_TOP = 2100;
const BEACH_TOP = 2020;

// "HH:MM:SS" for the Grand Prix countdown.
export function formatHMS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
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

// One car body. Models: sedan, van, truck, sport, taxi.
export function drawCarShape(ctx, car) {
  const model = car.model || 'sedan';
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle || 0);
  ctx.fillStyle = car.color || '#c0392b';
  if (model === 'van') {
    rr(ctx, -26, -12, 52, 24, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.85)';
    ctx.fillRect(8, -9, 12, 18);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-24, -12, 52, 5);
  } else if (model === 'truck') {
    ctx.fillStyle = '#5d6d7e';
    ctx.fillRect(-26, -11, 26, 22);
    ctx.fillStyle = car.color || '#c0392b';
    ctx.fillRect(2, -10, 24, 20);
    ctx.fillStyle = 'rgba(180,220,255,0.85)';
    ctx.fillRect(14, -8, 8, 16);
  } else if (model === 'sport') {
    rr(ctx, -24, -10, 48, 20, 9);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,20,30,0.85)';
    rr(ctx, -6, -8, 16, 16, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(-26, -8, 4, 16);
    ctx.fillStyle = car.color || '#c0392b';
    ctx.fillRect(-24, -11, 3, 22);
  } else {
    // Sedan (and taxi base).
    rr(ctx, -23, -11, 46, 22, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.85)';
    ctx.fillRect(-6, -9, 12, 18);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(-20, -11, 4, 22);
    if (model === 'taxi') {
      ctx.fillStyle = '#f7dc6f';
      ctx.fillRect(-4, -14, 8, 4);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 5px sans-serif';
      ctx.fillText('TAXI', -4, -15);
    }
  }
  ctx.restore();
}

function drawBoatShape(ctx, boat, highlight) {
  ctx.save();
  ctx.translate(boat.x, boat.y);
  ctx.rotate(boat.angle || 0);
  const len = boat.kind === 'jetski' ? 30 : boat.kind === 'yacht' ? 64 : 46;
  const wid = boat.kind === 'jetski' ? 14 : boat.kind === 'yacht' ? 22 : 18;
  ctx.fillStyle = boat.color || '#fff';
  ctx.beginPath();
  ctx.ellipse(0, 0, len / 2, wid / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(-len / 6, 0, len / 4, wid / 4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (highlight) {
    ctx.strokeStyle = '#f7dc6f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, len / 2 + 4, wid / 2 + 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, shirt, angle, down) {
  ctx.save();
  ctx.translate(x, y);
  if (down) {
    ctx.fillStyle = shirt || '#888';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 6, angle || 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(angle || 0);
  ctx.fillStyle = shirt || '#888';
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function render(state, ctx) {
  const cam = state.camera || { x: 1420, y: 1230 };
  const ox = VIEW_W / 2 - cam.x;
  const oy = VIEW_H / 2 - cam.y;
  const city = state.city;
  const p = state.player;

  // --- Ground: grass, beach, sea.
  ctx.fillStyle = '#3f7a4a';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  ctx.translate(ox, oy);
  ctx.fillStyle = '#e8d28a';
  ctx.fillRect(0, BEACH_TOP, WORLD_W, SEA_TOP - BEACH_TOP);
  ctx.fillStyle = '#1e6fa8';
  ctx.fillRect(0, SEA_TOP, WORLD_W, WORLD_H - SEA_TOP);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(0, SEA_TOP, WORLD_W, 4);

  // --- Roads: the 360px grid.
  ctx.fillStyle = '#3a3f46';
  for (let x = 180; x <= 2700; x += 360) ctx.fillRect(x - 38, 0, 76, SEA_TOP);
  for (let y = 180; y <= 1980; y += 360) ctx.fillRect(0, y - 38, WORLD_W, 76);
  ctx.strokeStyle = 'rgba(240,220,120,0.7)';
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 18]);
  for (let x = 180; x <= 2700; x += 360) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, SEA_TOP); ctx.stroke();
  }
  for (let y = 180; y <= 1980; y += 360) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_W, y); ctx.stroke();
  }
  ctx.setLineDash([]);

  // --- Parks.
  ctx.fillStyle = '#2e8b57';
  for (const park of city.parks || []) {
    ctx.fillRect(park.x, park.y, park.w || 200, park.h || 140);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(park.x, park.y, park.w || 200, 8);
    ctx.fillStyle = '#2e8b57';
  }

  // --- Buildings.
  for (const b of city.buildings || []) {
    const w = b.w || 120;
    const h = b.h || 90;
    ctx.fillStyle = b.color || '#8a7f70';
    ctx.fillRect(b.x, b.y, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x, b.y, w, 8);
    ctx.fillStyle = 'rgba(255,255,180,0.5)';
    for (let wx = b.x + 14; wx < b.x + w - 10; wx += 26) {
      ctx.fillRect(wx, b.y + 16, 12, 10);
    }
  }

  // --- Landmark labels.
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  for (const key of Object.keys(city.landmarks || {})) {
    const lm = city.landmarks[key];
    ctx.fillStyle = '#f7dc6f';
    ctx.beginPath();
    ctx.arc(lm.x, lm.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('\u2605', lm.x, lm.y + 3);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(lm.name || key, lm.x, lm.y - 14);
  }

  // --- Pickups: cash / health / ammo.
  for (const pk of state.pickups || []) {
    if (pk.taken) continue;
    const bob = Math.sin((state.time || 0) * 2 + (pk.bob || 0)) * 3;
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#2ecc71';
      ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif';
      ctx.fillText('$', pk.x, pk.y + bob + 4);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(pk.x - 9, pk.y + bob - 9, 18, 18);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(pk.x - 2, pk.y + bob - 6, 4, 12);
      ctx.fillRect(pk.x - 6, pk.y + bob - 2, 12, 4);
    } else {
      ctx.fillStyle = '#f7dc6f';
      ctx.fillRect(pk.x - 8, pk.y + bob - 6, 16, 12);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('AMMO', pk.x, pk.y + bob + 3);
    }
  }

  // --- Solmar Coins (side jobs).
  const sj = state.sideJobs;
  if (sj) {
    for (const c of sj.coins || []) {
      if (c.taken) continue;
      const bob = Math.sin((state.time || 0) * 3 + (c.bob || 0)) * 4;
      ctx.fillStyle = '#ffd700';
      ctx.beginPath(); ctx.arc(c.x, c.y + bob, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#7a5c00'; ctx.font = 'bold 11px sans-serif';
      ctx.fillText('C', c.x, c.y + bob + 4);
    }
    // Taxi fare: waiting passenger + destination flag.
    if (sj.fare && sj.fare.stage === 'waiting') {
      drawPerson(ctx, sj.fare.x, sj.fare.y, '#f39c12', 0, false);
      ctx.fillStyle = '#f39c12';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('TAXI?', sj.fare.x, sj.fare.y - 16);
    }
    if (sj.fare && sj.fare.stage === 'riding') {
      ctx.fillStyle = '#f39c12';
      ctx.beginPath(); ctx.arc(sj.fare.destX, sj.fare.destY, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.font = 'bold 12px sans-serif';
      ctx.fillText('$', sj.fare.destX, sj.fare.destY + 4);
      ctx.fillStyle = '#fff';
      ctx.fillText(sj.fare.destName || 'Drop-off', sj.fare.destX, sj.fare.destY - 18);
    }
  }

  // --- Mission crates.
  for (const c of state.crates || []) {
    if (c.taken) continue;
    ctx.fillStyle = '#a67c52';
    ctx.fillRect(c.x - 11, c.y - 11, 22, 22);
    ctx.strokeStyle = '#6e4f2a'; ctx.lineWidth = 2;
    ctx.strokeRect(c.x - 11, c.y - 11, 22, 22);
    ctx.beginPath(); ctx.moveTo(c.x - 11, c.y - 11); ctx.lineTo(c.x + 11, c.y + 11); ctx.stroke();
  }

  // --- Boats (live, from state.boats — replaces the old decoration).
  for (const b of state.boats || []) {
    drawBoatShape(ctx, b, p.inBoat && p.boat === b);
  }

  // --- Traffic cars.
  for (const car of (state.traffic && state.traffic.cars) || []) {
    drawCarShape(ctx, car);
  }

  // --- Police cars (roadblocks are parked cruisers inside this list).
  for (const cop of (state.police && state.police.cars) || []) {
    drawCarShape(ctx, { x: cop.x, y: cop.y, angle: cop.angle || 0, model: 'sedan', color: '#1c2733' });
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('SCPD', cop.x, cop.y - 16);
  }

  // --- Pedestrians.
  for (const ped of (state.traffic && state.traffic.peds) || []) {
    drawPerson(ctx, ped.x, ped.y, ped.shirt, ped.angle, ped.down);
  }

  // --- Enemies (gang members).
  for (const e of (state.combat && state.combat.enemies) || []) {
    drawPerson(ctx, e.x, e.y, e.shirt || '#7a2d8f', e.angle, false);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(e.x - 12, e.y - 16, 24, 4);
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(e.x - 12, e.y - 16, 24 * Math.max(0, (e.hp || 0) / 100), 4);
  }

  // --- Bullets.
  ctx.fillStyle = '#ffe14d';
  for (const b of (state.combat && state.combat.bullets) || []) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
  }

  // --- Player: in a boat, in a car, or on foot.
  if (p.inBoat && p.boat) {
    // Boat already drawn above with a gold ring.
  } else if (p.inCar && p.car) {
    drawCarShape(ctx, { x: p.car.x, y: p.car.y, angle: p.car.angle, model: p.car.model || 'sedan', color: p.car.color || '#c0392b' });
    ctx.strokeStyle = '#f7dc6f';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, 30, 0, Math.PI * 2); ctx.stroke();
  } else {
    if (!(p.invuln > 0 && Math.floor((state.time || 0) * 10) % 2 === 0)) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.aimAngle || 0);
      ctx.fillStyle = '#2e86c1';
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f5cba7';
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(20, 0); ctx.stroke();
      ctx.restore();
    }
  }

  // --- Police helicopter + spotlight (visual only).
  const heli = state.police2 && state.police2.heli;
  if (heli) {
    ctx.fillStyle = 'rgba(255,240,150,0.18)';
    ctx.beginPath(); ctx.arc(p.x, p.y, 130, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,150,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, 130, 0, Math.PI * 2); ctx.stroke();
    ctx.save();
    ctx.translate(heli.x, heli.y);
    ctx.rotate(heli.angle || 0);
    ctx.fillStyle = '#1c2733';
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    const rotor = heli.rotor || 0;
    ctx.beginPath();
    ctx.moveTo(Math.cos(rotor) * -30, Math.sin(rotor) * -6);
    ctx.lineTo(Math.cos(rotor) * 30, Math.sin(rotor) * 6);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('SCPD AIR', heli.x, heli.y - 24);
  }

  // --- Mission marker: pulsing diamond + ring.
  const marker = missionMarker(state);
  if (marker) {
    const pulse = 14 + Math.sin((state.time || 0) * 4) * 4;
    ctx.strokeStyle = '#f7dc6f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(marker.x, marker.y - pulse - 8);
    ctx.lineTo(marker.x + pulse, marker.y);
    ctx.lineTo(marker.x, marker.y + pulse + 8);
    ctx.lineTo(marker.x - pulse, marker.y);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();

  // ================= HUD (screen space) =================
  const obj = currentObjective(state);
  const wanted = state.wanted || 0;
  const coinsFound = sj ? (sj.coinsFound || 0) : 0;
  const coinsTotal = sj && sj.coins ? sj.coins.length : 12;

  // Top-left panel.
  ctx.fillStyle = 'rgba(10,14,20,0.78)';
  rr(ctx, 12, 12, 300, 132, 10);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('$' + (state.money || 0).toLocaleString('en-US'), 24, 40);
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.fillText('HP ' + Math.max(0, Math.round(state.hp || 0)) + '  •  Ammo ' + (state.ammo || 0), 24, 62);
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(24, 70, 120, 8);
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(24, 70, 120 * Math.max(0, (state.hp || 0) / 100), 8);
  ctx.fillStyle = '#f7dc6f';
  ctx.font = 'bold 15px sans-serif';
  const stars = '\u2605'.repeat(wanted) + '\u2606'.repeat(Math.max(0, 5 - wanted));
  ctx.fillText('SCPD ' + stars, 24, 96);
  ctx.fillStyle = '#7fd4ff';
  ctx.font = '13px sans-serif';
  let radioLine = '♪ Radio off';
  try { radioLine = '♪ ' + radioName(state.radio); } catch (e) { radioLine = '♪ SOLMAR FM'; }
  ctx.fillText(radioLine, 24, 116);
  ctx.fillStyle = '#ffd700';
  ctx.fillText('Coins ' + coinsFound + '/' + coinsTotal, 24, 134);

  // Objective line under the panel, with distance + arrow.
  if (obj) {
    let distText = '';
    if (marker) {
      const d = Math.round(Math.hypot(p.x - marker.x, p.y - marker.y));
      const ang = Math.atan2(marker.y - p.y, marker.x - p.x);
      const arrows = ['\u2192', '\u2198', '\u2193', '\u2199', '\u2190', '\u2196', '\u2191', '\u2197'];
      const idx = Math.round(((ang + Math.PI / 8) % (Math.PI * 2)) / (Math.PI / 4));
      const arrow = arrows[((idx % 8) + 8) % 8];
      distText = '  ' + arrow + ' ' + d + 'm';
    }
    ctx.fillStyle = 'rgba(10,14,20,0.78)';
    const label = 'MISSION: ' + (state.mission ? state.mission.def.title : '') + ' — ' + obj.text + distText;
    ctx.font = 'bold 14px sans-serif';
    const w = ctx.measureText(label).width + 20;
    rr(ctx, 12, 152, Math.min(w, VIEW_W - 24), 28, 8);
    ctx.fill();
    ctx.fillStyle = '#f7dc6f';
    ctx.fillText(label, 22, 171);
  }

  // Grand Prix countdown, top-right.
  ctx.fillStyle = 'rgba(10,14,20,0.78)';
  rr(ctx, VIEW_W - 262, 12, 250, 54, 10);
  ctx.fill();
  ctx.fillStyle = '#ff9f43';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('GRAND PRIX ' + formatHMS(state.grandPrix ? state.grandPrix.startsIn : 3600), VIEW_W - 24, 34);
  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  const fareText = sj ? ('Fares $' + (sj.faresEarned || 0)) : '';
  ctx.fillText(fareText + '  •  ' + (state.missionsDone || 0) + '/12 missions', VIEW_W - 24, 54);
  ctx.textAlign = 'left';

  // Speed, bottom-left (car / boat).
  if (p.inCar || p.inBoat) {
    const kmh = Math.round(Math.abs(p.speed || 0) * 0.36);
    ctx.fillStyle = 'rgba(10,14,20,0.78)';
    rr(ctx, 12, VIEW_H - 96, 150, 40, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(kmh + ' km/h', 24, VIEW_H - 68);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText(p.inBoat ? 'BOAT' : 'DRIVING', 24, VIEW_H - 52);
  }

  // Prompt, bottom-center.
  if (state.prompt) {
    ctx.font = 'bold 15px sans-serif';
    const w = ctx.measureText(state.prompt).width + 24;
    ctx.fillStyle = 'rgba(10,14,20,0.85)';
    rr(ctx, (VIEW_W - w) / 2, VIEW_H - 118, w, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(state.prompt, VIEW_W / 2, VIEW_H - 98);
    ctx.textAlign = 'left';
  }

  // How-to line.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '12px sans-serif';
  ctx.fillText('WASD move • Mouse aim • Click shoot • E interact / steal / board boats • Q radio • Space punch / handbrake • M mute • P pause', 12, VIEW_H - 12);

  // --- Minimap (live), bottom-right.
  const mmW = 200;
  const mmH = 150;
  const mmX = VIEW_W - mmW - 12;
  const mmY = VIEW_H - mmH - 12;
  const sx = mmW / WORLD_W;
  const sy = mmH / WORLD_H;
  ctx.fillStyle = 'rgba(10,14,20,0.8)';
  ctx.fillRect(mmX, mmY, mmW, mmH);
  ctx.fillStyle = '#1e6fa8';
  ctx.fillRect(mmX, mmY + SEA_TOP * sy, mmW, (WORLD_H - SEA_TOP) * sy);
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  for (let x = 180; x <= 2700; x += 360) {
    ctx.beginPath(); ctx.moveTo(mmX + x * sx, mmY); ctx.lineTo(mmX + x * sx, mmY + SEA_TOP * sy); ctx.stroke();
  }
  for (let y = 180; y <= 1980; y += 360) {
    ctx.beginPath(); ctx.moveTo(mmX, mmY + y * sy); ctx.lineTo(mmX + mmW, mmY + y * sy); ctx.stroke();
  }
  for (const b of state.boats || []) {
    ctx.fillStyle = '#7fd4ff';
    ctx.fillRect(mmX + b.x * sx - 2, mmY + b.y * sy - 2, 4, 4);
  }
  if (marker) {
    ctx.fillStyle = '#f7dc6f';
    ctx.beginPath(); ctx.arc(mmX + marker.x * sx, mmY + marker.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(mmX + p.x * sx, mmY + p.y * sy, 4, 0, Math.PI * 2); ctx.fill();

  // --- Wasted / Busted banner.
  if (state.banner) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, VIEW_H / 2 - 50, VIEW_W, 100);
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.banner.text, VIEW_W / 2, VIEW_H / 2 + 18);
    ctx.textAlign = 'left';
  }

  // --- Title screen overlay (HUD above stays visible with sample data).
  if (state.screen === 'title') {
    ctx.fillStyle = 'rgba(5,8,14,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f7dc6f';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText('SOLMAR CITY', VIEW_W / 2, 250);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText('An open-world crime game — 12 missions • 5 radio stations • 6 boats • SCPD • Grand Prix', VIEW_W / 2, 292);
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#2ecc71';
    ctx.fillText('▶  New Game', VIEW_W / 2, 380);
    if (state.saveInfo) {
      ctx.fillStyle = '#fff';
      ctx.font = '20px sans-serif';
      ctx.fillText('Continue — ' + state.saveInfo, VIEW_W / 2, 420);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '15px sans-serif';
    ctx.fillText('Press Enter or click New Game to play', VIEW_W / 2, 480);
    ctx.textAlign = 'left';
  }

  // --- Pause overlay.
  if (state.screen === 'paused') {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', VIEW_W / 2, VIEW_H / 2);
    ctx.font = '18px sans-serif';
    ctx.fillText('Press P or Esc to keep playing', VIEW_W / 2, VIEW_H / 2 + 40);
    ctx.textAlign = 'left';
  }
}
