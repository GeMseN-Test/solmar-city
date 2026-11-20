// render.js — All drawing for Solmar City: the city, cars (sedan /
// van / taxi / truck / sport shapes), boats, the SCPD helicopter +
// spotlight, coins, taxi passengers, and the full HUD (money, active
// mission, radio station, coins, boat speed, SCPD wanted stars, and
// the Solmar Grand Prix countdown).

// Finisher fix (v2-retry integration): the HUD radio line needs the live
// station name. drawHUD only ever saw the game state, so it must read it
// through this import — the UI bag's radioName never reaches drawHUD.
import { radioName } from './radio.js';

export function drawCarShape(ctx, x, y, angle, color, model) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const len = model === 'truck' ? 58 : model === 'van' ? 52 : 46;
  const wid = model === 'truck' ? 26 : model === 'van' ? 26 : 22;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-len / 2 + 2, -wid / 2 + 3, len, wid);
  // Body.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-len / 2, -wid / 2, len, wid, 6);
  ctx.fill();
  // Cabin / windshield.
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  if (model === 'truck') {
    ctx.fillRect(-len / 2 + 4, -wid / 2 + 3, 12, wid - 6);
    ctx.fillStyle = '#3a3f45';
    ctx.fillRect(len / 2 - 22, -wid / 2 + 2, 20, wid - 4);
  } else if (model === 'van') {
    ctx.fillRect(-len / 2 + 6, -wid / 2 + 3, len - 16, wid - 6);
  } else if (model === 'sport') {
    ctx.beginPath();
    ctx.moveTo(-6, -wid / 2 + 3);
    ctx.lineTo(10, -wid / 2 + 3);
    ctx.lineTo(16, 0);
    ctx.lineTo(10, wid / 2 - 3);
    ctx.lineTo(-6, wid / 2 - 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-len / 2 + 3, -wid / 2 + 2, 5, wid - 4);
  } else {
    ctx.fillRect(-8, -wid / 2 + 3, 18, wid - 6);
  }
  // Taxi checker + roof sign.
  if (model === 'taxi') {
    ctx.fillStyle = '#111';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(-len / 2 + 4 + i * 8, -2, 4, 4);
    }
    ctx.fillStyle = '#ffe14d';
    ctx.fillRect(-4, -wid / 2 - 3, 10, 4);
  }
  // Headlights + taillights.
  ctx.fillStyle = '#fff7ae';
  ctx.fillRect(len / 2 - 2, -wid / 2 + 3, 2, 5);
  ctx.fillRect(len / 2 - 2, wid / 2 - 8, 2, 5);
  ctx.fillStyle = '#e33';
  ctx.fillRect(-len / 2, -wid / 2 + 3, 2, 5);
  ctx.fillRect(-len / 2, wid / 2 - 8, 2, 5);
  // Wheels.
  ctx.fillStyle = '#111';
  ctx.fillRect(-len / 2 + 6, -wid / 2 - 2, 9, 4);
  ctx.fillRect(-len / 2 + 6, wid / 2 - 2, 9, 4);
  ctx.fillRect(len / 2 - 15, -wid / 2 - 2, 9, 4);
  ctx.fillRect(len / 2 - 15, wid / 2 - 2, 9, 4);
  ctx.restore();
}

function drawPoliceCar(ctx, car) {
  drawCarShape(ctx, car.x, car.y, car.angle, car.color || '#1c2733', 'sedan');
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // SCPD livery: white doors + roof text.
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(-8, -11, 20, 22);
  ctx.fillStyle = '#0a0a0a';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SCPD', 2, 0);
  ctx.restore();
  // Light bar.
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const t = Date.now() / 180;
  ctx.fillStyle = Math.floor(t) % 2 === 0 ? '#ff2d2d' : '#2d7bff';
  ctx.fillRect(-4, -13, 8, 5);
  ctx.fillStyle = Math.floor(t) % 2 === 0 ? '#2d7bff' : '#ff2d2d';
  ctx.fillRect(-4, 8, 8, 5);
  ctx.restore();
}

