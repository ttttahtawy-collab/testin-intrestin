// Builds one BufferGeometry per 16x16 chunk column with face culling and vertex AO.
import * as THREE from 'three';
import { BLOCKS, B, tileUV } from './blocks.js';
import { SX, SZ, SY, CHUNK } from './world.js';

// Corner order forms a "Z": triangles (0,1,2),(2,1,3) or flipped (0,1,3),(0,3,2).
const FACES = [
  { dir: [-1, 0, 0], tile: 'side', shade: 0.78, c: [[0, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 1, 1, 1, 1], [0, 0, 1, 1, 0]] },
  { dir: [1, 0, 0], tile: 'side', shade: 0.78, c: [[1, 1, 1, 0, 1], [1, 0, 1, 0, 0], [1, 1, 0, 1, 1], [1, 0, 0, 1, 0]] },
  { dir: [0, -1, 0], tile: 'bottom', shade: 0.5, c: [[1, 0, 1, 1, 0], [0, 0, 1, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 0, 1]] },
  { dir: [0, 1, 0], tile: 'top', shade: 1.0, c: [[0, 1, 1, 1, 1], [1, 1, 1, 0, 1], [0, 1, 0, 1, 0], [1, 1, 0, 0, 0]] },
  { dir: [0, 0, -1], tile: 'side', shade: 0.66, c: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 1], [0, 1, 0, 1, 1]] },
  { dir: [0, 0, 1], tile: 'side', shade: 0.9, c: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1]] },
];
const AO = [0.45, 0.66, 0.84, 1.0];

