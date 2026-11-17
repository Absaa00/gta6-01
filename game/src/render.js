// render.js — all drawing for Palmera Bay: Street Heat.
// Canvas 2D, top-down. Draws the city, entities, effects, HUD, minimap and
// the menu / pause / game-over screens. No assets: every pixel is code.

import { WORLD_W, WORLD_H, ROAD_W } from './world.js';
import { missionObjective, missionProgressText, MISSION_DEFS } from './missions.js';

const VIEW_W = 1280;
const VIEW_H = 720;

function fmtClock(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function fmtMoney(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }

function drawCarShape(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const w = car.w, h = car.h;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 7);
  ctx.fill();
  // Roof / cabin.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, -w * 0.22, -h / 2 + 4, w * 0.42, h - 8, 5);
  ctx.fill();
  // Windshield.
  ctx.fillStyle = '#bfe3f0';
  ctx.fillRect(w * 0.2, -h / 2 + 4, 6, h - 8);
  // Wheels.
  ctx.fillStyle = '#111';
  ctx.fillRect(-w / 2 + 4, -h / 2 - 3, 12, 5);
  ctx.fillRect(-w / 2 + 4, h / 2 - 2, 12, 5);
  ctx.fillRect(w / 2 - 16, -h / 2 - 3, 12, 5);
  ctx.fillRect(w / 2 - 16, h / 2 - 2, 12, 5);
  // Police livery / taxi checker.
  if (car.kind === 'police') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-w * 0.1, -h / 2, w * 0.2, h);
    ctx.fillStyle = '#e63946';
    ctx.fillRect(-w * 0.32, -h / 2, 5, h);
    ctx.fillStyle = '#ff2e2e';
    ctx.beginPath(); ctx.arc(-w * 0.05, -h / 2 + 2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2e7dff';
    ctx.beginPath(); ctx.arc(w * 0.08, -h / 2 + 2, 3, 0, Math.PI * 2); ctx.fill();
  } else if (car.kind === 'taxi') {
    ctx.fillStyle = '#222';
    for (let i = 0; i < 5; i++) ctx.fillRect(-w / 2 + 6 + i * 8, -2, 4, 4);
  }
  // Headlights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(w / 2 - 2, -h / 2 + 3, 3, 5);
  ctx.fillRect(w / 2 - 2, h / 2 - 8, 3, 5);
  // Brake lights.
  if (car.brakeLight) {
    ctx.fillStyle = '#ff2222';
    ctx.fillRect(-w / 2 - 1, -h / 2 + 3, 3, 5);
    ctx.fillRect(-w / 2 - 1, h / 2 - 8, 3, 5);
  }
  // Damage smoke for wrecked cars.
  if (car.hp < 45 && !car.dead) {
    ctx.fillStyle = 'rgba(80,80,80,0.6)';
    ctx.beginPath(); ctx.arc(-w * 0.2, 0, 7 + Math.random() * 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
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

function drawPedShape(ctx, ped, time) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.dead) {
    ctx.rotate(ped.angle);
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.ellipse(0, 0, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a1f1f';
    ctx.beginPath(); ctx.arc(6, 4, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  const bob = Math.sin(ped.walkPhase) * 1.5;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(1, 2, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
  // Body.
  ctx.fillStyle = ped.color;
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  // Head.
  ctx.fillStyle = '#f0c8a0';
  ctx.beginPath(); ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3 + bob * 0.2, 5, 0, Math.PI * 2); ctx.fill();
  // Direction tick.
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(Math.cos(ped.angle) * 9, Math.sin(ped.angle) * 9);
  ctx.lineTo(Math.cos(ped.angle) * 13, Math.sin(ped.angle) * 13);
  ctx.stroke();
  // Cop hat / goon gun.
  if (ped.kind === 'cop') {
    ctx.fillStyle = '#1b4f9c';
    ctx.beginPath(); ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath(); ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3, 3.5, 0, Math.PI * 2); ctx.fill();
  } else if (ped.kind === 'goon' || ped.kind === 'rival') {
    ctx.fillStyle = '#222';
    ctx.fillRect(Math.cos(ped.angle) * 10 - 2, Math.sin(ped.angle) * 10 - 2, 7, 4);
  }
  ctx.restore();
}

function drawWorld(ctx, G, cam) {
  const city = G.city;
  const x0 = cam.x - 40, y0 = cam.y - 40, x1 = cam.x + VIEW_W + 40, y1 = cam.y + VIEW_H + 40;

  // Ground: grass base.
  ctx.fillStyle = '#5d8a4a';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Subtle grass texture: deterministic speckles.
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let gx = Math.floor(x0 / 90) * 90; gx < x1; gx += 90) {
    for (let gy = Math.floor(y0 / 90) * 90; gy < y1; gy += 90) {
      ctx.fillRect(gx + ((gx * 7 + gy * 13) % 60), gy + ((gx * 3 + gy * 11) % 60), 18, 8);
    }
  }
  // Beach sand + sea (east).
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(Math.max(x0, city.beach.x), y0, Math.min(x1, WORLD_W) - Math.max(x0, city.beach.x), y1 - y0);
  ctx.fillStyle = '#2e7fb8';
  ctx.fillRect(Math.max(x0, city.sea.x), y0, Math.min(x1, WORLD_W) - Math.max(x0, city.sea.x), y1 - y0);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let wy = Math.floor(y0 / 120) * 120; wy < y1; wy += 120) {
    const off = Math.sin((G.time * 1.5 + wy) * 0.02) * 8;
    ctx.fillRect(city.sea.x + 4 + off, wy, 60, 3);
  }
  // Harbor water (south) + docks.
  ctx.fillStyle = '#2e7fb8';
  ctx.fillRect(x0, Math.max(y0, city.harbor.y), x1 - x0, Math.min(y1, WORLD_H) - Math.max(y0, city.harbor.y));
  for (const d of city.docks) {
    ctx.fillStyle = '#8a6a4a';
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = '#6b4f36';
    for (let px = d.x + 10; px < d.x + d.w; px += 30) ctx.fillRect(px, d.y, 4, d.h);
  }
  for (const c of city.containers) {
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(c.x, c.y, c.w, 6);
  }
  // Park.
  const pk = city.park;
  ctx.fillStyle = '#4a7a38';
  ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
  ctx.fillStyle = '#6b9a4a';
  ctx.beginPath(); ctx.arc(pk.x + pk.w / 2, pk.y + pk.h / 2, 46, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7fb8d9';
  ctx.beginPath(); ctx.arc(pk.x + pk.w / 2, pk.y + pk.h / 2, 30, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c9a86a';
  ctx.fillRect(pk.x + pk.w / 2 - 4, pk.y, 8, pk.h); // path through the park

  // Roads: asphalt + sidewalk edge + centre dashes.
  ctx.fillStyle = '#3a3f47';
  for (const rx of city.roadsV) ctx.fillRect(rx - ROAD_W / 2, Math.max(y0, 0), ROAD_W, Math.min(y1, WORLD_H) - Math.max(y0, 0));
  for (const ry of city.roadsH) ctx.fillRect(Math.max(x0, 0), ry - ROAD_W / 2, Math.min(x1, 2850) - Math.max(x0, 0), ROAD_W);
  ctx.fillStyle = '#c9c2b4';
  for (const rx of city.roadsV) {
    ctx.fillRect(rx - ROAD_W / 2 - 6, Math.max(y0, 0), 6, Math.min(y1, WORLD_H) - Math.max(y0, 0));
    ctx.fillRect(rx + ROAD_W / 2, Math.max(y0, 0), 6, Math.min(y1, WORLD_H) - Math.max(y0, 0));
  }
  for (const ry of city.roadsH) {
    ctx.fillRect(Math.max(x0, 0), ry - ROAD_W / 2 - 6, Math.min(x1, 2850) - Math.max(x0, 0), 6);
    ctx.fillRect(Math.max(x0, 0), ry + ROAD_W / 2, Math.min(x1, 2850) - Math.max(x0, 0), 6);
  }
  ctx.fillStyle = '#f5d76e';
  for (const rx of city.roadsV) {
    for (let dy = Math.floor(y0 / 60) * 60; dy < y1; dy += 60) ctx.fillRect(rx - 2, dy, 4, 28);
  }
  for (const ry of city.roadsH) {
    for (let dx = Math.floor(x0 / 60) * 60; dx < x1; dx += 60) ctx.fillRect(dx, ry - 2, 28, 4);
  }
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const rx of city.roadsV) {
    for (const ry of city.roadsH) {
      if (rx > x1 || rx < x0 || ry > y1 || ry < y0) continue;
      for (let i = -3; i <= 3; i++) ctx.fillRect(rx + i * 12 - 4, ry - ROAD_W / 2 + 6, 7, 12);
    }
  }
  // Boardwalk along the beach.
  ctx.fillStyle = '#b08d5f';
  ctx.fillRect(2780, Math.max(y0, 0), 70, Math.min(y1, WORLD_H) - Math.max(y0, 0));

  // Trees.
  for (const t of city.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(t.x + 3, t.y + 4, t.r, t.r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.palm ? '#3f9e4d' : '#2f7a33';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#57b368';
    ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
    if (t.palm) {
      ctx.fillStyle = '#7a5a3a';
      ctx.fillRect(t.x - 2, t.y, 4, 8);
    }
  }

  // Buildings.
  for (const b of city.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = b.tall ? '#7fb2d9' : '#ffe9a8';
    for (const wnd of b.windows) {
      ctx.fillStyle = wnd.lit ? '#ffe9a8' : '#2c3e50';
      ctx.fillRect(b.x + wnd.dx, b.y + wnd.dy, 12, 10);
    }
    if (b.landmark) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.landmark, b.x + b.w / 2, b.y + b.h / 2 + 4);
    }
  }

  // Spray shop: green glow zone + sign.
  const sp = city.sprayShop;
  const pulse = 0.5 + Math.sin(G.time * 3) * 0.25;
  ctx.fillStyle = `rgba(46,204,113,${0.18 + pulse * 0.12})`;
  ctx.fillRect(sp.x - 30, sp.y - 30, sp.w + 60, sp.h + 60);
  ctx.strokeStyle = '#2ecc71';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.strokeRect(sp.x - 30, sp.y - 30, sp.w + 60, sp.h + 60);
  ctx.setLineDash([]);
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SPRAY SHOP — $150', sp.x + sp.w / 2, sp.y - 38);

  // Pickups.
  for (const pk2 of G.pickups) {
    if (pk2.x < x0 || pk2.x > x1 || pk2.y < y0 || pk2.y > y1) continue;
    const bobY = Math.sin(G.time * 4 + pk2.x) * 3;
    ctx.save();
    ctx.translate(pk2.x, pk2.y + bobY);
    if (pk2.kind === 'package') {
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(-11, -9, 22, 18);
      ctx.fillStyle = '#d68910';
      ctx.fillRect(-11, -2, 22, 4);
      ctx.strokeStyle = '#7e5109'; ctx.lineWidth = 2; ctx.strokeRect(-11, -9, 22, 18);
    } else {
      const col = pk2.kind === 'health' ? '#e74c3c' : pk2.kind === 'armor' ? '#3498db' : '#f1c40f';
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pk2.kind === 'health' ? '+' : pk2.kind === 'armor' ? 'A' : '»', 0, 5);
    }
    ctx.restore();
  }

  // Mission marker (pulsing gold ring + beam).
  const obj = missionObjective(G);
  if (obj) {
    const r = 26 + Math.sin(G.time * 5) * 6;
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(obj.x, obj.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,62,0.25)';
    ctx.beginPath(); ctx.arc(obj.x, obj.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.moveTo(obj.x, obj.y - 34);
    ctx.lineTo(obj.x - 10, obj.y - 52);
    ctx.lineTo(obj.x + 10, obj.y - 52);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 14px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(obj.label, obj.x, obj.y - 58);
  }
}

