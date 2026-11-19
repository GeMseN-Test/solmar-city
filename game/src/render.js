// render.js — Solmar City canvas renderer.
// Written from the v2 spec only. Draws the map, cars (sedan/van/truck/
// sport/taxi), boats, police heli + spotlight, coins, taxi fares, and
// the full HUD (money, wanted stars, mission, radio, coins, boat speed).
import { RadioMod, radioName } from './radio.js';
import { sideJobsText, fareMarker } from './sidejobs.js';
import { heliSpotlight } from './police2.js';
import { missionMarker, currentObjective } from './missions.js';

const VIEW_W = 1280;
const VIEW_H = 800;

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// Radio station label for the HUD. RadioMod is the radio module object
// from radio.js; radioName is the plain helper. Either may answer.
export function radioLabel(state) {
  let label = '';
  try {
    if (RadioMod && typeof RadioMod.name === 'function') label = RadioMod.name(state.radio);
    else if (RadioMod && typeof RadioMod === 'string') label = RadioMod;
    else if (RadioMod && RadioMod.stationName) label = String(RadioMod.stationName);
  } catch (e) { /* fall through to radioName */ }
  if (!label) {
    try { label = radioName(state.radio) || ''; } catch (e) { label = ''; }
  }
  return label || 'RADIO OFF';
}

