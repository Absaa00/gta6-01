// main.js — Palmera Bay: Street Heat. Entry point and game loop.
// Wires input, world, entities, missions, audio and rendering together.
// State machine: menu -> playing <-> paused, gameover, win.
// Save lives in localStorage under SAVE_KEY. A ?scene= query param stages
// a deterministic scene for screenshots (drive / chase / mission / start).

import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { buildCity, WORLD_W, WORLD_H, collideCircleBuildings, onRoad } from './world.js';
import {
  makeCar, makePed, makeBullet, makeParticle, spawnTraffic, spawnParkedCars,
  spawnPedestrians, spawnPoliceCar, updatePlayerCar, updateTrafficCar,
  updatePed, updateBullets, updateParticles, resolveCarCollisions,
  updateWanted, setWanted, damagePlayer, explodeCar, killPed, addHitSparks,
} from './entities.js';
import {
  createMissionState, startMission, updateMission, missionObjective, MISSION_DEFS,
} from './missions.js';
import { drawGame, drawStartScreen, drawPauseScreen, drawGameOverScreen, drawWinScreen } from './render.js';

const SAVE_KEY = 'palmera-bay-save-v1';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const G = {
  state: 'menu',           // menu | playing | paused | gameover | win
  time: 0,
  clock: 8 * 60,           // minutes since midnight; the story starts at 08:00
  money: 50,
  health: 100,
  armor: 0,
  ammo: 12,
  maxAmmo: 12,
  wanted: 0,
  wantedTimer: 0,
  policeSpawnCd: 0,
  player: {
    x: 700, y: 700, angle: 0, speed: 0,
    car: null, invuln: 0, onFootSpeed: 0,
  },
  cars: [], peds: [], bullets: [], particles: [], pickups: [],
  city: null,
  mission: null,
  lastMission: -1,
  nextMissionIn: 0,
  storyDone: false,
  stats: { kills: 0, carsStolen: 0 },
  camera: { x: 0, y: 0 },
  shake: 0, flash: 0,
  message: null, banner: null,
  aiming: false,
  shootCd: 0,
  punchCd: 0,
  reloadT: 0,
  sprayT: 0,
  saveExists: false,
  showHelp: false,
  menuButtons: [], pauseButtons: [], overButtons: [], winButtons: [],
  input: null,
  sound: new SoundEngine(),
};

G.input = new Input(canvas);
G.city = buildCity(20261117);
G.mission = createMissionState();

// ---- Messaging ---------------------------------------------------------------

G.setMessage = function (text, seconds) { G.message = { text, t: seconds || 3 }; };
G.setBanner = function (title, sub, seconds) { G.banner = { title, sub, t: seconds || 4 }; };

// ---- Save / load ---------------------------------------------------------------

G.saveGame = function (silent) {
  try {
    const save = {
      v: 1,
      x: G.player.x, y: G.player.y, angle: G.player.angle,
      money: G.money, health: G.health, armor: G.armor, ammo: G.ammo,
      clock: G.clock, wanted: G.wanted,
      lastMission: G.lastMission, storyDone: G.storyDone,
      stats: G.stats, time: G.time,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    G.saveExists = true;
    if (!silent) G.setMessage('Game saved.', 2);
  } catch (e) { /* storage unavailable: play on without saving */ }
};

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1) return null;
    return s;
  } catch (e) { return null; }
}

G.saveExists = !!loadSave();

// ---- World (re)spawn -------------------------------------------------------------

function resetWorld() {
  G.cars = [];
  G.peds = [];
  G.bullets = [];
  G.particles = [];
  G.pickups = [];
  G.mission = createMissionState();
  G.lastMission = -1;
  G.nextMissionIn = 0;
  G.storyDone = false;
  G.wanted = 0;
  G.wantedTimer = 0;
  G.stats = { kills: 0, carsStolen: 0 };
  G.clock = 8 * 60;
  G.time = 0;
  spawnTraffic(G, 14);
  spawnParkedCars(G, 10);
  spawnPedestrians(G, 26);
  // Health / armor / ammo pickups from the city's fixed spots.
  for (const s of G.city.pickupSpots) G.pickups.push({ x: s.x, y: s.y, kind: s.kind, t: 0 });
  // A parked car right by the spawn point so the first drive is one key away.
  const starter = makeCar(760, 700, 0, 'sedan', '#c0392b');
  G.cars.push(starter);
}

