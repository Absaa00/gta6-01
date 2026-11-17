// entities.js — cars, pedestrians, police, bullets and particles.
// Traffic cars follow the road grid; police cars chase the player; peds
// stroll the sidewalks and flee when scared.

import { WORLD_W, WORLD_H, ROAD_W, collideCircleBuildings, onRoad, nearestRoadV, nearestRoadH, inWater } from './world.js';

export const CAR_COLORS = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#e67e22', '#ecf0f1', '#2c3e50', '#16a085', '#d35400'];
export const TAXI_COLOR = '#f1c40f';
export const POLICE_COLOR = '#1b4f9c';

let nextId = 1;
export function newId() { return nextId++; }

export function makeCar(x, y, angle, kind, color) {
  return {
    id: newId(), x, y, angle, speed: 0, kind, // sedan | taxi | sport | truck | police
    color: color || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    w: kind === 'truck' ? 62 : 46, h: kind === 'truck' ? 26 : 22,
    hp: kind === 'police' ? 120 : 100,
    driver: null,            // a Ped object, or 'player', or null (parked)
    ai: null,                // traffic AI state for NPC cars
    wanted: false,
    dead: false,
    brakeLight: false,
    skid: 0,
  };
}

export function makePed(x, y, kind) {
  const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#fd79a8'];
  return {
    id: newId(), x, y, angle: Math.random() * Math.PI * 2,
    speed: 28 + Math.random() * 22, kind: kind || 'walker', // walker | driver | cop | goon | rival
    color: colors[Math.floor(Math.random() * colors.length)],
    hp: kind === 'goon' ? 60 : kind === 'cop' ? 50 : 30,
    state: 'walk',           // walk | flee | chase | shoot | dead
    target: null,
    shootCd: 1 + Math.random(),
    dead: false,
    walkPhase: Math.random() * 10,
  };
}

export function makeBullet(x, y, angle, speed, dmg, from) {
  return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.8, dmg, from };
}

export function makeParticle(x, y, opts = {}) {
  return {
    x, y,
    vx: opts.vx || 0, vy: opts.vy || 0,
    life: opts.life || 0.5, maxLife: opts.life || 0.5,
    size: opts.size || 3, color: opts.color || '#ffffff',
    gravity: opts.gravity || 0, drag: opts.drag || 0.98,
  };
}

// ---- Spawning ---------------------------------------------------------------

export function spawnTraffic(G, n) {
  const city = G.city;
  for (let i = 0; i < n; i++) {
    const vertical = Math.random() < 0.5;
    let x, y, angle;
    if (vertical) {
      x = city.roadsV[Math.floor(Math.random() * city.roadsV.length)] + (Math.random() < 0.5 ? 22 : -22);
      y = 100 + Math.random() * (WORLD_H - 300);
      angle = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = 100 + Math.random() * 2600;
      y = city.roadsH[Math.floor(Math.random() * city.roadsH.length)] + (Math.random() < 0.5 ? 22 : -22);
      angle = Math.random() < 0.5 ? 0 : Math.PI;
    }
    const kind = Math.random() < 0.12 ? 'taxi' : Math.random() < 0.1 ? 'sport' : Math.random() < 0.08 ? 'truck' : 'sedan';
    const car = makeCar(x, y, angle, kind, kind === 'taxi' ? TAXI_COLOR : undefined);
    car.driver = makePed(x, y, 'driver');
    car.ai = { cruise: 120 + Math.random() * 70, dir: angle, lane: 22, stuck: 0 };
    car.speed = car.ai.cruise;
    G.cars.push(car);
  }
}

export function spawnParkedCars(G, n) {
  const city = G.city;
  const spots = [
    { x: 700, y: 260 }, { x: 1120, y: 260 }, { x: 1520, y: 660 }, { x: 2300, y: 260 },
    { x: 300, y: 660 }, { x: 1900, y: 1060 }, { x: 700, y: 1460 }, { x: 1500, y: 1860 },
    { x: 2400, y: 1460 }, { x: 1100, y: 1860 }, { x: 2600, y: 660 }, { x: 1900, y: 660 },
  ];
  for (let i = 0; i < Math.min(n, spots.length); i++) {
    const s = spots[i];
    const car = makeCar(s.x, s.y, (Math.random() < 0.5 ? 0 : Math.PI / 2), 'sedan');
    car.driver = null; // parked, empty
    G.cars.push(car);
  }
}

