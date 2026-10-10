// Voxel storage, raycasting and AABB collision.
// The map is large, so voxels live in 16x16x16 sections. A section is either a
// single uniform block id, TERRAIN (computed on the fly from the per-column
// heightmap, surface block, plant and water level), or a 4096-byte array that is
// allocated the first time something is built or broken inside it.
import { B, BLOCKS, SOLID } from './blocks.js';

export const SX = 2048, SZ = 2048, SY = 128;
export const CHUNK = 16;
export const NCX = SX >> 4, NCZ = SZ >> 4, NSY = SY >> 4;
const TERRAIN = 255;

export class World {
  constructor() {
    this.sec = new Array(NCX * NCZ * NSY).fill(null);
    this.uni = new Uint8Array(NCX * NCZ * NSY).fill(TERRAIN); // block id of sections with no array
    this.hmap = new Uint8Array(SX * SZ); // y of the top terrain block
    this.surf = new Uint8Array(SX * SZ).fill(B.GRASS); // top terrain block
    this.plant = new Uint8Array(SX * SZ); // cross plant standing on the surface (0 = none)
    this.wmap = new Uint8Array(SX * SZ); // water surface y (0 = dry)
    this.dirty = new Set();
  }
  terrain(x, y, z) {
    const i = z * SX + x, h = this.hmap[i];
    if (y > h) {
      if (y <= this.wmap[i]) return B.WATER;
      return y === h + 1 ? this.plant[i] : B.AIR;
    }
    if (y === h) return this.surf[i];
    if (y > h - 4) return this.surf[i] === B.SAND ? B.SAND : B.DIRT;
    return B.STONE;
  }
  materialize(si) {
    const sy = si % NSY, col = (si - sy) / NSY;
    const cx = col % NCX, cz = (col - cx) / NCX;
    const a = new Uint8Array(4096);
    for (let y = 0; y < 16; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++)
      a[(y << 8) | (z << 4) | x] = this.terrain(cx * 16 + x, sy * 16 + y, cz * 16 + z);
    this.sec[si] = a;
    return a;
  }
  // After generation: sections wholly above the terrain become AIR, wholly inside rock become STONE.
  compactTerrain() {
    for (let cz = 0; cz < NCZ; cz++) for (let cx = 0; cx < NCX; cx++) {
      let lo = 255, hi = 0;
      for (let z = cz * 16; z < cz * 16 + 16; z++) for (let x = cx * 16; x < cx * 16 + 16; x++) {
        const i = z * SX + x;
        lo = Math.min(lo, this.hmap[i]);
        hi = Math.max(hi, this.hmap[i] + 1, this.wmap[i]);
      }
      for (let sy = 0; sy < NSY; sy++) {
        const si = (cz * NCX + cx) * NSY + sy;
        if (this.sec[si] !== null || this.uni[si] !== TERRAIN) continue;
        if (sy * 16 > hi) this.uni[si] = B.AIR;
        else if (sy * 16 + 15 < lo - 4) this.uni[si] = B.STONE;
      }
    }
  }
  setSurface(x, z, b) { if (x >= 0 && z >= 0 && x < SX && z < SZ) { this.surf[z * SX + x] = b; this.plant[z * SX + x] = 0; } }
  inside(x, y, z) {
    return x >= 0 && x < SX && z >= 0 && z < SZ && y >= 0 && y < SY;
  }
  get(x, y, z) {
    if (y < 0) return B.STONE;
    if (x < 0 || x >= SX || z < 0 || z >= SZ || y >= SY) return B.AIR;
    const si = (((z >> 4) * NCX + (x >> 4)) * NSY) + (y >> 4);
    const s = this.sec[si];
    if (s === null) { const u = this.uni[si]; return u === TERRAIN ? this.terrain(x, y, z) : u; }
    return s[((y & 15) << 8) | ((z & 15) << 4) | (x & 15)];
  }
  set(x, y, z, b) {
    if (x < 0 || x >= SX || z < 0 || z >= SZ || y < 0 || y >= SY) return;
    x |= 0; y |= 0; z |= 0;
    const si = (((z >> 4) * NCX + (x >> 4)) * NSY) + (y >> 4);
    let s = this.sec[si];
    if (s === null) {
      const u = this.uni[si];
      if (u === b) return;
      s = u === TERRAIN ? this.materialize(si) : (this.sec[si] = new Uint8Array(4096).fill(u));
    }
    s[((y & 15) << 8) | ((z & 15) << 4) | (x & 15)] = b;
  }
  // Mark a whole section as one block id (used by generation for solid rock).
  fillSection(cx, cz, sy, b) {
    const si = ((cz * NCX + cx) * NSY) + sy;
    this.sec[si] = null; this.uni[si] = b;
  }
  sectionIsAir(cx, cz, sy) {
    const si = ((cz * NCX + cx) * NSY) + sy;
    return this.sec[si] === null && this.uni[si] === B.AIR;
  }
  // Highest y that may hold a non-air block in this chunk column (for meshing).
  chunkMaxY(cx, cz) {
    for (let sy = NSY - 1; sy >= 0; sy--) if (!this.sectionIsAir(cx, cz, sy)) return sy * 16 + 15;
    return -1;
  }
  // Edit at runtime and mark affected chunks for remeshing. Returns the previous block.
  edit(x, y, z, b) {
    if (!this.inside(x, y, z)) return B.AIR;
    const old = this.get(x, y, z);
    if (old === b) return old;
    this.set(x, y, z, b);
    const cx = x >> 4, cz = z >> 4;
    this.dirty.add(cx + ',' + cz);
    if ((x & 15) === 0) this.dirty.add((cx - 1) + ',' + cz);
    if ((x & 15) === 15) this.dirty.add((cx + 1) + ',' + cz);
    if ((z & 15) === 0) this.dirty.add(cx + ',' + (cz - 1));
    if ((z & 15) === 15) this.dirty.add(cx + ',' + (cz + 1));
    return old;
  }
  solid(x, y, z) {
    return SOLID[this.get(x, y, z)] === 1;
  }
  // Walkable height of the natural terrain (ignores buildings), used by titans and people.
  groundAt(x, z) {
    const ix = Math.max(0, Math.min(SX - 1, Math.floor(x)));
    const iz = Math.max(0, Math.min(SZ - 1, Math.floor(z)));
    return this.hmap[iz * SX + ix] + 1;
  }
  // Highest solid block top at column, scanning down from y (skips empty sections).
  topSolid(x, z, fromY = SY - 1) {
    if (x < 0 || x >= SX || z < 0 || z >= SZ) return 0;
    const cx = x >> 4, cz = z >> 4;
    for (let y = Math.min(SY - 1, fromY); y >= 0; y--) {
      if ((y & 15) === 15 && this.sectionIsAir(cx, cz, y >> 4)) { y -= 15; continue; }
      if (this.solid(x, y, z)) return y + 1;
    }
    return 0;
  }
  // Highest non-air block id and its y (for the map).
  topBlock(x, z) {
    const cx = x >> 4, cz = z >> 4;
    for (let y = SY - 1; y >= 0; y--) {
      if ((y & 15) === 15 && this.sectionIsAir(cx, cz, y >> 4)) { y -= 15; continue; }
      const b = this.get(x, y, z);
      if (b !== B.AIR && !BLOCKS[b].cross) return [b, y];
    }
    return [B.STONE, 0];
  }

