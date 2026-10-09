// Modular voxel building kit. All structures are written into the world's
// sparse override layer and register gameplay metadata (doors, lights, smoke,
// beds, containers, NPC spots) in world.meta.
import { B, KIND, SOLID } from './blocks.js';
import { rng, hash3, hash2 } from '../core/noise.js';
import { WX, WZ, H } from './world.js';

export function initMeta(world) {
  world.meta = {
    lights: [], smoke: [], doors: [], spots: {}, containers: [], beds: [], interiors: [],
    windmills: [], waterwheels: [], banners: [], campfires: [], signs: [], ladders: [],
  };
}

// local->world transform with 90 degree rotations. Local front is -z.
export class Frame {
  constructor(world, ox, oy, oz, rot = 0) {
    this.w = world; this.ox = ox; this.oy = oy; this.oz = oz; this.rot = ((rot % 4) + 4) % 4;
  }
  tx(lx, lz) {
    switch (this.rot) {
      case 0: return [this.ox + lx, this.oz + lz];
      case 1: return [this.ox - lz, this.oz + lx];
      case 2: return [this.ox - lx, this.oz - lz];
      default: return [this.ox + lz, this.oz - lx];
    }
  }
  dir(dx, dz) {
    switch (this.rot) {
      case 0: return [dx, dz];
      case 1: return [-dz, dx];
      case 2: return [-dx, -dz];
      default: return [dz, -dx];
    }
  }
  wp(lx, ly, lz) { const [x, z] = this.tx(lx, lz); return { x, y: this.oy + ly, z }; }
  set(lx, ly, lz, b) { const [x, z] = this.tx(lx, lz); this.w.set(x, this.oy + ly, z, b); }
  get(lx, ly, lz) { const [x, z] = this.tx(lx, lz); return this.w.peek(x, this.oy + ly, z); }
  fill(x0, y0, z0, x1, y1, z1, b) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
      for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, z, b);
  }
  // fill downward from ly=-1 to terrain
  foundation(x0, z0, x1, z1, b = B.COBBLE, top = -1) {
    for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
        for (let y = top; y > -30; y--) {
          const cur = this.get(x, y, z);
          if (y < top && SOLID[cur] && cur !== B.WATER) break;
          this.set(x, y, z, b);
        }
      }
  }
  mark(x0, z0, x1, z1, pad = 2) {
    for (let z = Math.min(z0, z1) - pad; z <= Math.max(z0, z1) + pad; z++)
      for (let x = Math.min(x0, x1) - pad; x <= Math.max(x0, x1) + pad; x++) {
        const [wx, wz] = this.tx(x, z);
        if (wx >= 0 && wz >= 0 && wx < WX && wz < WZ) this.w.mask[wz * WX + wx] = 1;
      }
  }
  meta() { return this.w.meta; }
  light(lx, ly, lz, color = 0xffb060, intensity = 1, radius = 16, flicker = true) {
    const p = this.wp(lx, ly, lz);
    this.w.meta.lights.push({ x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5, color, intensity, radius, flicker });
  }
  spot(name, lx, ly, lz, face = 0) {
    const p = this.wp(lx, ly, lz);
    const [dx, dz] = this.dir(0, -1);
    this.w.meta.spots[name] = { x: p.x + 0.5, y: p.y, z: p.z + 0.5, yaw: Math.atan2(-dx, -dz) + face };
    return this.w.meta.spots[name];
  }
}

export function groundAt(world, x, z) { return world.height[Math.max(0, Math.min(WZ - 1, Math.round(z))) * WX + Math.max(0, Math.min(WX - 1, Math.round(x)))]; }