function newGame() {
  resetWorld();
  G.money = 50;
  G.health = 100;
  G.armor = 0;
  G.ammo = 12;
  G.player.x = 700; G.player.y = 700; G.player.angle = 0;
  G.player.car = null;
  G.state = 'playing';
  G.sound.init();
  G.sound.startMusic();
  G.setBanner('PALMERA BAY', 'Marco Reyes is back. Madame Sol is waiting at her cafe — follow the gold marker.', 5);
  G.nextMissionIn = 2.5;
}

function continueGame() {
  const s = loadSave();
  if (!s) { newGame(); return; }
  resetWorld();
  G.money = s.money; G.health = s.health; G.armor = s.armor; G.ammo = s.ammo;
  G.clock = s.clock; G.wanted = s.wanted;
  G.lastMission = s.lastMission; G.storyDone = s.storyDone;
  G.stats = s.stats || G.stats;
  G.player.x = s.x; G.player.y = s.y; G.player.angle = s.angle;
  G.player.car = null;
  G.state = 'playing';
  G.sound.init();
  G.sound.startMusic();
  G.setBanner('WELCOME BACK', 'Your save was loaded. The city kept moving without you.', 4);
  G.nextMissionIn = 3;
}

// ---- Player: on foot -------------------------------------------------------------

function updatePlayerOnFoot(G, dt) {
  const p = G.player;
  const input = G.input;
  const mx = input.axis('a', 'd');
  const my = input.axis('w', 's');
  const run = input.down('shift');
  const speed = run ? 250 : 150;
  let vx = 0, vy = 0;
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    vx = (mx / len) * speed;
    vy = (my / len) * speed;
    p.angle = Math.atan2(vy, vx);
  }
  p.x += vx * dt;
  p.y += vy * dt;
  const fixed = collideCircleBuildings(p.x, p.y, 12, G.city);
  p.x = fixed.x; p.y = fixed.y;
  // Aim at the mouse when the pistol is out.
  const m = input.mousePos();
  const wx = m.x + G.camera.x, wy = m.y + G.camera.y;
  G.aiming = input.down('mouse0') || G.ammo < G.maxAmmo;
  if (input.down('mouse0')) p.angle = Math.atan2(wy - p.y, wx - p.x);
  p.invuln = Math.max(0, p.invuln - dt);
}

// ---- Shooting / punching ---------------------------------------------------------

