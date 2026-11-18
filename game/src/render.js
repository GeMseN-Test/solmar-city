// Everything on screen: the city, the cars, the boats, the cops, the
// helicopter, the HUD, the minimap, and the title / pause /
// WASTED screens. Pure drawing — it never changes the state, it only
// reads it. `render(ctx, state, view)` where view is
// { camX, camY, vw, vh, screen, banner, mouse }.
import { BEACH_TOP, ROAD_WIDTH, ROAD_XS, ROAD_YS, SEA_TOP, WORLD_H, WORLD_W } from './config.js';
import { fareMarker, sideJobsText } from './sidejobs.js';
import { currentObjective, missionMarker } from './missions.js';
import { heliSpotlight } from './police2.js';
import { radioName } from './radio.js';
import { clamp, dist, formatMoney, formatTime } from './util.js';

export function titleButtons(vw, vh) {
  const w = 280;
  const h = 54;
  return {
    newGame: { x: vw / 2 - w / 2, y: vh / 2 + 30, w, h },
    continue: { x: vw / 2 - w / 2, y: vh / 2 + 100, w, h },
  };
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

function drawCarShape(ctx, car, color) {
  const model = car.model || 'sedan';
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-22, -12, 46, 26);
  ctx.fillStyle = color;
  if (model === 'van') {
    roundRect(ctx, -26, -13, 52, 26, 5);
    ctx.fill();
    ctx.fillStyle = '#bfe3f2';
    ctx.fillRect(-20, -10, 14, 20);
    ctx.fillStyle = color;
    ctx.fillRect(8, -10, 14, 20);
  } else if (model === 'truck') {
    ctx.fillRect(-26, -12, 30, 24);
    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(6, -11, 20, 22);
    ctx.fillStyle = '#bfe3f2';
    ctx.fillRect(18, -9, 6, 18);
  } else if (model === 'sport') {
    roundRect(ctx, -24, -11, 48, 22, 10);
    ctx.fill();
    ctx.fillStyle = '#20242c';
    ctx.fillRect(-6, -9, 16, 18);
    ctx.fillStyle = color;
    ctx.fillRect(-26, -10, 6, 20);
  } else {
    // sedan + taxi share the classic shape; taxis get a checker band.
    roundRect(ctx, -23, -11, 46, 22, 7);
    ctx.fill();
    ctx.fillStyle = '#bfe3f2';
    ctx.fillRect(-4, -9, 14, 18);
    if (model === 'taxi') {
      ctx.fillStyle = '#1a1a1a';
      for (let i = 0; i < 5; i++) ctx.fillRect(-22 + i * 9, -11, 5, 4);
      ctx.fillStyle = '#f5c518';
      ctx.fillRect(-2, -13, 12, 4);
    }
    if (car.kind === 'police') {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(-23, -11, 46, 6);
      ctx.fillStyle = '#d21f3c';
      ctx.fillRect(-8, -13, 7, 4);
      ctx.fillStyle = '#2a6fd2';
      ctx.fillRect(1, -13, 7, 4);
    }
  }
  // Headlights point forward.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(21, -9, 3, 5);
  ctx.fillRect(21, 4, 3, 5);
  ctx.restore();
}

