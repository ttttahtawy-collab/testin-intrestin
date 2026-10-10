// Procedural world: three concentric walls, two gate districts that bulge out of the
// walls, a capital, villages and farmland inside, and a wild frontier outside with a
// forest of giant trees, ruins, watchtowers and supply caches.
import { B } from './blocks.js';
import { SX, SZ, SY } from './world.js';
import { fbm, mulberry32 } from './noise.js';

const SEED = 7;
export const G = 30; // y of the top ground block inside the walls (people walk at G + 1)
export const CX = 1024, CZ = 900; // centre of the walled territory
const WT = 3.5; // half thickness of the great walls
export const GATE_H = 24, GATE_HALF = 6;

// id, name, centre, radius, height. District walls only exist outside their parent ring.
export const WALLS = [
  { id: 0, name: 'Inner Wall', cx: CX, cz: CZ, R: 170, H: 44, gates: [Math.PI / 2, 0, Math.PI, -Math.PI / 2] },
  { id: 1, name: 'Middle Wall', cx: CX, cz: CZ, R: 380, H: 44, gates: [Math.PI / 2, 0, Math.PI, -Math.PI / 2] },
  { id: 2, name: 'Outer Wall', cx: CX, cz: CZ, R: 640, H: 44, gates: [Math.PI / 2, 0, Math.PI, -Math.PI / 2] },
  { id: 3, name: 'Tharsk District Wall', cx: CX, cz: CZ + 640, R: 140, H: 44, parent: 2, gates: [Math.PI / 2] },
  { id: 4, name: 'Corvane District Wall', cx: CX, cz: CZ + 380, R: 120, H: 44, parent: 1, gates: [Math.PI / 2] },
];