function updateCombat(G, dt) {
  const p = G.player;
  const input = G.input;
  G.shootCd -= dt;
  G.punchCd -= dt;
  if (G.reloadT > 0) {
    G.reloadT -= dt;
    if (G.reloadT <= 0) { G.ammo = G.maxAmmo; G.setMessage('Reloaded.', 1.2); }
    return;
  }
  if (input.wasPressed('r') && G.ammo < G.maxAmmo) {
    G.reloadT = 0.9;
    G.sound.reload();
    return;
  }
  // Punch: F, short-range arc in front of the player.
  if (input.wasPressed('f') && G.punchCd <= 0 && !p.car) {
    G.punchCd = 0.45;
    G.sound.punch();
    const hx = p.x + Math.cos(p.angle) * 26, hy = p.y + Math.sin(p.angle) * 26;
    for (const ped of G.peds) {
      if (ped.dead) continue;
      if (Math.hypot(ped.x - hx, ped.y - hy) < 30) {
        ped.hp -= 22;
        ped.state = 'flee';
        addHitSparks(G, ped.x, ped.y);
        if (ped.hp <= 0) killPed(G, ped);
        else if (ped.kind === 'cop' || ped.kind === 'goon') setWanted(G, Math.max(G.wanted, 1), 'you hit a cop');
      }
    }
    for (const car of G.cars) {
      if (car.dead || car === p.car) continue;
      if (Math.hypot(car.x - hx, car.y - hy) < 34) { car.hp -= 10; if (car.hp <= 0) explodeCar(G, car); }
    }
  }
  // Shoot: hold / click the mouse.
  if (input.down('mouse0') && G.shootCd <= 0 && !p.car) {
    if (G.ammo <= 0) {
      G.shootCd = 0.3;
      G.sound.reload();
      G.reloadT = 0.9;
      return;
    }
    G.shootCd = 0.22;
    G.ammo--;
    const m = input.mousePos();
    const wx = m.x + G.camera.x, wy = m.y + G.camera.y;
    const ang = Math.atan2(wy - p.y, wx - p.x);
    G.bullets.push(makeBullet(p.x + Math.cos(ang) * 18, p.y + Math.sin(ang) * 18, ang, 760, 26, 'player'));
    G.sound.shoot();
    G.shake = Math.max(G.shake, 2);
    G.particles.push(makeParticle(p.x + Math.cos(ang) * 20, p.y + Math.sin(ang) * 20, { life: 0.07, size: 7, color: '#ffd23e' }));
    if (G.wanted < 1) {
      // Firing a gun in public draws attention.
      let copNear = false;
      for (const ped of G.peds) if (ped.kind === 'cop' && !ped.dead && Math.hypot(ped.x - p.x, ped.y - p.y) < 500) copNear = true;
      for (const car of G.cars) if (car.kind === 'police' && !car.dead && Math.hypot(car.x - p.x, car.y - p.y) < 500) copNear = true;
      if (copNear) setWanted(G, 1, 'shots fired near the police');
    }
  }
}

// ---- Entering / stealing cars ------------------------------------------------------