// ------------------------------------------------------------------
// Houses
// ------------------------------------------------------------------
const FLOOR_H = 6;
export function house(world, o) {
  const { x, z, rot = 0, w = 11, d = 9, floors = 1, roof = B.ROOF_RED, style = 'timber', type = 'home', name = 'house', chimney = true, seed = 1, shutters = B.CLOTH_GREEN, lit = 0.7 } = o;
  const r = rng(seed + x * 31 + z * 17);
  const baseY = o.y ?? groundAt(world, x + 0, z + 0) + 1;
  // center the footprint on (x,z) in local frame
  const F = new Frame(world, x, baseY, z, rot);
  const lx0 = -Math.floor(w / 2), lz0 = -Math.floor(d / 2);
  const L = (lx, ly, lz, b) => F.set(lx0 + lx, ly, lz0 + lz, b);
  const fill = (a, b2, c, dd, e, f, blk) => F.fill(lx0 + a, b2, lz0 + c, lx0 + dd, e, lz0 + f, blk);
  F.mark(lx0, lz0, lx0 + w - 1, lz0 + d - 1, 3);
  F.foundation(lx0 - 1, lz0 - 1, lx0 + w, lz0 + d, B.COBBLE, -1);
  const roofH = Math.ceil(d / 2) + 2;
  const topY = floors * FLOOR_H;
  fill(0, 0, 0, w - 1, topY + roofH + 1, d - 1, B.AIR);
  // floor
  fill(0, -1, 0, w - 1, -1, d - 1, type === 'smith' || type === 'barn' ? B.COBBLE : B.PLANKS);
  const midX = Math.floor(w / 2) - 1;
  const doorPos = [];
  for (let f = 0; f < floors; f++) {
    const y0 = f * FLOOR_H;
    for (let y = y0; y < y0 + FLOOR_H; y++) {
      for (let lx = 0; lx < w; lx++) for (let lz = 0; lz < d; lz++) {
        const edgeX = lx === 0 || lx === w - 1, edgeZ = lz === 0 || lz === d - 1;
        if (!edgeX && !edgeZ) continue;
        const corner = edgeX && edgeZ;
        let b;
        if (style === 'stone' || (style === 'mixed' && f === 0)) {
          b = corner ? B.STONE_DARK : B.STONE_LIGHT;
          if (y === y0 + FLOOR_H - 1 && style === 'mixed') b = B.BEAM;
        } else if (style === 'plank') {
          b = corner || y === y0 ? B.LOG : B.PLANKS;
        } else {
          const along = edgeZ ? lx : lz;
          const beam = corner || along % 4 === 0 || y === y0 + FLOOR_H - 1 || (y === y0 && f === 0);
          b = beam ? B.BEAM : (style === 'cream' ? B.PLASTER_CREAM : B.PLASTER);
          if (f === 0 && y === y0 && style !== 'cream') b = B.STONE_LIGHT;
        }
        L(lx, y, lz, b);
      }
    }
    // windows
    const wy = y0 + 2;
    for (let lx = 2; lx < w - 2; lx++) {
      if (lx % 4 !== 2) continue;
      for (const lz of [0, d - 1]) {
        if (f === 0 && lz === 0 && Math.abs(lx - midX - 0.5) < 2.5) continue;
        const glass = r() < lit ? B.GLASS_LIT : B.GLASS_DARK;
        L(lx, wy, lz, glass); L(lx, wy + 1, lz, glass);
        if (style !== 'stone' && shutters) {
          const out = lz === 0 ? -1 : d;
          L(lx - 1, wy, out, shutters); L(lx - 1, wy + 1, out, shutters);
          L(lx + 1, wy, out, shutters); L(lx + 1, wy + 1, out, shutters);
          if (r() < 0.6) { L(lx, wy - 1, out, B.PLANKS_DARK); if (r() < 0.8) L(lx, wy, out, r.pick([B.FLOWER_RED, B.FLOWER_YELLOW, B.FLOWER_PURPLE])); }
        }
      }
    }
    for (let lz = 2; lz < d - 2; lz++) {
      if (lz % 4 !== 2) continue;
      for (const lx of [0, w - 1]) {
        const glass = r() < lit ? B.GLASS_LIT : B.GLASS_DARK;
        L(lx, wy, lz, glass); L(lx, wy + 1, lz, glass);
      }
    }
    // upper floor slab
    if (f > 0) fill(1, y0 - 1, 1, w - 2, y0 - 1, d - 2, B.PLANKS);
  }
  // door (2 wide, 5 tall)
  for (let y = 0; y < 5; y++) { L(midX, y, 0, B.AIR); L(midX + 1, y, 0, B.AIR); }
  L(midX - 1, 5, 0, B.BEAM); L(midX, 5, 0, B.BEAM); L(midX + 1, 5, 0, B.BEAM); L(midX + 2, 5, 0, B.BEAM);
  // step in front
  L(midX, -1, -1, B.COBBLE); L(midX + 1, -1, -1, B.COBBLE);
  const dp = F.wp(lx0 + midX, 0, lz0);
  const [fdx, fdz] = F.dir(0, -1);
  const [rdx, rdz] = F.dir(1, 0);
  const door = { x: dp.x, y: dp.y, z: dp.z, fdx, fdz, rdx, rdz, w: 2, h: 5, name };
  world.meta.doors.push(door);
  // lantern beside the door
  L(midX - 1, 4, -1, B.LANTERN);
  F.light(lx0 + midX - 1, 4, lz0 - 1, 0xffb060, 0.9, 14);
  // roof (gable, ridge along local x)
  let k = 0;
  for (; k <= Math.ceil(d / 2); k++) {
    const y = topY + k;
    const zA = k - 1, zB = d - k;
    if (zA > zB) break;
    for (let lx = -1; lx <= w; lx++) {
      L(lx, y, zA, roof); L(lx, y, zB, roof);
      if (k > 0) { L(lx, y - 1, zA, roof); L(lx, y - 1, zB, roof); }
    }
    // gable walls
    for (let lz = zA + 1; lz < zB; lz++) {
      const gb = (lz % 3 === 0 && style === 'timber') ? B.BEAM : style === 'stone' ? B.STONE_LIGHT : style === 'plank' ? B.PLANKS : style === 'cream' ? B.PLASTER_CREAM : B.PLASTER;
      L(0, y, lz, gb); L(w - 1, y, lz, gb);
    }
    if (zB - zA <= 1) break;
  }
  const ridgeY = topY + k;
  if (d % 2 === 1) for (let lx = -1; lx <= w; lx++) L(lx, ridgeY + 1, Math.floor(d / 2), roof);
  // gable window
  if (d >= 9) { L(0, topY + 2, Math.floor(d / 2), B.GLASS_DARK); L(w - 1, topY + 2, Math.floor(d / 2), r() < lit ? B.GLASS_LIT : B.GLASS_DARK); }
  // interior
  const spots = {};
  const inside = (n, lx, lz, ly = 0, face = 0) => { spots[n] = F.spot(name + '.' + n, lx0 + lx, ly, lz0 + lz, face); };
  inside('in', midX, 2, 0);
  inside('front', midX, -3, 0, Math.PI);
  // chimney & hearth on right back corner
  if (chimney) {
    const cx = w - 2, cz = d - 2;
    for (let y = 0; y <= ridgeY + 2; y++) { L(cx, y, cz + 1 > d - 1 ? d - 1 : cz + 1, B.BRICK); L(cx, y, d - 1, B.BRICK); }
    for (let y = 0; y <= ridgeY + 2; y++) { L(w - 1, y, d - 1, B.BRICK); }
    fill(cx - 1, 0, cz, cx, 0, cz, B.STONE_DARK);
    L(cx, 0, cz, B.STONE_DARK); L(cx, 1, cz, B.AIR); L(cx, 2, cz, B.BRICK); L(cx - 1, 2, cz, B.BRICK);
    const hp = F.wp(lx0 + cx, 1, lz0 + cz);
    world.meta.campfires.push({ x: hp.x + 0.5, y: hp.y, z: hp.z + 0.5, hearth: true, small: true });
    F.light(lx0 + cx, 1, lz0 + cz - 1, 0xff8a3a, 1.2, 12);
    const sp = F.wp(lx0 + w - 1, ridgeY + 3, lz0 + d - 1);
    world.meta.smoke.push({ x: sp.x + 0.5, y: sp.y, z: sp.z + 0.5 });
    inside('hearth', cx - 1, cz - 2, 0, Math.PI);
  }
  // furnish
  furnish(F, lx0, lz0, w, d, floors, type, r, inside, name, world);
  // stairs to upper floor
  if (floors > 1) {
    for (let i = 0; i < 6; i++) {
      for (let y = 0; y <= i; y++) L(1 + i, y, d - 2, B.PLANKS_DARK);
      L(1 + i, i + 1, d - 2, B.AIR);
    }
    fill(1, FLOOR_H - 1, d - 2, 7, FLOOR_H - 1, d - 2, B.AIR);
    for (let y = FLOOR_H; y < FLOOR_H + 5; y++) L(1, y, d - 2, B.AIR);
  }
  const b0 = F.wp(lx0, 0, lz0), b1 = F.wp(lx0 + w - 1, 0, lz0 + d - 1);
  world.meta.interiors.push({ x0: Math.min(b0.x, b1.x), x1: Math.max(b0.x, b1.x) + 1, z0: Math.min(b0.z, b1.z), z1: Math.max(b0.z, b1.z) + 1, y0: baseY, y1: baseY + topY + roofH, name });
  return { door, spots, frame: F, baseY, name };
}

