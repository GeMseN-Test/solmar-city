// Solmar City — render.js: everything the player sees.
//
// One canvas, two passes: the world (translated by the camera) and then
// the HUD (fixed to the screen). Also draws the title screen, the pause
// overlay, and the WASTED / BUSTED / mission banners.
//
// The camera is owned by world.js (state.camera). NOTE: the caller here
// does the translate exactly once — drawGround / drawLandmarks work in
// WORLD coordinates, never subtract the camera again.

import { currentObjective, objectiveProgress, missionMarker, interactPrompt } from './missions.js';
import * as Police2Mod from './police2.js';
import * as RadioMod from './radio.js';

export const VIEW_W = 1280;
export const VIEW_H = 800;

const WORLD_W = 2880;
const WORLD_H = 2160;
const SEA_TOP = 2100;
const BEACH_TOP = 2020;

// --- small helpers ----------------------------------------------------------

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function fmtMoney(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// --- car + boat shapes ------------------------------------------------------

const MODEL_SIZE = {
  sedan: { l: 46, w: 22 },
  taxi: { l: 46, w: 22 },
  sport: { l: 48, w: 21 },
  van: { l: 54, w: 24 },
  truck: { l: 62, w: 24 },
};

function drawCarShape(ctx, x, y, angle, color, model, isPolice) {
  const size = MODEL_SIZE[model] || MODEL_SIZE.sedan;
  const l = size.l;
  const w = size.w;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, -l / 2 + 2, -w / 2 + 3, l, w, 7);
  ctx.fill();

  if (model === 'truck') {
    // Cab + boxy trailer.
    ctx.fillStyle = color || '#8a8f96';
    roundRect(ctx, -l / 2, -w / 2, l * 0.62, w, 4);
    ctx.fill();
    ctx.fillStyle = '#5d6770';
    roundRect(ctx, l * 0.12, -w / 2, l * 0.38, w, 4);
    ctx.fill();
    ctx.fillStyle = '#9fb4c8';
    ctx.fillRect(l * 0.28, -w / 2 + 3, 8, w - 6);
  } else if (model === 'van') {
    ctx.fillStyle = color || '#7a7f85';
    roundRect(ctx, -l / 2, -w / 2, l, w, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,30,45,0.85)';
    roundRect(ctx, -l / 2 + 6, -w / 2 + 3, l * 0.42, w - 6, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,30,45,0.55)';
    roundRect(ctx, l * 0.08, -w / 2 + 3, l * 0.3, w - 6, 4);
    ctx.fill();
  } else {
    // Sedan / taxi / sport body.
    ctx.fillStyle = color || '#b03a3a';
    roundRect(ctx, -l / 2, -w / 2, l, w, 8);
    ctx.fill();
    // Cabin + windows.
    ctx.fillStyle = 'rgba(18,28,42,0.9)';
    const cabL = model === 'sport' ? l * 0.34 : l * 0.4;
    roundRect(ctx, -cabL / 2 - 2, -w / 2 + 3.5, cabL, w - 7, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,200,230,0.7)';
    ctx.fillRect(-cabL / 2 + 1, -w / 2 + 5, 3, w - 10);
    if (model === 'sport') {
      // Spoiler + racing stripe.
      ctx.fillStyle = '#222';
      ctx.fillRect(-l / 2 - 2, -w / 2 + 1, 4, w - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(-l / 2 + 4, -2, l - 8, 4);
    }
    if (model === 'taxi') {
      ctx.fillStyle = '#f7c948';
      ctx.fillRect(-l / 2 + 2, -w / 2, l - 4, 4);
      ctx.fillRect(-l / 2 + 2, w / 2 - 4, l - 4, 4);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
    }
  }

  // Headlights + taillights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(l / 2 - 2, -w / 2 + 2, 2, 4);
  ctx.fillRect(l / 2 - 2, w / 2 - 6, 2, 4);
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(-l / 2, -w / 2 + 2, 2, 4);
  ctx.fillRect(-l / 2, w / 2 - 6, 2, 4);

  if (isPolice) {
    // Black-and-white cruiser + light bar.
    ctx.fillStyle = '#f2f2f2';
    roundRect(ctx, -l / 2 + 6, -w / 2, l * 0.42, w, 6);
    ctx.fill();
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-4, -w / 2 - 1, 4, 4);
    ctx.fillStyle = '#2f7fe0';
    ctx.fillRect(0, -w / 2 - 1, 4, 4);
  }
  ctx.restore();
}