export function spawnPedestrians(G, n) {
  const city = G.city;
  for (let i = 0; i < n; i++) {
    const rx = city.roadsV[Math.floor(Math.random() * city.roadsV.length)];
    const ry = city.roadsH[Math.floor(Math.random() * city.roadsH.length)];
    const p = makePed(rx + (Math.random() < 0.5 ? 1 : -1) * (ROAD_W / 2 + 14), ry + (Math.random() * 200 - 100), 'walker');
    p.angle = Math.random() * Math.PI * 2;
    G.peds.push(p);
  }
}

export function spawnPoliceCar(G, nearX, nearY) {
  // Spawn on a road near the player, just off-screen when possible.
  const city = G.city;
  const rx = nearestRoadV(nearX, city);
  const ry = nearestRoadH(nearY, city);
  const car = makeCar(rx + 22, ry - 22, Math.atan2(nearY - (ry - 22), nearX - (rx + 22)), 'police', POLICE_COLOR);
  car.driver = makePed(car.x, car.y, 'cop');
  car.ai = { police: true, cruise: 300 };
  car.speed = 180;
  G.cars.push(car);
  return car;
}

export function spawnFootCop(G, x, y) {
  const p = makePed(x, y, 'cop');
  p.state = 'chase';
  G.peds.push(p);
  return p;
}

// ---- Car physics ------------------------------------------------------------

function carCollideBuildings(car, G) {
  // Approximate the car as a circle at its centre for building collision.
  const r = Math.max(car.w, car.h) * 0.42;
  const fixed = collideCircleBuildings(car.x, car.y, r, G.city);
  if (fixed.x !== car.x || fixed.y !== car.y) {
    if (Math.abs(car.speed) > 120) {
      G.sound.crash();
      car.hp -= 8;
      addCrashSparks(G, car.x, car.y);
    }
    car.speed *= 0.4;
    car.x = fixed.x; car.y = fixed.y;
  }
  if (inWater(car.x, car.y, G.city)) {
    // Bounce off the water edge: push back along the car's travel.
    car.speed *= -0.3;
    car.x -= Math.cos(car.angle) * 30;
    car.y -= Math.sin(car.angle) * 30;
  }
}

export function updatePlayerCar(G, dt) {
  const car = G.player.car;
  const input = G.input;
  const fwd = input.axis('s', 'w');
  const steer = input.axis('a', 'd');
  const maxSpeed = car.kind === 'sport' ? 480 : car.kind === 'truck' ? 320 : 420;
  const accel = 340;
  if (fwd > 0) car.speed += accel * dt;
  else if (fwd < 0) car.speed -= (car.speed > 0 ? 520 : 200) * dt; // brake / reverse
  else car.speed -= Math.sign(car.speed) * 140 * dt;              // drag
  if (Math.abs(car.speed) < 4 && fwd === 0) car.speed = 0;
  car.speed = Math.max(-170, Math.min(maxSpeed, car.speed));
  const steerRate = 2.4 * Math.min(1, Math.abs(car.speed) / 120 + 0.25);
  car.angle += steer * steerRate * dt * Math.sign(car.speed);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.brakeLight = fwd < 0 || (fwd === 0 && Math.abs(car.speed) > 60);
  car.skid = Math.abs(steer) > 0 && Math.abs(car.speed) > 240 ? car.skid + dt : 0;
  if (car.skid > 0.05) {
    const bx = car.x - Math.cos(car.angle) * car.w * 0.4;
    const by = car.y - Math.sin(car.angle) * car.h * 0.4;
    G.particles.push(makeParticle(bx, by, { vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, life: 0.4, size: 4, color: '#555' }));
    car.skid = 0;
  }
  carCollideBuildings(car, G);
  G.player.x = car.x; G.player.y = car.y; G.player.angle = car.angle;
}

// ---- Traffic AI -------------------------------------------------------------

function trafficTurnAtIntersection(car, G) {
  const city = G.city;
  const nearV = city.roadsV.some((rx) => Math.abs(car.x - rx) < 60);
  const nearH = city.roadsH.some((ry) => Math.abs(car.y - ry) < 60);
  if (!nearV || !nearH) return;
  if (Math.random() < 0.35) {
    // Turn left or right (90 degrees).
    car.angle += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
    car.ai.dir = car.angle;
  }
}