export function zoneOf(x, z) {
  const d = Math.hypot(x - CX, z - CZ);
  if (d < WALLS[0].R) return 'inner';
  if (d < WALLS[1].R) return 'middle';
  if (Math.hypot(x - WALLS[4].cx, z - WALLS[4].cz) < WALLS[4].R) return 'corvane';
  if (d < WALLS[2].R) return 'outer';
  if (Math.hypot(x - WALLS[3].cx, z - WALLS[3].cz) < WALLS[3].R) return 'tharsk';
  return 'outside';
}
export const ZONE_NAMES = {
  inner: 'Merrow · within the Inner Wall', middle: 'Middle Territory', corvane: 'Corvane District',
  outer: 'Outer Territory', tharsk: 'Tharsk District', outside: 'Beyond the Walls',
};

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function* generate(world) {
  const rnd = mulberry32(SEED);
  const info = {
    walls: WALLS, gates: [], towns: [], trees: [], buildings: [], depots: [], canisters: [],
    caches: [], insignias: [], towers: [], pois: [], posts: [], spawns: {},
  };
  const hm = world.hmap;
  const H = (x, z) => hm[Math.max(0, Math.min(SZ - 1, z | 0)) * SX + Math.max(0, Math.min(SX - 1, x | 0))];
  const setH = (x, z, h) => { if (x >= 0 && z >= 0 && x < SX && z < SZ) hm[z * SX + x] = h; };

  // ---------- heightmap (noise on a coarse grid, interpolated) ----------
  const STEP = 4, GW = SX / STEP + 1;
  const coarse = new Float32Array(GW * GW);
  for (let j = 0; j < GW; j++) for (let i = 0; i < GW; i++) {
    const x = i * STEP, z = j * STEP;
    const hills = (fbm(x / 150, z / 150, SEED) - 0.5) * 34 + (fbm(x / 44, z / 44, SEED + 9) - 0.5) * 8;
    const farm = (fbm(x / 90, z / 90, SEED + 3) - 0.5) * 5;
    const d = Math.hypot(x - CX, z - CZ);
    const outside = smoothstep(WALLS[2].R + 10, WALLS[2].R + 90, d);
    let h = G + farm * (1 - outside) + (hills + 4) * outside;
    // mountains ring the edge of the map
    const edge = Math.min(x, z, SX - 1 - x, SZ - 1 - z);
    const m = 1 - smoothstep(20, 150, edge);
    h += m * (40 + fbm(x / 60, z / 60, SEED + 21) * 45);
    coarse[j * GW + i] = h;
  }
  for (let z = 0; z < SZ; z++) {
    const j = Math.floor(z / STEP), fz = (z % STEP) / STEP;
    for (let x = 0; x < SX; x++) {
      const i = Math.floor(x / STEP), fx = (x % STEP) / STEP;
      const a = coarse[j * GW + i], b = coarse[j * GW + i + 1], c = coarse[(j + 1) * GW + i], d = coarse[(j + 1) * GW + i + 1];
      const h = a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
      hm[z * SX + x] = Math.max(G - 8, Math.min(SY - 20, Math.round(h)));
    }
  }
  yield 0.08;

  // flatten under the walls and around town sites
  const flats = [];
  const flatten = (cx, cz, r, feather, level = G) => flats.push({ cx, cz, r, feather, level });
  const towns = [
    { id: 'merrow', name: 'Merrow', ox: CX, oz: CZ, clip: (x, z) => Math.hypot(x - CX, z - CZ) < WALLS[0].R - 14, roof: 'mix', floors: [2, 4], pop: 60, capital: true },
    { id: 'corvane', name: 'Corvane District', ox: CX, oz: CZ + 380 + 60, clip: (x, z) => Math.hypot(x - CX, z - (CZ + 380)) < 110 && Math.hypot(x - CX, z - CZ) > WALLS[1].R + 10, roof: 'mix', floors: [1, 3], pop: 60, evacGate: 'middleS' },
    { id: 'tharsk', name: 'Tharsk District', ox: CX, oz: CZ + 640 + 66, clip: (x, z) => Math.hypot(x - CX, z - (CZ + 640)) < 130 && Math.hypot(x - CX, z - CZ) > WALLS[2].R + 10, roof: 'mix', floors: [1, 3], pop: 60, evacGate: 'outerS' },
  ];
  const village = (id, name, ang, r, evacGate, opts = {}) => {
    const ox = Math.round(CX + Math.cos(ang) * r), oz = Math.round(CZ + Math.sin(ang) * r);
    const rr = opts.r || 44;
    towns.push({ id, name, ox, oz, clip: (x, z) => Math.hypot(x - ox, z - oz) < rr, roof: 'thatch', floors: [1, 2], pop: opts.pop ?? 12, evacGate, village: true, ruined: !!opts.ruined, spacing: 26 });
  };
  village('hollowford', 'Hollow Ford', 0.55, 515, 'middleE');
  village('ashby', 'Ashby', 2.55, 515, 'middleW');
  village('kettle', 'Kettle Green', -2.3, 520, 'middleN');
  village('fenmoor', 'Fenmoor', -0.75, 515, 'middleN');
  village('lindale', 'Lindale', 0.8, 280, 'innerE');
  village('brenn', 'Brenn', 2.35, 280, 'innerW');
  // abandoned settlements beyond the walls
  const ruinVillage = (id, name, x, z) => {
    towns.push({ id, name, ox: x, oz: z, clip: (a, b) => Math.hypot(a - x, b - z) < 46, roof: 'thatch', floors: [1, 2], pop: 0, village: true, ruined: true, spacing: 26 });
  };
  ruinVillage('fenwick', 'Fenwick (abandoned)', 1560, 1800);
  ruinVillage('grayhollow', 'Grayhollow (abandoned)', 240, 760);
  ruinVillage('dunmere', 'Dunmere (abandoned)', 1820, 1040);
  for (const t of towns) {
    if (t.capital) continue;
    const rr = t.id === 'tharsk' ? 140 : t.id === 'corvane' ? 120 : 50;
    const cx = t.id === 'tharsk' ? CX : t.ox, cz = t.id === 'tharsk' ? CZ + 640 : t.id === 'corvane' ? CZ + 380 : t.oz;
    flatten(cx, cz, rr, 30, t.ruined ? Math.max(G, H(t.ox, t.oz)) : G);
  }
  const camp = { x: Math.round(CX + Math.cos(-1.05) * 272), z: Math.round(CZ + Math.sin(-1.05) * 272) };
  const keep = { x: 560, z: 1830 };
  flatten(keep.x, keep.z, 40, 26, Math.max(G, H(keep.x, keep.z)));
  for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
    const d = Math.hypot(x - CX, z - CZ);
    let h = hm[z * SX + x];
    // walls sit on flat ground
    let k = 0;
    for (const w of WALLS) {
      const dw = Math.abs(Math.hypot(x - w.cx, z - w.cz) - w.R);
      if (dw < 40) k = Math.max(k, 1 - smoothstep(10, 40, dw));
    }
    if (d < WALLS[2].R + 8) k = Math.max(k, 0.0);
    for (const f of flats) {
      const df = Math.hypot(x - f.cx, z - f.cz);
      if (df < f.r + f.feather) {
        const kk = 1 - smoothstep(f.r, f.r + f.feather, df);
        h = h * (1 - kk) + f.level * kk;
      }
    }
    h = h * (1 - k) + G * k;
    hm[z * SX + x] = Math.round(h);
  }
  yield 0.16;

  // ---------- water ----------
  const lakes = [
    { x: Math.round(CX + Math.cos(1.25) * 560), z: Math.round(CZ + Math.sin(1.25) * 560), r: 30 },
    { x: Math.round(CX + Math.cos(-0.25) * 270), z: Math.round(CZ + Math.sin(-0.25) * 270), r: 24 },
    { x: 330, z: 1580, r: 48 },
    { x: 1730, z: 1500, r: 40 },
  ];
  info.lakes = lakes;
  for (const L of lakes) {
    const lvl = H(L.x, L.z) - 1;
    for (let z = L.z - L.r - 14; z <= L.z + L.r + 14; z++) for (let x = L.x - L.r - 14; x <= L.x + L.r + 14; x++) {
      const wob = (fbm(x / 12, z / 12, SEED + 31) - 0.5) * 10;
      const d = Math.hypot(x - L.x, z - L.z) + wob;
      if (d < L.r) {
        setH(x, z, Math.min(H(x, z), lvl - 1 - Math.round((1 - d / L.r) * 4)));
        world.wmap[z * SX + x] = lvl;
        world.surf[z * SX + x] = B.SAND;
      } else if (d < L.r + 4) world.surf[z * SX + x] = B.SAND;
    }
  }

  // ---------- ground cover: fields, grass and flowers ----------
  for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
    const i = z * SX + x;
    if (world.wmap[i] || world.surf[i] === B.SAND) continue;
    const h = hm[i];
    if (h > G + 34) { world.surf[i] = rnd() < 0.5 ? B.STONE : B.GRAVEL; continue; }
    const d = Math.hypot(x - CX, z - CZ);
    if (d > WALLS[0].R + 30 && d < WALLS[2].R - 20 && fbm(x / 70, z / 70, SEED + 44) > 0.56) {
      world.surf[i] = B.FARMLAND;
      if (z % 3 !== 0) world.plant[i] = B.WHEAT;
      continue;
    }
    const k = rnd();
    if (k < 0.09) world.plant[i] = B.TALLGRASS;
    else if (k < 0.097) world.plant[i] = B.FLOWER_R;
    else if (k < 0.103) world.plant[i] = B.FLOWER_Y;
  }
  yield 0.22;

  // ---------- roads ----------
  const road = (x0, z0, x1, z1, w, mat) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(len);
    for (let s = 0; s <= n; s++) {
      const t = s / n, px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t;
      for (let dz = -w; dz <= w; dz++) for (let dx = -w; dx <= w; dx++) {
        if (dx * dx + dz * dz > w * w + 1) continue;
        const x = Math.round(px + dx), z = Math.round(pz + dz);
        if (x < 0 || z < 0 || x >= SX || z >= SZ || world.wmap[z * SX + x]) continue;
        world.setSurface(x, z, mat);
      }
    }
  };
  road(CX, CZ, CX, SZ - 160, 3, B.GRAVEL);
  road(CX, CZ, CX, 170, 3, B.GRAVEL);
  road(CX, CZ, 170, CZ, 3, B.GRAVEL);
  road(CX, CZ, SX - 170, CZ, 3, B.GRAVEL);

  // ---------- the great walls ----------
  const gateList = info.gates;
  const gateNames = ['S', 'E', 'W', 'N'];
  const wallPrefix = ['inner', 'middle', 'outer', 'tharsk', 'corvane'];
  for (const w of WALLS) {
    w.gates.forEach((a, k) => {
      gateList.push({
        id: wallPrefix[w.id] + gateNames[k], wallId: w.id, angle: a,
        x: w.cx + Math.cos(a) * w.R, z: w.cz + Math.sin(a) * w.R, nx: Math.cos(a), nz: Math.sin(a),
        name: `${w.name} · ${['south', 'east', 'west', 'north'][k]} gate`,
      });
    });
  }
  for (const w of WALLS) {
    buildWall(world, w, rnd, H);
    yield 0.22 + 0.12 * (w.id + 1) / WALLS.length;
  }
  for (const t of towns) {
    if (t.evacGate) {
      const g = gateList.find((q) => q.id === t.evacGate);
      t.evac = { x: g.x + g.nx * 7, z: g.z + g.nz * 7, gate: g.id };
    }
  }

  // ---------- towns ----------
  const occ = new Uint8Array(SX * SZ);
  const mark = (x0, z0, x1, z1) => {
    for (let z = Math.max(0, z0); z <= Math.min(SZ - 1, z1); z++) for (let x = Math.max(0, x0); x <= Math.min(SX - 1, x1); x++) occ[z * SX + x] = 1;
  };
  // keep the wall bands clear of houses
  const nearWall = (x, z) => WALLS.some((w) => Math.abs(Math.hypot(x - w.cx, z - w.cz) - w.R) < 12);
  for (const t of towns) {
    buildTown(world, t, rnd, info, occ, mark, nearWall, H);
    t.civilians = t.pop;
    info.towns.push(t);
  }
  yield 0.5;

  // ---------- cadet training camp (middle territory) ----------
  {
    const g = G;
    const yard = { x0: camp.x - 22, z0: camp.z - 16, x1: camp.x + 22, z1: camp.z + 16 };
    for (let z = yard.z0; z <= yard.z1; z++) for (let x = yard.x0; x <= yard.x1; x++) {
      world.setSurface(x, z, B.DIRT);
      const border = x === yard.x0 || x === yard.x1 || z === yard.z0 || z === yard.z1;
      if (border && (x + z) % 7 !== 0 && Math.abs(x - camp.x) > 3 && Math.abs(z - camp.z) > 3) world.set(x, g + 1, z, B.PLANKS);
    }
    mark(yard.x0 - 6, yard.z0 - 6, yard.x1 + 6, yard.z1 + 6);
    for (const [px, pz, ph] of [[-15, -9, 16], [15, -9, 18], [-15, 9, 14], [15, 9, 16], [0, -11, 24], [-6, 11, 12]]) {
      for (let y = g + 1; y <= g + ph; y++) world.set(camp.x + px, y, camp.z + pz, B.LOG);
      info.posts.push({ x: camp.x + px + 0.5, z: camp.z + pz + 0.5 });
    }
    info.yard = { x: camp.x, z: camp.z + 2, y: g + 1, ...yard };
    // barracks and a watch tower
    for (const [x0, z0, x1, z1] of [[yard.x0, yard.z1 + 8, yard.x0 + 30, yard.z1 + 17], [yard.x1 - 30, yard.z1 + 8, yard.x1, yard.z1 + 17]]) {
      const b = house(world, x0, z0, x1, z1, g, rnd, { roof: B.ROOF_BLUE, base: B.PLANKS, floors: 1 });
      addBuilding(world, info, b, 'camp');
      mark(x0 - 1, z0 - 1, x1 + 1, z1 + 1);
    }
    const tw = tower(world, yard.x1 + 12, yard.z0 - 8, g, 4, 32, B.DARKSTONE, B.ROOF_BLUE, rnd);
    addBuilding(world, info, tw, 'camp');
    mark(yard.x1 + 6, yard.z0 - 14, yard.x1 + 18, yard.z0 - 2);
    info.camp = { ...camp, name: 'Cadet Training Camp' };
    info.depots.push({ x: camp.x + 8, y: g + 1, z: camp.z - 18, name: 'Cadet camp depot', kind: 'town', zone: 'middle' });
    // training forest of tall trees north-east of the camp
    for (let i = 0, n = 0; i < 400 && n < 46; i++) {
      const a = rnd() * Math.PI * 2, r = 50 + rnd() * 120;
      const x = Math.round(camp.x + Math.cos(a) * r), z = Math.round(camp.z + Math.sin(a) * r);
      const tr = 1.8 + rnd() * 1.4;
      if (occ[z * SX + x] || Math.abs(x - CX) < 14 || nearWall(x, z)) continue;
      if (Math.hypot(x - CX, z - CZ) < WALLS[0].R + 20 || Math.hypot(x - CX, z - CZ) > WALLS[1].R - 20) continue;
      if (info.trees.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + tr + 14)) continue;
      const h = Math.round(34 + rnd() * 14);
      giantTree(world, x, z, H(x, z) + 1, h, tr, rnd);
      addTree(info, x, z, tr, h, H(x, z) + 1);
      mark(x - 8, z - 8, x + 8, z + 8);
      n++;
    }
  }
  yield 0.56;

  // ---------- beyond the walls ----------
  // the Old Keep: a ruined castle
  {
    const g = H(keep.x, keep.z);
    const s = 26;
    for (let z = keep.z - s; z <= keep.z + s; z++) for (let x = keep.x - s; x <= keep.x + s; x++) {
      const edge = Math.abs(x - keep.x) >= s - 2 || Math.abs(z - keep.z) >= s - 2;
      if (!edge) { world.setSurface(x, z, B.COBBLE); continue; }
      const hh = Math.floor(6 + fbm(x / 6, z / 6, SEED + 90) * 18);
      if (Math.abs(x - keep.x) < 4 && z > keep.z) continue; // gateway
      for (let y = g + 1; y <= g + hh; y++) world.set(x, y, z, rnd() < 0.35 ? B.MOSSY : B.BRICK);
    }
    for (const [dx, dz] of [[-s, -s], [s, -s], [-s, s], [s, s]]) {
      const b = tower(world, keep.x + dx, keep.z + dz, g, 4, 24 + Math.floor(rnd() * 10), B.BRICK, B.ROOF_RED, rnd, true);
      addBuilding(world, info, b, 'keep');
    }
    const kb = tower(world, keep.x, keep.z - 6, g, 7, 40, B.DARKSTONE, B.ROOF_BLUE, rnd, true);
    addBuilding(world, info, kb, 'keep');
    mark(keep.x - s - 8, keep.z - s - 8, keep.x + s + 8, keep.z + s + 8);
    info.keep = { x: keep.x, z: keep.z, y: g + 1, name: 'The Old Keep' };
    info.pois.push({ x: keep.x, z: keep.z, name: 'The Old Keep', kind: 'ruin' });
    info.depots.push({ x: keep.x + 0.5, y: g + 1, z: keep.z + 10.5, name: 'Old Keep cache', kind: 'outpost', zone: 'outside' });
  }
  // watchtowers with signal beacons
  const towerSpots = [[700, 1560], [1360, 1580], [1020, 1960 - 140], [300, 1240], [1760, 1260], [260, 420], [1790, 520], [1030, 140 + 110]];
  for (const [x, z] of towerSpots) {
    const g = H(x, z);
    if (g > G + 30) continue;
    const b = tower(world, x, z, g, 4, 32, B.BRICK, B.ROOF_RED, rnd);
    addBuilding(world, info, b, 'tower');
    mark(x - 10, z - 10, x + 10, z + 10);
    const top = g + 32 + 1;
    info.towers.push({ x: x + 0.5, y: top + 1, z: z + 0.5, lit: false, name: `Watchtower ${String.fromCharCode(65 + info.towers.length)}` });
    info.depots.push({ x: x + 7.5, y: g + 1, z: z + 0.5, name: `Watchtower ${String.fromCharCode(64 + info.towers.length)} camp`, kind: 'outpost', zone: 'outside' });
    for (let xx = x + 5; xx <= x + 9; xx++) for (let zz = z - 2; zz <= z + 2; zz++) world.setSurface(xx, zz, B.PLANKS);
  }
  // forest camps
  for (const [x, z, name] of [[1024 - 40, 1880, 'Forest of Giants camp'], [1250, 1760, 'East forest camp'], [800, 1700, 'West forest camp'], [160 + 120, 1000, 'Western ridge camp'], [1890 - 120, 820, 'Eastern ridge camp']]) {
    const g = H(x, z);
    for (let xx = x - 2; xx <= x + 2; xx++) for (let zz = z - 2; zz <= z + 2; zz++) world.setSurface(xx, zz, B.PLANKS);
    mark(x - 8, z - 8, x + 8, z + 8);
    info.depots.push({ x: x + 0.5, y: g + 1, z: z + 0.5, name, kind: 'outpost', zone: 'outside' });
  }
  info.forest = { x: 1024, z: 1850, name: 'Forest of Giants' };
  info.pois.push({ x: 1024, z: 1850, name: 'Forest of Giants', kind: 'forest' });
  yield 0.62;

  // giant trees: dense outside the outer wall, thickest in the Forest of Giants
  const forestNoise = (x, z) => fbm(x / 120, z / 120, SEED + 5, 3);
  const tgrid = new Map();
  const tkey = (x, z) => ((x / 40) | 0) + ',' + ((z / 40) | 0);
  const near = (x, z, r) => {
    const gx = (x / 40) | 0, gz = (z / 40) | 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      for (const t of tgrid.get((gx + a) + ',' + (gz + b)) || []) if (Math.hypot(t.x - x, t.z - z) < t.r + r + 12) return true;
    }
    return false;
  };
  const step = 22;
  for (let gz = 10; gz < SZ - 10; gz += step) {
    for (let gx = 10; gx < SX - 10; gx += step) {
      const fn = forestNoise(gx, gz);
      const deep = Math.hypot(gx - info.forest.x, gz - info.forest.z) < 230;
      const forest = fn > 0.5 || deep;
      if (!forest && rnd() > 0.08) continue;
      const x = Math.round(gx + (rnd() - 0.5) * step * 0.9), z = Math.round(gz + (rnd() - 0.5) * step * 0.9);
      const r = 2.2 + rnd() * 2.4 + (deep ? 1 : 0);
      if (x < 40 || z < 40 || x > SX - 40 || z > SZ - 40) continue;
      if (Math.hypot(x - CX, z - CZ) < WALLS[2].R + 45 + r) continue;
      if (Math.hypot(x - CX, z - (CZ + 640)) < 140 + 40 + r) continue;
      if (Math.abs(x - CX) < 9 + r) continue; // keep the south road open
      if (occ[z * SX + x] || world.wmap[z * SX + x]) continue;
      const g = H(x, z);
      if (g > G + 26) continue;
      if (lakes.some((L) => Math.hypot(L.x - x, L.z - z) < L.r + 10 + r)) continue;
      if (near(x, z, r)) continue;
      const h = Math.round(46 + rnd() * 24 + (forest ? 8 : 0) + (deep ? 12 : 0));
      giantTree(world, x, z, g + 1, Math.min(h, SY - g - 16), r, rnd);
      const t = addTree(info, x, z, r, h, g + 1);
      const k = tkey(x, z);
      if (!tgrid.has(k)) tgrid.set(k, []);
      tgrid.get(k).push(t);
    }
    if (gz % (step * 10) < step) yield 0.62 + 0.26 * gz / SZ;
  }
  // small trees and orchards everywhere
  for (let i = 0; i < 9000; i++) {
    const x = Math.floor(40 + rnd() * (SX - 80)), z = Math.floor(40 + rnd() * (SZ - 80));
    const idx = z * SX + x;
    if (occ[idx] || world.wmap[idx] || world.surf[idx] !== B.GRASS) continue;
    if (nearWall(x, z) || Math.abs(x - CX) < 6 || Math.abs(z - CZ) < 6) continue;
    if (hm[idx] > G + 30) continue;
    smallTree(world, x, z, hm[idx] + 1, rnd);
  }
  yield 0.9;

  // ---------- supplies, caches, collectibles ----------
  const wallPoint = (w, a, inset = 0) => ({ x: w.cx + Math.cos(a) * (w.R - inset), z: w.cz + Math.sin(a) * (w.R - inset), y: G + w.H + 1 });
  for (const w of WALLS) {
    const n = w.parent != null ? 3 : Math.round(w.R / 70);
    for (let k = 0; k < n; k++) {
      let a = w.parent != null ? Math.PI / 2 + (k - 1) * 0.75 : (k / n) * Math.PI * 2 + 0.3;
      if (w.parent != null) a = Math.PI / 2 + (k - 1) * 0.85;
      const p = wallPoint(w, a, 0);
      if (w.parent != null && Math.hypot(p.x - CX, p.z - CZ) < WALLS[w.parent].R + 6) continue;
      info.depots.push({ ...p, name: `${w.name} depot ${k + 1}`, kind: 'wall', zone: 'wall' });
    }
  }
  for (const t of info.towns) if (t.plaza && !t.ruined) info.depots.push({ x: t.plaza.x + 6.5, y: G + 1, z: t.plaza.z + 6.5, name: `${t.name} depot`, kind: 'town', zone: zoneOf(t.plaza.x, t.plaza.z) });
  // gas canisters
  for (let i = 0; i < 20000 && info.canisters.length < 160; i++) {
    const x = Math.floor(40 + rnd() * (SX - 80)), z = Math.floor(40 + rnd() * (SZ - 80));
    if (Math.hypot(x - CX, z - CZ) < WALLS[2].R + 20) continue;
    const y = world.topSolid(x, z, 100);
    if (y > G + 40 || world.get(x, y - 1, z) === B.LEAVES || world.wmap[z * SX + x]) continue;
    if (info.canisters.some((c) => Math.abs(c.x - x) + Math.abs(c.z - z) < 50)) continue;
    info.canisters.push({ x: x + 0.5, y: y + 0.5, z: z + 0.5 });
  }
  for (const w of WALLS.slice(0, 3)) for (let k = 0; k < 8; k++) {
    const p = wallPoint(w, (k / 8) * Math.PI * 2 + 0.7, 0);
    info.canisters.push({ x: p.x, y: p.y + 0.5, z: p.z });
  }
  // supply caches and lost insignias (collectibles beyond the walls)
  const scatter = (list, n, minGap, onTrees) => {
    for (let i = 0; i < 40000 && list.length < n; i++) {
      const x = Math.floor(60 + rnd() * (SX - 120)), z = Math.floor(60 + rnd() * (SZ - 120));
      if (Math.hypot(x - CX, z - CZ) < WALLS[2].R + 40 || Math.hypot(x - CX, z - (CZ + 640)) < 180) continue;
      if (H(x, z) > G + 30 || world.wmap[z * SX + x]) continue;
      const y = onTrees ? world.topSolid(x, z, SY - 1) : H(x, z) + 1;
      if (onTrees && world.get(x, y - 1, z) !== B.LEAVES) continue;
      if (list.some((c) => Math.hypot(c.x - x, c.z - z) < minGap)) continue;
      list.push({ id: list.length, x: x + 0.5, y, z: z + 0.5, taken: false });
    }
  };
  scatter(info.caches, 24, 150, false);
  scatter(info.insignias, 12, 160, true);
  scatter(info.insignias, 20, 160, false);

  // spawn points
  const gS2 = gateList.find((g) => g.id === 'tharskS');
  info.spawns.camp = { x: camp.x + 0.5, y: G + 1, z: camp.z - 20.5, yaw: Math.PI };
  info.spawns.tharskWall = { x: gS2.x - 16, y: G + WALLS[3].H + 1.01, z: gS2.z - 1, yaw: Math.PI };
  info.spawns.corvaneWall = { x: CX + 20, y: G + WALLS[4].H + 1.01, z: CZ + 380 + 120 - 1, yaw: Math.PI };
  info.spawns.merrow = { x: CX + 8.5, y: G + 1, z: CZ + 8.5, yaw: 0 };
  const wW = gateList.find((g) => g.id === 'outerW');
  info.spawns.outerWestWall = { x: wW.x + 1, y: G + WALLS[2].H + 1.01, z: wW.z + 10, yaw: Math.PI / 2 };
  info.spawns.corvanePlaza = { x: towns[1].plaza.x + 3.5, y: G + 1, z: towns[1].plaza.z + 3.5, yaw: Math.PI };

  world.compactTerrain();
  info.G = G; info.CX = CX; info.CZ = CZ;
  yield 1;
  return info;
}