  // Amanatides & Woo voxel traversal. Returns {x,y,z, point:[..], normal:[..], dist, block} or null.
  raycast(ox, oy, oz, dx, dy, dz, maxDist, test = (b) => SOLID[b] === 1) {
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len; dy /= len; dz /= len;
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
    let tmx = dx === 0 ? Infinity : (dx > 0 ? x + 1 - ox : ox - x) * tdx;
    let tmy = dy === 0 ? Infinity : (dy > 0 ? y + 1 - oy : oy - y) * tdy;
    let tmz = dz === 0 ? Infinity : (dz > 0 ? z + 1 - oz : oz - z) * tdz;
    let t = 0, nx = 0, ny = 0, nz = 0;
    while (t <= maxDist) {
      const b = this.get(x, y, z);
      if (b !== B.AIR && test(b)) {
        return {
          x, y, z, block: b, dist: t,
          point: [ox + dx * t, oy + dy * t, oz + dz * t],
          normal: [nx, ny, nz],
        };
      }
      if (tmx < tmy && tmx < tmz) { x += stepX; t = tmx; tmx += tdx; nx = -stepX; ny = 0; nz = 0; }
      else if (tmy < tmz) { y += stepY; t = tmy; tmy += tdy; nx = 0; ny = -stepY; nz = 0; }
      else { z += stepZ; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -stepZ; }
      if (y < -1 || y > SY + 1) break;
    }
    return null;
  }

  // Does an AABB (min/max) overlap any solid voxel?
  boxHits(minX, minY, minZ, maxX, maxY, maxZ) {
    for (let y = Math.floor(minY); y <= Math.floor(maxY - 1e-6); y++)
      for (let z = Math.floor(minZ); z <= Math.floor(maxZ - 1e-6); z++)
        for (let x = Math.floor(minX); x <= Math.floor(maxX - 1e-6); x++)
          if (this.solid(x, y, z)) return true;
    return false;
  }
}

export function isPlant(b) {
  return BLOCKS[b] && BLOCKS[b].cross;
}