export function updateTrafficCar(G, car, dt) {
  const ai = car.ai;
  if (!ai) return;
  if (ai.police) { updatePoliceCar(G, car, dt); return; }
  // Cruise toward current heading, snapped to the nearest road lane.
  const targetSpeed = ai.cruise;
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
  // Gentle steering toward the heading; snap onto the lane centre.
  const desired = ai.dir;
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += diff * Math.min(1, dt * 4);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Keep on roads: if we drifted off the grid, steer back to nearest road.
  if (!onRoad(car.x, car.y, G.city)) {
    const rx = nearestRoadV(car.x, G.city);
    const ry = nearestRoadH(car.y, G.city);
    if (Math.abs(car.x - rx) < Math.abs(car.y - ry)) {
      ai.dir = car.y < ry ? Math.PI / 2 : -Math.PI / 2;
      car.y += Math.sign(ry - car.y) * car.speed * dt * 0.3;
    } else {
      ai.dir = car.x < rx ? 0 : Math.PI;
      car.x += Math.sign(rx - car.x) * car.speed * dt * 0.3;
    }
  }
  trafficTurnAtIntersection(car, G);
  // Wrap around the world edges so traffic never runs dry.
  if (car.x < 40) { car.x = 40; ai.dir = 0; }
  if (car.x > WORLD_W - 40) { car.x = WORLD_W - 40; ai.dir = Math.PI; }
  if (car.y < 40) { car.y = 40; ai.dir = Math.PI / 2; }
  if (car.y > WORLD_H - 40) { car.y = WORLD_H - 40; ai.dir = -Math.PI / 2; }
  carCollideBuildings(car, G);
  // Slow for the car ahead (cheap check against nearby cars).
  for (const other of G.cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x, dy = other.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d < 70 && d > 1) {
      const ahead = Math.cos(car.angle) * dx + Math.sin(car.angle) * dy;
      if (ahead > 0) car.speed = Math.min(car.speed, other.speed * 0.9);
    }
  }
}

// ---- Police AI --------------------------------------------------------------

export function updatePoliceCar(G, car, dt) {
  const p = G.player;
  const dx = p.x - car.x, dy = p.y - car.y;
  const dist = Math.hypot(dx, dy);
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff * 3 * dt));
  const targetSpeed = dist > 320 ? 430 : dist > 90 ? 340 : 220;
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 2);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  carCollideBuildings(car, G);
  // Ram the player: damage on hard contact.
  if (dist < 46) {
    if (Math.abs(car.speed) > 150) {
      damagePlayer(G, 6, 'police ram');
      G.shake = Math.max(G.shake, 8);
      G.sound.crash();
      car.speed *= 0.5;
    }
    // Shove the player's car.
    const push = 60 * dt;
    if (p.car) { p.car.x += (dx / (dist || 1)) * push * -1; p.car.y += (dy / (dist || 1)) * push * -1; }
  }
  // Give up if the player escaped far away.
  if (dist > 1400) { car.dead = true; }
}

// ---- Pedestrians ------------------------------------------------------------

export function updatePed(G, ped, dt) {
  if (ped.dead) return;
  ped.walkPhase += dt * 6;
  const p = G.player;
  if (ped.state === 'flee') {
    const dx = ped.x - p.x, dy = ped.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    ped.angle = Math.atan2(dy, dx);
    ped.x += Math.cos(ped.angle) * 150 * dt;
    ped.y += Math.sin(ped.angle) * 150 * dt;
    if (d > 500) ped.state = 'walk';
  } else if (ped.state === 'chase') {
    const dx = p.x - ped.x, dy = p.y - ped.y;
    const d = Math.hypot(dx, dy) || 1;
    ped.angle = Math.atan2(dy, dx);
    const sp = ped.kind === 'cop' ? 165 : 140;
    ped.x += Math.cos(ped.angle) * sp * dt;
    ped.y += Math.sin(ped.angle) * sp * dt;
    if (d < 30) {
      // Cop or goon punches the player.
      if (ped.kind === 'cop' || ped.kind === 'goon') {
        damagePlayer(G, 4, 'beaten');
        G.shake = Math.max(G.shake, 3);
      }
    }
    if (d > 900) ped.state = 'walk';
  } else if (ped.state === 'shoot') {
    const dx = p.x - ped.x, dy = p.y - ped.y;
    const d = Math.hypot(dx, dy) || 1;
    ped.angle = Math.atan2(dy, dx);
    ped.shootCd -= dt;
    if (d < 420 && ped.shootCd <= 0) {
      ped.shootCd = 1.1 + Math.random() * 0.8;
      const spread = (Math.random() - 0.5) * 0.25;
      G.bullets.push(makeBullet(ped.x, ped.y, ped.angle + spread, 620, 7, 'enemy'));
      G.sound.enemyShoot();
      G.particles.push(makeParticle(ped.x + Math.cos(ped.angle) * 14, ped.y + Math.sin(ped.angle) * 14, { life: 0.08, size: 6, color: '#ffd23e' }));
    }
    if (d > 500) ped.state = 'walk';
  } else {
    // Stroll along the sidewalk; turn at random, avoid buildings.
    if (Math.random() < dt * 0.15) ped.angle += (Math.random() - 0.5) * 1.6;
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    if (ped.x < 30 || ped.x > WORLD_W - 30 || ped.y < 30 || ped.y > WORLD_H - 30) ped.angle += Math.PI;
    if (!onRoad(ped.x, ped.y, G.city) && Math.random() < dt * 0.5) ped.angle += Math.PI / 2;
  }
  const fixed = collideCircleBuildings(ped.x, ped.y, 11, G.city);
  ped.x = fixed.x; ped.y = fixed.y;
}