function furnish(F, lx0, lz0, w, d, floors, type, r, inside, name, world) {
  const L = (lx, ly, lz, b) => F.set(lx0 + lx, ly, lz0 + lz, b);
  const container = (lx, ly, lz, kind, loot) => {
    const p = F.wp(lx0 + lx, ly, lz0 + lz);
    world.meta.containers.push({ x: p.x, y: p.y, z: p.z, kind, loot, owner: name, id: `${name}.${kind}.${lx}.${lz}.${ly}` });
  };
  const bedAt = (lx, lz, ly = 0, tag = 'bed') => {
    L(lx, ly, lz, B.BED); L(lx, ly, lz + 1, B.BED); L(lx, ly + 1, lz + 1, B.PLANKS_DARK);
    inside(tag, lx, lz - 1, ly, 0);
    const p = F.wp(lx0 + lx, ly + 1, lz0 + lz);
    world.meta.beds.push({ x: p.x + 0.5, y: p.y, z: p.z + 0.5, owner: name });
  };
  const upY = floors > 1 ? FLOOR_H : 0;
  switch (type) {
    case 'home': {
      bedAt(w - 3 > 2 ? 2 : 1, d - 4, upY, 'bed');
      if (floors > 1) bedAt(w - 4, d - 4, upY, 'bed2');
      L(Math.floor(w / 2), 0, Math.floor(d / 2), B.TABLE);
      L(Math.floor(w / 2) - 1, 0, Math.floor(d / 2), B.PLANKS_DARK);
      inside('table', Math.floor(w / 2) - 2, Math.floor(d / 2), 0, -Math.PI / 2);
      L(1, 0, 1, B.BARREL); L(1, 1, 1, B.BARREL);
      L(w - 2, 0, 1, B.CRATE); container(w - 2, 1, 1, 'chest', 'home');
      L(1, 0, 3, B.BOOKSHELF); L(1, 1, 3, B.BOOKSHELF);
      L(Math.floor(w / 2), -1, Math.floor(d / 2) + 1, B.CARPET);
      break;
    }
    case 'inn': {
      // long tables & counter
      for (let lx = 2; lx < w - 3; lx += 4) {
        L(lx, 0, 3, B.TABLE); L(lx + 1, 0, 3, B.TABLE);
        L(lx, 0, 2, B.PLANKS_DARK); L(lx + 1, 0, 4, B.PLANKS_DARK);
      }
      for (let lx = 2; lx < w - 2; lx++) L(lx, 0, d - 3, B.TABLE);
      L(2, 0, d - 2, B.BARREL); L(3, 0, d - 2, B.BARREL); L(2, 1, d - 2, B.BARREL);
      inside('counter', Math.floor(w / 2), d - 2, 0, Math.PI);
      inside('seat1', 2, 2, 0, 0); inside('seat2', 6, 4, 0, Math.PI); inside('seat3', w - 4, 2, 0, 0);
      if (floors > 1) { bedAt(2, 2, FLOOR_H, 'room1'); bedAt(w - 3, 2, FLOOR_H, 'room2'); bedAt(Math.floor(w / 2), 2, FLOOR_H, 'room3'); }
      container(3, 1, d - 2, 'barrel', 'food');
      break;
    }
    case 'smith': {
      L(2, 0, 2, B.IRON); L(2, 1, 2, B.IRON);
      L(w - 3, 0, 2, B.CRATE); L(w - 3, 1, 2, B.IRON);
      inside('anvil', 3, 3, 0, -Math.PI / 2);
      L(1, 0, d - 2, B.BARREL);
      container(w - 3, 2, 2, 'chest', 'smith');
      bedAt(2, d - 4, upY, 'bed');
      break;
    }
    case 'shop': {
      for (let lx = 2; lx < w - 2; lx++) L(lx, 0, 3, B.TABLE);
      for (let lz = 2; lz < d - 2; lz++) { L(1, 0, lz, B.BOOKSHELF); L(1, 1, lz, B.CRATE); }
      inside('counter', Math.floor(w / 2), 4, 0, 0);
      container(w - 2, 0, d - 2, 'chest', 'shop');
      bedAt(w - 3, d - 4, upY, 'bed');
      break;
    }
    case 'healer': {
      for (let i = 0; i < 3; i++) bedAt(2 + i * 3, d - 4, 0, 'cot' + i);
      L(w - 2, 0, 1, B.BOOKSHELF); L(w - 2, 1, 1, B.BOOKSHELF); L(w - 2, 0, 2, B.TABLE);
      inside('work', w - 3, 2, 0, -Math.PI / 2);
      container(w - 2, 1, 2, 'chest', 'herbs');
      break;
    }
    case 'hall': {
      for (let lz = 3; lz < d - 3; lz++) { L(Math.floor(w / 2) - 2, 0, lz, B.TABLE); L(Math.floor(w / 2) + 2, 0, lz, B.TABLE); }
      for (let lz = 1; lz < d - 1; lz++) L(Math.floor(w / 2), -1, lz, B.CARPET);
      L(Math.floor(w / 2), 0, d - 2, B.GOLD_TRIM); L(Math.floor(w / 2), 1, d - 2, B.CLOTH_RED);
      inside('seat', Math.floor(w / 2), d - 3, 0, Math.PI);
      container(1, 0, d - 2, 'chest', 'noble');
      break;
    }
    case 'barn': {
      for (let lx = 1; lx < w - 1; lx += 2) { L(lx, 0, d - 2, B.HAY); if (r() < 0.5) L(lx, 1, d - 2, B.HAY); }
      L(1, 0, 1, B.CRATE); container(1, 1, 1, 'crate', 'farm');
      inside('work', Math.floor(w / 2), 3, 0, 0);
      break;
    }
    default: break;
  }
}