function nearestCar(G, maxDist) {
  const p = G.player;
  let best = null, bd = maxDist;
  for (const car of G.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

function enterCar(G, car) {
  const p = G.player;
  if (car.driver && car.driver !== 'player') {
    // Steal: the driver bails out and runs.
    const driver = car.driver;
    driver.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    driver.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    driver.state = 'flee';
    G.peds.push(driver);
    car.driver = 'player';
    G.stats.carsStolen++;
    G.setMessage('Car stolen!', 2);
    // Stealing in front of the police raises the wanted level.
    let copNear = false;
    for (const ped of G.peds) if (ped.kind === 'cop' && !ped.dead && Math.hypot(ped.x - p.x, ped.y - p.y) < 420) copNear = true;
    for (const c of G.cars) if (c.kind === 'police' && !c.dead && Math.hypot(c.x - p.x, c.y - p.y) < 420) copNear = true;
    if (copNear) setWanted(G, Math.max(G.wanted, 1), 'carjacking in front of the police');
  } else {
    car.driver = 'player';
  }
  car.ai = null;
  p.car = car;
  p.x = car.x; p.y = car.y;
  G.sound.doorSlam();
}

function exitCar(G) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  car.driver = null;
  car.speed = 0;
  p.car = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  const fixed = collideCircleBuildings(p.x, p.y, 12, G.city);
  p.x = fixed.x; p.y = fixed.y;
  G.sound.doorSlam();
}

function updateCarInteract(G) {
  const input = G.input;
  const p = G.player;
  if (!input.wasPressed('e')) return;
  if (p.car) { exitCar(G); return; }
  const car = nearestCar(G, 70);
  if (car) enterCar(G, car);
}

// ---- Spray shop ---------------------------------------------------------------------

function updateSprayShop(G, dt) {
  const p = G.player;
  const sp = G.city.sprayShop;
  const inZone = p.car && p.x > sp.x - 30 && p.x < sp.x + sp.w + 30 && p.y > sp.y - 30 && p.y < sp.y + sp.h + 30;
  if (!inZone) { G.sprayT = 0; return; }
  if (G.wanted === 0) return;
  G.sprayT += dt;
  if (G.sprayT > 1.2) {
    G.sprayT = 0;
    if (G.money >= 150) {
      G.money -= 150;
      setWanted(G, 0, 'fresh paint, clean record');
      G.setMessage('Spray shop: wanted cleared for $150.', 3);
      G.sound.pickup();
      for (let i = 0; i < 14; i++) {
        G.particles.push(makeParticle(p.x + (Math.random() - 0.5) * 60, p.y + (Math.random() - 0.5) * 40, { life: 0.6, size: 4, color: '#2ecc71' }));
      }
    } else {
      G.setMessage('Spray shop costs $150 — you are short.', 2.5);
    }
  }
}

// ---- Pickups ----------------------------------------------------------------------------

function updatePickups(G, dt) {
  const p = G.player;
  for (const pk of G.pickups) {
    pk.t += dt;
    if (Math.hypot(pk.x - p.x, pk.y - p.y) > 34) continue;
    if (pk.kind === 'package') continue; // handled by missions
    if (pk.kind === 'health' && G.health >= 100) continue;
    if (pk.kind === 'armor' && G.armor >= 100) continue;
    if (pk.kind === 'ammo' && G.ammo >= G.maxAmmo) continue;
    if (pk.kind === 'health') G.health = Math.min(100, G.health + 40);
    if (pk.kind === 'armor') G.armor = Math.min(100, G.armor + 50);
    if (pk.kind === 'ammo') G.ammo = G.maxAmmo;
    G.sound.pickup();
    G.setMessage(pk.kind === 'health' ? '+40 health' : pk.kind === 'armor' ? '+50 armor' : 'Ammo refilled', 1.8);
    // Respawn elsewhere after a while.
    const spots = G.city.pickupSpots;
    const s = spots[Math.floor(Math.random() * spots.length)];
    pk.x = s.x; pk.y = s.y;
  }
}

// ---- Traffic / pedestrian upkeep -------------------------------------------------------------

function upkeepPopulation(G, dt) {
  // Keep traffic flowing: replace dead / escaped cars, keep peds around.
  G.trafficCd = (G.trafficCd || 0) - dt;
  if (G.trafficCd <= 0) {
    G.trafficCd = 3;
    const alive = G.cars.filter((c) => !c.dead && c.ai && !c.ai.police).length;
    if (alive < 10) spawnTraffic(G, 2);
    const walkers = G.peds.filter((pd) => !pd.dead && pd.kind === 'walker').length;
    if (walkers < 18) spawnPedestrians(G, 3);
  }
  // Prune the dead so arrays stay small.
  if (G.cars.length > 60) G.cars = G.cars.filter((c) => !c.dead || c === G.player.car);
  if (G.peds.length > 80) G.peds = G.peds.filter((pd) => !pd.dead);
}

// ---- Debug scenes for screenshots (?scene=...) -------------------------------------------------

function applyScene(G, scene) {
  if (scene === 'drive') {
    const car = G.cars.find((c) => !c.dead && !c.driver);
    if (car) { G.player.x = car.x; G.player.y = car.y; enterCar(G, car); }
    G.player.car.speed = 260;
  } else if (scene === 'chase') {
    const car = G.cars.find((c) => !c.dead && !c.driver);
    if (car) { G.player.x = car.x; G.player.y = car.y; enterCar(G, car); }
    G.player.car.speed = 300;
    setWanted(G, 3, 'screenshot chase');
    spawnPoliceCar(G, G.player.x - 200, G.player.y - 150);
    spawnPoliceCar(G, G.player.x + 260, G.player.y + 120);
  } else if (scene === 'mission') {
    startMission(G, 0);
    G.nextMissionIn = 0;
  }
}

// ---- Menu / pause button clicks ---------------------------------------------------------------

function clickButtons(buttons) {
  const m = G.input.mousePos();
  for (const b of buttons) {
    if (m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h) return b;
  }
  return null;
}

// ---- Main loop ----------------------------------------------------------------------------------

let lastTs = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0.001, (ts - lastTs) / 1000 || 0.016));
  lastTs = ts;
  const input = G.input;

  // Global mute toggle.
  if (input.wasPressed('m')) {
    G.sound.setMuted(!G.sound.muted);
    G.setMessage(G.sound.muted ? 'Muted (M to unmute)' : 'Sound on', 1.5);
  }

  if (G.state === 'menu') {
    G.time += dt;
    if (input.wasPressed('enter')) { newGame(); }
    else if (input.mouseClicked()) {
      const b = clickButtons(G.menuButtons);
      if (b && b.enabled) {
        G.sound.init();
        if (b.action === 'new') newGame();
        else if (b.action === 'continue') continueGame();
        else if (b.action === 'help') G.showHelp = !G.showHelp;
      }
    }
    drawStartScreen(ctx, G);
  } else if (G.state === 'playing') {
    G.time += dt;
    G.clock = (G.clock + dt * 0.6) % (24 * 60); // ~100 real seconds per game hour
    G.shake = Math.max(0, G.shake - dt * 30);
    G.flash = Math.max(0, G.flash - dt * 1.5);
    if (G.message) { G.message.t -= dt; if (G.message.t <= 0) G.message = null; }
    if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }

    if (input.wasPressed('escape') || input.wasPressed('p')) {
      G.state = 'paused';
      G.sound.engine(0, false);
      G.sound.siren(false);
    } else {
      // Player.
      if (G.player.car) updatePlayerCar(G, dt);
      else updatePlayerOnFoot(G, dt);
      updateCarInteract(G);
      updateCombat(G, dt);
      updateSprayShop(G, dt);
      updatePickups(G, dt);
      // World.
      for (const car of G.cars) {
        if (car.dead || car === G.player.car) continue;
        if (car.ai && !car.ai.rival) updateTrafficCar(G, car, dt);
      }
      for (const ped of G.peds) updatePed(G, ped, dt);
      updateBullets(G, dt);
      updateParticles(G, dt);
      resolveCarCollisions(G);
      updateWanted(G, dt);
      updateMission(G, dt);
      upkeepPopulation(G, dt);
      // Audio follows the action.
      const inCar = !!G.player.car;
      const speed01 = inCar ? Math.abs(G.player.car.speed) / 480 : 0;
      G.sound.engine(speed01, inCar);
      const chasing = G.cars.some((c) => c.kind === 'police' && !c.dead && Math.hypot(c.x - G.player.x, c.y - G.player.y) < 700);
      G.sound.siren(G.wanted > 0 && chasing);
      drawGame(ctx, G);
    }
  } else if (G.state === 'paused') {
    if (input.wasPressed('escape') || input.wasPressed('p')) G.state = 'playing';
    else if (input.mouseClicked()) {
      const b = clickButtons(G.pauseButtons);
      if (b) {
        if (b.action === 'resume') G.state = 'playing';
        else if (b.action === 'save') G.saveGame(false);
        else if (b.action === 'restart-mission') {
          if (G.mission.index >= 0) startMission(G, G.mission.index);
          G.state = 'playing';
        } else if (b.action === 'menu') { G.state = 'menu'; G.sound.stopMusic(); }
      }
    }
    drawGame(ctx, G);
    drawPauseScreen(ctx, G);
  } else if (G.state === 'gameover') {
    if (input.wasPressed('enter')) newGame();
    else if (input.mouseClicked()) {
      const b = clickButtons(G.overButtons);
      if (b) {
        if (b.action === 'retry') newGame();
        else if (b.action === 'menu') { G.state = 'menu'; G.sound.stopMusic(); }
      }
    }
    drawGameOverScreen(ctx, G);
  } else if (G.state === 'win') {
    if (input.mouseClicked()) {
      const b = clickButtons(G.winButtons);
      if (b) {
        if (b.action === 'freeroam') { G.state = 'playing'; G.mission.index = -1; }
        else if (b.action === 'menu') { G.state = 'menu'; G.sound.stopMusic(); }
      }
    }
    drawWinScreen(ctx, G);
  }

  input.endFrame();
}

// Boot: fresh world behind the menu, then apply any ?scene= staging.
resetWorld();
const params = new URLSearchParams(window.location.search);
const scene = params.get('scene');
if (scene) {
  // Auto-start into the staged scene so screenshots are one load away.
  newGame();
  applyScene(G, scene);
  if (scene === 'start') { G.state = 'menu'; }
}
requestAnimationFrame(frame);

// Expose a tiny debug handle for play-testing (read-only state snapshot).
window.__palmera = G;
