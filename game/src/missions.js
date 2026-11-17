// missions.js — the five-mission story chain of Palmera Bay: Street Heat.
// Marco Reyes is back in town, in debt to Madame Sol. Each mission has a
// setup, a live update, an objective marker and a payout. Missions are
// data + small state machines; the game calls startMission / updateMission /
// missionObjective, and entities report kills through the hooks below.

import { makePed, makeCar, spawnFootCop, setWanted, damagePlayer } from './entities.js';

export const MISSION_DEFS = [
  {
    id: 1, title: 'First Delivery',
    brief: "Madame Sol's cafe needs a package run. Drive to the golden marker at the cafe and press E.",
    reward: 200,
  },
  {
    id: 2, title: 'Three Drops',
    brief: 'Three packages are stashed around Palmera Bay. Collect all three — walk or drive over them.',
    reward: 300,
  },
  {
    id: 3, title: 'Lose the Heat',
    brief: 'A rival tipped off the police — you are at 3 stars! Reach the Hideout Garage to lose them.',
    reward: 400,
  },
  {
    id: 4, title: 'Rival: Rico Vane',
    brief: 'Rico Vane stole Madame Sol’s ledger. Wreck his car at the old lot — watch his armed goons.',
    reward: 600,
  },
  {
    id: 5, title: 'The Big Score',
    brief: 'Final job: hit Palmera Trust Bank, grab the cash, and get to the Safehouse. Guards are armed.',
    reward: 1500,
  },
];

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

export function createMissionState() {
  return {
    index: -1,            // -1 = free roam (no mission active)
    stage: 0,
    timer: 0,
    targets: [],          // {x, y, label, done}
    guards: [],           // ped refs for mission 5
    rivalCar: null,
    cashGrabbed: false,
    done: false,
    // Hooks called by entities.js when things die.
    onCarDestroyed(G, car) {
      if (this.index === 3 && car === this.rivalCar) {
        completeMission(G, 'Rico’s car is scrap. Madame Sol will be pleased.');
      }
    },
    onPedKilled(G, ped) {
      if (this.index === 4 && this.guards.includes(ped)) {
        this.guards = this.guards.filter((g) => g !== ped);
        if (this.guards.length === 0 && !this.cashGrabbed) {
          G.setMessage('Guards down — grab the cash at the bank!', 3);
        }
      }
    },
  };
}

export function startMission(G, index) {
  const m = G.mission;
  const def = MISSION_DEFS[index];
  m.index = index;
  G.lastMission = index;
  m.stage = 0;
  m.timer = 0;
  m.targets = [];
  m.guards = [];
  m.rivalCar = null;
  m.cashGrabbed = false;
  m.done = false;
  G.setBanner(`MISSION ${def.id}: ${def.title}`, def.brief, 5);
  G.sound.missionDone();

  if (index === 0) {
    const c = G.city.cafe;
    m.targets.push({ x: c.x + c.w / 2, y: c.y + c.h + 40, label: 'Cafe', done: false });
  } else if (index === 1) {
    m.targets.push(
      { x: 420, y: 1060, label: 'Package 1', done: false },
      { x: 2050, y: 420, label: 'Package 2', done: false },
      { x: 2500, y: 1900, label: 'Package 3', done: false },
    );
    for (const t of m.targets) G.pickups.push({ x: t.x, y: t.y, kind: 'package', t: 0, target: t });
  } else if (index === 2) {
    setWanted(G, 3, 'a rival tipped off the police!');
    const h = G.city.hideout;
    m.targets.push({ x: h.x + h.w / 2, y: h.y + h.h / 2, label: 'Hideout', done: false });
  } else if (index === 3) {
    // Rival Rico in a red sport car at the old lot, with two armed goons.
    const rx = 2350, ry = 2050;
    const rival = makeCar(rx, ry, -Math.PI / 2, 'sport', '#c0392b');
    rival.hp = 160;
    rival.driver = makePed(rx, ry, 'rival');
    rival.ai = { police: false, cruise: 0, rival: true };
    G.cars.push(rival);
    m.rivalCar = rival;
    for (const [gx, gy] of [[rx - 80, ry + 60], [rx + 80, ry - 40]]) {
      const goon = makePed(gx, gy, 'goon');
      goon.state = 'shoot';
      G.peds.push(goon);
    }
    m.targets.push({ x: rx, y: ry, label: 'Rico Vane', done: false });
  } else if (index === 4) {
    const b = G.city.bank;
    m.targets.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, label: 'Bank Vault', done: false });
    for (const [gx, gy] of [[b.x - 60, b.y - 20], [b.x + b.w + 60, b.y + 40], [b.x + 40, b.y + b.h + 60], [b.x + b.w - 40, b.y - 60]]) {
      const guard = makePed(gx, gy, 'goon');
      guard.state = 'shoot';
      guard.hp = 70;
      G.peds.push(guard);
      m.guards.push(guard);
    }
  }
}

export function completeMission(G, flavor) {
  const m = G.mission;
  const def = MISSION_DEFS[m.index];
  G.money += def.reward;
  G.sound.cash();
  G.sound.missionDone();
  G.setBanner('MISSION COMPLETE', `${def.title} — +$${def.reward}${flavor ? ' — ' + flavor : ''}`, 4.5);
  G.saveGame(true);
  m.done = true;
  m.index = -1;
  m.targets = [];
  // Chain the next mission after a breather.
  G.nextMissionIn = 6;
}