// ------------------------------------------------------------------
// Fortifications
// ------------------------------------------------------------------
export function tower(world, o) {
  const { x, z, r = 5, h = 22, roof = B.ROOF_SLATE, wall = B.STONE_DARK, crenel = false, door = true, rot = 0, name = 'tower', lit = true } = o;
  const baseY = o.y ?? groundAt(world, x, z) + 1;
  const F = new Frame(world, x, baseY, z, rot);
  F.mark(-r, -r, r, r, 2);
  for (let lz = -r; lz <= r; lz++) for (let lx = -r; lx <= r; lx++) {
    const dd = Math.hypot(lx, lz);
    if (dd > r + 0.5) continue;
    for (let y = -1; y > -25; y--) { const c = F.get(lx, y, lz); if (SOLID[c] && y < -1) break; F.set(lx, y, lz, B.STONE); }
    for (let y = 0; y < h; y++) {
      if (dd > r - 1.2) F.set(lx, y, lz, (y % 7 === 0) ? B.STONE : wall);
      else F.set(lx, y, lz, (y % 8 === 7 && dd < r - 1.2) ? B.PLANKS_DARK : B.AIR);
    }
  }
  // slit windows
  for (let y = 4; y < h - 2; y += 7) for (let a = 0; a < 4; a++) {
    const [dx, dz] = [[1, 0], [0, 1], [-1, 0], [0, -1]][a];
    F.set(dx * r, y, dz * r, lit && y > 8 ? B.GLASS_LIT : B.GLASS_DARK); F.set(dx * r, y + 1, dz * r, lit && y > 8 ? B.GLASS_LIT : B.GLASS_DARK);
  }
  if (door) for (let y = 0; y < 5; y++) { F.set(0, y, -r, B.AIR); F.set(-1, y, -r, B.AIR); F.set(0, y, -r + 1, B.AIR); F.set(-1, y, -r + 1, B.AIR); }
  if (crenel) {
    for (let lz = -r - 1; lz <= r + 1; lz++) for (let lx = -r - 1; lx <= r + 1; lx++) {
      const dd = Math.hypot(lx, lz);
      if (dd <= r + 1.5) F.set(lx, h, lz, B.STONE);
      if (dd > r + 0.3 && dd <= r + 1.5 && ((lx + lz) & 1)) { F.set(lx, h + 1, lz, wall); F.set(lx, h + 2, lz, wall); }
    }
  }
  if (roof) {
    const rr = r + 1;
    for (let k = 0; k <= rr * 1.6; k++) {
      const rad = rr - k / 1.6;
      if (rad < 0) break;
      for (let lz = -rr; lz <= rr; lz++) for (let lx = -rr; lx <= rr; lx++) {
        const dd = Math.hypot(lx, lz);
        if (dd <= rad + 0.5 && dd > rad - 1.2) F.set(lx, h + (crenel ? 3 : 0) + k, lz, roof);
      }
    }
    F.set(0, h + (crenel ? 3 : 0) + Math.ceil(rr * 1.6) + 1, 0, B.GOLD_TRIM);
  }
  // ladder platforms are implied; place a lantern inside
  F.set(0, 3, 0, B.LANTERN);
  F.light(0, 3, 0, 0xffb060, 0.8, 10);
  return { baseY, F };
}

export function wallLine(world, x0, z0, x1, z1, o = {}) {
  const { h = 12, thick = 3, mat = B.STONE_DARK, crenel = true, y } = o;
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.ceil(len);
  const nx = -(z1 - z0) / len, nz = (x1 - x0) / len;
  const done = new Set();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const cx = x0 + (x1 - x0) * t, cz = z0 + (z1 - z0) * t;
    for (let s = -thick / 2; s <= thick / 2; s += 0.5) {
      const wx = Math.round(cx + nx * s), wz = Math.round(cz + nz * s);
      const key = wx * 4096 + wz;
      if (done.has(key)) continue;
      done.add(key);
      const by = y ?? groundAt(world, wx, wz) + 1;
      for (let yy = by - 1; yy > by - 25; yy--) { const c = world.peek(wx, yy, wz); if (SOLID[c] && yy < by - 1) break; world.set(wx, yy, wz, B.STONE); }
      for (let yy = by; yy < by + h; yy++) world.set(wx, yy, wz, (yy - by) % 6 === 5 ? B.STONE : mat);
      const edge = Math.abs(s) >= thick / 2 - 0.25;
      if (crenel && edge && ((i >> 1) & 1)) { world.set(wx, by + h, wz, mat); world.set(wx, by + h + 1, wz, mat); }
      world.mask[wz * WX + wx] = 1;
    }
  }
}

