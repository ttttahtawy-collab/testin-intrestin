// Voxel world storage. Terrain lives in compact 2D maps, vegetation is stamped
// from templates on demand, and hand-built structures live in sparse 16^3
// override chunks. Dense 32x32xH chunk arrays are generated lazily and cached.
import { B, KIND, SOLID, OPAQUE } from './blocks.js';
import { hash2, hash3 } from '../core/noise.js';
import { TPL } from './templates.js';

export const WX = 2048, WZ = 2048, H = 128, CS = 32, SEA = 30;
export const NCX = WX / CS, NCZ = WZ / CS;
const KEEP = 255;

// Biomes control decoration
export const BIOME = { MEADOW: 0, WEALD: 1, MIRE: 2, HIGHLAND: 3, COAST: 4, MOOR: 5, TOWN: 6, SNOW: 7 };

const SUBSURF = new Uint8Array(256);
for (let i = 0; i < 256; i++) SUBSURF[i] = B.DIRT;
SUBSURF[B.SAND] = B.SAND; SUBSURF[B.SNOW] = B.STONE; SUBSURF[B.STONE] = B.STONE; SUBSURF[B.GRANITE] = B.GRANITE;
SUBSURF[B.MUD] = B.MUD; SUBSURF[B.COBBLE] = B.GRAVEL; SUBSURF[B.GRAVEL] = B.DIRT; SUBSURF[B.STONE_DARK] = B.STONE;
SUBSURF[B.MOSS_STONE] = B.STONE; SUBSURF[B.BLIGHT] = B.MUD;

const GRASSY = new Uint8Array(256);
[B.GRASS, B.GRASS_DARK, B.GRASS_DRY, B.GRASS_MARSH, B.BLIGHT].forEach((b) => (GRASSY[b] = 1));

const HARD = new Uint8Array(256);
[B.LOG, B.PINE_LOG, B.BIRCH_LOG, B.STONE, B.GRANITE, B.ROCK_MOSSY].forEach((b) => (HARD[b] = 1));

export class World {
  constructor() {
    const n = WX * WZ;
    this.height = new Uint8Array(n);
    this.surf = new Uint8Array(n);
    this.water = new Uint8Array(n); // water surface level (0 = none)
    this.biome = new Uint8Array(n);
    this.mask = new Uint8Array(n); // 1 = no vegetation/features
    this.over = new Map(); // sparse 16^3 overrides
    this.features = new Array(NCX * NCZ); // per chunk list of [x,y,z,tplRef]
    for (let i = 0; i < this.features.length; i++) this.features[i] = [];
    this.cache = new Map(); // dense chunk cache
    this.cacheOrder = [];
    this.dirty = new Set(); // chunk keys needing remesh
    this.maxCache = 520;
  }

  idx(x, z) { return z * WX + x; }
  h(x, z) {
    x |= 0; z |= 0;
    if (x < 0 || z < 0 || x >= WX || z >= WZ) return 0;
    return this.height[z * WX + x];
  }
  inBounds(x, z) { return x >= 0 && z >= 0 && x < WX && z < WZ; }

  // ---------- structure overrides ----------
  set(x, y, z, b) {
    if (x < 0 || z < 0 || y < 0 || x >= WX || z >= WZ || y >= H) return;
    const key = ((y >> 4) * 128 + (z >> 4)) * 128 + (x >> 4);
    let c = this.over.get(key);
    if (!c) { c = new Uint8Array(4096).fill(KEEP); this.over.set(key, c); }
    c[((y & 15) << 8) | ((z & 15) << 4) | (x & 15)] = b;
    const ck = (z >> 5) * NCX + (x >> 5);
    const d = this.cache.get(ck);
    if (d) {
      d[(y << 10) | ((z & 31) << 5) | (x & 31)] = b;
      this.dirty.add(ck);
      // neighbours share faces
      if ((x & 31) === 0 && x > 0) this.dirty.add(ck - 1);
      if ((x & 31) === 31 && x < WX - 1) this.dirty.add(ck + 1);
      if ((z & 31) === 0 && z > 0) this.dirty.add(ck - NCX);
      if ((z & 31) === 31 && z < WZ - 1) this.dirty.add(ck + NCX);
    }
  }
  // Read through overrides without generating chunks (used by builders)
  peek(x, y, z) {
    if (x < 0 || z < 0 || x >= WX || z >= WZ) return B.AIR;
    if (y < 0) return B.STONE;
    if (y >= H) return B.AIR;
    const c = this.over.get(((y >> 4) * 128 + (z >> 4)) * 128 + (x >> 4));
    if (c) { const v = c[((y & 15) << 8) | ((z & 15) << 4) | (x & 15)]; if (v !== KEEP) return v; }
    return this.terrainAt(x, y, z);
  }
  terrainAt(x, y, z) {
    const i = z * WX + x;
    const h = this.height[i];
    if (y <= h) {
      if (y === h) return this.surf[i];
      if (y > h - 4) return SUBSURF[this.surf[i]];
      return B.STONE;
    }
    if (y <= this.water[i]) return B.WATER;
    return B.AIR;
  }