// ---------------- structures ----------------

function buildWall(world, w, rnd, H) {
  const top = G + w.H;
  const R = w.R;
  const parent = w.parent != null ? WALLS[w.parent] : null;
  const x0 = Math.max(0, Math.floor(w.cx - R - 6)), x1 = Math.min(SX - 1, Math.ceil(w.cx + R + 6));
  const z0 = Math.max(0, Math.floor(w.cz - R - 6)), z1 = Math.min(SZ - 1, Math.ceil(w.cz + R + 6));
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const d = Math.hypot(x - w.cx, z - w.cz);
    const off = d - R;
    if (off < -WT || off > WT + 1.2) continue;
    if (parent && Math.hypot(x - parent.cx, z - parent.cz) < parent.R + WT - 0.5) continue;
    const ang = Math.atan2(z - w.cz, x - w.cx);
    const gate = w.gates.some((a) => Math.abs(Math.atan2(Math.sin(ang - a), Math.cos(ang - a))) * R <= GATE_HALF);
    const arc = ang * R;
    const base = H(x, z) - 3;
    if (off > WT) {
      // ribs on the outer face
      if (gate || ((arc % 26) + 26) % 26 > 3) continue;
      for (let y = base; y <= top - 2; y++) world.set(x, y, z, B.WALL);
      continue;
    }
    for (let y = base; y <= top; y++) {
      if (gate && y > G && y <= G + GATE_H) {
        if (Math.abs(off) <= 1.2) world.set(x, y, z, B.GATE);
        continue;
      }
      world.set(x, y, z, B.WALL);
    }
    if (gate && Math.abs(off) > 1.2) for (let y = G + 1; y <= G + GATE_H; y++) world.set(x, y, z, B.AIR);
    if (gate) world.setSurface(x, z, B.COBBLE);
    // crenellations on the outside, a low rail on the inside
    if (off > WT - 1.1 && Math.floor(arc / 2) % 2 === 0) world.set(x, top + 1, z, B.WALL);
    if (off < -WT + 1.0) world.set(x, top + 1, z, B.WALL);
    // the odd cannon on the battlements
    if (Math.abs(off) < 0.5 && ((arc % 60) + 60) % 60 < 1 && !gate) {
      world.set(x, top + 1, z, B.DARKSTONE);
    }
  }
}