// ---- Bullets & particles ----------------------------------------------------

export function updateBullets(G, dt) {
  for (const b of G.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    // Hit a building?
    if (G.city && inBuildingPoint(b.x, b.y, G.city)) {
      b.life = 0;
      addHitSparks(G, b.x, b.y);
      continue;
    }
    if (b.from === 'player') {
      // Hit an enemy ped.
      for (const ped of G.peds) {
        if (ped.dead || ped.kind === 'walker' || ped.kind === 'driver') continue;
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 16) {
          ped.hp -= b.dmg;
          b.life = 0;
          addHitSparks(G, b.x, b.y);
          if (ped.hp <= 0) killPed(G, ped);
          break;
        }
      }
      if (b.life <= 0) continue;
      // Hit a car (police / rival).
      for (const car of G.cars) {
        if (car.dead || car === G.player.car) continue;
        const dx = b.x - car.x, dy = b.y - car.y;
        const localX = Math.cos(-car.angle) * dx - Math.sin(-car.angle) * dy;
        const localY = Math.sin(-car.angle) * dx + Math.cos(-car.angle) * dy;
        if (Math.abs(localX) < car.w / 2 + 4 && Math.abs(localY) < car.h / 2 + 4) {
          car.hp -= b.dmg;
          b.life = 0;
          addHitSparks(G, b.x, b.y);
          if (car.hp <= 0) explodeCar(G, car);
          break;
        }
      }
    } else {
      // Enemy bullet vs the player.
      const p = G.player;
      const r = p.car ? 24 : 13;
      if (Math.hypot(p.x - b.x, p.y - b.y) < r) {
        damagePlayer(G, b.dmg, 'shot');
        b.life = 0;
        addHitSparks(G, b.x, b.y);
      }
    }
  }
  G.bullets = G.bullets.filter((b) => b.life > 0);
}

function inBuildingPoint(x, y, city) {
  for (const b of city.buildings) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  }
  return false;
}

export function updateParticles(G, dt) {
  for (const pt of G.particles) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= pt.drag;
    pt.vy *= pt.drag;
    pt.vy += pt.gravity * dt;
  }
  G.particles = G.particles.filter((pt) => pt.life > 0);
}

export function addHitSparks(G, x, y) {
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    G.particles.push(makeParticle(x, y, { vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, life: 0.25, size: 2, color: '#ffd23e' }));
  }
}

export function addCrashSparks(G, x, y) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    G.particles.push(makeParticle(x, y, { vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, life: 0.4, size: 3, color: '#ff9f1c' }));
  }
}

export function explodeCar(G, car) {
  car.dead = true;
  G.shake = Math.max(G.shake, 16);
  G.flash = 0.35;
  G.sound.explosion();
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 240;
    G.particles.push(makeParticle(car.x, car.y, {
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.5 + Math.random() * 0.6, size: 4 + Math.random() * 5,
      color: ['#ff5c1c', '#ffd23e', '#555', '#ff8c42'][i % 4],
    }));
  }
  if (car.driver && car.driver.kind !== 'player') {
    car.driver.dead = true;
  }
  if (G.mission) G.mission.onCarDestroyed?.(G, car);
}