function drawEntities(ctx, G, cam) {
  const x0 = cam.x - 60, y0 = cam.y - 60, x1 = cam.x + VIEW_W + 60, y1 = cam.y + VIEW_H + 60;
  // Cars (dead wrecks first, as dark husks).
  for (const car of G.cars) {
    if (car.x < x0 || car.x > x1 || car.y < y0 || car.y > y1) continue;
    if (car.dead) {
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      ctx.fillStyle = '#1c1c1c';
      roundRect(ctx, -car.w / 2, -car.h / 2, car.w, car.h, 7);
      ctx.fill();
      ctx.restore();
      continue;
    }
    drawCarShape(ctx, car);
  }
  // Pedestrians.
  for (const ped of G.peds) {
    if (ped.x < x0 || ped.x > x1 || ped.y < y0 || ped.y > y1) continue;
    drawPedShape(ctx, ped, G.time);
  }
  // Player on foot (only when not in a car).
  const p = G.player;
  if (!p.car) {
    ctx.save();
    ctx.translate(p.x, p.y);
    const bob = Math.sin(G.time * 10) * 1.2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(1, 3, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 4, Math.sin(p.angle) * 4 + bob * 0.2, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e63946';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(p.angle) * 11, Math.sin(p.angle) * 11);
    ctx.lineTo(Math.cos(p.angle) * 17, Math.sin(p.angle) * 17);
    ctx.stroke();
    // Pistol in hand when aiming.
    if (G.aiming) {
      ctx.fillStyle = '#111';
      ctx.fillRect(Math.cos(p.angle) * 12 - 2, Math.sin(p.angle) * 12 - 2, 8, 4);
    }
    ctx.restore();
    // Player ring so the eye finds Marco instantly.
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, 16 + Math.sin(G.time * 4) * 2, 0, Math.PI * 2); ctx.stroke();
  }
  // Bullets.
  for (const b of G.bullets) {
    ctx.strokeStyle = '#ffe66d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Particles.
  for (const pt of G.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawOffscreenObjectiveArrow(ctx, G, cam) {
  const obj = missionObjective(G);
  if (!obj) return;
  const p = G.player;
  const sx = obj.x - cam.x, sy = obj.y - cam.y;
  if (sx > 40 && sx < VIEW_W - 40 && sy > 40 && sy < VIEW_H - 40) return;
  const cx = VIEW_W / 2, cy = VIEW_H / 2;
  const ang = Math.atan2(obj.y - p.y, obj.x - p.x);
  const ax = cx + Math.cos(ang) * 300;
  const ay = cy + Math.sin(ang) * 200;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(ang);
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill();
  ctx.restore();
  const d = Math.round(Math.hypot(obj.x - p.x, obj.y - p.y));
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 13px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${obj.label} · ${d}m`, ax, ay + 26);
}

// ---- HUD --------------------------------------------------------------------

function drawHUD(ctx, G) {
  const p = G.player;
  // Bottom-left status panel.
  ctx.fillStyle = 'rgba(8,12,20,0.72)';
  roundRect(ctx, 14, VIEW_H - 108, 300, 94, 10);
  ctx.fill();
  // Health bar.
  ctx.fillStyle = '#222';
  ctx.fillRect(28, VIEW_H - 92, 180, 14);
  ctx.fillStyle = G.health > 30 ? '#2ecc71' : '#e74c3c';
  ctx.fillRect(28, VIEW_H - 92, 180 * (G.health / 100), 14);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`HEALTH ${Math.ceil(G.health)}`, 32, VIEW_H - 81);
  // Armor bar.
  ctx.fillStyle = '#222';
  ctx.fillRect(28, VIEW_H - 72, 180, 10);
  ctx.fillStyle = '#3498db';
  ctx.fillRect(28, VIEW_H - 72, 180 * (G.armor / 100), 10);
  ctx.fillStyle = '#cfe8ff';
  ctx.fillText(`ARMOR ${Math.ceil(G.armor)}`, 32, VIEW_H - 63);
  // Money + ammo.
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 20px "Trebuchet MS", sans-serif';
  ctx.fillText(fmtMoney(G.money), 28, VIEW_H - 34);
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 14px "Trebuchet MS", sans-serif';
  ctx.fillText(`AMMO ${G.ammo} / ${G.maxAmmo}`, 150, VIEW_H - 34);
  ctx.fillStyle = '#fff';
  ctx.font = '12px "Trebuchet MS", sans-serif';
  ctx.fillText(fmtClock(G.clock), 28, VIEW_H - 18);

  // Wanted stars, top-left.
  ctx.fillStyle = 'rgba(8,12,20,0.72)';
  roundRect(ctx, 14, 14, 210, 44, 10);
  ctx.fill();
  ctx.font = 'bold 26px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < G.wanted ? '#ffd23e' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', 24 + i * 36, 46);
  }

  // Speed (driving) bottom-right.
  if (p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.32);
    ctx.fillStyle = 'rgba(8,12,20,0.72)';
    roundRect(ctx, VIEW_W - 170, VIEW_H - 78, 156, 64, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${kmh}`, VIEW_W - 66, VIEW_H - 38);
    ctx.font = 'bold 12px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#9fb3cc';
    ctx.fillText('km/h', VIEW_W - 30, VIEW_H - 38);
    ctx.fillStyle = '#f39c12';
    ctx.font = 'bold 12px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(p.car.kind === 'police' ? 'POLICE CRUISER' : p.car.kind.toUpperCase(), VIEW_W - 156, VIEW_H - 60);
  }

  // Mission progress line, top-centre.
  const prog = missionProgressText(G);
  if (prog) {
    ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
    const w = ctx.measureText(prog).width + 28;
    ctx.fillStyle = 'rgba(8,12,20,0.72)';
    roundRect(ctx, (VIEW_W - w) / 2, 14, w, 34, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.textAlign = 'center';
    ctx.fillText(prog, VIEW_W / 2, 36);
  }

  // Message toast.
  if (G.message && G.message.t > 0) {
    ctx.globalAlpha = Math.min(1, G.message.t);
    ctx.font = 'bold 16px "Trebuchet MS", sans-serif';
    const w = ctx.measureText(G.message.text).width + 30;
    ctx.fillStyle = 'rgba(8,12,20,0.8)';
    roundRect(ctx, (VIEW_W - w) / 2, 58, w, 32, 9);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(G.message.text, VIEW_W / 2, 79);
    ctx.globalAlpha = 1;
  }

  // Objective banner (mission start / complete).
  if (G.banner && G.banner.t > 0) {
    ctx.globalAlpha = Math.min(1, G.banner.t);
    ctx.fillStyle = 'rgba(8,12,20,0.82)';
    ctx.fillRect(0, 130, VIEW_W, 96);
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 34px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(G.banner.title, VIEW_W / 2, 168);
    ctx.fillStyle = '#fff';
    ctx.font = '16px "Trebuchet MS", sans-serif';
    wrapText(ctx, G.banner.sub, VIEW_W / 2, 196, 900, 22);
    ctx.globalAlpha = 1;
  }

  // Controls hint, bottom-centre (fades after a while).
  if (G.time < 25 && G.state === 'playing') {
    ctx.globalAlpha = Math.max(0, Math.min(1, (25 - G.time) / 3));
    ctx.fillStyle = 'rgba(8,12,20,0.6)';
    ctx.font = '13px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WASD move/drive · E enter/steal car · F punch · Click shoot · R reload · M mute · Esc pause', VIEW_W / 2, VIEW_H - 8);
    ctx.globalAlpha = 1;
  }
  drawMinimap(ctx, G);
}

function wrapText(ctx, text, cx, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  ctx.fillText(line, cx, yy);
}

// ---- Minimap -----------------------------------------------------------------

function drawMinimap(ctx, G) {
  const mw = 210, mh = 158;
  const mx = VIEW_W - mw - 14, my = 64;
  const sx = mw / WORLD_W, sy = mh / WORLD_H;
  ctx.fillStyle = 'rgba(8,12,20,0.78)';
  roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, mw, mh);
  ctx.clip();
  ctx.fillStyle = '#3c6b34';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#2e7fb8';
  ctx.fillRect(mx + 3050 * sx, my, (WORLD_W - 3050) * sx, mh);
  ctx.fillRect(mx, my + 2260 * sy, mw, (WORLD_H - 2260) * sy);
  ctx.fillStyle = '#5d8a4a';
  ctx.fillRect(mx + 2850 * sx, my, 200 * sx, mh);
  // Roads.
  ctx.strokeStyle = '#9aa0a8';
  ctx.lineWidth = 2;
  for (const rx of G.city.roadsV) {
    ctx.beginPath(); ctx.moveTo(mx + rx * sx, my); ctx.lineTo(mx + rx * sx, my + mh); ctx.stroke();
  }
  for (const ry of G.city.roadsH) {
    ctx.beginPath(); ctx.moveTo(mx, my + ry * sy); ctx.lineTo(mx + mw, my + ry * sy); ctx.stroke();
  }
  // Spray shop (green), mission (gold), police (blue/red), player (white).
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(mx + G.city.sprayShop.x * sx - 3, my + G.city.sprayShop.y * sy - 3, 6, 6);
  const obj = missionObjective(G);
  if (obj) {
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(mx + obj.x * sx, my + obj.y * sy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(mx + obj.x * sx, my + obj.y * sy, 8 + Math.sin(G.time * 5) * 2, 0, Math.PI * 2); ctx.stroke();
  }
  for (const car of G.cars) {
    if (car.dead || car.kind !== 'police') continue;
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(mx + car.x * sx - 2, my + car.y * sy - 2, 4, 4);
  }
  for (const ped of G.peds) {
    if (ped.dead || ped.kind !== 'cop') continue;
    ctx.fillStyle = '#3b82ff';
    ctx.fillRect(mx + ped.x * sx - 2, my + ped.y * sy - 2, 4, 4);
  }
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(mx + G.player.x * sx, my + G.player.y * sy, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#9fb3cc';
  ctx.font = 'bold 11px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PALMERA BAY', mx, my + mh + 18);
}

// ---- Screens -----------------------------------------------------------------

function menuButton(ctx, x, y, w, h, label, hovered, disabled) {
  ctx.fillStyle = disabled ? 'rgba(60,60,60,0.8)' : hovered ? '#ffd23e' : 'rgba(20,26,38,0.85)';
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = disabled ? '#555' : '#ffd23e';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = disabled ? '#888' : hovered ? '#111' : '#ffd23e';
  ctx.font = 'bold 20px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 7);
}

export function drawStartScreen(ctx, G) {
  // Sunset gradient sky over a drawn skyline silhouette.
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#ff9a56');
  grad.addColorStop(0.45, '#e85d75');
  grad.addColorStop(0.75, '#6a4a8a');
  grad.addColorStop(1, '#2b2a4a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath(); ctx.arc(1020, 130, 62, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,210,62,0.25)';
  ctx.beginPath(); ctx.arc(1020, 130, 90, 0, Math.PI * 2); ctx.fill();
  // Skyline.
  ctx.fillStyle = '#1d1a33';
  const skyline = [120, 200, 150, 260, 180, 320, 140, 240, 300, 170, 220, 130, 260, 190];
  let sx = 0;
  for (const h of skyline) {
    ctx.fillRect(sx, VIEW_H - 260 - h, 95, 260 + h);
    sx += 95;
  }
  ctx.fillStyle = '#0f0e20';
  ctx.fillRect(0, VIEW_H - 120, VIEW_W, 120);
  ctx.fillStyle = '#f5d76e';
  for (let i = 0; i < 24; i++) ctx.fillRect(30 + i * 54, VIEW_H - 118, 20, 4);
  // Title.
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.font = 'bold 76px "Trebuchet MS", sans-serif';
  ctx.fillText('PALMERA BAY', VIEW_W / 2 + 4, 154);
  ctx.fillStyle = '#fff';
  ctx.fillText('PALMERA BAY', VIEW_W / 2, 150);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 44px "Trebuchet MS", sans-serif';
  ctx.fillText('S T R E E T   H E A T', VIEW_W / 2, 205);
  ctx.fillStyle = '#fff';
  ctx.font = '17px "Trebuchet MS", sans-serif';
  wrapText(ctx, 'Marco Reyes is back in Palmera Bay — and he owes Madame Sol. Drive, steal, outrun the law, and run her five jobs to pay the debt.', VIEW_W / 2, 250, 820, 24);

  const mx = G.input.mousePos();
  const bw = 320, bh = 54, bx = (VIEW_W - bw) / 2;
  const btns = [
    { label: 'NEW GAME', y: 330, enabled: true, action: 'new' },
    { label: 'CONTINUE', y: 396, enabled: G.saveExists, action: 'continue' },
    { label: 'HOW TO PLAY', y: 462, enabled: true, action: 'help' },
  ];
  G.menuButtons = btns.map((b) => ({ ...b, x: bx, w: bw, h: bh }));
  for (const b of G.menuButtons) {
    const hov = mx.x >= b.x && mx.x <= b.x + b.w && mx.y >= b.y && mx.y <= b.y + b.h && b.enabled;
    menuButton(ctx, b.x, b.y, b.w, b.h, b.label, hov, !b.enabled);
  }
  if (G.showHelp) {
    ctx.fillStyle = 'rgba(8,12,20,0.92)';
    roundRect(ctx, 240, 540, 800, 150, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '15px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'left';
    const lines = [
      'WASD — walk / drive    SHIFT — run    E — enter, exit or steal a car',
      'F — punch    MOUSE CLICK — shoot pistol    R — reload    M — mute',
      'Steal a car near police to raise your wanted level. Lose the cops,',
      'or pay $150 at the green SPRAY SHOP to clear your stars. ESC — pause.',
    ];
    lines.forEach((l, i) => ctx.fillText(l, 270, 575 + i * 26));
  } else {
    ctx.fillStyle = '#cfd8e6';
    ctx.font = '14px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WASD move · E enter car · F punch · Click shoot · ESC pause · M mute', VIEW_W / 2, 580);
    ctx.fillText('An original game — city, characters, story and music made for this entry. No Rockstar content.', VIEW_W / 2, 610);
    ctx.fillText('v1.0 · plays offline · saves to this browser', VIEW_W / 2, 640);
  }
}

export function drawPauseScreen(ctx, G) {
  ctx.fillStyle = 'rgba(5,8,14,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 44px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', VIEW_W / 2, 180);
  const mx = G.input.mousePos();
  const bw = 320, bh = 54, bx = (VIEW_W - bw) / 2;
  const btns = [
    { label: 'RESUME', y: 240, action: 'resume' },
    { label: 'SAVE GAME', y: 306, action: 'save' },
    { label: 'RESTART MISSION', y: 372, action: 'restart-mission' },
    { label: 'QUIT TO MENU', y: 438, action: 'menu' },
  ];
  G.pauseButtons = btns.map((b) => ({ ...b, x: bx, w: bw, h: bh }));
  for (const b of G.pauseButtons) {
    const hov = mx.x >= b.x && mx.x <= b.x + b.w && mx.y >= b.y && mx.y <= b.y + b.h;
    menuButton(ctx, b.x, b.y, b.w, b.h, b.label, hov, false);
  }
  ctx.fillStyle = '#cfd8e6';
  ctx.font = '15px "Trebuchet MS", sans-serif';
  ctx.fillText(`Mission: ${G.mission.index >= 0 ? MISSION_DEFS[G.mission.index].title : 'Free roam'} · ${fmtMoney(G.money)} · Wanted ${G.wanted}★`, VIEW_W / 2, 540);
  ctx.fillText('M mute · saves are stored in this browser (localStorage)', VIEW_W / 2, 570);
}

export function drawGameOverScreen(ctx, G) {
  ctx.fillStyle = 'rgba(20,4,6,0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 64px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BUSTED', VIEW_W / 2, 260);
  ctx.fillStyle = '#fff';
  ctx.font = '20px "Trebuchet MS", sans-serif';
  ctx.fillText('Marco went down in Palmera Bay. Madame Sol is not amused.', VIEW_W / 2, 310);
  ctx.fillText(`You earned ${fmtMoney(G.money)} · ${G.stats.kills} taken down · ${G.stats.carsStolen} cars stolen`, VIEW_W / 2, 350);
  const mx = G.input.mousePos();
  const bw = 320, bh = 54, bx = (VIEW_W - bw) / 2;
  const btns = [
    { label: 'TRY AGAIN', y: 410, action: 'retry' },
    { label: 'MAIN MENU', y: 476, action: 'menu' },
  ];
  G.overButtons = btns.map((b) => ({ ...b, x: bx, w: bw, h: bh }));
  for (const b of G.overButtons) {
    const hov = mx.x >= b.x && mx.x <= b.x + b.w && mx.y >= b.y && mx.y <= b.y + b.h;
    menuButton(ctx, b.x, b.y, b.w, b.h, b.label, hov, false);
  }
}