export function tower(world, tx, tz, g, r, h, mat, roof, rnd, ruined = false) {
  for (let y = g - 2; y <= g + h; y++) for (let z = tz - r - 1; z <= tz + r + 1; z++) for (let x = tx - r - 1; x <= tx + r + 1; x++) {
    const d = Math.hypot(x - tx, z - tz);
    if (d > r + 0.5) continue;
    const shell = d > r - 0.9;
    let b = mat;
    if (shell && y > g + 4 && (y - g) % 7 === 3 && (x === tx || z === tz)) b = B.WINDOW;
    if (shell && (mat === B.DARKSTONE || ruined) && rnd() < (ruined ? 0.2 : 0.04)) b = B.MOSSY;
    if (ruined && shell && y > g + h * 0.6 && rnd() < 0.25) b = B.AIR;
    world.set(x, y, z, b);
  }
  const capY = g + h + 1;
  if (!ruined) {
    for (let z = tz - r - 1; z <= tz + r + 1; z++) for (let x = tx - r - 1; x <= tx + r + 1; x++) {
      if (Math.hypot(x - tx, z - tz) <= r + 1.5) world.set(x, capY, z, B.TIMBER);
    }
    for (let k = 0; k <= r + 2; k++) {
      const rr = r + 1.5 - k * 0.85;
      if (rr < 0) { world.set(tx, capY + 1 + k, tz, roof); world.set(tx, capY + 2 + k, tz, B.TIMBER); break; }
      for (let z = tz - r - 2; z <= tz + r + 2; z++) for (let x = tx - r - 2; x <= tx + r + 2; x++) {
        if (Math.max(Math.abs(x - tx), Math.abs(z - tz)) <= rr) world.set(x, capY + 1 + k, z, roof);
      }
    }
  }
  return { x0: tx - r - 2, z0: tz - r - 2, x1: tx + r + 2, z1: tz + r + 2, y0: g, y1: capY + r + 4 };
}