export function palisade(world, pts, o = {}) {
  const { h = 7, gaps = [] } = o;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0));
    for (let k = 0; k <= n; k++) {
      const x = Math.round(x0 + (x1 - x0) * k / n), z = Math.round(z0 + (z1 - z0) * k / n);
      if (gaps.some(([gx, gz, gr]) => Math.hypot(x - gx, z - gz) < gr)) continue;
      const by = groundAt(world, x, z) + 1;
      const hh = h + ((x + z) % 2 ? 0 : 1);
      for (let y = by - 2; y < by + hh; y++) world.set(x, y, z, B.LOG);
      world.set(x, by + hh, z, B.PINE_LOG);
      if (k % 3 === 0) world.set(x, by + 3, z, B.BEAM);
      world.mask[z * WX + x] = 1;
    }
  }
}

export function fence(world, pts, b = B.PLANKS_DARK) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0));
    for (let k = 0; k <= n; k++) {
      const x = Math.round(x0 + (x1 - x0) * k / n), z = Math.round(z0 + (z1 - z0) * k / n);
      const by = groundAt(world, x, z) + 1;
      world.set(x, by, z, k % 3 === 0 ? B.LOG : b);
      if (k % 3 === 0) world.set(x, by + 1, z, B.LOG);
    }
  }
}

// ------------------------------------------------------------------
// Props
// ------------------------------------------------------------------
export function lampPost(world, x, z, y) {
  const by = y ?? groundAt(world, x, z) + 1;
  for (let k = 0; k < 5; k++) world.set(x, by + k, z, B.IRON);
  world.set(x, by + 5, z, B.LANTERN);
  world.set(x, by + 6, z, B.IRON);
  world.meta.lights.push({ x: x + 0.5, y: by + 5.5, z: z + 0.5, color: 0xffb060, intensity: 1.0, radius: 16, flicker: true });
  world.mask[z * WX + x] = 1;
}

export function stall(world, x, z, rot, cloth = B.CLOTH_RED, goods = 'produce', name = 'stall') {
  const by = groundAt(world, x, z) + 1;
  const F = new Frame(world, x, by, z, rot);
  F.mark(-3, -2, 3, 2, 1);
  for (const [px, pz] of [[-3, -2], [3, -2], [-3, 2], [3, 2]]) for (let y = 0; y < 5; y++) F.set(px, y, pz, B.BEAM);
  for (let lx = -2; lx <= 2; lx++) F.set(lx, 0, -1, B.TABLE);
  for (let lx = -3; lx <= 3; lx++) for (let lz = -3; lz <= 2; lz++) {
    const y = 5 + Math.floor((lz + 3) / 3);
    F.set(lx, 7 - Math.floor((lz + 3) / 2), lz, ((lx + 10) & 1) ? cloth : B.CLOTH_WHITE);
  }
  const goodsSet = goods === 'produce' ? [B.PUMPKIN, B.HAY, B.CRATE] : goods === 'cloth' ? [B.CLOTH_BLUE, B.CLOTH_RED, B.WOOL_GREY] : goods === 'fish' ? [B.BARREL, B.ICE, B.CRATE] : [B.IRON, B.CRATE, B.BARREL];
  for (let lx = -2; lx <= 2; lx++) if (hash2(x + lx, z, 3) < 0.7) F.set(lx, 1, -1, goodsSet[(lx + 2) % goodsSet.length]);
  F.set(-2, 0, 1, B.CRATE); F.set(2, 0, 1, B.BARREL);
  return F.spot(name, 0, 0, 1, 0);
}

export function well(world, x, z) {
  const by = groundAt(world, x, z) + 1;
  const F = new Frame(world, x, by, z, 0);
  F.mark(-2, -2, 2, 2, 1);
  for (let lx = -2; lx <= 2; lx++) for (let lz = -2; lz <= 2; lz++) {
    const edge = Math.abs(lx) === 2 || Math.abs(lz) === 2;
    if (Math.abs(lx) === 2 && Math.abs(lz) === 2) continue;
    if (edge) { F.set(lx, 0, lz, B.COBBLE); F.set(lx, 1, lz, B.COBBLE); }
    else { for (let y = -6; y < 0; y++) F.set(lx, y, lz, y < -2 ? B.WATER : B.AIR); F.set(lx, 0, lz, B.AIR); }
  }
  for (const px of [-2, 2]) for (let y = 2; y < 6; y++) F.set(px, y, 0, B.BEAM);
  for (let lx = -3; lx <= 3; lx++) { F.set(lx, 6, -1, B.ROOF_BROWN); F.set(lx, 6, 1, B.ROOF_BROWN); F.set(lx, 7, 0, B.ROOF_BROWN); }
  F.set(0, 5, 0, B.ROPE); F.set(0, 4, 0, B.BARREL);
}

export function tent(world, x, z, rot, cloth = B.CLOTH_WHITE, len = 6, wid = 5) {
  const by = groundAt(world, x, z) + 1;
  const F = new Frame(world, x, by, z, rot);
  const half = Math.floor(wid / 2);
  const l0 = -Math.floor(len / 2), l1 = Math.floor(len / 2);
  F.mark(-half - 2, l0 - 1, half + 2, l1 + 1, 1);
  F.fill(-half - 1, 0, l0, half + 1, 2 * (half + 1) + 1, l1, B.AIR);
  // steep A-frame: rises two voxels for every voxel inward
  for (let lz = l0; lz <= l1; lz++) {
    for (let k = 0; k <= half + 1; k++) {
      for (let dy = 0; dy < 2; dy++) { F.set(-half - 1 + k, 2 * k + dy, lz, cloth); F.set(half + 1 - k, 2 * k + dy, lz, cloth); }
    }
  }
  // closed back wall, open front
  for (let k = 0; k <= half; k++) for (let dy = 0; dy < 2; dy++) for (let lx = -half + k; lx <= half - k; lx++) F.set(lx, 2 * k + dy, l1, cloth);
  // ridge pole
  for (let lz = l0 - 1; lz <= l1 + 1; lz++) F.set(0, 2 * (half + 1) + 1, lz, B.BEAM);
  F.set(-half - 1, 0, l0 - 1, B.BEAM); F.set(half + 1, 0, l0 - 1, B.BEAM);
  F.fill(-half, -1, l0, half, -1, l1, B.STRAW);
  return F;
}