function drawBoatShape(ctx, x, y, angle, color, kind) {
  const l = kind === 'yacht' ? 92 : kind === 'jetski' ? 44 : 66;
  const w = kind === 'yacht' ? 30 : kind === 'jetski' ? 18 : 26;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 3, l / 2, w / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hull.
  ctx.fillStyle = color || '#e8e8e8';
  ctx.beginPath();
  ctx.ellipse(0, 0, l / 2, w / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Deck / cabin.
  if (kind === 'yacht') {
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, -l * 0.28, -w * 0.32, l * 0.5, w * 0.64, 6);
    ctx.fill();
    ctx.fillStyle = '#2c4a63';
    roundRect(ctx, -l * 0.2, -w * 0.22, l * 0.3, w * 0.44, 4);
    ctx.fill();
  } else if (kind === 'jetski') {
    ctx.fillStyle = '#222';
    roundRect(ctx, -l * 0.2, -w * 0.3, l * 0.4, w * 0.6, 4);
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    roundRect(ctx, -l * 0.22, -w * 0.3, l * 0.36, w * 0.6, 5);
    ctx.fill();
    ctx.fillStyle = '#2c4a63';
    ctx.fillRect(l * 0.05, -w * 0.3, 4, w * 0.6);
  }
  ctx.restore();
}

// --- world pass -------------------------------------------------------------

function drawGround(ctx, state, cam, vw, vh) {
  const x0 = cam.x - vw / 2 - 40;
  const y0 = cam.y - vh / 2 - 40;
  const x1 = cam.x + vw / 2 + 40;
  const y1 = cam.y + vh / 2 + 40;

  // Grass.
  ctx.fillStyle = '#2c4a2e';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  // Roads: verticals x = 180..2700 step 360, horizontals y = 180..1980.
  ctx.fillStyle = '#3a3a40';
  for (let x = 180; x <= 2700; x += 360) {
    ctx.fillRect(x - 38, Math.max(y0, 0), 76, Math.min(y1, BEACH_TOP) - Math.max(y0, 0));
  }
  for (let y = 180; y <= 1980; y += 360) {
    ctx.fillRect(Math.max(x0, 0), y - 38, Math.min(x1, WORLD_W) - Math.max(x0, 0), 76);
  }
  // Centre dashes.
  ctx.fillStyle = '#c8b25a';
  for (let x = 180; x <= 2700; x += 360) {
    for (let y = 120; y < BEACH_TOP; y += 60) {
      if (Math.abs(((y - 180) % 360) - 180) > 38) ctx.fillRect(x - 2, y, 4, 26);
    }
  }
  for (let y = 180; y <= 1980; y += 360) {
    for (let x = 120; x < WORLD_W; x += 60) {
      if (Math.abs(((x - 180) % 360) - 180) > 38) ctx.fillRect(x, y - 2, 26, 4);
    }
  }

  // Beach, then the sea.
  ctx.fillStyle = '#c2a878';
  ctx.fillRect(Math.max(x0, 0), BEACH_TOP, Math.min(x1, WORLD_W) - Math.max(x0, 0), SEA_TOP - BEACH_TOP);
  const seaGrad = ctx.createLinearGradient(0, SEA_TOP, 0, WORLD_H);
  seaGrad.addColorStop(0, '#1b5a7a');
  seaGrad.addColorStop(1, '#0e3a56');
  ctx.fillStyle = seaGrad;
  ctx.fillRect(Math.max(x0, 0), SEA_TOP, Math.min(x1, WORLD_W) - Math.max(x0, 0), WORLD_H - SEA_TOP);
  // Gentle waves.
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  const t = (state.playTime || 0) * 0.7;
  for (let yy = SEA_TOP + 24; yy < WORLD_H; yy += 36) {
    ctx.beginPath();
    for (let xx = Math.max(x0, 0); xx <= Math.min(x1, WORLD_W); xx += 48) {
      const wy = yy + Math.sin(xx * 0.02 + t + yy) * 3;
      if (xx === Math.max(x0, 0)) ctx.moveTo(xx, wy);
      else ctx.lineTo(xx, wy);
    }
    ctx.stroke();
  }
}