export function killPed(G, ped) {
  ped.dead = true;
  ped.state = 'dead';
  G.stats.kills++;
  for (let i = 0; i < 8; i++) {
    G.particles.push(makeParticle(ped.x, ped.y, {
      vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160,
      life: 0.4, size: 3, color: '#c0392b',
    }));
  }
  if (G.mission) G.mission.onPedKilled?.(G, ped);
}

// ---- Player damage / wanted -------------------------------------------------

export function damagePlayer(G, amount, cause) {
  const p = G.player;
  if (p.invuln > 0 || G.state !== 'playing') return;
  let rest = amount;
  if (G.armor > 0) {
    const absorbed = Math.min(G.armor, rest);
    G.armor -= absorbed;
    rest -= absorbed;
  }
  G.health -= rest;
  G.flash = Math.max(G.flash, 0.25);
  p.invuln = 0.35;
  if (G.health <= 0) {
    G.health = 0;
    G.state = 'gameover';
    G.sound.explosion();
  }
}

export function setWanted(G, level, reason) {
  const before = G.wanted;
  G.wanted = Math.max(0, Math.min(5, level));
  G.wantedTimer = 0;
  if (G.wanted > before) {
    G.sound.wantedUp();
    G.setMessage(`WANTED ${G.wanted}★ — ${reason || 'the heat is on!'}`, 3);
  }
}

/** Wanted decays when no police can see the player for a while. */
export function updateWanted(G, dt) {
  if (G.wanted <= 0) return;
  const p = G.player;
  let policeNear = false;
  for (const car of G.cars) {
    if (car.kind === 'police' && !car.dead && Math.hypot(car.x - p.x, car.y - p.y) < 650) { policeNear = true; break; }
  }
  if (!policeNear) {
    for (const ped of G.peds) {
      if (ped.kind === 'cop' && !ped.dead && Math.hypot(ped.x - p.x, ped.y - p.y) < 450) { policeNear = true; break; }
    }
  }
  if (policeNear) {
    G.wantedTimer = 0;
    G.heatTimer = 0;
  } else {
    G.wantedTimer += dt;
    if (G.wantedTimer > 7) {
      G.wantedTimer = 0;
      setWanted(G, G.wanted - 1, 'you slipped away');
      if (G.wanted > 0) G.setMessage(`Wanted dropped to ${G.wanted}★ — keep laying low`, 2.5);
    }
  }
  // Spawn police to match the wanted level (cap by level).
  const wantCars = G.wanted >= 3 ? 3 : G.wanted >= 1 ? 1 : 0;
  const haveCars = G.cars.filter((c) => c.kind === 'police' && !c.dead).length;
  G.policeSpawnCd = (G.policeSpawnCd || 0) - dt;
  if (haveCars < wantCars && G.policeSpawnCd <= 0) {
    spawnPoliceCar(G, p.x + (Math.random() - 0.5) * 800, p.y + (Math.random() - 0.5) * 800);
    G.policeSpawnCd = 4;
  }
  const wantCops = G.wanted >= 2 ? 2 : 0;
  const haveCops = G.peds.filter((pd) => pd.kind === 'cop' && !pd.dead && pd.state === 'chase').length;
  if (haveCops < wantCops && G.policeSpawnCd <= 0) {
    spawnFootCop(G, p.x + (Math.random() < 0.5 ? -1 : 1) * 300, p.y + (Math.random() < 0.5 ? -1 : 1) * 300);
    G.policeSpawnCd = 4;
  }
}

// ---- Car-to-car collisions (simple circle push-apart) ------------------------

export function resolveCarCollisions(G) {
  const cars = G.cars.filter((c) => !c.dead);
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = 34;
      if (d < min && d > 0.01) {
        const push = (min - d) / 2;
        const nx = dx / d, ny = dy / d;
        const aPlayer = a === G.player.car, bPlayer = b === G.player.car;
        if (!aPlayer) { a.x -= nx * push; a.y -= ny * push; }
        if (!bPlayer) { b.x += nx * push; b.y += ny * push; }
        const impact = Math.abs(a.speed - b.speed);
        if (impact > 180) {
          a.hp -= 5; b.hp -= 5;
          G.sound.crash();
          addCrashSparks(G, (a.x + b.x) / 2, (a.y + b.y) / 2);
          if (a.hp <= 0) explodeCar(G, a);
          if (b.hp <= 0) explodeCar(G, b);
        }
        a.speed *= 0.7; b.speed *= 0.7;
      }
    }
  }
}