export function campfire(world, x, z, o = {}) {
  const by = groundAt(world, x, z) + 1;
  for (const [dx, dz] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) world.set(x + dx, by - 1, z + dz, B.COBBLE);
  world.set(x, by - 1, z, B.DIRT);
  world.meta.campfires.push({ x: x + 0.5, y: by, z: z + 0.5, rest: o.rest !== false, name: o.name || null, id: o.id || null });
  world.meta.lights.push({ x: x + 0.5, y: by + 1, z: z + 0.5, color: 0xff7a2a, intensity: 1.6, radius: 20, flicker: true });
  // logs to sit on
  for (const [dx, dz] of [[-3, 0], [3, 0]]) { world.set(x + dx, by, z + dz - 1, B.LOG); world.set(x + dx, by, z + dz, B.LOG); world.set(x + dx, by, z + dz + 1, B.LOG); }
  for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) world.mask[(z + dz) * WX + x + dx] = 1;
  return { x, y: by, z };
}

export function cropField(world, x0, z0, x1, z1, crop = B.WHEAT) {
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const by = groundAt(world, x, z) + 1;
    const row = (z - z0) % 3;
    world.mask[z * WX + x] = 1;
    if (row === 2) { world.set(x, by - 1, z, B.DIRT_PATH); continue; }
    world.set(x, by - 1, z, B.DIRT);
    if (crop === B.PUMPKIN) { if (hash2(x, z, 4) < 0.25) world.set(x, by, z, B.PUMPKIN); else if (hash2(x, z, 5) < 0.5) world.set(x, by, z, B.TUFT); }
    else world.set(x, by, z, crop);
  }
}

export function windmill(world, x, z, rot = 0) {
  const by = groundAt(world, x, z) + 1;
  const F = new Frame(world, x, by, z, rot);
  F.mark(-5, -5, 5, 5, 2);
  for (let y = 0; y < 18; y++) {
    const r = 4 - Math.floor(y / 7);
    for (let lx = -r; lx <= r; lx++) for (let lz = -r; lz <= r; lz++) {
      const edge = Math.abs(lx) === r || Math.abs(lz) === r;
      F.set(lx, y, lz, edge ? (y < 2 ? B.STONE_LIGHT : B.PLASTER) : (y % 6 === 5 ? B.PLANKS : B.AIR));
    }
  }
  for (let k = 0; k < 5; k++) for (let lx = -3 + k; lx <= 3 - k; lx++) for (let lz = -3; lz <= 3; lz++) F.set(lx, 18 + k, lz, B.THATCH);
  for (let y = 0; y < 5; y++) F.set(0, y, -4, B.AIR), F.set(-1, y, -4, B.AIR);
  F.set(0, 14, -3, B.BEAM); F.set(0, 14, -4, B.BEAM); F.set(0, 14, -5, B.BEAM);
  const hub = F.wp(0, 14, -6);
  const [dx, dz] = F.dir(0, -1);
  world.meta.windmills.push({ x: hub.x + 0.5, y: hub.y + 0.5, z: hub.z + 0.5, dx, dz });
  world.meta.doors.push({ ...F.wp(-1, 0, -4), fdx: dx, fdz: dz, rdx: F.dir(1, 0)[0], rdz: F.dir(1, 0)[1], w: 2, h: 5, name: 'mill' });
  return F;
}

export function dock(world, x, z, rot, len = 14, wid = 4) {
  const F = new Frame(world, x, 0, z, rot);
  const y = world.water[z * WX + x] || 30;
  const deck = y + 1;
  for (let lz = 0; lz < len; lz++) for (let lx = 0; lx < wid; lx++) {
    const p = F.wp(lx, 0, -lz);
    world.set(p.x, deck, p.z, B.PLANKS);
    if ((lx === 0 || lx === wid - 1) && lz % 4 === 0) {
      for (let yy = deck - 1; yy > deck - 12; yy--) { if (SOLID[world.peek(p.x, yy, p.z)] && world.peek(p.x, yy, p.z) !== B.WATER) break; world.set(p.x, yy, p.z, B.LOG); }
      world.set(p.x, deck + 1, p.z, B.LOG);
    }
  }
  return deck;
}

export function boat(world, x, y, z, rot = 0) {
  const F = new Frame(world, x, y, z, rot);
  for (let lz = -4; lz <= 4; lz++) {
    const half = lz === -4 || lz === 4 ? 0 : Math.abs(lz) === 3 ? 1 : 2;
    for (let lx = -half; lx <= half; lx++) {
      F.set(lx, 0, lz, B.PLANKS_DARK);
      if (Math.abs(lx) === half) F.set(lx, 1, lz, B.PLANKS_DARK);
    }
  }
  F.set(0, 1, 0, B.PLANKS);
}

export function bridge(world, c) {
  const { x0, z0, x1, z1 } = c;
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.ceil(len);
  const nx = -(z1 - z0) / len, nz = (x1 - x0) / len;
  let wl = 0;
  for (let i = 0; i <= n; i++) { const x = Math.round(x0 + (x1 - x0) * i / n), z = Math.round(z0 + (z1 - z0) * i / n); wl = Math.max(wl, world.water[z * WX + x]); }
  const deck = Math.max(c.y + 1, wl + 3);
  for (let i = -2; i <= n + 2; i++) {
    const t = i / n;
    const cx = x0 + (x1 - x0) * t, cz = z0 + (z1 - z0) * t;
    for (let s = -3; s <= 3; s += 0.5) {
      const x = Math.round(cx + nx * s), z = Math.round(cz + nz * s);
      const edge = Math.abs(s) >= 2.75;
      const arch = Math.abs(Math.sin((i / n) * Math.PI * 2)) * 3;
      world.set(x, deck - 1, z, B.COBBLE);
      for (let y = deck - 2; y >= deck - 2 - Math.max(0, 3 - arch); y--) world.set(x, y, z, B.STONE_LIGHT);
      if (edge) { world.set(x, deck, z, B.STONE_LIGHT); if (i % 4 === 0) world.set(x, deck + 1, z, B.STONE_LIGHT); }
      for (let y = deck; y < deck + 5; y++) if (!edge && world.peek(x, y, z) !== B.AIR) world.set(x, y, z, B.AIR);
      world.mask[z * WX + x] = 1;
      // piers down to river bed at intervals
      if (i % 8 === 4 && !edge) for (let y = deck - 2; y > deck - 16; y--) { const b = world.peek(x, y, z); if (b !== B.WATER && b !== B.AIR && SOLID[b]) break; world.set(x, y, z, B.STONE_LIGHT); }
    }
  }
  // ramps at ends: lower the deck to ground
  return deck;
}

