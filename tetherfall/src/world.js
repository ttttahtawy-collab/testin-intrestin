// Voxel storage, raycasting and AABB collision.
import { B, BLOCKS, SOLID } from './blocks.js';

export const SX = 640, SZ = 640, SY = 128;
export const CHUNK = 16;

export class World {
  constructor() {
    this.data = new Uint8Array(SX * SY * SZ);
    this.ground = new Float32Array(SX * SZ); // natural terrain height, used by colossi
    this.dirty = new Set();
  }
  inside(x, y, z) {
    return x >= 0 && x < SX && z >= 0 && z < SZ && y >= 0 && y < SY;
  }
  get(x, y, z) {
    if (y < 0) return B.STONE;
    if (x < 0 || x >= SX || z < 0 || z >= SZ || y >= SY) return B.AIR;
    return this.data[(y * SZ + z) * SX + x];
  }
  set(x, y, z, b) {
    if (!this.inside(x, y, z)) return;
    this.data[(y * SZ + z) * SX + x] = b;
  }
  // Edit at runtime and mark affected chunks for remeshing.
  edit(x, y, z, b) {
    if (!this.inside(x, y, z)) return false;
    this.set(x, y, z, b);
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    this.dirty.add(cx + ',' + cz);
    if (x % CHUNK === 0) this.dirty.add((cx - 1) + ',' + cz);
    if (x % CHUNK === CHUNK - 1) this.dirty.add((cx + 1) + ',' + cz);
    if (z % CHUNK === 0) this.dirty.add(cx + ',' + (cz - 1));
    if (z % CHUNK === CHUNK - 1) this.dirty.add(cx + ',' + (cz + 1));
    return true;
  }
  solid(x, y, z) {
    return SOLID[this.get(x, y, z)] === 1;
  }
  groundAt(x, z) {
    const ix = Math.max(0, Math.min(SX - 1, Math.floor(x)));
    const iz = Math.max(0, Math.min(SZ - 1, Math.floor(z)));
    return this.ground[iz * SX + ix];
  }
  // Highest solid block top at column, scanning down from y.
  topSolid(x, z, fromY = SY - 1) {
    for (let y = fromY; y >= 0; y--) if (this.solid(x, y, z)) return y + 1;
    return 0;
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