function drawBoatShape(ctx, boat) {
  ctx.save();
  ctx.translate(boat.x, boat.y);
  ctx.rotate(boat.angle);
  // Wake: a fading triangle behind the hull.
  if (boat.wake > 0.1) {
    ctx.fillStyle = 'rgba(255,255,255,' + (0.35 * boat.wake).toFixed(2) + ')';
    ctx.beginPath();
    ctx.moveTo(-24, 0);
    ctx.lineTo(-44, -14);
    ctx.lineTo(-44, 14);
    ctx.closePath();
    ctx.fill();
  }
  const big = boat.speedMul < 0.95;
  const len = big ? 64 : 46;
  const wid = big ? 26 : 18;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-len / 2, -wid / 2 + 3, len, wid);
  ctx.fillStyle = boat.color;
  ctx.beginPath();
  ctx.moveTo(len / 2, 0);
  ctx.lineTo(len / 2 - 10, -wid / 2);
  ctx.lineTo(-len / 2 + 6, -wid / 2);
  ctx.lineTo(-len / 2, 0);
  ctx.lineTo(-len / 2 + 6, wid / 2);
  ctx.lineTo(len / 2 - 10, wid / 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#20344a';
  ctx.fillRect(-8, -wid / 4, 14, wid / 2);
  if (boat.inUse) {
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPed(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.down) {
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = ped.shirt;
    ctx.fillRect(-11, -4, 22, 8);
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(14, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const bob = Math.sin(ped.stepPhase) * 1.5;
    ctx.rotate(ped.angle);
    ctx.fillStyle = ped.shirt;
    ctx.fillRect(-6, -5 + bob * 0.3, 12, 10);
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(8, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20242c';
    ctx.fillRect(-7, -4, 3, 8);
  }
  ctx.restore();
}

function drawEnemy(ctx, e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);
  ctx.fillStyle = e.shirt;
  ctx.fillRect(-8, -7, 16, 14);
  ctx.fillStyle = e.skin;
  ctx.beginPath();
  ctx.arc(9, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  // The gun they point at you.
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(8, -1, 12, 2);
  ctx.restore();
  // HP bar.
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(e.x - 14, e.y - 22, 28, 4);
  ctx.fillStyle = '#d21f3c';
  ctx.fillRect(e.x - 14, e.y - 22, 28 * clamp(e.hp / 100, 0, 1), 4);
}

function drawPlayer(ctx, p) {
  if (p.inCar || p.inBoat) return; // the car / boat drawing covers them
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.aimAngle);
  // Mara: teal jacket, dark jeans, gun forward.
  ctx.fillStyle = '#1f9e8a';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(4, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(8, -2, 12, 4);
  ctx.restore();
  if (p.invuln > 0 && Math.floor(p.invuln * 8) % 2 === 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawGround(ctx, state, view) {
  const { camX, camY, vw, vh } = view;
  // NOTE: the caller already translated the context by (-camX, -camY),
  // so everything here is drawn in raw world coordinates.
  // Grass everywhere first.
  ctx.fillStyle = '#5a8a4a';
  ctx.fillRect(camX, camY, vw, vh);
  // Beach strip.
  ctx.fillStyle = '#e0c98f';
  ctx.fillRect(0, BEACH_TOP, WORLD_W, SEA_TOP - BEACH_TOP);
  // The sea.
  ctx.fillStyle = '#2a6a9e';
  ctx.fillRect(0, SEA_TOP, WORLD_W, WORLD_H - SEA_TOP);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (let x = 0; x < WORLD_W; x += 240) {
    ctx.fillRect(x, SEA_TOP + 30, 120, 3);
  }
  // Gull Island: a sandy bump in the sea.
  const isl = state.city.landmarks.island;
  ctx.fillStyle = '#e0c98f';
  ctx.beginPath();
  ctx.ellipse(isl.x, isl.y, 90, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a8a4a';
  ctx.beginPath();
  ctx.ellipse(isl.x, isl.y, 55, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Roads: asphalt strips with dashed center lines.
  ctx.fillStyle = '#3a3a40';
  for (const rx of ROAD_XS) ctx.fillRect(rx - ROAD_WIDTH / 2, 0, ROAD_WIDTH, 2020);
  for (const ry of ROAD_YS) ctx.fillRect(0, ry - ROAD_WIDTH / 2, WORLD_W, ROAD_WIDTH);
  ctx.fillStyle = '#c9c9a8';
  for (const rx of ROAD_XS) {
    for (let y = 0; y < 2020; y += 60) ctx.fillRect(rx - 2, y, 4, 28);
  }
  for (const ry of ROAD_YS) {
    for (let x = 0; x < WORLD_W; x += 60) ctx.fillRect(x, ry - 2, 28, 4);
  }
  // Parks.
  for (const park of state.city.parks) {
    ctx.fillStyle = '#4a7a3a';
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = '#2f5a26';
    for (let i = 0; i < 6; i++) {
      const tx = park.x + 30 + ((i * 47) % (park.w - 60));
      const ty = park.y + 30 + ((i * 61) % (park.h - 60));
      ctx.beginPath();
      ctx.arc(tx, ty, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Buildings with lit windows.
  for (const b of state.city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(b.x + 4, b.y + 4, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x, b.y, b.w, 8);
    if (b.lit) {
      ctx.fillStyle = '#ffe9a8';
      for (let wx = b.x + 12; wx < b.x + b.w - 10; wx += 26) {
        for (let wy = b.y + 14; wy < b.y + b.h - 10; wy += 30) {
          if ((wx + wy) % 3 === 0) ctx.fillRect(wx, wy, 10, 12);
        }
      }
    }
  }
}

function drawLandmarks(ctx, state, view) {
  const { camX, camY } = view;
  const icons = {
    garage: 'G', safehouse: 'H', bank: '$', turf: 'V',
    docks: 'D', marina: 'M', radio: 'R', island: 'I',
  };
  for (const key of Object.keys(state.city.landmarks)) {
    const lm = state.city.landmarks[key];
    // Raw world coordinates — the caller already translated the context.
    const x = lm.x;
    const y = lm.y;
    if (x < camX - 80 || x > camX + view.vw + 80 || y < camY - 80 || y > camY + view.vh + 80) continue;
    ctx.fillStyle = 'rgba(10,10,20,0.75)';
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f5c518';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#f5c518';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icons[key] || '?', x, y + 1);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(lm.name, x, y + 28);
  }
}

function drawHud(ctx, state, view) {
  const { vw } = view;
  const p = state.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Top-left status panel.
  ctx.fillStyle = 'rgba(8,8,16,0.72)';
  roundRect(ctx, 12, 12, 250, 132, 10);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(formatMoney(state.money), 24, 40);
  // Health bar.
  ctx.fillStyle = '#333';
  ctx.fillRect(24, 50, 140, 12);
  ctx.fillStyle = p.hp > 30 ? '#37c24a' : '#d21f3c';
  ctx.fillRect(24, 50, 140 * clamp(p.hp / 100, 0, 1), 12);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText('HP ' + Math.ceil(p.hp), 170, 61);
  ctx.fillText('Ammo ' + p.ammo, 24, 82);
  // Wanted stars.
  ctx.font = 'bold 20px sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < state.police.wanted ? '★' : '☆';
  ctx.fillStyle = '#ffd23e';
  ctx.fillText(stars, 24, 106);
  // Radio + side jobs.
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#9fd8ff';
  ctx.fillText('♪ ' + radioName(state.radio), 24, 128);
  ctx.fillStyle = 'rgba(8,8,16,0.72)';
  roundRect(ctx, 12, 148, 250, 26, 8);
  ctx.fill();
  ctx.fillStyle = '#ffd23e';
  ctx.font = '13px sans-serif';
  ctx.fillText(sideJobsText(state), 24, 166);

  // Objective panel, top center.
  const obj = currentObjective(state);
  if (state.mission && obj) {
    const marker = missionMarker(state);
    const d = marker ? Math.round(dist(p.x, p.y, marker.x, marker.y)) : 0;
    ctx.fillStyle = 'rgba(8,8,16,0.72)';
    const panelW = 420;
    roundRect(ctx, vw / 2 - panelW / 2, 12, panelW, 64, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.mission.title + '  •  ' + formatMoney(state.mission.reward), vw / 2, 34);
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText(obj.text + (marker ? '  —  ' + d + 'm' : ''), vw / 2, 58);
    ctx.textAlign = 'left';
  }

  // Speed, bottom left.
  const speed = p.inCar && p.car ? Math.abs(p.car.speed) : p.inBoat && p.boat ? Math.abs(p.boat.speed) : 0;
  if (p.inCar || p.inBoat) {
    ctx.fillStyle = 'rgba(8,8,16,0.72)';
    roundRect(ctx, 12, view.vh - 64, 270, 48, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(Math.round(speed * 0.36) + ' km/h', 24, view.vh - 32);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#9fd8ff';
    ctx.fillText(p.inBoat ? 'BOAT — E to step ashore' : 'SPACE handbrake — E to exit', 24, view.vh - 18);
  } else {
    ctx.fillStyle = 'rgba(8,8,16,0.6)';
    roundRect(ctx, 12, view.vh - 44, 470, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#ddd';
    ctx.font = '12px sans-serif';
    ctx.fillText('WASD move • Shift run • Click shoot • Space punch • E steal / board • Q radio • P pause', 22, view.vh - 24);
  }
  drawMinimap(ctx, state, view);
}

function drawMinimap(ctx, state, view) {
  const mw = 190;
  const mh = 142;
  const x0 = view.vw - mw - 12;
  const y0 = view.vh - mh - 12;
  const sx = mw / WORLD_W;
  const sy = mh / WORLD_H;
  ctx.fillStyle = 'rgba(8,8,16,0.75)';
  roundRect(ctx, x0 - 4, y0 - 4, mw + 8, mh + 8, 8);
  ctx.fill();
  ctx.fillStyle = '#2a6a9e';
  ctx.fillRect(x0, y0 + SEA_TOP * sy, mw, mh - SEA_TOP * sy);
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  for (const rx of ROAD_XS) {
    ctx.beginPath();
    ctx.moveTo(x0 + rx * sx, y0);
    ctx.lineTo(x0 + rx * sx, y0 + 2020 * sy);
    ctx.stroke();
  }
  for (const ry of ROAD_YS) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + ry * sy);
    ctx.lineTo(x0 + mw, y0 + ry * sy);
    ctx.stroke();
  }
  const marker = missionMarker(state);
  if (marker) {
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(x0 + marker.x * sx, y0 + marker.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const boat of state.boats) {
    ctx.fillStyle = '#9fd8ff';
    ctx.fillRect(x0 + boat.x * sx - 1, y0 + boat.y * sy - 1, 3, 3);
  }
  const p = state.player;
  ctx.fillStyle = '#37c24a';
  ctx.beginPath();
  ctx.arc(x0 + p.x * sx, y0 + p.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawScreens(ctx, state, view) {
  const { vw, vh } = view;
  if (view.screen === 'title') {
    ctx.fillStyle = 'rgba(5,5,12,0.72)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('SOLMAR CITY', vw / 2, vh / 2 - 90);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText('An open-world crime game — 12 story missions, boats, radio, taxis', vw / 2, vh / 2 - 52);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#9fd8ff';
    ctx.fillText('Mara Voss is back in Solmar. Steal cars, dodge the cops, take the crown.', vw / 2, vh / 2 - 24);
    const btns = titleButtons(vw, vh);
    ctx.fillStyle = '#ffd23e';
    roundRect(ctx, btns.newGame.x, btns.newGame.y, btns.newGame.w, btns.newGame.h, 10);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('NEW GAME', vw / 2, btns.newGame.y + 35);
    if (view.hasSave) {
      ctx.fillStyle = '#2a6a9e';
      roundRect(ctx, btns.continue.x, btns.continue.y, btns.continue.w, btns.continue.h, 10);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText('CONTINUE', vw / 2, btns.continue.y + 35);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#ddd';
      ctx.fillText(view.saveInfo || '', vw / 2, btns.continue.y + 74);
    }
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Press Enter or click New Game to play.', vw / 2, vh - 30);
    ctx.textAlign = 'left';
    return;
  }
  if (view.screen === 'paused') {
    ctx.fillStyle = 'rgba(5,5,12,0.6)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('PAUSED', vw / 2, vh / 2);
    ctx.font = '16px sans-serif';
    ctx.fillText('Press P to resume', vw / 2, vh / 2 + 34);
    ctx.textAlign = 'left';
    return;
  }
  if (view.banner) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(8,8,16,0.8)';
    const bw = 560;
    roundRect(ctx, vw / 2 - bw / 2, vh / 2 - 110, bw, 84, 12);
    ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(view.banner.text, vw / 2, vh / 2 - 66);
    if (view.banner.sub) {
      ctx.fillStyle = '#fff';
      ctx.font = '16px sans-serif';
      ctx.fillText(view.banner.sub, vw / 2, vh / 2 - 38);
    }
    ctx.textAlign = 'left';
  }
  if (view.dead) {
    ctx.fillStyle = 'rgba(120,0,0,0.45)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText(view.dead, vw / 2, vh / 2 - 10);
    ctx.font = '18px sans-serif';
    ctx.fillText('Back at the safehouse…', vw / 2, vh / 2 + 30);
    ctx.textAlign = 'left';
  }
}

export function render(ctx, state, view) {
  const { camX, camY, vw, vh } = view;
  ctx.clearRect(0, 0, vw, vh);
  ctx.save();
  ctx.translate(-camX, -camY);
  drawGround(ctx, state, view);
  ctx.restore();

  // Everything below draws in world coordinates.
  ctx.save();
  ctx.translate(-camX, -camY);

  // Mission crates.
  for (const crate of state.missionCrates || []) {
    if (crate.taken) continue;
    ctx.fillStyle = '#8a6f3a';
    ctx.fillRect(crate.x - 12, crate.y - 9, 24, 18);
    ctx.strokeStyle = '#5a4a22';
    ctx.lineWidth = 2;
    ctx.strokeRect(crate.x - 12, crate.y - 9, 24, 18);
  }
  // Pickups.
  for (const pk of state.pickups) {
    const bobY = Math.sin(pk.bob) * 3;
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#37c24a';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bobY, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', pk.x, pk.y + bobY + 4);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(pk.x - 9, pk.y + bobY - 9, 18, 18);
      ctx.fillStyle = '#d21f3c';
      ctx.fillRect(pk.x - 2, pk.y + bobY - 6, 4, 12);
      ctx.fillRect(pk.x - 6, pk.y + bobY - 2, 12, 4);
    } else {
      ctx.fillStyle = '#f5c518';
      ctx.fillRect(pk.x - 8, pk.y + bobY - 5, 16, 10);
      ctx.fillStyle = '#8a6f00';
      ctx.fillRect(pk.x - 8, pk.y + bobY - 5, 16, 3);
    }
    ctx.textAlign = 'left';
  }
  // Solmar Coins: spinning gold.
  for (const coin of state.sideJobs.coins) {
    if (coin.taken) continue;
    const w = 4 + Math.abs(Math.sin(coin.bob)) * 6;
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.ellipse(coin.x, coin.y, w, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a6f00';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Taxi fare: waving passenger or destination flag.
  const fare = state.sideJobs.fare;
  if (fare) {
    if (fare.stage === 'waiting') {
      ctx.fillStyle = '#ff8fd2';
      ctx.beginPath();
      ctx.arc(fare.x, fare.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fare.x, fare.y, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', fare.x, fare.y - 24);
      ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = '#ff8fd2';
      ctx.beginPath();
      ctx.moveTo(fare.destX, fare.destY - 18);
      ctx.lineTo(fare.destX + 16, fare.destY - 12);
      ctx.lineTo(fare.destX, fare.destY - 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DROP-OFF $' + fare.pay, fare.destX, fare.destY - 26);
      ctx.textAlign = 'left';
    }
  }
  // Boats in the harbor.
  for (const boat of state.boats) drawBoatShape(ctx, boat);
  // Traffic + pedestrians.
  for (const car of state.traffic.cars) drawCarShape(ctx, car, car.color);
  for (const ped of state.traffic.peds) drawPed(ctx, ped);
  // Police.
  for (const car of state.police.cars) drawCarShape(ctx, car, car.color);
  for (const cop of state.police.cops) {
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.rotate(cop.angle);
    ctx.fillStyle = '#1a2a6a';
    ctx.fillRect(-6, -5, 12, 10);
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(8, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Helicopter + spotlight.
  const spot = heliSpotlight(state);
  if (spot) {
    ctx.fillStyle = 'rgba(255,244,170,0.18)';
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, spot.r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (state.police2.heli) {
    const h = state.police2.heli;
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.angle);
    ctx.fillStyle = '#1a2a3a';
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    const r = h.rotor;
    ctx.beginPath();
    ctx.moveTo(Math.cos(r) * 30, Math.sin(r) * 30);
    ctx.lineTo(-Math.cos(r) * 30, -Math.sin(r) * 30);
    ctx.moveTo(Math.cos(r + Math.PI / 2) * 30, Math.sin(r + Math.PI / 2) * 30);
    ctx.lineTo(-Math.cos(r + Math.PI / 2) * 30, -Math.sin(r + Math.PI / 2) * 30);
    ctx.stroke();
    ctx.restore();
  }
  // Gang members.
  for (const e of state.combat.enemies) drawEnemy(ctx, e);
  // Bullets.
  for (const b of state.combat.bullets) {
    ctx.strokeStyle = b.fromPlayer ? '#ffe9a8' : '#ff6a6a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - Math.cos(b.angle) * 10, b.y - Math.sin(b.angle) * 10);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Player car / boat / on foot.
  const p = state.player;
  if (p.inCar && p.car) drawCarShape(ctx, p.car, p.car.color);
  else if (p.inBoat && p.boat) drawBoatShape(ctx, p.boat);
  else drawPlayer(ctx, p);
  // Mission marker ring.
  const marker = missionMarker(state);
  if (marker && view.screen === 'game') {
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 26 + Math.sin(state.playTime * 4) * 4, 0, Math.PI * 2);
    ctx.stroke();
    // Arrow from the player toward the marker.
    const d = dist(p.x, p.y, marker.x, marker.y);
    if (d > 130) {
      const a = Math.atan2(marker.y - p.y, marker.x - p.x);
      const ax = p.x + Math.cos(a) * 52;
      const ay = p.y + Math.sin(a) * 52;
      ctx.fillStyle = '#ffd23e';
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-6, -7);
      ctx.lineTo(-6, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  drawLandmarks(ctx, state, view);
  ctx.restore();

  drawHud(ctx, state, view);
  drawScreens(ctx, state, view);
}