export function updateMission(G, dt) {
  const m = G.mission;
  if (m.index === -1) {
    if (G.nextMissionIn !== undefined && G.nextMissionIn > 0) {
      G.nextMissionIn -= dt;
      if (G.nextMissionIn <= 0) {
        const next = (G.lastMission ?? -1) + 1;
        if (next < MISSION_DEFS.length) {
          G.lastMission = next;
          startMission(G, next);
        } else if (!G.storyDone) {
          G.storyDone = true;
          G.state = 'win';
        }
      }
    }
    return;
  }
  const p = G.player;
  m.timer += dt;

  if (m.index === 0) {
    const t = m.targets[0];
    if (dist(p.x, p.y, t.x, t.y) < 70) {
      t.done = true;
      completeMission(G, 'Package delivered. Madame Sol is watching you, Marco.');
    }
  } else if (m.index === 1) {
    for (const t of m.targets) {
      if (!t.done && dist(p.x, p.y, t.x, t.y) < 46) {
        t.done = true;
        G.sound.pickup();
        G.setMessage(`Package collected (${m.targets.filter((x) => x.done).length}/3)`, 2);
      }
    }
    if (m.targets.every((t) => t.done)) {
      completeMission(G, 'All three drops done. The streets are starting to talk.');
    }
  } else if (m.index === 2) {
    const t = m.targets[0];
    if (dist(p.x, p.y, t.x, t.y) < 90) {
      setWanted(G, 0, 'you lost them in the garage');
      completeMission(G, 'Clean. The heat forgot your face — for now.');
    }
    // Extra pressure: a foot cop spawns if the player is on foot too long.
    if (m.timer > 20 && !m.extraCop) {
      m.extraCop = true;
      spawnFootCop(G, p.x + 260, p.y - 200);
    }
  } else if (m.index === 3) {
    // Rival AI: Rico tries to ram the player, then flees when badly hurt.
    const rival = m.rivalCar;
    if (rival && !rival.dead) {
      const d = dist(rival.x, rival.y, p.x, p.y);
      const wantAngle = Math.atan2(p.y - rival.y, p.x - rival.x);
      let diff = wantAngle - rival.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const fleeing = rival.hp < 60;
      const angle = fleeing ? wantAngle + Math.PI : wantAngle;
      let adiff = angle - rival.angle;
      while (adiff > Math.PI) adiff -= Math.PI * 2;
      while (adiff < -Math.PI) adiff += Math.PI * 2;
      rival.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, adiff * 3 * dt));
      rival.speed += ((fleeing ? 380 : 300) - rival.speed) * Math.min(1, dt * 1.5);
      rival.x += Math.cos(rival.angle) * rival.speed * dt;
      rival.y += Math.sin(rival.angle) * rival.speed * dt;
      if (d < 50 && Math.abs(rival.speed) > 120 && (m.ramCd || 0) <= 0) {
        m.ramCd = 1.2;
        damagePlayer(G, 8, 'rammed by Rico');
        G.shake = Math.max(G.shake, 7);
        G.sound.crash();
      }
      m.ramCd = Math.max(0, (m.ramCd || 0) - dt);
      if (rival.x < 60 || rival.x > 3140 || rival.y < 60 || rival.y > 2340) rival.angle += Math.PI / 2;
    }
  } else if (m.index === 4) {
    const b = G.city.bank;
    const vault = m.targets[0];
    if (!m.cashGrabbed && dist(p.x, p.y, vault.x, vault.y) < 80) {
      if (m.guards.length === 0) {
        m.cashGrabbed = true;
        G.money += 250;
        G.sound.cash();
        G.setMessage('Cash grabbed (+$250)! Get to the Safehouse!', 3.5);
        const s = G.city.safehouse;
        m.targets.push({ x: s.x + s.w / 2, y: s.y + s.h / 2, label: 'Safehouse', done: false });
        setWanted(G, 4, 'the bank alarm is screaming!');
      } else {
        G.setMessage(`Take down the guards first (${m.guards.length} left)`, 2);
        m.timer = Math.max(m.timer, 0);
      }
    }
    const safe = m.targets[1];
    if (m.cashGrabbed && safe && dist(p.x, p.y, safe.x, safe.y) < 90) {
      completeMission(G, 'The Big Score is done. Madame Sol’s debt is paid. Palmera Bay is yours, Marco.');
    }
  }
}

/** Current objective marker (world coords + label), or null in free roam. */
export function missionObjective(G) {
  const m = G.mission;
  if (m.index === -1) return null;
  const t = m.targets.find((x) => !x.done);
  if (!t) return null;
  return { x: t.x, y: t.y, label: t.label, mission: MISSION_DEFS[m.index].title };
}

export function missionProgressText(G) {
  const m = G.mission;
  if (m.index === -1) return null;
  const def = MISSION_DEFS[m.index];
  if (m.index === 1) {
    const got = m.targets.filter((t) => t.done).length;
    return `${def.title}: ${got}/3 packages`;
  }
  if (m.index === 4) {
    if (m.cashGrabbed) return `${def.title}: escape to the Safehouse`;
    return `${def.title}: clear the guards (${m.guards.length} left)`;
  }
  if (m.index === 3) {
    return `${def.title}: wreck Rico's car`;
  }
  return `${def.title}: reach the marker`;
}
