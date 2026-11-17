// world.js — the city of Palmera Bay: procedural grid, beach, harbor, park.
// All geometry is generated from a fixed seed so every load builds the same
// city. Exports the city data plus collision and road helpers.

export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_W = 96;

// Deterministic PRNG (mulberry32) so the city is identical every run.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BUILDING_COLORS = [
  '#c98f5f', '#b57a52', '#d9a05b', '#8fa3b8', '#7d8ba0', '#a8876b',
  '#e0b184', '#9aa78a', '#c47f6a', '#6f7f92', '#d4c08a', '#b98a7a',
];
const ROOF_COLORS = ['#5d4a3a', '#4a4a55', '#6b4a3a', '#3f4a3a', '#54423a'];

export function buildCity(seed = 20261117) {
  const rnd = mulberry32(seed);
  // Road centre lines. Vertical roads stop before the beach strip; the
  // easternmost road is the boardwalk along the sand.
  const roadsV = [200, 600, 1000, 1400, 1800, 2200, 2600];
  const roadsH = [200, 600, 1000, 1400, 1800, 2200];
  const buildings = [];

  // Blocks between neighbouring roads. One block is the park, one is the
  // harbor yard, the rest get 1-4 procedural buildings each.
  for (let i = 0; i < roadsV.length - 1; i++) {
    for (let j = 0; j < roadsH.length - 1; j++) {
      const bx0 = roadsV[i] + ROAD_W / 2 + 14;
      const bx1 = roadsV[i + 1] - ROAD_W / 2 - 14;
      const by0 = roadsH[j] + ROAD_W / 2 + 14;
      const by1 = roadsH[j + 1] - ROAD_W / 2 - 14;
      const isPark = (i === 2 && j === 2);
      const isHarborYard = (i === 3 && j === 4);
      if (isPark || isHarborYard) continue;
      const count = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < count; k++) {
        const w = 90 + rnd() * 130;
        const h = 80 + rnd() * 120;
        const x = bx0 + rnd() * Math.max(1, (bx1 - bx0) - w);
        const y = by0 + rnd() * Math.max(1, (by1 - by0) - h);
        const b = {
          x, y, w, h,
          color: BUILDING_COLORS[Math.floor(rnd() * BUILDING_COLORS.length)],
          roof: ROOF_COLORS[Math.floor(rnd() * ROOF_COLORS.length)],
          tall: rnd() < 0.3,
          windows: [],
        };
        const cols = Math.max(2, Math.floor(w / 34));
        const rows = Math.max(2, Math.floor(h / 34));
        for (let cx = 0; cx < cols; cx++) {
          for (let cy = 0; cy < rows; cy++) {
            if (rnd() < 0.75) b.windows.push({ dx: 12 + cx * 34, dy: 12 + cy * 34, lit: rnd() < 0.3 });
          }
        }
        buildings.push(b);
      }
    }
  }

  // Landmark zones (rects, in world coords).
  const park = { x: roadsV[2] + ROAD_W / 2, y: roadsH[2] + ROAD_W / 2, w: 400 - ROAD_W, h: 400 - ROAD_W };
  const beach = { x: 2850, y: 0, w: WORLD_W - 2850, h: WORLD_H };      // sand strip
  const sea = { x: 3050, y: 0, w: WORLD_W - 3050, h: WORLD_H };         // water
  const harbor = { x: 0, y: 2260, w: WORLD_W, h: WORLD_H - 2260 };     // southern water
  const docks = [
    { x: 300, y: 2200, w: 260, h: 60 },
    { x: 900, y: 2200, w: 260, h: 60 },
    { x: 1500, y: 2200, w: 260, h: 60 },
  ];
  const containers = [];
  for (let i = 0; i < 14; i++) {
    containers.push({
      x: 120 + (i % 7) * 190 + rnd() * 30, y: 2050 + Math.floor(i / 7) * 70,
      w: 120, h: 44, color: ['#b8442c', '#2c6db8', '#c9a13a', '#3a8a4a'][i % 4],
    });
  }

  // Named places.
  const cafe = { x: 1090, y: 690, w: 120, h: 90, name: "Madame Sol's Cafe" }; // in block (1000..1400, 600..1000)
  const sprayShop = { x: 640, y: 1700, w: 150, h: 110, name: 'Spray Shop' };
  const safehouse = { x: 1900, y: 300, w: 130, h: 100, name: 'Safehouse' };
  const bank = { x: 2300, y: 1100, w: 170, h: 130, name: 'Palmera Trust Bank' };
  const hideout = { x: 260, y: 1900, w: 140, h: 100, name: 'Hideout Garage' };
  // Landmark buildings act as colliders too.
  for (const lm of [cafe, sprayShop, safehouse, bank, hideout]) {
    buildings.push({ x: lm.x, y: lm.y, w: lm.w, h: lm.h, color: '#8a6a4a', roof: '#4a3a30', tall: false, windows: [], landmark: lm.name });
  }

  // Trees in the park + palms along the beach boardwalk.
  const trees = [];
  for (let i = 0; i < 26; i++) {
    trees.push({ x: park.x + 30 + rnd() * (park.w - 60), y: park.y + 30 + rnd() * (park.h - 60), r: 12 + rnd() * 8, palm: false });
  }
  for (let y = 60; y < WORLD_H - 100; y += 130) {
    trees.push({ x: 2820 + rnd() * 20, y, r: 10, palm: true });
  }
  // A few palms scattered on sidewalks.
  for (let i = 0; i < 18; i++) {
    const rx = roadsV[Math.floor(rnd() * roadsV.length)];
    const ry = roadsH[Math.floor(rnd() * roadsH.length)];
    trees.push({ x: rx + ROAD_W / 2 + 12, y: ry + ROAD_W / 2 + 12 + rnd() * 200, r: 9, palm: true });
  }

  // Pickup spawn spots (health / armor / ammo), fixed positions.
  const pickupSpots = [
    { x: 400, y: 400, kind: 'health' }, { x: 1600, y: 400, kind: 'ammo' },
    { x: 2400, y: 800, kind: 'armor' }, { x: 800, y: 1200, kind: 'ammo' },
    { x: 2000, y: 1600, kind: 'health' }, { x: 1200, y: 2000, kind: 'armor' },
    { x: 2600, y: 1600, kind: 'ammo' }, { x: 400, y: 2000, kind: 'health' },
  ];

  return {
    roadsV, roadsH, buildings, park, beach, sea, harbor, docks, containers,
    trees, pickupSpots, cafe, sprayShop, safehouse, bank, hideout,
  };
}