export function house(world, x0, z0, x1, z1, g, rnd, opts = {}) {
  const floors = opts.floors ?? (rnd() < 0.22 ? 3 : rnd() < 0.7 ? 2 : 1);
  const Hh = floors * 4 + 1;
  const roof = opts.roof ?? (rnd() < 0.72 ? B.ROOF_RED : B.ROOF_BLUE);
  const base = opts.base ?? (rnd() < 0.3 ? B.BRICK : B.PLASTER);
  const ruined = !!opts.ruined;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    world.set(x, g, z, B.PLANKS);
    for (let y = g + 1; y <= g + Hh + 12; y++) world.set(x, y, z, B.AIR);
  }
  const doorSide = opts.door ?? Math.floor(rnd() * 4);
  for (let y = g + 1; y <= g + Hh; y++) {
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const edgeX = x === x0 || x === x1, edgeZ = z === z0 || z === z1;
      if (!edgeX && !edgeZ) continue;
      const corner = edgeX && edgeZ;
      const ly = y - g;
      let b = ly <= 4 ? base : B.PLASTER;
      if (corner || (ly > 1 && ly % 4 === 1)) b = B.TIMBER;
      else {
        const along = edgeX ? z - z0 : x - x0;
        const len = edgeX ? z1 - z0 : x1 - x0;
        if (along % 3 === 2 && along < len - 1 && (ly % 4 === 2 || ly % 4 === 3)) b = B.WINDOW;
        if (ly > 5 && along % 3 === 0) b = B.TIMBER;
      }
      if (ruined && (rnd() < 0.12 || (ly > 3 && rnd() < 0.3))) b = rnd() < 0.5 ? B.AIR : B.MOSSY;
      world.set(x, y, z, b);
    }
  }
  const midX = (x0 + x1) >> 1, midZ = (z0 + z1) >> 1;
  for (let y = g + 1; y <= g + 2; y++) {
    if (doorSide === 0) world.set(midX, y, z0, B.AIR);
    if (doorSide === 1) world.set(midX, y, z1, B.AIR);
    if (doorSide === 2) world.set(x0, y, midZ, B.AIR);
    if (doorSide === 3) world.set(x1, y, midZ, B.AIR);
  }
  const alongX = x1 - x0 >= z1 - z0;
  const y0 = g + Hh + 1;
  let topY = y0;
  if (!(ruined && rnd() < 0.6)) {
    if (alongX) {
      for (let k = 0; ; k++) {
        const za = z0 - 1 + k, zb = z1 + 1 - k;
        if (za > zb) break;
        topY = y0 + k;
        for (let x = x0 - 1; x <= x1 + 1; x++) {
          if (ruined && rnd() < 0.3) continue;
          world.set(x, y0 + k, za, roof); world.set(x, y0 + k, zb, roof);
        }
        for (let z = za + 1; z < zb; z++) { world.set(x0, y0 + k, z, B.PLASTER); world.set(x1, y0 + k, z, B.PLASTER); }
      }
    } else {
      for (let k = 0; ; k++) {
        const xa = x0 - 1 + k, xb = x1 + 1 - k;
        if (xa > xb) break;
        topY = y0 + k;
        for (let z = z0 - 1; z <= z1 + 1; z++) {
          if (ruined && rnd() < 0.3) continue;
          world.set(xa, y0 + k, z, roof); world.set(xb, y0 + k, z, roof);
        }
        for (let x = xa + 1; x < xb; x++) { world.set(x, y0 + k, z0, B.PLASTER); world.set(x, y0 + k, z1, B.PLASTER); }
      }
    }
  }
  if (!ruined && rnd() < 0.5) {
    const chx = x0 + 1 + Math.floor(rnd() * (x1 - x0 - 1)), chz = z0 + 1;
    for (let y = y0; y < y0 + Math.max(x1 - x0, z1 - z0) / 2 + 3; y++) { world.set(chx, y, chz, B.BRICK); topY = Math.max(topY, y); }
  }
  return { x0: x0 - 1, z0: z0 - 1, x1: x1 + 1, z1: z1 + 1, y0: g, y1: topY + 1 };
}