  addFeature(x, y, z, tpl) {
    const ci = (z >> 5) * NCX + (x >> 5);
    if (ci < 0 || ci >= this.features.length) return;
    this.features[ci].push([x, y, z, tpl]);
  }

  // ---------- dense chunks ----------
  getChunk(cx, cz) {
    const key = cz * NCX + cx;
    let d = this.cache.get(key);
    if (d) return d;
    d = this.generateChunk(cx, cz);
    this.cache.set(key, d);
    this.cacheOrder.push(key);
    if (this.cacheOrder.length > this.maxCache) this.evict();
    return d;
  }
  hasChunk(cx, cz) { return this.cache.has(cz * NCX + cx); }
  evict(keepFn) {
    // remove oldest entries not protected
    let tries = this.cacheOrder.length;
    while (this.cacheOrder.length > this.maxCache * 0.85 && tries-- > 0) {
      const k = this.cacheOrder.shift();
      if (this.protect && this.protect(k)) { this.cacheOrder.push(k); continue; }
      this.cache.delete(k);
    }
  }

  generateChunk(cx, cz) {
    const d = new Uint8Array(CS * CS * H);
    const x0 = cx * CS, z0 = cz * CS;
    // terrain + ground decoration
    for (let z = 0; z < CS; z++) {
      for (let x = 0; x < CS; x++) {
        const wx = x0 + x, wz = z0 + z;
        const i = wz * WX + wx;
        const h = this.height[i], s = this.surf[i], sub = SUBSURF[s];
        const col = (z << 5) | x;
        for (let y = 0; y < h - 3; y++) d[(y << 10) | col] = B.STONE;
        for (let y = Math.max(0, h - 3); y < h; y++) d[(y << 10) | col] = sub;
        d[(h << 10) | col] = s;
        const wl = this.water[i];
        for (let y = h + 1; y <= wl; y++) d[(y << 10) | col] = B.WATER;
        if (wl <= h && h + 1 < H && !this.mask[i]) {
          const deco = this.decoFor(wx, wz, s, this.biome[i]);
          if (deco) d[((h + 1) << 10) | col] = deco;
        } else if (wl > h && wl - h <= 2 && this.biome[i] === BIOME.MIRE && hash2(wx, wz, 77) < 0.3 && wl + 1 < H) {
          d[((wl + 1) << 10) | col] = B.REED;
        }
      }
    }
    // stamped features from this and neighbouring chunks
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const ncx = cx + dx, ncz = cz + dz;
      if (ncx < 0 || ncz < 0 || ncx >= NCX || ncz >= NCZ) continue;
      const list = this.features[ncz * NCX + ncx];
      for (let f = 0; f < list.length; f++) {
        const [fx, fy, fz, t] = list[f];
        if (fx + t.maxx < x0 || fx + t.minx >= x0 + CS || fz + t.maxz < z0 || fz + t.minz >= z0 + CS) continue;
        const pos = t.pos, blk = t.blk;
        for (let k = 0; k < t.n; k++) {
          const lx = fx + pos[k * 3] - x0, ly = fy + pos[k * 3 + 1], lz = fz + pos[k * 3 + 2] - z0;
          if (lx < 0 || lz < 0 || lx >= CS || lz >= CS || ly < 0 || ly >= H) continue;
          const di = (ly << 10) | (lz << 5) | lx;
          const cur = d[di], b = blk[k];
          if (cur === B.AIR || KIND[cur] === 3) d[di] = b;
          else if (HARD[b] && cur !== B.WATER) d[di] = b;
        }
      }
    }
    // overrides
    const ox = cx * 2, oz = cz * 2;
    for (let cy = 0; cy < H / 16; cy++) for (let sz = 0; sz < 2; sz++) for (let sx = 0; sx < 2; sx++) {
      const c = this.over.get((cy * 128 + oz + sz) * 128 + ox + sx);
      if (!c) continue;
      for (let j = 0; j < 4096; j++) {
        const v = c[j];
        if (v === KEEP) continue;
        const ly = (cy << 4) | (j >> 8), lz = (sz << 4) | ((j >> 4) & 15), lx = (sx << 4) | (j & 15);
        d[(ly << 10) | (lz << 5) | lx] = v;
      }
    }
    return d;
  }

  decoFor(x, z, s, biome) {
    if (!GRASSY[s] && s !== B.SNOW && s !== B.MUD && s !== B.SAND) return 0;
    const r = hash2(x, z, 1234);
    const patch = hash2(x >> 3, z >> 3, 99);
    switch (biome) {
      case BIOME.MEADOW:
        if (r < 0.22) return B.TUFT;
        if (r < 0.245 && patch > 0.55) return [B.FLOWER_RED, B.FLOWER_YELLOW, B.FLOWER_WHITE, B.FLOWER_BLUE][(patch * 40) & 3];
        return 0;
      case BIOME.WEALD:
        if (r < 0.16) return B.TUFT;
        if (r < 0.22) return B.FERN;
        if (r < 0.226) return patch > 0.5 ? B.MUSHROOM_RED : B.MUSHROOM_BROWN;
        if (r < 0.23 && patch > 0.7) return B.FLOWER_PURPLE;
        return 0;
      case BIOME.MIRE:
        if (s === B.BLIGHT) return r < 0.12 ? B.BLIGHT_GROWTH : 0;
        if (r < 0.2) return B.TUFT;
        if (r < 0.26) return B.REED;
        if (r < 0.265) return B.MUSHROOM_BROWN;
        return 0;
      case BIOME.HIGHLAND:
        if (s === B.SNOW) return 0;
        if (r < 0.12) return B.TUFT;
        if (r < 0.135 && patch > 0.6) return B.FLOWER_BLUE;
        return 0;
      case BIOME.COAST:
        if (s === B.SAND) return r < 0.03 ? B.REED : 0;
        if (r < 0.18) return B.TUFT;
        if (r < 0.19) return B.FLOWER_WHITE;
        return 0;
      case BIOME.MOOR:
        if (r < 0.2) return B.TUFT;
        if (r < 0.23 && patch > 0.4) return B.FLOWER_PURPLE;
        if (r < 0.235) return B.FLOWER_YELLOW;
        return 0;
      case BIOME.TOWN:
        return r < 0.06 ? B.TUFT : 0;
      default:
        return 0;
    }
  }

  // ---------- queries ----------
  get(x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y < 0) return B.STONE;
    if (y >= H) return B.AIR;
    if (x < 0 || z < 0 || x >= WX || z >= WZ) return y <= SEA ? B.WATER : B.AIR;
    const d = this.getChunk(x >> 5, z >> 5);
    return d[(y << 10) | ((z & 31) << 5) | (x & 31)];
  }
  solid(x, y, z) { return SOLID[this.get(x, y, z)] === 1; }
  opaque(x, y, z) { return OPAQUE[this.get(x, y, z)] === 1; }

  // highest solid block at column (scanning loaded data)
  groundY(x, z, fromY = H - 1) {
    x = Math.floor(x); z = Math.floor(z);
    if (x < 0 || z < 0 || x >= WX || z >= WZ) return SEA;
    const d = this.getChunk(x >> 5, z >> 5);
    const col = ((z & 31) << 5) | (x & 31);
    for (let y = Math.min(H - 1, Math.floor(fromY)); y >= 0; y--) if (SOLID[d[(y << 10) | col]]) return y + 1;
    return 0;
  }
  // standing height: lowest free space at or above y where you can stand
  standY(x, z, y) {
    x = Math.floor(x); z = Math.floor(z);
    let yy = Math.floor(y);
    for (let i = 0; i < 12; i++) {
      if (!this.solid(x, yy, z) && !this.solid(x, yy + 1, z) && !this.solid(x, yy + 2, z)) {
        // fall to ground
        while (yy > 0 && !this.solid(x, yy - 1, z)) yy--;
        return yy;
      }
      yy++;
    }
    return yy;
  }

  // Voxel DDA raycast. Returns {x,y,z,b,dist,nx,ny,nz} or null
  raycast(ox, oy, oz, dx, dy, dz, maxDist, filter = SOLID) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
    let tmx = dx > 0 ? (x + 1 - ox) * tdx : (ox - x) * tdx;
    let tmy = dy > 0 ? (y + 1 - oy) * tdy : (oy - y) * tdy;
    let tmz = dz > 0 ? (z + 1 - oz) * tdz : (oz - z) * tdz;
    let t = 0, nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < 512 && t <= maxDist; i++) {
      const b = this.get(x, y, z);
      if (filter[b]) return { x, y, z, b, dist: t, nx, ny, nz };
      if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; nx = -sx; ny = 0; nz = 0; }
      else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; nx = 0; ny = -sy; nz = 0; }
      else { z += sz; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
    }
    return null;
  }

  lineOfSight(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const d = Math.hypot(dx, dy, dz);
    if (d < 0.01) return true;
    return !this.raycast(ax, ay, az, dx / d, dy / d, dz / d, d - 0.3);
  }
}

export { KEEP, SUBSURF, GRASSY };