function drawBoat(ctx, boat) {
  ctx.save();
  ctx.translate(boat.x, boat.y);
  ctx.rotate(boat.angle);
  const len = boat.kind === 'yacht' ? 78 : boat.kind === 'jetski' ? 30 : boat.kind === 'speedboat' ? 52 : 46;
  const wid = boat.kind === 'yacht' ? 24 : boat.kind === 'jetski' ? 12 : 18;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 3, len / 2, wid / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = boat.color || '#f2f2f2';
  ctx.beginPath();
  ctx.moveTo(len / 2, 0);
  ctx.lineTo(len / 4, -wid / 2);
  ctx.lineTo(-len / 2 + 6, -wid / 2 + 2);
  ctx.lineTo(-len / 2, 0);
  ctx.lineTo(-len / 2 + 6, wid / 2 - 2);
  ctx.lineTo(len / 4, wid / 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (boat.kind === 'yacht') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-14, -8, 26, 16);
    ctx.fillStyle = '#9fd8ff';
    ctx.fillRect(-12, -6, 22, 12);
  } else if (boat.kind !== 'jetski') {
    ctx.fillStyle = 'rgba(20,40,70,0.55)';
    ctx.fillRect(-8, -wid / 2 + 4, 16, wid - 8);
  }
  ctx.restore();
  // Wake.
  if (boat.wake) {
    for (const w of boat.wake) {
      const a = Math.max(0, w.life / (w.maxLife || 1)) * 0.5;
      ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(w.x, w.y, 4 + (1 - a) * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPed(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.down) {
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = ped.skin || '#e8b98a';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt || '#888';
    ctx.fillRect(-9, -5, 18, 10);
  } else {
    const bob = Math.sin(ped.stepPhase || 0) * 1.5;
    ctx.fillStyle = ped.shirt || '#888';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin || '#e8b98a';
    ctx.beginPath();
    ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3 + bob * 0.2, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawEnemy(ctx, e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 3, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = e.shirt || '#7a2d8f';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = e.skin || '#e8b98a';
  ctx.beginPath();
  ctx.arc(Math.cos(e.angle) * 3, Math.sin(e.angle) * 3, 5.5, 0, Math.PI * 2);
  ctx.fill();
  // Health bar.
  if (e.hp < e.maxHp) {
    ctx.fillStyle = '#111';
    ctx.fillRect(-12, -18, 24, 4);
    ctx.fillStyle = '#e33';
    ctx.fillRect(-12, -18, 24 * Math.max(0, e.hp / e.maxHp), 4);
  }
  ctx.restore();
}

function drawPlayer(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 11, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(p.angle);
  ctx.fillStyle = '#f2b705';
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(5, 0, 5.5, 0, Math.PI * 2);
  ctx.fill();
  // Gun barrel toward aim.
  ctx.rotate((p.aimAngle !== undefined ? p.aimAngle : p.angle) - p.angle);
  ctx.fillStyle = '#333';
  ctx.fillRect(8, -1.5, 12, 3);
  ctx.restore();
}

function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return pad(h) + ':' + pad(m) + ':' + pad(sec);
}

function drawHUD(ctx, state, canvasW, canvasH) {
  const p = state.player || {};
  const money = state.money || 0;
  const coins = state.sideJobs ? state.sideJobs.coinsFound + '/12' : '0/12';
  const fares = state.sideJobs ? state.sideJobs.faresEarned : 0;
  // Finisher fix: the old line read state.radioName twice — a string that
  // only screenshot staging ever set (so Q never changed the HUD, and in
  // real play it always fell through to 'RADIO OFF'). The staged station
  // already lives in state.radio.stationIndex, so the live radioName()
  // function returns the right station in every scene and follows Q.
  const radioLabel = state.radio ? radioName : null;
  const wanted = state.police ? state.police.wanted : 0;
  ctx.save();
  // Top-left info panel.
  ctx.fillStyle = 'rgba(8,14,24,0.72)';
  ctx.beginPath();
  ctx.roundRect(12, 12, 300, 132, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('$' + money.toLocaleString('en-US'), 24, 22);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#ffd21a';
  ctx.fillText('● Coins ' + coins + '  •  Fares $' + fares, 24, 50);
  ctx.fillStyle = '#7fd4ff';
  const station = typeof radioLabel === 'function' ? radioLabel(state.radio) : (radioLabel || 'RADIO OFF');
  ctx.fillText('♪ ' + station, 24, 72);
  ctx.fillStyle = '#9fe870';
  const mission = state.missionTitle || (state.mission && state.mission.title) || 'Free roam — pick a mission';
  ctx.fillText('◆ ' + mission, 24, 94);
  ctx.fillStyle = '#ff9d9d';
  const boatLine = p.inBoat && p.boat
    ? 'Boat ' + Math.round(Math.abs(p.boat.speed || 0)) + ' px/s'
    : 'HP ' + Math.max(0, Math.round(p.hp || 100)) + '  •  Ammo ' + (p.ammo || 0);
  ctx.fillText(boatLine, 24, 116);
  // Wanted line — SCPD branded.
  if (wanted > 0) {
    ctx.fillStyle = '#ff5252';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('SCPD ' + '★'.repeat(wanted) + '☆'.repeat(5 - wanted), 24, 140);
  }
  // Grand Prix countdown, top-right.
  const gp = state.grandPrix;
  const gpText = gp && typeof gp.startsIn === 'number'
    ? 'SOLMAR GRAND PRIX — STARTS IN ' + formatClock(gp.startsIn)
    : 'SOLMAR GRAND PRIX — SOON';
  ctx.font = 'bold 15px sans-serif';
  const gpW = ctx.measureText(gpText).width;
  ctx.fillStyle = 'rgba(8,14,24,0.72)';
  ctx.beginPath();
  ctx.roundRect(canvasW - gpW - 36, 12, gpW + 24, 30, 8);
  ctx.fill();
  ctx.fillStyle = '#ffd21a';
  ctx.textAlign = 'right';
  ctx.fillText(gpText, canvasW - 24, 19);
  // How-to, bottom.
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(
    'WASD move • E enter car / boat • Q radio • Space handbrake / punch • M mute • P pause',
    canvasW / 2,
    canvasH - 22
  );
  // Mission banner.
  if (state.banner) {
    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = '#ffd21a';
    ctx.textAlign = 'center';
    ctx.fillText(state.banner, canvasW / 2, 70);
  }
  ctx.restore();
}

export function render(ctx, state, camera) {
  if (!ctx || !state) return;
  const canvasW = ctx.canvas ? ctx.canvas.width : 1280;
  const canvasH = ctx.canvas ? ctx.canvas.height : 800;
  const p = state.player || { x: 1420, y: 1230 };
  const camX = camera && camera.x !== undefined ? camera.x : p.x;
  const camY = camera && camera.y !== undefined ? camera.y : p.y;
  const offX = canvasW / 2 - camX;
  const offY = canvasH / 2 - camY;
  ctx.save();
  ctx.clearRect(0, 0, canvasW, canvasH);
  // Sky-tinted backdrop.
  ctx.fillStyle = '#0e1a24';
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.translate(offX, offY);
  const city = state.city || {};
  // Ground: grass, beach, sea.
  ctx.fillStyle = '#3f7a3a';
  ctx.fillRect(0, 0, 2880, 2020);
  ctx.fillStyle = '#e8d8a0';
  ctx.fillRect(0, 2020, 2880, 80);
  ctx.fillStyle = '#1d6fb8';
  ctx.fillRect(0, 2100, 2880, 60);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  for (let i = 0; i < 12; i++) {
    ctx.fillRect(((i * 260) % 2880), 2116 + (i % 3) * 8, 90, 2);
  }
  // Roads.
  if (city.isRoad) {
    ctx.fillStyle = '#2b2f36';
    for (let gx = 180; gx <= 2700; gx += 360) ctx.fillRect(gx - 38, 0, 76, 2020);
    for (let gy = 180; gy <= 1980; gy += 360) ctx.fillRect(0, gy - 38, 2880, 76);
    ctx.strokeStyle = '#f7d154';
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 22]);
    for (let gx = 180; gx <= 2700; gx += 360) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, 2020);
      ctx.stroke();
    }
    for (let gy = 180; gy <= 1980; gy += 360) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(2880, gy);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  // Parks.
  if (city.parks) {
    for (const park of city.parks) {
      ctx.fillStyle = '#57a34a';
      ctx.beginPath();
      ctx.arc(park.x, park.y, park.r || 90, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2f7a2a';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(park.x + Math.cos(i * 1.3) * 50, park.y + Math.sin(i * 1.3) * 50, 12, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Buildings.
  if (city.buildings) {
    for (const b of city.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(b.x + 4, b.y + 5, b.w, b.h);
      ctx.fillStyle = b.color || '#6b7280';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,240,170,0.75)';
      for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += 18) {
        for (let wy = b.y + 8; wy < b.y + b.h - 8; wy += 18) {
          ctx.fillRect(wx, wy, 8, 8);
        }
      }
    }
  }
  // Landmarks.
  if (city.landmarks) {
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    for (const key of Object.keys(city.landmarks)) {
      const lm = city.landmarks[key];
      ctx.fillStyle = '#ffd21a';
      ctx.beginPath();
      ctx.arc(lm.x, lm.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const label = lm.name || key;
      const w = ctx.measureText(label).width;
      ctx.fillRect(lm.x - w / 2 - 5, lm.y - 30, w + 10, 18);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, lm.x, lm.y - 26);
    }
  }
  // Mission marker.
  if (state.marker) {
    const m = state.marker;
    ctx.strokeStyle = '#ffd21a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 22 + Math.sin(Date.now() / 300) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd21a';
    ctx.beginPath();
    ctx.moveTo(m.x, m.y - 34);
    ctx.lineTo(m.x - 8, m.y - 18);
    ctx.lineTo(m.x + 8, m.y - 18);
    ctx.closePath();
    ctx.fill();
  }
  // Solmar Coins.
  if (state.sideJobs && state.sideJobs.coins) {
    for (const coin of state.sideJobs.coins) {
      if (coin.taken) continue;
      const bobY = Math.sin(coin.bob || 0) * 3;
      ctx.fillStyle = '#ffd21a';
      ctx.beginPath();
      ctx.arc(coin.x, coin.y + bobY, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b8860b';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', coin.x, coin.y + bobY);
    }
  }
  // Pickups (cash / health / ammo).
  if (state.pickups) {
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      ctx.fillStyle = pk.kind === 'health' ? '#e33' : pk.kind === 'ammo' ? '#f80' : '#2ecc71';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pk.kind === 'health' ? '+' : pk.kind === 'ammo' ? 'A' : '$', pk.x, pk.y);
    }
  }
  // Taxi fare: waving passenger + destination marker.
  if (state.sideJobs && state.sideJobs.fare) {
    const fare = state.sideJobs.fare;
    if (fare.stage === 'waiting') {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(fare.x, fare.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.arc(fare.x, fare.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd21a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(fare.x, fare.y, 20 + Math.sin(Date.now() / 200) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI $' + fare.pay, fare.x, fare.y - 30);
    } else {
      ctx.strokeStyle = '#ffd21a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(fare.destX, fare.destY, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd21a';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(fare.destName + ' — ' + Math.ceil(fare.timeLeft) + 's', fare.destX, fare.destY - 32);
    }
  }
  // Boats.
  if (state.boats) {
    for (const boat of state.boats) drawBoat(ctx, boat);
  }
  // Traffic cars + peds.
  if (state.traffic) {
    for (const car of state.traffic.cars || []) {
      drawCarShape(ctx, car.x, car.y, car.angle, car.color, car.model);
    }
    for (const ped of state.traffic.peds || []) drawPed(ctx, ped);
  }
  // Police cruisers (SCPD branded) — roadblocks included.
  if (state.police && state.police.cars) {
    for (const cop of state.police.cars) drawPoliceCar(ctx, cop);
  }
  // Player car.
  if (p.inCar && p.car) {
    drawCarShape(ctx, p.car.x, p.car.y, p.car.angle, p.car.color, p.car.model || 'sedan');
  }
  // Enemies + bullets.
  if (state.combat) {
    for (const e of state.combat.enemies || []) {
      if (e.hp > 0) drawEnemy(ctx, e);
    }
    for (const b of state.combat.bullets || []) {
      ctx.fillStyle = b.fromPlayer ? '#ffe14d' : '#ff6b6b';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Player (on foot, or standing in a boat).
  if (!p.inCar) drawPlayer(ctx, p);
  // Heli + spotlight.
  if (state.police2 && state.police2.heli) {
    const heli = state.police2.heli;
    ctx.fillStyle = 'rgba(255,255,190,0.18)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 130, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,190,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 130, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.translate(heli.x, heli.y);
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 3;
    const r = heli.rotor || 0;
    ctx.beginPath();
    ctx.moveTo(Math.cos(r) * 34, Math.sin(r) * 6);
    ctx.lineTo(-Math.cos(r) * 34, -Math.sin(r) * 6);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCPD', 0, 3);
    ctx.restore();
  }
  ctx.restore();
  drawHUD(ctx, state, canvasW, canvasH);
}

export const drawWorld = render;
export const drawGame = render;

export default render;
