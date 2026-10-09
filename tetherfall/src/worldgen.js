// Procedural world: rolling hills, a walled town, a forest of giant trees.
import { B } from './blocks.js';
import { SX, SZ, SY } from './world.js';
import { fbm, mulberry32 } from './noise.js';

const SEED = 7;

export function generate(world) {
  const rnd = mulberry32(SEED);
  const town = { cx: 320, cz: 170, R: 84, wallH: 22 };
  const pond = { x: 150, z: 470, r: 26 };
  const info = { town, pond, trees: [], depots: [], canisters: [], posts: [] };
  const { cx, cz, R, wallH } = town;
  const g = 24; // town ground block y (flattened)
  const top = g + wallH;

  // ---------- terrain ----------
  const height = new Int16Array(SX * SZ);
  for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
    let h = 25 + (fbm(x / 120, z / 120, SEED) - 0.5) * 26 + (fbm(x / 34, z / 34, SEED + 9) - 0.5) * 6;
    const dt = Math.hypot(x - cx, z - cz);
    const tb = smoothstep(R + 4, R + 40, dt);
    h = 24 * (1 - tb) + h * tb;
    const edge = Math.min(x, z, SX - 1 - x, SZ - 1 - z);
    const eb = smoothstep(0, 30, edge);
    h = 22 * (1 - eb) + h * eb;
    const dp = Math.hypot(x - pond.x, z - pond.z);
    if (dp < pond.r + 10) h -= (1 - smoothstep(pond.r - 8, pond.r + 10, dp)) * 8;
    height[z * SX + x] = Math.max(8, Math.round(h));
  }
  const H = (x, z) => height[Math.max(0, Math.min(SZ - 1, z)) * SX + Math.max(0, Math.min(SX - 1, x))];

  const WATER_LEVEL = 21;
  for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
    const h = H(x, z);
    const nearWater = h <= WATER_LEVEL + 1 && Math.hypot(x - pond.x, z - pond.z) < pond.r + 12;
    for (let y = 0; y <= h; y++) {
      let b = B.STONE;
      if (y === h) b = nearWater ? B.SAND : B.GRASS;
      else if (y > h - 4) b = nearWater ? B.SAND : B.DIRT;
      world.set(x, y, z, b);
    }
    for (let y = h + 1; y <= WATER_LEVEL && nearWater; y++) world.set(x, y, z, B.WATER);
    world.ground[z * SX + x] = h + 1;
  }

  // ---------- town wall with three gates (south, east, west) ----------
  const gateAngles = [Math.PI / 2, 0, Math.PI];
  const gateHalf = 5;
  const inGate = (x, z) => gateAngles.some((a) => {
    const along = (x - cx) * Math.cos(a) + (z - cz) * Math.sin(a);
    const across = -(x - cx) * Math.sin(a) + (z - cz) * Math.cos(a);
    return along > 0 && Math.abs(across) <= gateHalf;
  });
  for (let z = cz - R - 4; z <= cz + R + 4; z++) for (let x = cx - R - 4; x <= cx + R + 4; x++) {
    const d = Math.hypot(x - cx, z - cz);
    if (d < R - 2.5 || d > R + 2.5) continue;
    const gate = inGate(x, z);
    const ang = Math.atan2(z - cz, x - cx);
    for (let y = g + 1; y <= top; y++) {
      if (gate && y <= g + 13) continue;
      const mossy = rnd() < (y < g + 8 ? 0.28 : 0.08);
      world.set(x, y, z, mossy ? B.MOSSY : B.BRICK);
    }
    if (d > R + 1.2) {
      const seg = Math.floor(((ang + Math.PI) * R) / 2);
      if (seg % 2 === 0) world.set(x, top + 1, z, B.BRICK);
    }
    if (d < R - 1.7) world.set(x, top + 1, z, B.BRICK);
  }
  // wall towers, spaced around the ring but clear of the gates
  for (let deg = -180; deg < 180; deg += 30) {
    const a = (deg * Math.PI) / 180;
    if (gateAngles.some((ga) => Math.abs(Math.atan2(Math.sin(a - ga), Math.cos(a - ga))) < 0.2)) continue;
    const tx = Math.round(cx + Math.cos(a) * R), tz = Math.round(cz + Math.sin(a) * R);
    tower(world, tx, tz, g, 5, 34, B.DARKSTONE, B.ROOF_BLUE, rnd);
  }
  // gatehouse towers flanking each gate
  for (const a of gateAngles) {
    for (const s of [-1, 1]) {
      const px = cx + Math.cos(a) * R - Math.sin(a) * s * (gateHalf + 5);
      const pz = cz + Math.sin(a) * R + Math.cos(a) * s * (gateHalf + 5);
      tower(world, Math.round(px), Math.round(pz), g, 4, 30, B.BRICK, B.ROOF_RED, rnd);
    }
  }

  // occupancy grid inside the walls
  const occ = new Uint8Array(SX * SZ);
  const mark = (x0, z0, x1, z1) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) occ[z * SX + x] = 1; };
  const free = (x0, z0, x1, z1) => {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      if (occ[z * SX + x]) return false;
      if (Math.hypot(x - cx, z - cz) > R - 7) return false;
    }
    return true;
  };

  // training yard in the middle
  const yard = { x0: cx - 17, z0: cz - 12, x1: cx + 17, z1: cz + 12 };
  for (let z = yard.z0; z <= yard.z1; z++) for (let x = yard.x0; x <= yard.x1; x++) {
    world.set(x, g, z, B.DIRT);
    const border = x === yard.x0 || x === yard.x1 || z === yard.z0 || z === yard.z1;
    if (border && (x + z) % 7 !== 0) world.set(x, g + 1, z, B.PLANKS);
  }
  for (let k = -2; k <= 2; k++) {
    world.set(cx + k, g + 1, yard.z0, B.AIR); world.set(cx + k, g + 1, yard.z1, B.AIR);
    world.set(yard.x0, g + 1, cz + k, B.AIR); world.set(yard.x1, g + 1, cz + k, B.AIR);
  }
  mark(yard.x0 - 3, yard.z0 - 3, yard.x1 + 3, yard.z1 + 3);
  for (const [px, pz, ph] of [[-12, -7, 16], [12, -7, 18], [-12, 7, 14], [12, 7, 16], [0, -8, 22], [-5, 8, 12]]) {
    for (let y = g + 1; y <= g + ph; y++) world.set(cx + px, y, cz + pz, B.LOG);
    info.posts.push({ x: cx + px + 0.5, z: cz + pz + 0.5 });
  }
  info.yard = { x: cx, z: cz + 2, y: g + 1, ...yard };

  // roads from each gate to the yard, and a gravel ring road inside the wall
  for (let z = yard.z1 + 1; z <= cz + R + 3; z++) for (let x = cx - 4; x <= cx + 4; x++) world.set(x, g, z, B.COBBLE);
  for (let x = yard.x1 + 1; x <= cx + R + 3; x++) for (let z = cz - 4; z <= cz + 4; z++) world.set(x, g, z, B.COBBLE);
  for (let x = cx - R - 3; x < yard.x0; x++) for (let z = cz - 4; z <= cz + 4; z++) world.set(x, g, z, B.COBBLE);
  for (let x = cx - 3; x <= cx + 3; x++) for (let z = cz - R + 8; z < yard.z0; z++) world.set(x, g, z, B.GRAVEL);
  for (let z = cz - R; z <= cz + R; z++) for (let x = cx - R; x <= cx + R; x++) {
    const d = Math.hypot(x - cx, z - cz);
    if (d > R - 15 && d < R - 11) { world.set(x, g, z, B.GRAVEL); occ[z * SX + x] = 1; }
  }
  mark(cx - 5, yard.z1, cx + 5, cz + R);
  mark(yard.x1, cz - 5, cx + R, cz + 5);
  mark(cx - R, cz - 5, yard.x0, cz + 5);
  mark(cx - 4, cz - R, cx + 4, yard.z0);

  // market square with a fountain (north-east quarter)
  const mx = cx + 34, mz = cz - 34;
  for (let z = mz - 9; z <= mz + 9; z++) for (let x = mx - 9; x <= mx + 9; x++) world.set(x, g, z, B.COBBLE);
  for (let z = mz - 3; z <= mz + 3; z++) for (let x = mx - 3; x <= mx + 3; x++) {
    const rim = Math.abs(x - mx) === 3 || Math.abs(z - mz) === 3;
    world.set(x, g + 1, z, rim ? B.BRICK : B.WATER);
  }
  for (let y = g + 1; y <= g + 6; y++) world.set(mx, y, mz, B.STONE);
  world.set(mx, g + 7, mz, B.MOSSY);
  mark(mx - 10, mz - 10, mx + 10, mz + 10);

  // tall inner towers
  const inner = [[-40, -22, 46, B.ROOF_RED], [42, 26, 42, B.ROOF_RED], [12, -52, 38, B.ROOF_BLUE], [-30, 40, 40, B.ROOF_BLUE], [-58, -2, 34, B.ROOF_RED], [56, -10, 36, B.ROOF_BLUE]];
  for (const [ox, oz, h, roof] of inner) {
    const tx = cx + ox, tz = cz + oz;
    if (!free(tx - 4, tz - 4, tx + 4, tz + 4)) continue;
    tower(world, tx, tz, g, 3, h, B.DARKSTONE, roof, rnd);
    mark(tx - 6, tz - 6, tx + 6, tz + 6);
  }

  // houses
  let placed = 0;
  for (let i = 0; i < 2000 && placed < 120; i++) {
    const w = 7 + Math.floor(rnd() * 7), d = 7 + Math.floor(rnd() * 5);
    const x0 = Math.floor(cx - R + 7 + rnd() * (2 * R - 14 - w));
    const z0 = Math.floor(cz - R + 7 + rnd() * (2 * R - 14 - d));
    const x1 = x0 + w - 1, z1 = z0 + d - 1;
    if (!free(x0 - 2, z0 - 2, x1 + 2, z1 + 2)) continue;
    mark(x0 - 1, z0 - 1, x1 + 1, z1 + 1);
    house(world, x0, z0, x1, z1, g, rnd);
    placed++;
  }
  for (let i = 0; i < 200; i++) {
    const x = Math.floor(cx - R + 8 + rnd() * (2 * R - 16)), z = Math.floor(cz - R + 8 + rnd() * (2 * R - 16));
    if (!free(x - 1, z - 1, x + 2, z + 2)) continue;
    mark(x - 1, z - 1, x + 2, z + 2);
    if (rnd() < 0.5) { for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) world.set(x + a, g + 1, z + b, B.HEDGE); }
    else smallTree(world, x, z, g + 1, rnd);
  }

  // ---------- outside the walls ----------
  // ruins of an old outer wall to the south, good anchor points
  const ruinR = R + 150;
  for (let z = cz; z <= cz + ruinR + 3; z++) for (let x = cx - ruinR - 3; x <= cx + ruinR + 3; x++) {
    if (x < 6 || z < 6 || x >= SX - 6 || z >= SZ - 6) continue;
    const d = Math.hypot(x - cx, z - cz);
    if (d < ruinR - 2 || d > ruinR + 2) continue;
    const ang = Math.atan2(z - cz, x - cx);
    if (ang < 0.15 || ang > Math.PI - 0.15) continue;
    const hh = Math.floor(fbm(ang * 9, 0.5, SEED + 77) * 26) - 6;
    if (hh <= 0) continue;
    const gy = H(x, z);
    for (let y = gy + 1; y <= gy + hh; y++) world.set(x, y, z, rnd() < 0.3 ? B.MOSSY : B.BRICK);
  }
  // outer watchtowers
  const watch = [[cx - 180, cz + 120], [cx + 190, cz + 100], [cx - 40, cz + 300], [cx + 120, cz + 330], [cx - 220, cz - 60], [cx + 230, cz - 90]];
  info.watch = [];
  for (const [wx, wz] of watch) {
    if (wx < 20 || wz < 20 || wx > SX - 20 || wz > SZ - 20) continue;
    tower(world, wx, wz, H(wx, wz), 4, 30, B.BRICK, B.ROOF_RED, rnd);
    info.watch.push({ x: wx, z: wz, r: 5 });
  }

  // giant trees: dense forest patches, a meadow ring around the town
  const forestNoise = (x, z) => fbm(x / 110, z / 110, SEED + 5, 3);
  const trunkOK = (x, z, r) => {
    if (x < 16 || z < 16 || x > SX - 16 || z > SZ - 16) return false;
    if (Math.hypot(x - cx, z - cz) < R + 30 + r) return false;
    if (Math.hypot(x - pond.x, z - pond.z) < pond.r + 8 + r) return false;
    if (Math.abs(Math.hypot(x - cx, z - cz) - ruinR) < r + 4) return false;
    for (const w of info.watch) if (Math.hypot(w.x - x, w.z - z) < r + 12) return false;
    for (const t of info.trees) if (Math.hypot(t.x - x, t.z - z) < t.r + r + 13) return false;
    return true;
  };
  const step = 20;
  for (let gz = 10; gz < SZ - 10; gz += step) for (let gx = 10; gx < SX - 10; gx += step) {
    const fn = forestNoise(gx, gz);
    const forest = fn > 0.47;
    if (!forest && rnd() > 0.12) continue;
    const x = Math.round(gx + (rnd() - 0.5) * step * 0.9), z = Math.round(gz + (rnd() - 0.5) * step * 0.9);
    const r = 2.2 + rnd() * 2.4;
    if (!trunkOK(x, z, r)) continue;
    const h = Math.round(46 + rnd() * 26 + (forest ? 8 : 0));
    giantTree(world, x, z, H(x, z) + 1, Math.min(h, SY - H(x, z) - 16), r, rnd);
    info.trees.push({ x: x + 0.5, z: z + 0.5, r, h });
  }
  for (const w of info.watch) info.trees.push(w); // colossi walk around watchtowers too
  for (let i = 0; i < 1100; i++) {
    const x = Math.floor(8 + rnd() * (SX - 16)), z = Math.floor(8 + rnd() * (SZ - 16));
    if (Math.hypot(x - cx, z - cz) < R + 8) continue;
    if (Math.hypot(x - pond.x, z - pond.z) < pond.r + 4) continue;
    if (world.get(x, H(x, z), z) !== B.GRASS || world.get(x, H(x, z) + 1, z) !== B.AIR) continue;
    smallTree(world, x, z, H(x, z) + 1, rnd);
  }

  // plants
  for (let z = 1; z < SZ - 1; z++) for (let x = 1; x < SX - 1; x++) {
    const y = world.topSolid(x, z, 70);
    if (world.get(x, y - 1, z) !== B.GRASS || world.get(x, y, z) !== B.AIR) continue;
    const k = rnd();
    if (k < 0.1) world.set(x, y, z, B.TALLGRASS);
    else if (k < 0.108) world.set(x, y, z, B.FLOWER_R);
    else if (k < 0.114) world.set(x, y, z, B.FLOWER_Y);
  }

  // ---------- points of interest ----------
  const wallPoint = (deg, inset = 0) => {
    const a = (deg * Math.PI) / 180;
    return { x: cx + Math.cos(a) * (R - inset), z: cz + Math.sin(a) * (R - inset), y: top + 1 };
  };
  const sp = wallPoint(-100, 0.5);
  info.spawn = { x: sp.x, y: sp.y + 0.01, z: sp.z, yaw: -Math.PI / 2 + 0.1 };
  info.wallBeacon = wallPoint(-92, 0.5);
  info.depots.push({ ...wallPoint(-108, 0.5), name: 'North wall depot' });
  info.depots.push({ ...wallPoint(160, 0.5), name: 'West wall depot' });
  info.depots.push({ ...wallPoint(30, 0.5), name: 'East wall depot' });
  info.depots.push({ x: cx + 8, y: g + 1, z: cz - 16, name: 'Yard depot' });
  const outpost = (ox, oz, name) => {
    const oy = H(ox, oz) + 1;
    for (let x = ox - 2; x <= ox + 2; x++) for (let z = oz - 2; z <= oz + 2; z++) {
      for (let y = oy; y < oy + 6; y++) world.set(x, y, z, B.AIR);
      world.set(x, oy - 1, z, B.PLANKS);
    }
    info.depots.push({ x: ox + 0.5, y: oy, z: oz + 0.5, name });
  };
  outpost(cx + 2, cz + R + 30, 'South gate outpost');
  outpost(cx + R + 30, cz + 2, 'East gate outpost');
  outpost(cx - R - 30, cz + 2, 'West gate outpost');
  outpost(cx - 10, cz + R + 210, 'Deep forest camp');
  for (const w of info.watch) outpost(w.x + 8, w.z, 'Watchtower camp');
  info.gateOutside = { x: cx + 0.5, z: cz + R + 22 };

  // gas canisters scattered on the ground and on the walls
  for (let i = 0; i < 3000 && info.canisters.length < 70; i++) {
    const x = Math.floor(16 + rnd() * (SX - 32)), z = Math.floor(16 + rnd() * (SZ - 32));
    if (Math.hypot(x - cx, z - cz) < R + 8) continue;
    const y = world.topSolid(x, z, 70);
    if (y > 50 || world.get(x, y - 1, z) === B.WATER || world.get(x, y - 1, z) === B.LEAVES) continue;
    if (info.canisters.some((c) => Math.hypot(c.x - x, c.z - z) < 38)) continue;
    info.canisters.push({ x: x + 0.5, y: y + 0.5, z: z + 0.5 });
  }
  for (const deg of [-60, 60, 120, 210, 250, -20]) info.canisters.push({ ...wallPoint(deg, 0.5), y: top + 1.5 });

  return info;
}

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function tower(world, tx, tz, g, r, h, mat, roof, rnd) {
  for (let y = g - 2; y <= g + h; y++) for (let z = tz - r - 1; z <= tz + r + 1; z++) for (let x = tx - r - 1; x <= tx + r + 1; x++) {
    const d = Math.hypot(x - tx, z - tz);
    if (d > r + 0.5) continue;
    const shell = d > r - 0.9;
    let b = mat;
    if (shell && y > g + 4 && (y - g) % 7 === 3 && (x === tx || z === tz)) b = B.WINDOW;
    if (shell && mat === B.DARKSTONE && rnd() < 0.04) b = B.MOSSY;
    world.set(x, y, z, b);
  }
  // overhanging cap and pyramid roof
  const capY = g + h + 1;
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

function house(world, x0, z0, x1, z1, g, rnd) {
  const floors = rnd() < 0.22 ? 3 : rnd() < 0.7 ? 2 : 1;
  const Hh = floors * 4 + 1;
  const roof = rnd() < 0.72 ? B.ROOF_RED : B.ROOF_BLUE;
  const base = rnd() < 0.3 ? B.BRICK : B.PLASTER;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    world.set(x, g, z, B.PLANKS);
    for (let y = g + 1; y <= g + Hh + 12; y++) world.set(x, y, z, B.AIR);
  }
  const doorSide = Math.floor(rnd() * 4);
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
      world.set(x, y, z, b);
    }
  }
  // door
  const midX = (x0 + x1) >> 1, midZ = (z0 + z1) >> 1;
  for (let y = g + 1; y <= g + 2; y++) {
    if (doorSide === 0) world.set(midX, y, z0, B.AIR);
    if (doorSide === 1) world.set(midX, y, z1, B.AIR);
    if (doorSide === 2) world.set(x0, y, midZ, B.AIR);
    if (doorSide === 3) world.set(x1, y, midZ, B.AIR);
  }
  // gable roof along the longer axis
  const alongX = x1 - x0 >= z1 - z0;
  const y0 = g + Hh + 1;
  if (alongX) {
    for (let k = 0; ; k++) {
      const za = z0 - 1 + k, zb = z1 + 1 - k;
      if (za > zb) break;
      for (let x = x0 - 1; x <= x1 + 1; x++) { world.set(x, y0 + k, za, roof); world.set(x, y0 + k, zb, roof); }
      for (let z = za + 1; z < zb; z++) { world.set(x0, y0 + k, z, B.PLASTER); world.set(x1, y0 + k, z, B.PLASTER); }
    }
  } else {
    for (let k = 0; ; k++) {
      const xa = x0 - 1 + k, xb = x1 + 1 - k;
      if (xa > xb) break;
      for (let z = z0 - 1; z <= z1 + 1; z++) { world.set(xa, y0 + k, z, roof); world.set(xb, y0 + k, z, roof); }
      for (let x = xa + 1; x < xb; x++) { world.set(x, y0 + k, z0, B.PLASTER); world.set(x, y0 + k, z1, B.PLASTER); }
    }
  }
  // chimney
  if (rnd() < 0.6) {
    const chx = x0 + 1 + Math.floor(rnd() * (x1 - x0 - 1)), chz = z0 + 1;
    for (let y = y0; y < y0 + Math.max(x1 - x0, z1 - z0) / 2 + 3; y++) world.set(chx, y, chz, B.BRICK);
  }
}

function leafBlob(world, x, y, z, rx, ry, rz, rnd, block = B.LEAVES) {
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++)
    for (let dz = -Math.ceil(rz); dz <= Math.ceil(rz); dz++)
      for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
        const q = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) + (dz * dz) / (rz * rz);
        if (q > 1 - rnd() * 0.25) continue;
        const X = Math.round(x + dx), Y = Math.round(y + dy), Z = Math.round(z + dz);
        if (world.get(X, Y, Z) === B.AIR) world.set(X, Y, Z, block);
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
  // branches
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
