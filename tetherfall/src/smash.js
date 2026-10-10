// Destruction: titans plough through houses and trees, pound holes in the walls, and the
// Beast hurls boulders. Also flying debris, falling trees and breach bookkeeping.
import * as THREE from 'three';
import { B, SMASH } from './blocks.js';
import { WALLS, G } from './worldgen.js';

const tmp = new THREE.Vector3();

class Debris {
  constructor(scene, n, mapColor) {
    this.n = n;
    this.mapColor = mapColor;
    const geo = new THREE.BoxGeometry(0.55, 0.55, 0.55);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 3); this.life = new Float32Array(n); this.rot = new Float32Array(n);
    this.next = 0;
    const m = new THREE.Matrix4().makeScale(0, 0, 0);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) { this.mesh.setMatrixAt(i, m); this.mesh.setColorAt(i, c.setRGB(1, 1, 1)); }
    scene.add(this.mesh);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._e = new THREE.Euler(); this._c = new THREE.Color();
    this.active = 0;
  }
  emit(x, y, z, block, power = 6, upward = 5) {
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = (Math.random() - 0.5) * power; this.v[i * 3 + 1] = Math.random() * upward + 1; this.v[i * 3 + 2] = (Math.random() - 0.5) * power;
    this.life[i] = 1.6 + Math.random() * 1.2;
    this.rot[i] = Math.random() * 6;
    const col = this.mapColor[block] || [140, 130, 120];
    this.mesh.setColorAt(i, this._c.setRGB(col[0] / 255, col[1] / 255, col[2] / 255).convertSRGBToLinear());
    this.mesh.instanceColor.needsUpdate = true;
    this.active = 3;
  }
  update(dt, world) {
    if (this.active <= 0) return;
    let any = false;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      const k = i * 3;
      this.v[k + 1] -= 22 * dt;
      this.p[k] += this.v[k] * dt; this.p[k + 1] += this.v[k + 1] * dt; this.p[k + 2] += this.v[k + 2] * dt;
      if (world.solid(Math.floor(this.p[k]), Math.floor(this.p[k + 1]), Math.floor(this.p[k + 2]))) {
        this.p[k + 1] = Math.floor(this.p[k + 1]) + 1.28; this.v[k + 1] *= -0.25; this.v[k] *= 0.5; this.v[k + 2] *= 0.5;
      }
      this.rot[i] += dt * 4;
      const s = this.life[i] > 0 ? Math.min(1, this.life[i] * 2) : 0;
      this._e.set(this.rot[i], this.rot[i] * 0.7, 0);
      this._m.compose(this._s.set(this.p[k], this.p[k + 1], this.p[k + 2]), this._q.setFromEuler(this._e), tmp.set(s, s, s));
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (!any) this.active--;
  }
}