function addBuilding(world, info, b, town) {
  let n = 0;
  for (let y = b.y0 + 1; y <= b.y1; y++) for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) if (world.get(x, y, z) !== B.AIR) n++;
  const rec = { ...b, blocks: n, lost: 0, collapsed: false, town, id: info.buildings.length };
  info.buildings.push(rec);
  return rec;
}
function addTree(info, x, z, r, h, g) {
  const t = { x: x + 0.5, z: z + 0.5, r, h, g, fallen: false, id: info.trees.length };
  info.trees.push(t);
  return t;
}

// Street grid town: intersections become the walking graph for townsfolk.
function buildTown(world, t, rnd, info, occ, mark, nearWall, H) {
  const S = t.spacing || 30, SW = t.village ? 2 : 3; // half street width
  const K = Math.ceil(170 / S);
  const nodes = [], index = new Map();
  const g = t.ruined ? H(t.ox, t.oz) : G;
  for (let j = -K; j <= K; j++) for (let i = -K; i <= K; i++) {
    const x = t.ox + i * S, z = t.oz + j * S;
    if (x < 8 || z < 8 || x >= SX - 8 || z >= SZ - 8) continue;
    if (!t.clip(x, z) || nearWall(x, z)) continue;
    index.set(i + ',' + j, nodes.length);
    nodes.push({ x: x + 0.5, z: z + 0.5, i, j, adj: [] });
  }
  const streetMat = t.village ? B.GRAVEL : B.COBBLE;
  const paint = (xa, za, xb, zb) => {
    for (let z = Math.min(za, zb) - SW; z <= Math.max(za, zb) + SW; z++) for (let x = Math.min(xa, xb) - SW; x <= Math.max(xa, xb) + SW; x++) {
      if (x < 0 || z < 0 || x >= SX || z >= SZ) continue;
      world.setSurface(x, z, streetMat);
      occ[z * SX + x] = 1;
    }
  };
  for (const n of nodes) {
    for (const [di, dj] of [[1, 0], [0, 1]]) {
      const m = index.get((n.i + di) + ',' + (n.j + dj));
      if (m === undefined) continue;
      const o = nodes[m];
      const mx = (n.x + o.x) / 2, mz = (n.z + o.z) / 2;
      if (!t.clip(mx, mz) || nearWall(mx, mz)) continue;
      n.adj.push(m); o.adj.push(nodes.indexOf(n));
      paint(Math.floor(n.x), Math.floor(n.z), Math.floor(o.x), Math.floor(o.z));
    }
  }
  // keep only nodes connected to the one nearest the plaza
  let start = 0, best = 1e9;
  nodes.forEach((n, k) => { const d = Math.hypot(n.x - t.ox, n.z - t.oz); if (d < best) { best = d; start = k; } });
  const seen = new Set([start]), queue = [start];
  while (queue.length) { const k = queue.shift(); for (const m of nodes[k].adj) if (!seen.has(m)) { seen.add(m); queue.push(m); } }
  const remap = new Map();
  const kept = [];
  nodes.forEach((n, k) => { if (seen.has(k)) { remap.set(k, kept.length); kept.push(n); } });
  for (const n of kept) n.adj = n.adj.filter((m) => remap.has(m)).map((m) => remap.get(m));
  t.nodes = kept;
  t.plaza = { x: t.ox + 0.5, z: t.oz + 0.5 };

  // plaza: the four blocks around the central crossing
  const pr = Math.floor(S * (t.village ? 0.45 : 0.7));
  for (let z = t.oz - pr; z <= t.oz + pr; z++) for (let x = t.ox - pr; x <= t.ox + pr; x++) {
    if (!t.clip(x, z)) continue;
    world.setSurface(x, z, streetMat);
  }
  mark(t.ox - pr - 2, t.oz - pr - 2, t.ox + pr + 2, t.oz + pr + 2);
  if (!t.ruined) {
    // fountain
    for (let z = t.oz - 3; z <= t.oz + 3; z++) for (let x = t.ox - 3; x <= t.ox + 3; x++) {
      const rim = Math.abs(x - t.ox) === 3 || Math.abs(z - t.oz) === 3;
      world.set(x, g + 1, z, rim ? B.BRICK : B.WATER);
    }
    for (let y = g + 1; y <= g + 5; y++) world.set(t.ox, y, t.oz, B.STONE);
    world.set(t.ox, g + 6, t.oz, B.MOSSY);
  }
  // landmark tower(s)
  if (t.capital) {
    const keepB = tower(world, t.ox, t.oz - 52, g, 9, 58, B.DARKSTONE, B.ROOF_BLUE, rnd);
    addBuilding(world, info, keepB, t.id);
    mark(t.ox - 14, t.oz - 66, t.ox + 14, t.oz - 38);
    for (const [dx, dz] of [[-16, -64], [16, -64], [-16, -40], [16, -40]]) {
      const b = tower(world, t.ox + dx, t.oz + dz, g, 4, 40, B.DARKSTONE, B.ROOF_BLUE, rnd);
      addBuilding(world, info, b, t.id);
    }
    t.hq = { x: t.ox + 0.5, z: t.oz - 36.5 };
  } else if (!t.village) {
    const bx = t.ox + pr - 6, bz = t.oz - pr + 6;
    const b = tower(world, bx, bz, g, 4, 40, B.DARKSTONE, B.ROOF_RED, rnd);
    addBuilding(world, info, b, t.id);
    t.bell = { x: bx, z: bz };
  }

  // houses on the lots between streets
  const lot = Math.floor((S - 2 * SW - 2) / 2);
  for (let j = -K; j < K; j++) for (let i = -K; i < K; i++) {
    const bx = t.ox + i * S + SW + 2, bz = t.oz + j * S + SW + 2;
    for (let a = 0; a < 2; a++) for (let c = 0; c < 2; c++) {
      if (t.village && rnd() < 0.35) continue;
      const w = Math.max(6, lot - 1 - Math.floor(rnd() * 3)), d = Math.max(6, lot - 1 - Math.floor(rnd() * 3));
      const x0 = bx + a * lot + Math.floor(rnd() * (lot - w)), z0 = bz + c * lot + Math.floor(rnd() * (lot - d));
      const x1 = x0 + w - 1, z1 = z0 + d - 1;
      if (x0 < 4 || z0 < 4 || x1 >= SX - 4 || z1 >= SZ - 4) continue;
      let ok = true;
      for (let z = z0 - 1; z <= z1 + 1 && ok; z++) for (let x = x0 - 1; x <= x1 + 1; x++) {
        if (occ[z * SX + x] || !t.clip(x, z) || world.wmap[z * SX + x]) { ok = false; break; }
      }
      if (!ok || nearWall(x0, z0) || nearWall(x1, z1)) continue;
      mark(x0 - 1, z0 - 1, x1 + 1, z1 + 1);
      // door faces the nearer street
      const door = a === 0 ? (c === 0 ? (rnd() < 0.5 ? 0 : 2) : (rnd() < 0.5 ? 1 : 2)) : (c === 0 ? (rnd() < 0.5 ? 0 : 3) : (rnd() < 0.5 ? 1 : 3));
      const floors = t.floors[0] + Math.floor(rnd() * (t.floors[1] - t.floors[0] + 1));
      const roof = t.roof === 'thatch' ? B.THATCH : rnd() < 0.7 ? B.ROOF_RED : B.ROOF_BLUE;
      const b = house(world, x0, z0, x1, z1, g, rnd, { floors, roof, door, ruined: t.ruined });
      addBuilding(world, info, b, t.id);
    }
  }
}