// ---- Queries ---------------------------------------------------------------

export function onRoad(x, y, city) {
  const half = ROAD_W / 2;
  for (const rx of city.roadsV) if (Math.abs(x - rx) <= half && y > -half && y < WORLD_H + half) return true;
  for (const ry of city.roadsH) if (Math.abs(y - ry) <= half && x > -half && x < 2850 + half) return true;
  return false;
}

export function inWater(x, y, city) {
  if (x >= city.sea.x) return true;
  if (y >= city.harbor.y && !(x >= 300 && x <= 560 && y < 2260)) return true;
  return false;
}

/** Nearest road centre coordinate for an axis (used by traffic AI). */
export function nearestRoadV(x, city) {
  let best = city.roadsV[0], bd = 1e9;
  for (const rx of city.roadsV) { const d = Math.abs(x - rx); if (d < bd) { bd = d; best = rx; } }
  return best;
}
export function nearestRoadH(y, city) {
  let best = city.roadsH[0], bd = 1e9;
  for (const ry of city.roadsH) { const d = Math.abs(y - ry); if (d < bd) { bd = d; best = ry; } }
  return best;
}

// ---- Collision -------------------------------------------------------------

/** Resolve a circle (x,y,r) against every building rect. Returns corrected {x,y}. */
export function collideCircleBuildings(x, y, r, city) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx, dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        y = cy + (dy / d) * r;
      } else {
        // Centre inside the rect: push out along the smallest penetration axis.
        const pl = x - b.x, pr = b.x + b.w - x, pt = y - b.y, pb = b.y + b.h - y;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = b.x - r; else if (m === pr) x = b.x + b.w + r;
        else if (m === pt) y = b.y - r; else y = b.y + b.h + r;
      }
    }
  }
  // World bounds + water are solid for the player and cars.
  x = Math.max(16, Math.min(WORLD_W - 16, x));
  y = Math.max(16, Math.min(WORLD_H - 16, y));
  return { x, y };
}

/** Point inside any building rect? */
export function insideBuilding(x, y, city) {
  for (const b of city.buildings) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  }
  return false;
}