export function buildChunk(world, cx, cz) {
  const pos = [], nor = [], uv = [], col = [], idx = [];
  const x0 = cx * CHUNK, z0 = cz * CHUNK;
  const opaque = (x, y, z) => {
    const b = world.get(x, y, z);
    return b !== B.AIR && !BLOCKS[b].see;
  };
  const occl = (x, y, z) => {
    const b = world.get(x, y, z);
    return b !== B.AIR && BLOCKS[b].solid ? 1 : 0;
  };

  // skip deep underground and empty sky
  let minY = SY;
  for (let z = z0 - 1; z <= z0 + CHUNK; z++) for (let x = x0 - 1; x <= x0 + CHUNK; x++) {
    if (x < 0 || z < 0 || x >= SX || z >= SZ) continue;
    minY = Math.min(minY, world.hmap[z * SX + x] - 1);
  }
  minY = Math.max(0, minY);
  const maxY = world.chunkMaxY(cx, cz);

  for (let y = minY; y <= maxY; y++) for (let z = z0; z < z0 + CHUNK; z++) for (let x = x0; x < x0 + CHUNK; x++) {
    const b = world.get(x, y, z);
    if (b === B.AIR) continue;
    const def = BLOCKS[b];
    if (def.cross) { addCross(x, y, z, def, pos, nor, uv, col, idx); continue; }
    for (const f of FACES) {
      const nx = x + f.dir[0], ny = y + f.dir[1], nz = z + f.dir[2];
      const nb = world.get(nx, ny, nz);
      if (nb !== B.AIR) {
        const nd = BLOCKS[nb];
        if (!nd.see) continue;
        if (nb === b) continue; // leaves/water against same
      }
      if (def.water && f.dir[1] !== 1) continue;
      const [u0, v0, u1, v1] = tileUV(def.tiles[f.tile]);
      const base = pos.length / 3;
      const aos = [];
      for (const c of f.c) {
        // AO from the three voxels touching this corner in the neighbour layer
        let s1 = 0, s2 = 0, cc = 0;
        const off = [c[0] ? 1 : -1, c[1] ? 1 : -1, c[2] ? 1 : -1];
        const axes = [0, 1, 2].filter((a) => f.dir[a] === 0);
        const p1 = [nx, ny, nz], p2 = [nx, ny, nz], p3 = [nx, ny, nz];
        p1[axes[0]] += off[axes[0]];
        p2[axes[1]] += off[axes[1]];
        p3[axes[0]] += off[axes[0]]; p3[axes[1]] += off[axes[1]];
        s1 = occl(p1[0], p1[1], p1[2]); s2 = occl(p2[0], p2[1], p2[2]); cc = occl(p3[0], p3[1], p3[2]);
        const ao = s1 && s2 ? 0 : 3 - (s1 + s2 + cc);
        aos.push(ao);
        let py = y + c[1];
        if (def.water) py = y + 0.86;
        pos.push(x + c[0], py, z + c[2]);
        nor.push(f.dir[0], f.dir[1], f.dir[2]);
        uv.push(c[3] ? u1 : u0, c[4] ? v1 : v0);
        const l = AO[ao] * f.shade;
        col.push(l, l, l);
      }
      if (aos[0] + aos[3] < aos[1] + aos[2]) idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
      else idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
    }
  }
  if (!idx.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

function addCross(x, y, z, def, pos, nor, uv, col, idx) {
  const [u0, v0, u1, v1] = tileUV(def.tiles.side);
  const quads = [
    [[0.15, 0.15], [0.85, 0.85]],
    [[0.85, 0.15], [0.15, 0.85]],
  ];
  for (const [a, b] of quads) {
    for (const flip of [false, true]) {
      const base = pos.length / 3;
      const p = [[a, 0], [b, 0], [a, 1], [b, 1]];
      const uvs = [[u0, v0], [u1, v0], [u0, v1], [u1, v1]];
      for (let i = 0; i < 4; i++) {
        const [xy, h] = p[i];
        pos.push(x + xy[0], y + h * 0.95, z + xy[1]);
        nor.push(0, 1, 0);
        uv.push(uvs[i][0], uvs[i][1]);
        const l = h ? 0.95 : 0.7;
        col.push(l, l, l);
      }
      if (flip) idx.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);
      else idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
  }
}

// Streams chunk meshes in around the camera, nearest first, within a time budget,
// rebuilds chunks that were edited and drops meshes that fall far behind.
const MAXR = 40;
const OFFSETS = [];
for (let dz = -MAXR; dz <= MAXR; dz++) for (let dx = -MAXR; dx <= MAXR; dx++) {
  const d = Math.hypot(dx, dz);
  if (d <= MAXR) OFFSETS.push([dx, dz, d]);
}
OFFSETS.sort((a, b) => a[2] - b[2]);

export class ChunkRenderer {
  constructor(world, scene, material) {
    this.world = world; this.scene = scene; this.material = material;
    this.built = new Map(); // key -> mesh | null (empty chunk)
    this.frame = 0;
  }
  key(cx, cz) { return cx + ',' + cz; }
  build(cx, cz) {
    const k = this.key(cx, cz);
    this.drop(k);
    if (cx < 0 || cz < 0 || cx >= SX / CHUNK || cz >= SZ / CHUNK) return;
    const geo = buildChunk(this.world, cx, cz);
    if (!geo) { this.built.set(k, null); return; }
    const m = new THREE.Mesh(geo, this.material);
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    this.scene.add(m);
    this.built.set(k, m);
  }
  drop(k) {
    const old = this.built.get(k);
    if (old) { this.scene.remove(old); old.geometry.dispose(); }
    this.built.delete(k);
  }
  // Build everything within `radius` blocks of a point (used while loading). Yields progress.
  *buildAround(pos, radius) {
    const ccx = Math.floor(pos.x / CHUNK), ccz = Math.floor(pos.z / CHUNK);
    const rc = radius / CHUNK;
    const list = OFFSETS.filter((o) => o[2] <= rc);
    let n = 0;
    for (const [dx, dz] of list) {
      const cx = ccx + dx, cz = ccz + dz;
      if (!this.built.has(this.key(cx, cz))) this.build(cx, cz);
      yield ++n / list.length;
    }
  }
  update(pos, radius, budgetMs = 5) {
    const t0 = performance.now();
    const ccx = Math.floor(pos.x / CHUNK), ccz = Math.floor(pos.z / CHUNK);
    const rc = Math.min(MAXR, radius / CHUNK);
    // edited chunks first: rebuild the ones in range, forget the rest
    if (this.world.dirty.size) {
      const list = [];
      for (const k of this.world.dirty) {
        const [cx, cz] = k.split(',').map(Number);
        const d = Math.hypot(cx - ccx, cz - ccz);
        if (d > rc + 1) { this.drop(k); this.world.dirty.delete(k); } else list.push([d, cx, cz, k]);
      }
      list.sort((a, b) => a[0] - b[0]);
      for (const [, cx, cz, k] of list) {
        this.build(cx, cz);
        this.world.dirty.delete(k);
        if (performance.now() - t0 > budgetMs * 0.65) break;
      }
    }
    for (const [dx, dz, d] of OFFSETS) {
      if (d > rc) break;
      const cx = ccx + dx, cz = ccz + dz;
      if (cx < 0 || cz < 0 || cx >= SX / CHUNK || cz >= SZ / CHUNK) continue;
      if (this.built.has(this.key(cx, cz))) continue;
      this.build(cx, cz);
      if (performance.now() - t0 > budgetMs) break;
    }
    if (++this.frame % 60 === 0) {
      for (const k of [...this.built.keys()]) {
        const [cx, cz] = k.split(',').map(Number);
        if (Math.hypot(cx - ccx, cz - ccz) > rc + 4) this.drop(k);
      }
    }
  }
}