function drawParks(ctx, state) {
  const parks = (state.city && state.city.parks) || [];
  for (const park of parks) {
    const w = park.w || park.width || 200;
    const h = park.h || park.height || 140;
    ctx.fillStyle = '#3f7a37';
    roundRect(ctx, park.x - w / 2, park.y - h / 2, w, h, 10);
    ctx.fill();
    ctx.fillStyle = '#2c5c26';
    for (let i = 0; i < 5; i++) {
      const tx = park.x - w / 2 + 24 + ((i * 37) % Math.max(20, w - 48));
      const ty = park.y - h / 2 + 22 + ((i * 53) % Math.max(20, h - 44));
      ctx.beginPath();
      ctx.arc(tx, ty, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBuildings(ctx, state) {
  const buildings = (state.city && state.city.buildings) || [];
  for (const b of buildings) {
    const w = b.w || b.width || 120;
    const h = b.h || b.height || 90;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x - w / 2 + 4, b.y - h / 2 + 5, w, h);
    ctx.fillStyle = b.color || '#6b5a4a';
    ctx.fillRect(b.x - w / 2, b.y - h / 2, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x - w / 2, b.y - h / 2, w, h);
    // Roof detail.
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(b.x - w / 2 + 8, b.y - h / 2 + 8, w - 16, h * 0.3);
  }
}

function drawLandmarks(ctx, state) {
  const landmarks = (state.city && state.city.landmarks) || {};
  ctx.textAlign = 'center';
  for (const key of Object.keys(landmarks)) {
    const lm = landmarks[key];
    const label = lm.name || lm.label || key;
    ctx.fillStyle = '#f7c948';
    ctx.beginPath();
    ctx.arc(lm.x, lm.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('★', lm.x, lm.y + 4);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(label, lm.x, lm.y - 16);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.fillText(label, lm.x, lm.y - 17);
  }
}

function drawPickups(ctx, state) {
  const t = state.playTime || 0;
  for (const pk of state.pickups || []) {
    if (pk.taken) continue;
    const bob = Math.sin(t * 3 + (pk.bob || 0)) * 2;
    const y = pk.y + bob;
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#37b24d';
      ctx.beginPath();
      ctx.arc(pk.x, y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', pk.x, y + 4);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#fff';
      roundRect(ctx, pk.x - 10, y - 10, 20, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#e03131';
      ctx.fillRect(pk.x - 2, y - 7, 4, 14);
      ctx.fillRect(pk.x - 7, y - 2, 14, 4);
    } else {
      ctx.fillStyle = '#f7c948';
      roundRect(ctx, pk.x - 10, y - 7, 20, 14, 3);
      ctx.fill();
      ctx.fillStyle = '#7a5b00';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AMMO', pk.x, y + 3);
    }
  }
}

function drawCoins(ctx, state) {
  const sj = state.sideJobs;
  if (!sj || !Array.isArray(sj.coins)) return;
  const t = state.playTime || 0;
  for (const coin of sj.coins) {
    if (coin.taken) continue;
    const bob = Math.sin(t * 2.5 + (coin.bob || 0)) * 3;
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath();
    ctx.arc(coin.x, coin.y + bob, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a87b00';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#a87b00';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('S', coin.x, coin.y + bob + 3.5);
  }
}

function drawCrates(ctx, state) {
  for (const crate of state.crates || []) {
    if (crate.taken) continue;
    ctx.fillStyle = '#8a6d3b';
    ctx.fillRect(crate.x - 12, crate.y - 12, 24, 24);
    ctx.strokeStyle = '#5d4620';
    ctx.lineWidth = 2;
    ctx.strokeRect(crate.x - 12, crate.y - 12, 24, 24);
    ctx.beginPath();
    ctx.moveTo(crate.x - 12, crate.y - 12);
    ctx.lineTo(crate.x + 12, crate.y + 12);
    ctx.moveTo(crate.x + 12, crate.y - 12);
    ctx.lineTo(crate.x - 12, crate.y + 12);
    ctx.stroke();
  }
}

function drawTraffic(ctx, state) {
  const traffic = state.traffic;
  if (!traffic) return;
  for (const car of traffic.cars || []) {
    drawCarShape(ctx, car.x, car.y, car.angle, car.color, car.model, false);
  }
  for (const ped of traffic.peds || []) {
    if (ped.down) {
      // Knocked down: lying flat.
      ctx.fillStyle = ped.skin || '#c98d64';
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 12, 6, ped.angle || 0, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    const bob = Math.sin((state.playTime || 0) * 6 + (ped.stepPhase || 0)) * 1.5;
    ctx.fillStyle = ped.skin || '#c98d64';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y + bob, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt || '#4a6fa5';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y + bob + 2, 9, 0, Math.PI * 2);
    ctx.fill();
    if (ped.panic) {
      ctx.fillStyle = '#ff0000';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', ped.x, ped.y - 14);
    }
  }
}

function drawPolice(ctx, state) {
  const police = state.police;
  if (!police) return;
  for (const car of police.cars || []) {
    drawCarShape(ctx, car.x, car.y, car.angle, car.color || '#22303e', car.model || 'sedan', true);
    if (car.roadblock) {
      ctx.fillStyle = 'rgba(247,201,72,0.9)';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ROADBLOCK', car.x, car.y - 22);
    }
  }
  // Helicopter + spotlight.
  const p2 = state.police2;
  if (p2 && p2.heli) {
    const heli = p2.heli;
    let spot = null;
    if (typeof Police2Mod.heliSpotlight === 'function') {
      try {
        spot = Police2Mod.heliSpotlight(state);
      } catch (e) {
        spot = null;
      }
    }
    if (!spot) spot = { x: state.player.x, y: state.player.y, r: 130 };
    const grad = ctx.createRadialGradient(spot.x, spot.y, 10, spot.x, spot.y, spot.r);
    grad.addColorStop(0, 'rgba(255,244,180,0.35)');
    grad.addColorStop(1, 'rgba(255,244,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, spot.r, 0, Math.PI * 2);
    ctx.fill();
    // Heli body + spinning rotor.
    ctx.save();
    ctx.translate(heli.x, heli.y);
    ctx.rotate(heli.angle || 0);
    ctx.fillStyle = '#22303e';
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9fb4c8';
    ctx.beginPath();
    ctx.arc(10, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    const rotor = (heli.rotor || 0) + (state.playTime || 0) * 20;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-34 * Math.cos(rotor), -34 * Math.sin(rotor));
    ctx.lineTo(34 * Math.cos(rotor), 34 * Math.sin(rotor));
    ctx.stroke();
    ctx.restore();
  }
}

function drawBoats(ctx, state) {
  for (const boat of state.boats || []) {
    // Wake while moving.
    if (boat.speed && Math.abs(boat.speed) > 30) {
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 3;
      const bx = boat.x - Math.cos(boat.angle) * 40;
      const by = boat.y - Math.sin(boat.angle) * 40;
      ctx.beginPath();
      ctx.moveTo(bx, by - 12);
      ctx.lineTo(bx - 26, by - 20);
      ctx.moveTo(bx, by + 12);
      ctx.lineTo(bx - 26, by + 20);
      ctx.stroke();
    }
    drawBoatShape(ctx, boat.x, boat.y, boat.angle, boat.color, boat.kind);
  }
}

function drawCombat(ctx, state) {
  const combat = state.combat;
  if (!combat) return;
  for (const e of combat.enemies || []) {
    const bob = Math.sin((state.playTime || 0) * 5 + (e.x % 7)) * 1;
    ctx.fillStyle = e.skin || '#c98d64';
    ctx.beginPath();
    ctx.arc(e.x, e.y + bob, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = e.shirt || '#7a2d8f';
    ctx.beginPath();
    ctx.arc(e.x, e.y + bob + 2, 10, 0, Math.PI * 2);
    ctx.fill();
    // Gun pointing at the player.
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x + Math.cos(e.angle || 0) * 16, e.y + Math.sin(e.angle || 0) * 16);
    ctx.stroke();
    // HP bar.
    const hpFrac = clamp((e.hp || 0) / 100, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(e.x - 14, e.y - 24, 28, 5);
    ctx.fillStyle = hpFrac > 0.5 ? '#37b24d' : '#e03131';
    ctx.fillRect(e.x - 14, e.y - 24, 28 * hpFrac, 5);
  }
  for (const b of combat.bullets || []) {
    ctx.strokeStyle = b.friendly === false ? '#ff6b6b' : '#ffe066';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - Math.cos(b.angle || 0) * 10, b.y - Math.sin(b.angle || 0) * 10);
    ctx.stroke();
  }
}

function drawFare(ctx, state) {
  const sj = state.sideJobs;
  if (!sj || !sj.fare) return;
  const fare = sj.fare;
  const t = state.playTime || 0;
  if (fare.stage === 'waiting') {
    // Waving passenger.
    const wave = Math.sin(t * 8) * 4;
    ctx.fillStyle = '#c98d64';
    ctx.beginPath();
    ctx.arc(fare.x, fare.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2f9e44';
    ctx.beginPath();
    ctx.arc(fare.x, fare.y + 2, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c98d64';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(fare.x + 6, fare.y - 4);
    ctx.lineTo(fare.x + 14, fare.y - 14 + wave);
    ctx.stroke();
    ctx.fillStyle = '#f7c948';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', fare.x, fare.y - 20);
  } else if (fare.stage === 'delivering' || fare.stage === 'riding') {
    // Destination flag (the fare module calls this stage 'riding').
    ctx.fillStyle = '#f7c948';
    ctx.beginPath();
    ctx.arc(fare.destX, fare.destY, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', fare.destX, fare.destY + 4);
    ctx.strokeStyle = '#f7c948';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(fare.destX, fare.destY, 20 + Math.sin(t * 4) * 4, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPlayer(ctx, state) {
  const p = state.player;
  if (p.inCar && p.car) {
    drawCarShape(ctx, p.car.x, p.car.y, p.car.angle, p.car.color, p.car.model, false);
    // Handbrake smoke.
    if (state.handbrakeSmoke > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(
          p.car.x - Math.cos(p.car.angle) * 24 + (i - 1.5) * 8,
          p.car.y - Math.sin(p.car.angle) * 24 + (i % 2 ? 8 : -8),
          6 + i * 2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    return;
  }
  if (p.inBoat && p.boat) {
    drawBoatShape(ctx, p.boat.x, p.boat.y, p.boat.angle, p.boat.color, p.boat.kind);
    return;
  }
  // On foot: Mara Voss, gun in hand.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(p.x + 2, p.y + 3, 12, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c98d64';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e03131';
  ctx.beginPath();
  ctx.arc(p.x, p.y + 2, 10, 0, Math.PI * 2);
  ctx.fill();
  // Gun barrel toward the aim.
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + Math.cos(p.aimAngle) * 20, p.y + Math.sin(p.aimAngle) * 20);
  ctx.stroke();
  if (p.invuln > 0 && Math.floor((state.playTime || 0) * 8) % 2 === 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawMissionMarker(ctx, state, cam, vw, vh) {
  const marker = missionMarker(state);
  if (!marker) return;
  const p = state.player;
  const d = dist(p.x, p.y, marker.x, marker.y);
  const t = state.playTime || 0;
  // Pulsing ring on the target itself.
  ctx.strokeStyle = '#f7c948';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, 26 + Math.sin(t * 4) * 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#f7c948';
  ctx.beginPath();
  ctx.moveTo(marker.x, marker.y - 34);
  ctx.lineTo(marker.x - 8, marker.y - 48);
  ctx.lineTo(marker.x + 8, marker.y - 48);
  ctx.closePath();
  ctx.fill();
  // Edge arrow when the target is off-screen.
  const sx = marker.x - cam.x + vw / 2;
  const sy = marker.y - cam.y + vh / 2;
  if (sx < 30 || sx > vw - 30 || sy < 30 || sy > vh - 30) {
    const ang = Math.atan2(marker.y - p.y, marker.x - p.x);
    const ax = vw / 2 + Math.cos(ang) * (Math.min(vw, vh) / 2 - 60);
    const ay = vh / 2 + Math.sin(ang) * (Math.min(vw, vh) / 2 - 60);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    ctx.fillStyle = '#f7c948';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#f7c948';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(d) + 'm', ax, ay + 26);
  }
}

// --- HUD --------------------------------------------------------------------

function drawHUD(ctx, state, ui, vw, vh) {
  const p = state.player;
  // Top-left panel: cash, health, ammo, stars, radio, coins.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, 12, 12, 250, 150, 10);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#37b24d';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(fmtMoney(state.money), 24, 40);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  roundRect(ctx, 24, 50, 150, 12, 6);
  ctx.fill();
  ctx.fillStyle = p.hp > 50 ? '#37b24d' : p.hp > 25 ? '#f7c948' : '#e03131';
  roundRect(ctx, 24, 50, 150 * clamp(p.hp / 100, 0, 1), 12, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  ctx.fillText('HP ' + Math.ceil(p.hp), 180, 60);
  // Ammo.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('Ammo ' + p.ammo, 24, 84);
  // Wanted stars.
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < (state.wanted || 0) ? '★' : '☆';
  ctx.fillStyle = '#ffd43b';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(stars, 24, 108);
  // Radio line.
  let radioText = '♪ Radio off';
  if (state.radio) {
    const name =
      typeof RadioMod.radioName === 'function'
        ? RadioMod.radioName(state.radio)
        : 'SOLMAR FM';
    radioText = '♪ ' + name;
  }
  ctx.fillStyle = '#9fb4c8';
  ctx.font = '12px sans-serif';
  ctx.fillText(radioText, 24, 130);
  // Coins + fares.
  const sj = state.sideJobs;
  if (sj) {
    const coins = (sj.coinsFound || 0) + '/' + ((sj.coins && sj.coins.length) || 12);
    ctx.fillStyle = '#ffd43b';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('Coins ' + coins + '  •  Fares $' + (sj.faresEarned || 0), 24, 148);
  }

  // Objective bar (bottom centre).
  const obj = currentObjective(state);
  if (obj && state.mission) {
    const def = state.mission.def;
    const marker = missionMarker(state);
    const d = marker ? Math.round(dist(p.x, p.y, marker.x, marker.y)) : 0;
    const text =
      def.id + ' ' + def.title + ' — ' + obj.text + objectiveProgress(state) +
      (marker ? '  •  ' + d + 'm' : '') + '  •  ' + fmtMoney(def.reward);
    ctx.font = 'bold 15px sans-serif';
    const tw = ctx.measureText(text).width + 28;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, (vw - tw) / 2, vh - 86, tw, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#f7c948';
    ctx.textAlign = 'center';
    ctx.fillText(text, vw / 2, vh - 63);
  }

  // Prompt line (E — ...).
  const prompt = interactPrompt(state);
  if (prompt) {
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(prompt, vw / 2, vh - 96);
  }

  // Speed (bottom right).
  let speed = 0;
  if (p.inCar && p.car) speed = Math.abs(p.car.speed || 0);
  else if (p.inBoat && p.boat) speed = Math.abs(p.boat.speed || 0);
  else speed = p.speed || 0;
  const kmh = Math.round(speed * 0.18);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, vw - 128, vh - 64, 116, 52, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(kmh + '', vw - 40, vh - 32);
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#9fb4c8';
  ctx.fillText(p.inBoat ? 'kn' : 'km/h', vw - 40, vh - 16);
  if (p.inBoat) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#9fb4c8';
    ctx.font = '11px sans-serif';
    ctx.fillText('BOAT', vw - 92, vh - 32);
  }

  // Controls hint (bottom left).
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, 12, vh - 64, 330, 52, 10);
  ctx.fill();
  ctx.fillStyle = '#cfd8e3';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WASD move / drive  •  E interact  •  Q radio', 22, vh - 44);
  ctx.fillText('Space punch / handbrake  •  Click shoot  •  P pause  •  M mute', 22, vh - 26);

  // Minimap (top right).
  const mw = 200;
  const mh = 150;
  const mx = vw - mw - 12;
  const my = 12;
  const sx = mw / WORLD_W;
  const sy = mh / WORLD_H;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(ctx, mx - 4, my - 4, mw + 8, mh + 8, 8);
  ctx.fill();
  ctx.fillStyle = '#2c4a2e';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#1b5a7a';
  ctx.fillRect(mx, my + SEA_TOP * sy, mw, mh - SEA_TOP * sy);
  ctx.fillStyle = '#c2a878';
  ctx.fillRect(mx, my + BEACH_TOP * sy, mw, (SEA_TOP - BEACH_TOP) * sy);
  const landmarks = (state.city && state.city.landmarks) || {};
  ctx.fillStyle = '#f7c948';
  for (const key of Object.keys(landmarks)) {
    ctx.fillRect(mx + landmarks[key].x * sx - 2, my + landmarks[key].y * sy - 2, 4, 4);
  }
  const marker = missionMarker(state);
  if (marker) {
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.arc(mx + marker.x * sx, my + marker.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(mx + p.x * sx, my + p.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(mx + p.x * sx, my + p.y * sy, 7, 0, Math.PI * 2);
  ctx.stroke();
  if (state.police && state.police.cars) {
    ctx.fillStyle = '#4a90e2';
    for (const cop of state.police.cars) {
      ctx.fillRect(mx + cop.x * sx - 2, my + cop.y * sy - 2, 4, 4);
    }
  }

  // Banner (mission complete / story complete).
  if (ui && ui.banner && ui.banner.until > (state.playTime || 0)) {
    const b = ui.banner;
    ctx.font = 'bold 26px sans-serif';
    const tw = ctx.measureText(b.text).width + 44;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    roundRect(ctx, (vw - tw) / 2, 150, tw, 52, 10);
    ctx.fill();
    ctx.fillStyle = b.color || '#f7c948';
    ctx.textAlign = 'center';
    ctx.fillText(b.text, vw / 2, 185);
    if (b.sub) {
      ctx.fillStyle = '#fff';
      ctx.font = '15px sans-serif';
      ctx.fillText(b.sub, vw / 2, 208);
    }
  }

  // WASTED / BUSTED overlay.
  if (ui && ui.overlay && ui.overlay.until > (state.playTime || 0)) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.fillStyle = ui.overlay.color || '#e03131';
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ui.overlay.text, vw / 2, vh / 2);
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText(ui.overlay.sub || '', vw / 2, vh / 2 + 36);
  }
}

// --- title / pause ----------------------------------------------------------

export function titleButtons(vw, vh) {
  return {
    newGame: { x: vw / 2 - 130, y: vh / 2 + 30, w: 260, h: 52 },
    cont: { x: vw / 2 - 130, y: vh / 2 + 96, w: 260, h: 52 },
  };
}

function drawTitle(ctx, state, ui, vw, vh) {
  // Night-city backdrop: deep blue + skyline blocks + stars.
  const grad = ctx.createLinearGradient(0, 0, 0, vh);
  grad.addColorStop(0, '#0b1e33');
  grad.addColorStop(1, '#123a5c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 60; i++) {
    const sx = (i * 173) % vw;
    const sy = (i * 97) % 220;
    ctx.globalAlpha = 0.3 + ((i * 7) % 10) / 20;
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#0a1626';
  for (let i = 0; i < 14; i++) {
    const bw = 60 + ((i * 53) % 70);
    const bh = 120 + ((i * 89) % 180);
    ctx.fillRect(i * 96 - 20, vh - bh - 90, bw, bh);
  }
  ctx.fillStyle = '#f7c948';
  for (let i = 0; i < 40; i++) {
    const wx = (i * 211) % vw;
    const wy = vh - 90 - ((i * 131) % 240);
    ctx.globalAlpha = 0.5;
    ctx.fillRect(wx, wy, 3, 4);
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f7c948';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText('SOLMAR CITY', vw / 2, vh / 2 - 110);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText('An open-world crime game — steal, drive, sail, and take the crown.', vw / 2, vh / 2 - 70);
  ctx.fillStyle = '#9fb4c8';
  ctx.font = '15px sans-serif';
  ctx.fillText('12 story missions  •  5 radio stations  •  6 boats  •  taxi fares  •  Solmar Coins', vw / 2, vh / 2 - 40);

  const btns = titleButtons(vw, vh);
  // New Game.
  ctx.fillStyle = '#37b24d';
  roundRect(ctx, btns.newGame.x, btns.newGame.y, btns.newGame.w, btns.newGame.h, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('NEW GAME', vw / 2, btns.newGame.y + 34);
  // Continue (only when a save exists).
  if (ui && ui.hasSave) {
    ctx.fillStyle = '#2f7fe0';
    roundRect(ctx, btns.cont.x, btns.cont.y, btns.cont.w, btns.cont.h, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText('CONTINUE', vw / 2, btns.cont.y + 34);
    if (ui.saveText) {
      ctx.fillStyle = '#cfd8e3';
      ctx.font = '13px sans-serif';
      ctx.fillText(ui.saveText, vw / 2, btns.cont.y + 72);
    }
  } else {
    ctx.fillStyle = '#9fb4c8';
    ctx.font = '14px sans-serif';
    ctx.fillText('Press Enter or click New Game to play.', vw / 2, btns.cont.y + 30);
  }
  ctx.fillStyle = '#7a8a9a';
  ctx.font = '13px sans-serif';
  ctx.fillText('WASD move / drive  •  E interact  •  Q radio  •  Space punch / handbrake  •  P pause  •  M mute', vw / 2, vh - 40);
}

function drawPaused(ctx, vw, vh) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', vw / 2, vh / 2 - 10);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#cfd8e3';
  ctx.fillText('Press P to resume — your progress is saved.', vw / 2, vh / 2 + 26);
}

// --- main entry -------------------------------------------------------------

export function render(state, ctx, ui) {
  const vw = ctx.canvas.width || VIEW_W;
  const vh = ctx.canvas.height || VIEW_H;
  const mode = (ui && ui.mode) || 'game';
  ctx.clearRect(0, 0, vw, vh);

  if (mode === 'title') {
    drawTitle(ctx, state, ui, vw, vh);
    return;
  }

  // World pass (camera translate happens exactly once, here).
  const cam = state.camera || { x: 1440, y: 1080 };
  ctx.save();
  ctx.translate(vw / 2 - cam.x, vh / 2 - cam.y);
  drawGround(ctx, state, cam, vw, vh);
  drawParks(ctx, state);
  drawBuildings(ctx, state);
  drawLandmarks(ctx, state);
  drawPickups(ctx, state);
  drawCoins(ctx, state);
  drawCrates(ctx, state);
  drawFare(ctx, state);
  drawTraffic(ctx, state);
  drawPolice(ctx, state);
  drawBoats(ctx, state);
  drawCombat(ctx, state);
  drawPlayer(ctx, state);
  drawMissionMarker(ctx, state, cam, vw, vh);
  ctx.restore();

  // HUD pass (screen space).
  drawHUD(ctx, state, ui, vw, vh);

  if (mode === 'paused') drawPaused(ctx, vw, vh);
}

// Backwards-friendly alias: some callers use drawGame.
export const drawGame = render;
