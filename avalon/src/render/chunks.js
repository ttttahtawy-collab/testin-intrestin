// Streams detailed chunk meshes near the player and coarse LOD meshes beyond.
import * as THREE from 'three';
import { meshChunk, meshLOD } from './mesher.js';
import { CS, NCX, NCZ, WX, WZ } from '../world/world.js';

function makeGeom(d, water = false) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(d.nrm, 3, true));
  g.setAttribute('color', new THREE.BufferAttribute(d.col, 4, true));
  if (!water) g.setAttribute('aFlags', new THREE.BufferAttribute(d.flg, 4, true));
  g.setIndex(new THREE.BufferAttribute(d.idx, 1));
  g.computeBoundingSphere();
  return g;
}

export class ChunkManager {
  constructor(world, scene, mat, waterMat) {
    this.world = world; this.scene = scene; this.mat = mat; this.waterMat = waterMat;
    this.near = new Map(); // key -> {mesh, water}
    this.lod1 = new Map(); // 64-block superchunks
    this.lod2 = new Map(); // 128-block regions
    this.nearRadius = 176;
    this.lod1Radius = 420;
    this.decoRadius = 84;
    this.cullRadius = 1100;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.pending = [];
    this.px = 0; this.pz = 0;
    world.protect = (k) => {
      const cx = k % NCX, cz = Math.floor(k / NCX);
      const dx = (cx + 0.5) * CS - this.px, dz = (cz + 0.5) * CS - this.pz;
      return dx * dx + dz * dz < (this.nearRadius + 64) ** 2;
    };
  }

  addMesh(d, mat, shadow) {
    if (!d.count) return null;
    const m = new THREE.Mesh(makeGeom(d, mat === this.waterMat), mat);
    m.matrixAutoUpdate = false;
    if (shadow) { m.castShadow = true; m.receiveShadow = true; }
    if (mat === this.waterMat) m.renderOrder = 2;
    this.group.add(m);
    return m;
  }
  drop(e) {
    if (!e) return;
    for (const m of [e.mesh, e.water, e.deco]) if (m) { this.group.remove(m); m.geometry.dispose(); }
  }

  buildLOD2All(progress) {
    for (let rz = 0; rz < WZ / 128; rz++) for (let rx = 0; rx < WX / 128; rx++) {
      const r = meshLOD(this.world, rx, rz, 8, 128);
      const key = rz * 16 + rx;
      this.lod2.set(key, { mesh: this.addMesh(r.solid, this.mat, false), water: this.addMesh(r.water, this.waterMat, false) });
    }
  }

  ensureLOD1(sx, sz) {
    const key = sz * 32 + sx;
    let e = this.lod1.get(key);
    if (!e) {
      const r = meshLOD(this.world, sx, sz, 4, 64);
      e = { mesh: this.addMesh(r.solid, this.mat, false), water: this.addMesh(r.water, this.waterMat, false) };
      this.lod1.set(key, e);
    }
    return e;
  }

  setVis(e, v) {
    if (!e) return;
    if (e.mesh) e.mesh.visible = v; if (e.water) e.water.visible = v;
    if (e.deco) { const dx = (e.cx + 0.5) * CS - this.px, dz = (e.cz + 0.5) * CS - this.pz; e.deco.visible = v && dx * dx + dz * dz < this.decoRadius * this.decoRadius; }
  }

  rebuildNear(cx, cz) {
    const key = cz * NCX + cx;
    const old = this.near.get(key);
    const r = meshChunk(this.world, cx, cz);
    const e = { mesh: this.addMesh(r.solid, this.mat, true), water: this.addMesh(r.water, this.waterMat, false), deco: this.addMesh(r.deco, this.mat, false) };
    if (e.deco) e.deco.receiveShadow = true;
    e.cx = cx; e.cz = cz;
    this.drop(old);
    this.near.set(key, e);
    return e;
  }

  // budgetMs: time allowed for meshing this frame
  update(px, pz, budgetMs = 6, force = false) {
    this.px = px; this.pz = pz;
    const t0 = performance.now();
    const R = this.nearRadius;
    // dirty chunks first
    if (this.world.dirty.size) {
      for (const k of this.world.dirty) if (this.near.has(k)) this.rebuildNear(k % NCX, Math.floor(k / NCX));
      this.world.dirty.clear();
    }
    // needed near chunks sorted by distance
    const pcx = Math.floor(px / CS), pcz = Math.floor(pz / CS);
    const rc = Math.ceil(R / CS) + 1;
    const need = [];
    for (let cz = pcz - rc; cz <= pcz + rc; cz++) for (let cx = pcx - rc; cx <= pcx + rc; cx++) {
      if (cx < 0 || cz < 0 || cx >= NCX || cz >= NCZ) continue;
      const dx = (cx + 0.5) * CS - px, dz = (cz + 0.5) * CS - pz;
      const d2 = dx * dx + dz * dz;
      if (d2 > R * R) continue;
      const key = cz * NCX + cx;
      if (!this.near.has(key)) need.push([d2, cx, cz]);
    }
    need.sort((a, b) => a[0] - b[0]);
    for (const [, cx, cz] of need) {
      if (!force && performance.now() - t0 > budgetMs) break;
      this.rebuildNear(cx, cz);
    }
    // unload far near-chunks
    for (const [key, e] of this.near) {
      const cx = key % NCX, cz = Math.floor(key / NCX);
      const dx = (cx + 0.5) * CS - px, dz = (cz + 0.5) * CS - pz;
      if (dx * dx + dz * dz > (R + 48) ** 2) { this.drop(e); this.near.delete(key); }
    }
    // visibility of LODs
    for (let rz = 0; rz < WZ / 128; rz++) for (let rx = 0; rx < WX / 128; rx++) {
      const e2 = this.lod2.get(rz * 16 + rx);
      const dx = (rx + 0.5) * 128 - px, dz = (rz + 0.5) * 128 - pz;
      const d2r = dx * dx + dz * dz;
      const close = d2r < this.lod1Radius * this.lod1Radius;
      const cullR = this.cullRadius + 90;
      this.setVis(e2, !close && d2r < cullR * cullR);
      for (let s = 0; s < 4; s++) {
        const sx = rx * 2 + (s & 1), sz = rz * 2 + (s >> 1);
        const k1 = sz * 32 + sx;
        if (!close) { this.setVis(this.lod1.get(k1), false); continue; }
        // superchunk fully covered by near chunks?
        let covered = true;
        for (let q = 0; q < 4 && covered; q++) {
          const cx = sx * 2 + (q & 1), cz = sz * 2 + (q >> 1);
          if (!this.near.has(cz * NCX + cx)) covered = false;
        }
        if (covered) this.setVis(this.lod1.get(k1), false);
        else {
          if (!this.lod1.has(k1) && !force && performance.now() - t0 > budgetMs * 1.5) { this.setVis(e2, true); continue; }
          const e1 = this.ensureLOD1(sx, sz);
          this.setVis(e1, true);
          // hide near chunks in a partially covered superchunk to avoid overlap
          for (let q = 0; q < 4; q++) {
            const cx = sx * 2 + (q & 1), cz = sz * 2 + (q >> 1);
            this.setVis(this.near.get(cz * NCX + cx), false);
          }
        }
        if (covered) for (let q = 0; q < 4; q++) {
          const cx = sx * 2 + (q & 1), cz = sz * 2 + (q >> 1);
          this.setVis(this.near.get(cz * NCX + cx), true);
        }
      }
    }
    if (this.world.cacheOrder.length > this.world.maxCache) this.world.evict();
  }

  get loadedAround() { return this.near.size; }
}