function leafBlob(world, x, y, z, rx, ry, rz, rnd, block = B.LEAVES) {
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++)
    for (let dz = -Math.ceil(rz); dz <= Math.ceil(rz); dz++)
      for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
        const q = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) + (dz * dz) / (rz * rz);
        if (q > 1 - rnd() * 0.25) continue;
        const X = Math.round(x + dx), Y = Math.round(y + dy), Z = Math.round(z + dz);
        const cur = world.get(X, Y, Z);
        if (cur === B.AIR || cur === B.TALLGRASS) world.set(X, Y, Z, block);
      }
}

function giantTree(world, x, z, g, h, r, rnd) {
  const ph = rnd() * 10;
  for (let y = g - 3; y <= g + h; y++) {
    const t = (y - g) / h;
    const flare = Math.max(0, 4 - (y - g)) * 0.7;
    const rr = r * (1 - 0.4 * t) + flare;
    const ox = x + Math.sin(y * 0.06 + ph) * 1.2, oz = z + Math.cos(y * 0.05 + ph) * 1.2;
    const R = Math.ceil(rr + 1);
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dz * dz > rr * rr) continue;
      world.set(Math.round(ox + dx), y, Math.round(oz + dz), B.LOG);
    }
  }
  const n = 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.8;
    const sy = g + h * (0.5 + rnd() * 0.33);
    const len = 9 + rnd() * 8;
    const ox = x + Math.sin(sy * 0.06 + ph) * 1.2, oz = z + Math.cos(sy * 0.05 + ph) * 1.2;
    let ex = ox, ey = sy, ez = oz;
    for (let t = 0; t <= len; t += 0.5) {
      ex = ox + Math.cos(a) * t; ez = oz + Math.sin(a) * t; ey = sy + t * 0.45;
      const br = 1.4 - (t / len) * 0.8;
      for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (dx * dx + dy * dy + dz * dz > br * br) continue;
        world.set(Math.round(ex + dx), Math.round(ey + dy), Math.round(ez + dz), B.LOG);
      }
    }
    leafBlob(world, ex, ey + 1, ez, 5 + rnd() * 3, 2.5 + rnd() * 1.5, 5 + rnd() * 3, rnd);
  }
  leafBlob(world, x, g + h + 1, z, 8 + rnd() * 3, 4 + rnd(), 8 + rnd() * 3, rnd);
}

function smallTree(world, x, z, g, rnd) {
  const h = 4 + Math.floor(rnd() * 4);
  for (let y = g; y < g + h; y++) world.set(x, y, z, B.LOG);
  leafBlob(world, x, g + h, z, 2.6, 2.2, 2.6, rnd);
}