// ------------------------------------------------------------------
// Underground: caves, mines, dungeons
// ------------------------------------------------------------------
export function carveSphere(world, cx, cy, cz, r, wall = null, floor = null) {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
    for (let z = Math.floor(cz - r - 1); z <= cz + r + 1; z++)
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        const d = Math.hypot(x - cx, (y - cy) * 1.2, z - cz);
        if (d <= r) world.set(x, y, z, B.AIR);
        else if (wall && d <= r + 1.2 && world.peek(x, y, z) !== B.AIR) world.set(x, y, z, hash3(x, y, z, 2) < 0.2 ? B.ORE : wall);
      }
  if (floor) for (let z = Math.floor(cz - r); z <= cz + r; z++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    const fy = Math.floor(cy - r * 0.6);
    if (Math.hypot(x - cx, z - cz) < r * 0.8) { for (let y = fy - 2; y < fy; y++) world.set(x, y, z, floor); for (let y = fy; y < cy; y++) world.set(x, y, z, B.AIR); }
  }
}

export function tunnel(world, pts, r = 2.5, wall = B.DEEPSTONE, supports = false) {
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0, z0] = pts[i], [x1, y1, z1] = pts[i + 1];
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0, z1 - z0));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, z = z0 + (z1 - z0) * t;
      // box-ish tunnel with flat floor
      for (let dy = -1; dy <= r * 2; dy++) for (let dz = -r - 1; dz <= r + 1; dz++) for (let dx = -r - 1; dx <= r + 1; dx++) {
        const px = Math.round(x + dx), py = Math.round(y + dy), pz = Math.round(z + dz);
        const inside = Math.hypot(dx, dz) <= r && dy >= 0 && dy < r * 2 - Math.max(0, Math.hypot(dx, dz) - r + 1.5);
        if (inside) world.set(px, py, pz, B.AIR);
        else if (dy === -1 && Math.hypot(dx, dz) <= r + 0.5) world.set(px, py, pz, B.GRAVEL);
        else if (Math.hypot(dx, dz) <= r + 1.2 && dy < r * 2 && world.peek(px, py, pz) !== B.AIR) world.set(px, py, pz, hash3(px, py, pz, 7) < 0.12 ? B.ORE : wall);
      }
      acc++;
      if (supports && acc % 9 === 0) {
        const len = Math.hypot(x1 - x0, z1 - z0) || 1;
        const nx = -(z1 - z0) / len, nz = (x1 - x0) / len;
        const yy = Math.round(y);
        for (const s of [-2, 2]) for (let dy = 0; dy < 4; dy++) world.set(Math.round(x + nx * s), yy + dy, Math.round(z + nz * s), B.BEAM);
        for (let s = -2; s <= 2; s++) world.set(Math.round(x + nx * s), yy + 4, Math.round(z + nz * s), B.BEAM);
        world.set(Math.round(x), yy + 3, Math.round(z), B.LANTERN);
        world.meta.lights.push({ x: Math.round(x) + 0.5, y: yy + 3.5, z: Math.round(z) + 0.5, color: 0xffa050, intensity: 1.2, radius: 14, flicker: true });
      }
    }
  }
}

export function room(world, x0, y0, z0, x1, y1, z1, wall = B.STONE_DARK, floor = B.COBBLE) {
  for (let y = y0 - 1; y <= y1 + 1; y++) for (let z = z0 - 1; z <= z1 + 1; z++) for (let x = x0 - 1; x <= x1 + 1; x++) {
    const inside = x >= x0 && x <= x1 && z >= z0 && z <= z1 && y >= y0 && y <= y1;
    if (inside) world.set(x, y, z, B.AIR);
    else if (y === y0 - 1) world.set(x, y, z, floor);
    else world.set(x, y, z, wall);
  }
}

// ------------------------------------------------------------------
// Decay for ruins
// ------------------------------------------------------------------
export function decay(world, x0, y0, z0, x1, y1, z1, amount = 0.5, seed = 3) {
  const isStruct = (x, y, z) => { const b = world.peek(x, y, z); return b !== B.AIR && KIND[b] === 1 && world.height[z * WX + x] < y; };
  for (let y = y1; y >= y0; y--) {
    const hr = (y - y0) / Math.max(1, y1 - y0);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const b = world.peek(x, y, z);
      if (b === B.AIR || KIND[b] !== 1) continue;
      if (world.height[z * WX + x] >= y) continue; // terrain
      if (b === B.ROOF_SLATE || b === B.ROOF_RED || b === B.ROOF_BLUE || b === B.GOLD_TRIM) { world.set(x, y, z, B.AIR); continue; }
      const n = hash3(x >> 3, y >> 2, z >> 3, seed) * 0.55 + hash3(x >> 1, y >> 1, z >> 1, seed + 2) * 0.3 + hash3(x, y, z, seed + 1) * 0.15;
      if (n < amount * (0.15 + hr * 1.15)) {
        world.set(x, y, z, B.AIR);
        if (hash3(x, y, z, seed + 5) < 0.06) {
          const gy = world.height[z * WX + x] + 1;
          if (world.peek(x, gy, z) === B.AIR) world.set(x, gy, z, B.RUBBLE);
        }
      } else if (b === B.STONE_DARK || b === B.STONE || b === B.STONE_LIGHT) {
        if (hash3(x, y, z, seed + 9) < 0.2 + (1 - hr) * 0.25) world.set(x, y, z, B.MOSS_STONE);
      } else if (b === B.PLANKS || b === B.PLANKS_DARK || b === B.TABLE) {
        if (hash3(x, y, z, seed + 3) < 0.55) world.set(x, y, z, B.AIR);
      }
    }
  }
  // remove unsupported debris (no block below and at most one side neighbour)
  for (let pass = 0; pass < 3; pass++) {
    for (let y = y0 + 1; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      if (!isStruct(x, y, z)) continue;
      if (world.peek(x, y - 1, z) !== B.AIR) continue;
      let sides = 0;
      if (isStruct(x + 1, y, z)) sides++; if (isStruct(x - 1, y, z)) sides++;
      if (isStruct(x, y, z + 1)) sides++; if (isStruct(x, y, z - 1)) sides++;
      if (sides <= 1) world.set(x, y, z, B.AIR);
    }
  }
}