export function drawWinScreen(ctx, G) {
  ctx.fillStyle = 'rgba(4,20,10,0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 56px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DEBT PAID', VIEW_W / 2, 240);
  ctx.fillStyle = '#fff';
  ctx.font = '20px "Trebuchet MS", sans-serif';
  wrapText(ctx, 'All five jobs done. Madame Sol’s ledger is closed, the Big Score is yours, and Palmera Bay belongs to Marco Reyes — for now.', VIEW_W / 2, 300, 820, 28);
  ctx.fillText(`Final take: ${fmtMoney(G.money)} · ${G.stats.kills} taken down · ${G.stats.carsStolen} cars stolen`, VIEW_W / 2, 380);
  const mx = G.input.mousePos();
  const bw = 320, bh = 54, bx = (VIEW_W - bw) / 2;
  const btns = [
    { label: 'KEEP PLAYING (FREE ROAM)', y: 430, action: 'freeroam' },
    { label: 'MAIN MENU', y: 496, action: 'menu' },
  ];
  G.winButtons = btns.map((b) => ({ ...b, x: bx, w: bw, h: bh }));
  for (const b of G.winButtons) {
    const hov = mx.x >= b.x && mx.x <= b.x + b.w && mx.y >= b.y && mx.y <= b.y + b.h;
    menuButton(ctx, b.x, b.y, b.w, b.h, b.label, hov, false);
  }
}

// ---- Main draw entry ---------------------------------------------------------

export function drawGame(ctx, G) {
  const p = G.player;
  const shakeX = (Math.random() - 0.5) * G.shake;
  const shakeY = (Math.random() - 0.5) * G.shake;
  const cam = {
    x: Math.max(0, Math.min(WORLD_W - VIEW_W, p.x - VIEW_W / 2 + shakeX)),
    y: Math.max(0, Math.min(WORLD_H - VIEW_H, p.y - VIEW_H / 2 + shakeY)),
  };
  G.camera = cam;
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  drawWorld(ctx, G, cam);
  drawEntities(ctx, G, cam);
  ctx.restore();
  // Damage flash.
  if (G.flash > 0) {
    ctx.fillStyle = `rgba(220,30,30,${G.flash * 0.5})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  drawOffscreenObjectiveArrow(ctx, G, cam);
  drawHUD(ctx, G);
  // Mute indicator.
  if (G.sound.muted) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('MUTED (M)', VIEW_W - 16, VIEW_H - 118);
  }
}