export class Smash {
  constructor(game, scene, mapColor) {
    this.game = game;
    this.scene = scene;
    this.world = game.world;
    this.debris = new Debris(scene, 600, mapColor);
    this.queue = []; // blocks still to crumble from collapsing buildings
    this.falling = []; // trees on their way down
    this.boulders = [];
    this.breaches = [];
    this.restore = []; // blocks being put back while a breach is sealed
    const info = game.info;
    this.tgrid = new Map(); this.bgrid = new Map();
    for (const t of info.trees) this.addToGrid(this.tgrid, t.x - t.r - 1, t.z - t.r - 1, t.x + t.r + 1, t.z + t.r + 1, t);
    for (const b of info.buildings) this.addToGrid(this.bgrid, b.x0, b.z0, b.x1, b.z1, b);
    this.trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a3e2a });
    this.leafMat = new THREE.MeshLambertMaterial({ color: 0x3f7a30 });
    this.boulderMat = new THREE.MeshLambertMaterial({ color: 0x8a847a });
  }
  addToGrid(grid, x0, z0, x1, z1, item) {
    for (let gz = Math.floor(z0 / 32); gz <= Math.floor(z1 / 32); gz++) for (let gx = Math.floor(x0 / 32); gx <= Math.floor(x1 / 32); gx++) {
      const k = gx + ',' + gz;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(item);
    }
  }
  cell(grid, x, z) { return grid.get(Math.floor(x / 32) + ',' + Math.floor(z / 32)) || []; }
  treeAt(x, z, y) {
    for (const t of this.cell(this.tgrid, x, z)) {
      if (t.fallen) continue;
      if (Math.hypot(x + 0.5 - t.x, z + 0.5 - t.z) < t.r + 3 && y < t.g + t.h + 2 && y >= t.g - 3) return t;
    }
    return null;
  }
  buildingAt(x, y, z) {
    for (const b of this.cell(this.bgrid, x, z)) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && y >= b.y0 && y <= b.y1) return b;
    return null;
  }

  // Remove one block and keep the books. Returns true if something broke.
  breakBlock(x, y, z, fx = 0, fz = 0, debrisChance = 0.08) {
    const w = this.world;
    const old = w.edit(x, y, z, B.AIR);
    if (old === B.AIR) return false;
    if (Math.random() < debrisChance) this.debris.emit(x + 0.5, y + 0.5, z + 0.5, old, 7, 6);
    const b = this.buildingAt(x, y, z);
    if (b && !b.collapsed) {
      b.lost++;
      if (b.lost > b.blocks * 0.28) this.collapse(b, fx, fz);
    }
    return true;
  }

  // Everything soft in front of a walking titan gives way.
  carveTitan(t) {
    const w = this.world;
    const r = t.radius() * (t.st.crawl ? 1.1 : 0.95);
    const fx = Math.sin(t.yaw), fz = Math.cos(t.yaw);
    const cx = t.pos.x + fx * r * 0.55, cz = t.pos.z + fz * r * 0.55;
    const g = Math.floor(w.groundAt(t.pos.x, t.pos.z));
    const y0 = g, y1 = Math.floor(g + t.air + t.H * (t.st.crawl ? 0.5 : 0.92));
    let n = 0;
    const r2 = r * r;
    for (let y = y0; y <= y1; y++) for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x + 0.5 - cx, dz = z + 0.5 - cz;
      if (dx * dx + dz * dz > r2) continue;
      const b = w.get(x, y, z);
      if (!SMASH[b]) continue;
      if (b === B.LOG) {
        const tree = this.treeAt(x, z, y);
        if (tree) { this.fellTree(tree, fx, fz); continue; }
      }
      if (this.breakBlock(x, y, z, fx, fz, 0.1)) n++;
      if (n > 260) return n;
    }
    if (n > 20) this.game.onSmash(t, n);
    return n;
  }

  // Pound a hole in a great wall (and anything else in the way).
  bashWall(p, radius, titan, kick = false) {
    const w = this.world;
    let n = 0;
    const R = Math.ceil(radius * 1.7);
    const wallId = nearestWall(p.x, p.z);
    let rec = this.breaches.find((q) => q.wallId === wallId && Math.hypot(q.x - p.x, q.z - p.z) < 30);
    for (let y = Math.floor(p.y - R); y <= p.y + R; y++) for (let z = Math.floor(p.z - R); z <= p.z + R; z++) for (let x = Math.floor(p.x - R); x <= p.x + R; x++) {
      const d = Math.hypot(x + 0.5 - p.x, (y + 0.5 - p.y) * (kick ? 0.6 : 1), z + 0.5 - p.z);
      const b = w.get(x, y, z);
      if (b === B.AIR) continue;
      const lim = b === B.GATE ? radius * 1.7 : radius;
      if (d > lim) continue;
      if (b === B.WALL || b === B.GATE) {
        if (y < G - 2) continue;
        if (!rec) {
          const wl = WALLS[wallId];
          const a = Math.atan2(p.z - wl.cz, p.x - wl.cx);
          rec = { id: this.breaches.length + 1, wallId, x: wl.cx + Math.cos(a) * wl.R, z: wl.cz + Math.sin(a) * wl.R, nx: Math.cos(a), nz: Math.sin(a), removed: [], open: false, sealed: false };
          this.breaches.push(rec);
        }
        w.edit(x, y, z, B.AIR);
        rec.removed.push(x, y, z, b);
        rec.sealed = false;
        if (Math.random() < 0.12) this.debris.emit(x + 0.5, y + 0.5, z + 0.5, b, 12, 8);
        n++;
      } else if (SMASH[b]) {
        if (this.breakBlock(x, y, z, 0, 0, 0.1)) n++;
      }
    }
    if (rec && !rec.open && this.passable(rec)) {
      rec.open = true;
      this.game.onBreach(rec, titan);
    }
    this.game.onWallBash(p, n, titan, kick);
    return n;
  }
  // Is there a gap through the wall at ground level near this breach?
  passable(rec) {
    const wl = WALLS[rec.wallId];
    const w = this.world;
    const a0 = Math.atan2(rec.z - wl.cz, rec.x - wl.cx);
    for (let da = -12; da <= 12; da += 1) {
      const a = a0 + da / wl.R;
      let clear = true;
      for (let s = -4.5; s <= 4.5 && clear; s += 0.5) {
        for (const lat of [-1.2, 0, 1.2]) {
          const ra = a + lat / wl.R;
          const x = Math.floor(wl.cx + Math.cos(ra) * (wl.R + s)), z = Math.floor(wl.cz + Math.sin(ra) * (wl.R + s));
          for (let y = G + 1; y <= G + 5; y++) {
            const b = w.get(x, y, z);
            if (b === B.WALL || b === B.GATE) { clear = false; break; }
          }
          if (!clear) break;
        }
      }
      if (clear) {
        rec.x = wl.cx + Math.cos(a) * wl.R; rec.z = wl.cz + Math.sin(a) * wl.R;
        rec.nx = Math.cos(a); rec.nz = Math.sin(a);
        return true;
      }
    }
    return false;
  }
  // Begin putting the stones back.
  seal(rec) {
    if (rec.sealed) return;
    rec.sealing = true;
    rec.pending = 0;
    for (let i = 0; i < rec.removed.length; i += 4) { this.restore.push([rec.removed[i], rec.removed[i + 1], rec.removed[i + 2], rec.removed[i + 3], rec]); rec.pending++; }
    rec.total = rec.pending;
    this.restore.sort((a, b) => b[1] - a[1]); // popped from the end: bottom courses first
  }
  sealProgress(rec) {
    if (rec.sealed) return 1;
    if (!rec.sealing) return 0;
    return 1 - rec.pending / Math.max(1, rec.total);
  }

  collapse(b, fx, fz) {
    b.collapsed = true;
    const w = this.world;
    const list = [];
    for (let y = b.y0 + 1; y <= b.y1; y++) for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) {
      if (w.get(x, y, z) !== B.AIR) list.push([x, y, z]);
    }
    this.queue.push(...list);
    this.game.onCollapse(b);
  }

  fellTree(t, fx, fz) {
    if (t.fallen) return;
    t.fallen = true;
    const w = this.world;
    const R = Math.ceil(t.r + 22);
    const others = [];
    for (let gz = Math.floor((t.z - 60) / 32); gz <= Math.floor((t.z + 60) / 32); gz++) for (let gx = Math.floor((t.x - 60) / 32); gx <= Math.floor((t.x + 60) / 32); gx++) {
      for (const o of this.tgrid.get(gx + ',' + gz) || []) if (o !== t && !o.fallen && !others.includes(o)) others.push(o);
    }
    for (let y = t.g - 3; y <= t.g + t.h + 14; y++) for (let z = Math.floor(t.z - R); z <= t.z + R; z++) for (let x = Math.floor(t.x - R); x <= t.x + R; x++) {
      const b = w.get(x, y, z);
      if (b !== B.LOG && b !== B.LEAVES) continue;
      const d = Math.hypot(x + 0.5 - t.x, z + 0.5 - t.z);
      if (d > R) continue;
      let mine = true;
      for (const o of others) if (Math.hypot(x + 0.5 - o.x, z + 0.5 - o.z) < d) { mine = false; break; }
      if (mine) w.edit(x, y, z, B.AIR);
    }
    // a simple stand-in that topples over
    const pivot = new THREE.Group();
    pivot.position.set(t.x, t.g, t.z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(t.r * 0.6, t.r, t.h, 8), this.trunkMat);
    trunk.position.y = t.h / 2;
    const crown = new THREE.Mesh(new THREE.BoxGeometry(18, 7, 18), this.leafMat);
    crown.position.y = t.h;
    pivot.add(trunk, crown);
    const len = Math.hypot(fx, fz) || 1;
    const axis = new THREE.Vector3(fz / len, 0, -fx / len);
    this.scene.add(pivot);
    this.falling.push({ t, pivot, axis, k: 0, dir: [fx / len, fz / len], landed: false });
    this.game.onTreeFall(t);
  }

  throwBoulder(from, target, speed = 46) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), this.boulderMat);
    mesh.position.copy(from);
    this.scene.add(mesh);
    // lead the target a little and solve for a flat-ish arc
    const T = Math.max(0.6, from.distanceTo(target.pos) / speed);
    const tv = target.vel || tmp.set(0, 0, 0);
    const aimX = target.pos.x + tv.x * T * 0.7, aimY = target.pos.y + 1 + tv.y * T * 0.4, aimZ = target.pos.z + tv.z * T * 0.7;
    const v = new THREE.Vector3((aimX - from.x) / T, (aimY - from.y) / T + 0.5 * 16 * T, (aimZ - from.z) / T);
    this.boulders.push({ mesh, v, life: 6 });
  }

  update(dt) {
    const w = this.world;
    // crumbling buildings
    for (let k = 0; k < 140 && this.queue.length; k++) {
      const [x, y, z] = this.queue.pop();
      const old = w.edit(x, y, z, B.AIR);
      if (old !== B.AIR && Math.random() < 0.05) this.debris.emit(x + 0.5, y + 0.5, z + 0.5, old, 5, 3);
      if (k % 30 === 0 && old !== B.AIR) this.game.fx.dust(tmp.set(x, y, z), 2, 3, 2);
    }
    // sealing breaches, at sealRate blocks per second
    this.sealAcc = (this.sealAcc || 0) + dt * (this.sealRate || 300);
    if (!this.restore.length) this.sealAcc = 0;
    for (; this.sealAcc >= 1 && this.restore.length; this.sealAcc--) {
      const [x, y, z, b, rec] = this.restore.pop();
      w.edit(x, y, z, b);
      if (--rec.pending <= 0) { rec.sealed = true; rec.open = false; rec.sealing = false; rec.removed = []; this.game.onSealed(rec); }
    }
    // falling trees
    for (const f of this.falling) {
      f.k += dt / 2.4;
      const a = Math.min(1, f.k) ** 2 * (Math.PI / 2 - 0.08);
      f.pivot.quaternion.setFromAxisAngle(f.axis, a);
      if (f.k >= 1 && !f.landed) {
        f.landed = true;
        this.game.onTreeLand(f.t, f.dir);
      }
      if (f.k > 1.6) { this.scene.remove(f.pivot); f.pivot.children.forEach((c) => c.geometry.dispose()); f.done = true; }
    }
    this.falling = this.falling.filter((f) => !f.done);
    // boulders
    for (const b of this.boulders) {
      b.life -= dt;
      b.v.y -= 16 * dt;
      b.mesh.position.addScaledVector(b.v, dt);
      b.mesh.rotation.x += dt * 3; b.mesh.rotation.z += dt * 2;
      const p = b.mesh.position;
      const hitH = this.game.humanNear(p, 2.6, null);
      if (hitH || w.solid(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)) || p.y < w.groundAt(p.x, p.z) || b.life <= 0) {
        this.explode(p, 3.2);
        this.game.onBoulderImpact(p, hitH);
        this.scene.remove(b.mesh); b.mesh.geometry.dispose(); b.done = true;
      }
    }
    this.boulders = this.boulders.filter((b) => !b.done);
    this.debris.update(dt, w);
  }

  explode(p, r) {
    const w = this.world;
    for (let y = Math.floor(p.y - r); y <= p.y + r; y++) for (let z = Math.floor(p.z - r); z <= p.z + r; z++) for (let x = Math.floor(p.x - r); x <= p.x + r; x++) {
      if (Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y, z + 0.5 - p.z) > r) continue;
      const b = w.get(x, y, z);
      if (b === B.LOG) { const t = this.treeAt(x, z, y); if (t && t.r < 3 && Math.random() < 0.02) { this.fellTree(t, Math.random() - 0.5, Math.random() - 0.5); continue; } }
      if (SMASH[b]) this.breakBlock(x, y, z, 0, 0, 0.25);
    }
  }
}

export function nearestWall(x, z) {
  let best = 0, bd = 1e9;
  for (const w of WALLS) {
    const d = Math.abs(Math.hypot(x - w.cx, z - w.cz) - w.R);
    if (d < bd) { bd = d; best = w.id; }
  }
  return best;
}