// ------------------------------------------------------------------
// Stilt house for the fens
// ------------------------------------------------------------------
export function stiltHouse(world, x, z, rot, o = {}) {
  const wl = Math.max(world.water[z * WX + x], world.height[z * WX + x]);
  const y = wl + 3;
  for (let lx = -6; lx <= 6; lx += 4) for (let lz = -5; lz <= 5; lz += 5) {
    const F0 = new Frame(world, x, y, z, rot);
    for (let yy = -1; yy > -14; yy--) { const c = F0.get(lx, yy, lz); if (SOLID[c] && c !== B.WATER && yy < -3) break; F0.set(lx, yy, lz, B.LOG); }
  }
  const F = new Frame(world, x, y, z, rot);
  F.fill(-7, -1, -6, 7, -1, 6, B.PLANKS_DARK);
  const hs = house(world, { x, z, y, rot, w: 9, d: 9, roof: B.THATCH, style: 'plank', type: o.type || 'home', name: o.name || 'stilt', chimney: false, shutters: null, lit: 0.5, seed: x + z });
  return { ...hs, deckY: y };
}

export function boardwalk(world, pts, y) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0));
    const len = Math.hypot(x1 - x0, z1 - z0);
    const nx = -(z1 - z0) / len, nz = (x1 - x0) / len;
    for (let k = 0; k <= n; k++) {
      const cx = x0 + (x1 - x0) * k / n, cz = z0 + (z1 - z0) * k / n;
      for (let s = -1; s <= 1; s += 0.5) {
        const x = Math.round(cx + nx * s), z = Math.round(cz + nz * s);
        world.set(x, y - 1, z, B.PLANKS);
        for (let yy = y; yy < y + 4; yy++) if (world.peek(x, yy, z) !== B.AIR && !SOLID[world.peek(x, yy, z)]) world.set(x, yy, z, B.AIR);
        if (k % 5 === 0 && Math.abs(s) === 1) for (let yy = y - 2; yy > y - 12; yy--) { const c = world.peek(x, yy, z); if (SOLID[c] && c !== B.WATER) break; world.set(x, yy, z, B.LOG); }
        world.mask[z * WX + x] = 1;
      }
    }
  }
}

export function banner(world, x, y, z, dx, dz, color = B.CLOTH_RED, len = 6) {
  // hangs down from (x,y,z) on a wall facing (dx,dz); 2 wide along the wall
  const rx = -dz, rz = dx;
  for (let k = 0; k < len; k++) {
    const b = k === 0 ? B.GOLD_TRIM : (k === len - 1 ? B.GOLD_TRIM : color);
    world.set(x, y - k, z, b); world.set(x + rx, y - k, z + rz, b);
  }
  world.meta.banners.push({ x, y, z, dx, dz });
}

export function lighthouse(world, x, z) {
  const by = groundAt(world, x, z) + 1;
  const h = 34;
  const F = new Frame(world, x, by, z, 0);
  F.mark(-6, -6, 6, 6, 2);
  for (let y = 0; y < h; y++) {
    const r = 5 - Math.floor(y / 14);
    for (let lz = -r; lz <= r; lz++) for (let lx = -r; lx <= r; lx++) {
      const dd = Math.hypot(lx, lz);
      if (dd > r + 0.5) continue;
      if (dd > r - 1) F.set(lx, y, lz, ((y >> 2) & 1) ? B.CLOTH_RED : B.PLASTER);
      else F.set(lx, y, lz, B.AIR);
    }
  }
  for (let y = 0; y < 5; y++) { F.set(0, y, -5, B.AIR); F.set(-1, y, -5, B.AIR); F.set(0, y, -4, B.AIR); }
  for (let lz = -4; lz <= 4; lz++) for (let lx = -4; lx <= 4; lx++) { if (Math.hypot(lx, lz) < 4.5) F.set(lx, h, lz, B.STONE_LIGHT); }
  for (const [px, pz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) for (let y = h + 1; y < h + 5; y++) F.set(px, y, pz, B.IRON);
  F.set(0, h + 1, 0, B.LANTERN); F.set(0, h + 2, 0, B.LANTERN); F.set(1, h + 1, 0, B.LANTERN); F.set(0, h + 1, 1, B.LANTERN);
  for (let k = 0; k < 4; k++) for (let lz = -3 + k; lz <= 3 - k; lz++) for (let lx = -3 + k; lx <= 3 - k; lx++) F.set(lx, h + 5 + k, lz, B.ROOF_RED);
  world.meta.lights.push({ x: x + 0.5, y: by + h + 2, z: z + 0.5, color: 0xffd090, intensity: 3, radius: 40, flicker: false, beacon: true });
  world.meta.doors.push({ ...F.wp(-1, 0, -5), fdx: 0, fdz: -1, rdx: 1, rdz: 0, w: 2, h: 5, name: 'lighthouse' });
  return { baseY: by, top: by + h };
}