function drawCarShape(ctx, x, y, angle, color, model) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color || '#c0c0c0';
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 2;
  if (model === 'van') {
    ctx.fillRect(-26, -13, 52, 26);
    ctx.strokeRect(-26, -13, 52, 26);
    ctx.fillStyle = 'rgba(180,220,255,0.85)';
    ctx.fillRect(8, -10, 12, 20);
  } else if (model === 'truck') {
    ctx.fillStyle = '#8a8f96';
    ctx.fillRect(-28, -13, 30, 26);
    ctx.strokeRect(-28, -13, 30, 26);
    ctx.fillStyle = color || '#c0c0c0';
    ctx.fillRect(2, -12, 24, 24);
    ctx.strokeRect(2, -12, 24, 24);
    ctx.fillStyle = 'rgba(180,220,255,0.85)';
    ctx.fillRect(14, -9, 8, 18);
  } else if (model === 'sport') {
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.lineTo(14, -11);
    ctx.lineTo(-14, -11);
    ctx.lineTo(-24, 0);
    ctx.lineTo(-14, 11);
    ctx.lineTo(14, 11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(20,20,30,0.85)';
    ctx.fillRect(-6, -8, 16, 16);
  } else {
    // sedan / taxi: classic rounded body + cabin.
    ctx.beginPath();
    ctx.roundRect(-23, -11, 46, 22, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(180,220,255,0.85)';
    ctx.fillRect(-4, -9, 14, 18);
    if (model === 'taxi') {
      ctx.fillStyle = '#111';
      for (let i = 0; i < 4; i++) ctx.fillRect(-20 + i * 10, -11, 5, 4);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(-2, -14, 10, 4);
    }
  }
  ctx.fillStyle = '#111';
  ctx.fillRect(-16, -13, 8, 4);
  ctx.fillRect(-16, 9, 8, 4);
  ctx.fillRect(10, -13, 8, 4);
  ctx.fillRect(10, 9, 8, 4);
  ctx.restore();
}

function drawBoat(ctx, boat) {
  ctx.save();
  ctx.translate(boat.x, boat.y);
  ctx.rotate(boat.angle || 0);
  const speed = Math.abs(boat.speed || 0);
  // Wake particles behind a moving boat.
  if (speed > 20) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(-26 - i * 10, (i % 2 ? 8 : -8), 3 + i, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = boat.color || '#fff';
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(30,60,90,0.7)';
  ctx.beginPath();
  ctx.ellipse(4, 0, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, shirt, skin, down) {
  ctx.save();
  ctx.translate(x, y);
  if (down) ctx.rotate(Math.PI / 2);
  ctx.rotate(angle || 0);
  ctx.fillStyle = skin || '#e8b98a';
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shirt || '#888';
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin || '#e8b98a';
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function moneyText(n) {
  return '$' + Math.round(n || 0).toLocaleString('en-US');
}

export function render(ctx, state, camera, ui) {
  const cam = camera || state.camera || { x: 0, y: 0 };
  const screen = (ui && ui.screen) || 'playing';
  const W = VIEW_W;
  const H = VIEW_H;
  ctx.clearRect(0, 0, W, H);

  // ---- World ----
  ctx.save();
  ctx.translate(-Math.round(cam.x), -Math.round(cam.y));

  // Ground: grass, beach, sea.
  ctx.fillStyle = '#3f7d3a';
  ctx.fillRect(cam.x - 20, cam.y - 20, W + 40, 2040 - cam.y + 20);
  ctx.fillStyle = '#e8d9a0';
  ctx.fillRect(cam.x - 20, 2020, W + 40, 90);
  ctx.fillStyle = '#1d6fb8';
  ctx.fillRect(cam.x - 20, 2100, W + 40, 80);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let x = 0; x < 2880; x += 180) {
    ctx.fillRect(x, 2108, 90, 3);
  }

  // Parks.
  try {
    for (const park of state.city.parks || []) {
      ctx.fillStyle = '#2f6b2e';
      ctx.fillRect(park.x, park.y, park.w || 200, park.h || 140);
      ctx.fillStyle = '#57a047';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(park.x + 30 + i * 36, park.y + 40 + (i % 2) * 50, 16, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } catch (e) {}

  // Roads (grid) + markings.
  ctx.fillStyle = '#3a3a3f';
  const roadXs = [180, 540, 900, 1260, 1620, 1980, 2340, 2700];
  const roadYs = [180, 540, 900, 1260, 1620, 1980];
  for (const x of roadXs) ctx.fillRect(x - 38, 0, 76, 2020);
  for (const y of roadYs) ctx.fillRect(0, y - 38, 2880, 76);
  ctx.strokeStyle = 'rgba(255,210,60,0.7)';
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 22]);
  for (const x of roadXs) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 2020); ctx.stroke();
  }
  for (const y of roadYs) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(2880, y); ctx.stroke();
  }
  ctx.setLineDash([]);

  // Buildings.
  try {
    for (const b of state.city.buildings || []) {
      ctx.fillStyle = b.color || '#6b6f7a';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,240,170,0.75)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 40));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if ((i + j) % 2 === 0) ctx.fillRect(b.x + 10 + i * 34, b.y + 10 + j * 40, 14, 18);
        }
      }
    }
  } catch (e) {}

  // Landmark labels.
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  try {
    const lms = state.city.landmarks || {};
    for (const key of Object.keys(lms)) {
      const lm = lms[key];
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(lm.x - 70, lm.y - 34, 140, 20);
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(lm.name || key, lm.x, lm.y - 20);
    }
  } catch (e) {}

  // Mission marker (pulsing).
  try {
    const marker = missionMarker(state);
    if (marker) {
      const pulse = 26 + 8 * Math.sin(state.time * 4);
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(marker.x, marker.y - 46);
      ctx.lineTo(marker.x - 10, marker.y - 26);
      ctx.lineTo(marker.x + 10, marker.y - 26);
      ctx.closePath();
      ctx.fill();
    }
  } catch (e) {}

  // Crates (M3).
  for (const c of state.crates || []) {
    if (c.taken) continue;
    ctx.fillStyle = '#a8763e';
    ctx.fillRect(c.x - 12, c.y - 12, 24, 24);
    ctx.strokeStyle = '#5e3d16';
    ctx.strokeRect(c.x - 12, c.y - 12, 24, 24);
    ctx.beginPath();
    ctx.moveTo(c.x - 12, c.y - 12); ctx.lineTo(c.x + 12, c.y + 12);
    ctx.moveTo(c.x + 12, c.y - 12); ctx.lineTo(c.x - 12, c.y + 12);
    ctx.stroke();
  }

  // Pickups.
  for (const pk of state.pickups || []) {
    if (pk.taken) continue;
    const bob = Math.sin((state.time || 0) * 3 + (pk.bob || 0)) * 3;
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#2fae4e';
      ctx.fillRect(pk.x - 10, pk.y - 7 + bob, 20, 14);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('$', pk.x, pk.y + 4 + bob);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(pk.x - 10, pk.y - 10 + bob, 20, 20);
      ctx.fillStyle = '#e33';
      ctx.fillRect(pk.x - 3, pk.y - 7 + bob, 6, 14);
      ctx.fillRect(pk.x - 7, pk.y - 3 + bob, 14, 6);
    } else {
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(pk.x - 8, pk.y - 8 + bob, 16, 16);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('AMMO', pk.x, pk.y + 3 + bob);
    }
  }

  // Solmar Coins (12 gold coins).
  try {
    for (const coin of (state.sideJobs && state.sideJobs.coins) || []) {
      if (coin.taken) continue;
      const bob = Math.sin((state.time || 0) * 3 + (coin.bob || 0)) * 3;
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(coin.x, coin.y + bob, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#8a6500';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('S', coin.x, coin.y + 4 + bob);
    }
  } catch (e) {}

  // Taxi fare: waiting passenger waves; riding stage shows the destination.
  try {
    const fare = state.sideJobs && state.sideJobs.fare;
    if (fare) {
      if (fare.stage === 'waiting') {
        ctx.fillStyle = '#ff5fa2';
        ctx.beginPath();
        ctx.arc(fare.x, fare.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(fare.x, fare.y, 20 + 4 * Math.sin(state.time * 5), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('TAXI $' + (fare.pay || 0), fare.x, fare.y - 28);
      } else if (fare.stage === 'riding') {
        // Passenger is in the car — mark the destination instead.
        ctx.strokeStyle = '#ff5fa2';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(fare.destX, fare.destY, 24 + 5 * Math.sin(state.time * 5), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ff5fa2';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('DROP OFF: ' + (fare.destName || 'destination'), fare.destX, fare.destY - 32);
        if (typeof fare.timeLeft === 'number') {
          ctx.fillStyle = '#fff';
          ctx.fillText(Math.ceil(fare.timeLeft) + 's', fare.destX, fare.destY + 40);
        }
      }
    }
    const fm = typeof fareMarker === 'function' ? fareMarker(state) : null;
    if (fm && !(state.sideJobs && state.sideJobs.fare)) {
      ctx.strokeStyle = '#ff5fa2';
      ctx.beginPath();
      ctx.arc(fm.x, fm.y, fm.r || 40, 0, Math.PI * 2);
      ctx.stroke();
    }
  } catch (e) {}

  // Boats (replaces any fixed decorative boats).
  for (const boat of state.boats || []) drawBoat(ctx, boat);

  // Traffic cars + pedestrians.
  try {
    for (const car of (state.traffic && state.traffic.cars) || []) {
      drawCarShape(ctx, car.x, car.y, car.angle, car.color, car.model);
    }
    for (const ped of (state.traffic && state.traffic.peds) || []) {
      if (ped.down) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(ped.x, ped.y, 12, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        drawPerson(ctx, ped.x, ped.y, 0, ped.shirt, ped.skin, true);
      } else {
        drawPerson(ctx, ped.x, ped.y, ped.angle, ped.shirt, ped.skin, false);
      }
    }
  } catch (e) {}

  // Police cars (roadblocks drawn parked, with a barrier stripe).
  try {
    for (const car of (state.police && state.police.cars) || []) {
      drawCarShape(ctx, car.x, car.y, car.angle, '#1c4fd6', 'sedan');
      if (car.roadblock) {
        ctx.fillStyle = 'rgba(255,210,60,0.9)';
        ctx.fillRect(car.x - 30, car.y - 4, 60, 8);
      }
    }
  } catch (e) {}

  // Police heli + spotlight (4–5 stars).
  try {
    const heli = state.police2 && state.police2.heli;
    const spot = typeof heliSpotlight === 'function' ? heliSpotlight(state) : null;
    if (spot) {
      ctx.fillStyle = 'rgba(255,240,160,0.20)';
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, spot.r || 130, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,160,0.6)';
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, spot.r || 130, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (heli) {
      ctx.save();
      ctx.translate(heli.x, heli.y);
      ctx.fillStyle = '#223';
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 3;
      const rotor = heli.rotor || 0;
      ctx.beginPath();
      ctx.moveTo(Math.cos(rotor) * 40, Math.sin(rotor) * 40);
      ctx.lineTo(-Math.cos(rotor) * 40, -Math.sin(rotor) * 40);
      ctx.stroke();
      ctx.restore();
    }
  } catch (e) {}

  // Enemies.
  try {
    for (const e of (state.combat && state.combat.enemies) || []) {
      drawPerson(ctx, e.x, e.y, e.angle, e.shirt || '#7a2d8f', e.skin, false);
      ctx.fillStyle = '#c00';
      ctx.fillRect(e.x - 14, e.y - 22, 28, 5);
      ctx.fillStyle = '#3f3';
      ctx.fillRect(e.x - 14, e.y - 22, 28 * clamp((e.hp || 0) / 100, 0, 1), 5);
    }
    // Bullets.
    ctx.fillStyle = '#ffe14d';
    for (const b of (state.combat && state.combat.bullets) || []) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } catch (e) {}

  // Tyre smoke (handbrake).
  for (const s of state.smoke || []) {
    ctx.fillStyle = 'rgba(200,200,200,' + clamp(s.life / (s.max || 0.5), 0, 1) * 0.7 + ')';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player (foot / car / boat).
  const p = state.player;
  if (p.inCar && p.car) {
    drawCarShape(ctx, p.car.x, p.car.y, p.car.angle, '#e33', 'sport');
  } else if (p.inBoat && p.boat) {
    // Player rides the boat already drawn above; add a marker ring.
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 34, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const blink = p.invuln > 0 && Math.floor(state.time * 10) % 2 === 0;
    if (!blink) drawPerson(ctx, p.x, p.y, p.aimAngle, '#2f7de1', '#e8b98a', false);
    // Aim line.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.aimAngle) * 30, p.y + Math.sin(p.aimAngle) * 30);
    ctx.stroke();
  }

  ctx.restore();

  // ---- HUD ----
  ctx.textAlign = 'left';
  ctx.font = 'bold 18px sans-serif';
  // Top-left panel: money, radio, coins.
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(12, 12, 320, 96);
  ctx.fillStyle = '#7dff8a';
  ctx.fillText(moneyText(state.money), 24, 38);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('♪ ' + radioLabel(state), 24, 62);
  let jobsLine = '';
  try { jobsLine = sideJobsText(state) || ''; } catch (e) {}
  if (!jobsLine && state.sideJobs) {
    jobsLine = 'Coins ' + (state.sideJobs.coinsFound || 0) + '/12';
  }
  ctx.fillStyle = '#fff';
  ctx.fillText(jobsLine, 24, 86);

  // Wanted stars (top-right).
  const wanted = (state.police && state.police.wanted) || 0;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(W - 210, 12, 198, 44);
  ctx.font = '28px sans-serif';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('★'.repeat(wanted) + '☆'.repeat(5 - wanted), W - 198, 44);

  // Health / ammo (bottom-left).
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(12, H - 56, 260, 44);
  ctx.fillStyle = '#ff5f5f';
  ctx.fillRect(24, H - 42, 120 * clamp(p.hp / 100, 0, 1), 12);
  ctx.strokeStyle = '#fff';
  ctx.strokeRect(24, H - 42, 120, 12);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('HP ' + Math.ceil(p.hp) + '   AMMO ' + p.ammo, 152, H - 30);

  // Boat speed (bottom-right, only in a boat).
  if (p.inBoat && p.boat) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(W - 220, H - 56, 208, 44);
    ctx.fillStyle = '#7dd7ff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('BOAT ' + Math.round(Math.abs(p.boat.speed || 0)) + ' kn', W - 208, H - 28);
  }

  // Mission panel (bottom-center).
  try {
    const def = state.currentMission;
    const obj = currentObjective(state);
    if (def && obj) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      const text = def.id + ' ' + def.title + ' — ' + obj.text;
      const w = Math.min(W - 40, 26 + ctx.measureText(text).width);
      ctx.fillRect((W - w) / 2, H - 96, w, 30);
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(text, W / 2, H - 75);
      ctx.textAlign = 'left';
    } else if (state.storyComplete) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(W / 2 - 220, H - 96, 440, 30);
      ctx.fillStyle = '#7dff8a';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('STORY COMPLETE — You are the King of Solmar!', W / 2, H - 75);
      ctx.textAlign = 'left';
    }
  } catch (e) {}

  // Prompt line (E to interact etc.).
  if (ui && ui.prompt) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    const w = 26 + ctx.measureText(ui.prompt).width;
    ctx.fillRect((W - w) / 2, H - 140, w, 30);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ui.prompt, W / 2, H - 119);
    ctx.textAlign = 'left';
  }

  // Banner (mission complete / busted / story).
  if (ui && ui.banner) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(W / 2 - 260, 120, 520, 54);
    ctx.fillStyle = '#7dff8a';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ui.banner, W / 2, 155);
    ctx.textAlign = 'left';
  }

  // How-to line.
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(12, H - 100, 560, 26);
  ctx.fillStyle = '#ddd';
  ctx.font = '13px sans-serif';
  ctx.fillText('WASD move • Mouse aim/shoot • E interact / board boat • Q radio • Space punch / handbrake', 20, H - 82);

  // ---- Screens ----
  if (screen === 'title') {
    ctx.fillStyle = 'rgba(8,12,28,0.88)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SOLMAR CITY', W / 2, 200);
    ctx.fillStyle = '#7dd7ff';
    ctx.font = '22px sans-serif';
    ctx.fillText('An open-world crime game — 12 story missions, boats, radio, taxis', W / 2, 250);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('Press Enter or click New Game to play.', W / 2, 330);
    if (ui && ui.saveText) {
      ctx.fillStyle = '#7dff8a';
      ctx.fillText('Continue: ' + ui.saveText, W / 2, 370);
    }
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('[ NEW GAME ]', W / 2, 450);
    ctx.textAlign = 'left';
  } else if (screen === 'paused') {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', W / 2, H / 2);
    ctx.font = '18px sans-serif';
    ctx.fillText('P / Esc to resume — M mute — Q radio', W / 2, H / 2 + 40);
    ctx.textAlign = 'left';
  } else if (screen === 'dead' || screen === 'busted') {
    ctx.fillStyle = 'rgba(40,0,0,0.65)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff5f5f';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(screen === 'dead' ? 'WASTED' : 'BUSTED', W / 2, H / 2);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('Press Enter to get back on your feet.', W / 2, H / 2 + 40);
    ctx.textAlign = 'left';
  } else if (screen === 'complete') {
    ctx.fillStyle = 'rgba(0,30,10,0.75)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#7dff8a';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KING OF SOLMAR', W / 2, H / 2 - 20);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText('All 12 missions done — $34,650 in story payouts. The city is yours.', W / 2, H / 2 + 30);
    ctx.fillText('Press Enter to keep playing.', W / 2, H / 2 + 70);
    ctx.textAlign = 'left';
  }
}

export { drawCarShape };
