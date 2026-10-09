// Voxel particle system (instanced cubes) for blood, sparks, dust, smoke,
// fire, falling leaves, fireflies, rain splashes and embers.
import * as THREE from 'three';

const MAX = 2600;
const dummy = new THREE.Object3D();
const col = new THREE.Color();

class Pool {
  constructor(scene, mat, max) {
    this.max = max;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.p = [];
  }
  add(o) { if (this.p.length >= this.max) this.p.shift(); this.p.push(o); }
  update(dt) {
    let n = 0;
    const keep = [];
    for (const p of this.p) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy -= (p.g ?? 20) * dt;
      const dr = Math.pow(p.drag ?? 0.4, dt);
      p.vx *= dr; p.vy *= p.kind === 'rise' ? 1 : dr; p.vz *= dr;
      if (p.kind === 'rise') { p.vy = p.rise; p.vx += (p.wind || 0) * dt; }
      if (p.kind === 'leaf') { p.vx = Math.sin(p.life * 2 + p.seed) * 0.8 + (p.wind || 0); p.vy = -0.9; }
      if (p.kind === 'firefly') { p.vx = Math.sin(p.life * 1.3 + p.seed) * 0.6; p.vy = Math.cos(p.life * 1.7 + p.seed) * 0.3; p.vz = Math.sin(p.life * 0.9 + p.seed * 2) * 0.6; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.floor !== undefined && p.y < p.floor) { p.y = p.floor; p.vy = 0; p.vx *= 0.5; p.vz *= 0.5; }
      const k = p.life / p.max;
      let s = p.size * (p.grow ? 1 + (1 - k) * p.grow : (p.shrink ? Math.max(0.05, k) : 1));
      if (p.kind === 'firefly') s *= 0.6 + 0.4 * Math.sin(p.life * 8 + p.seed);
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rx || 0, (p.ry || 0) + p.life * (p.spin || 0), 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(n, dummy.matrix);
      const fade = p.fade ? Math.min(1, k * 2) : 1;
      col.setRGB(p.r * fade, p.gC * fade, p.b * fade);
      this.mesh.setColorAt(n, col);
      n++;
      keep.push(p);
    }
    this.p = keep;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

const lin = (h) => { col.setHex(h); return [col.r, col.g, col.b]; };

export class FX {
  constructor(game) {
    this.game = game;
    this.lit = new Pool(game.scene, new THREE.MeshLambertMaterial({ color: 0xffffff }), MAX);
    this.glow = new Pool(game.scene, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), 1400);
    this.flashT = 0;
    this.tele = [];
  }
  P(pool, o) {
    const [r, g, b] = lin(o.color);
    pool.add({ vx: 0, vy: 0, vz: 0, size: 0.15, ...o, r, gC: g, b, max: o.life, seed: Math.random() * 10, rx: Math.random() * 3, ry: Math.random() * 3 });
  }
  blood(pos, n = 8, color = 0x7a1010) {
    for (let i = 0; i < n; i++) this.P(this.lit, { x: pos.x, y: pos.y, z: pos.z, vx: (Math.random() - 0.5) * 7, vy: Math.random() * 6 + 1, vz: (Math.random() - 0.5) * 7, life: 0.7 + Math.random() * 0.6, size: 0.1 + Math.random() * 0.12, color, g: 22, floor: this.game.world.groundY(pos.x, pos.z, pos.y + 1) + 0.05 });
  }
  sparks(pos, n = 10) {
    for (let i = 0; i < n; i++) this.P(this.glow, { x: pos.x, y: pos.y, z: pos.z, vx: (Math.random() - 0.5) * 12, vy: Math.random() * 8, vz: (Math.random() - 0.5) * 12, life: 0.25 + Math.random() * 0.3, size: 0.06, color: Math.random() < 0.5 ? 0xffd070 : 0xffa030, g: 25, shrink: true, drag: 0.1 });
  }
  dust(pos, n = 20, radius = 2) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, r = Math.random() * radius;
      this.P(this.lit, { x: pos.x + Math.cos(a) * r, y: pos.y + 0.2, z: pos.z + Math.sin(a) * r, vx: Math.cos(a) * 4, vy: 2 + Math.random() * 3, vz: Math.sin(a) * 4, life: 0.8 + Math.random() * 0.8, size: 0.25 + Math.random() * 0.3, color: 0x8a7a64, g: 4, grow: 1.5, fade: true, drag: 0.2 });
    }
  }
  smoke(x, y, z, wind = 0.6) {
    this.P(this.lit, { x: x + (Math.random() - 0.5) * 0.4, y, z: z + (Math.random() - 0.5) * 0.4, kind: 'rise', rise: 1.3 + Math.random() * 0.6, wind, life: 5 + Math.random() * 2, size: 0.35, color: 0x6a6a6a, grow: 3, fade: true, spin: 0.3 });
  }
  fire(pos, r, dt) {
    if (Math.random() < dt * 40) {
      const a = Math.random() * 6.28, d = Math.random() * r;
      this.P(this.glow, { x: pos.x + Math.cos(a) * d, y: pos.y + 0.1, z: pos.z + Math.sin(a) * d, kind: 'rise', rise: 2 + Math.random() * 2, life: 0.5 + Math.random() * 0.5, size: 0.25 + Math.random() * 0.2, color: Math.random() < 0.5 ? 0xff7a1a : 0xffc040, shrink: true });
    }
  }
  campfire(x, y, z, dt, small = false) {
    const rate = small ? 10 : 22;
    if (Math.random() < dt * rate) this.P(this.glow, { x: x + (Math.random() - 0.5) * (small ? 0.4 : 0.8), y: y + 0.1, z: z + (Math.random() - 0.5) * (small ? 0.4 : 0.8), kind: 'rise', rise: 1.6 + Math.random() * 1.5, life: 0.4 + Math.random() * 0.5, size: (small ? 0.14 : 0.24) + Math.random() * 0.12, color: Math.random() < 0.4 ? 0xffd060 : 0xff6a10, shrink: true, spin: 2 });
    if (Math.random() < dt * (small ? 1 : 3)) this.P(this.glow, { x: x + (Math.random() - 0.5) * 0.5, y: y + 0.6, z: z + (Math.random() - 0.5) * 0.5, kind: 'rise', rise: 2.5 + Math.random() * 2, wind: (Math.random() - 0.5), life: 1.5, size: 0.05, color: 0xffa040, shrink: true });
    if (!small && Math.random() < dt * 2.5) this.smoke(x, y + 1.6, z, 0.4);
  }
  fireBurst(pos) {
    for (let i = 0; i < 40; i++) this.P(this.glow, { x: pos.x, y: pos.y + 0.3, z: pos.z, vx: (Math.random() - 0.5) * 10, vy: Math.random() * 7, vz: (Math.random() - 0.5) * 10, life: 0.6 + Math.random() * 0.5, size: 0.3, color: Math.random() < 0.5 ? 0xff8a20 : 0xffd060, shrink: true, g: 6 });
    this.dust(pos, 12, 2);
  }
  leaf(x, y, z, color = 0x6a8a3a, wind = 0.5) { this.P(this.lit, { x, y, z, kind: 'leaf', wind, life: 7, size: 0.12, color, g: 0, spin: 3, floor: this.game.world.groundY(x, z, y) + 0.05 }); }
  firefly(x, y, z) { this.P(this.glow, { x, y, z, kind: 'firefly', life: 6 + Math.random() * 4, size: 0.07, color: 0xd8f070, g: 0 }); }
  splash(x, y, z) { this.P(this.lit, { x, y, z, vx: (Math.random() - 0.5) * 1.5, vy: 2 + Math.random() * 1.5, vz: (Math.random() - 0.5) * 1.5, life: 0.25, size: 0.06, color: 0xa8b8c8, g: 20 }); }
  snow(x, y, z) { this.P(this.lit, { x, y, z, kind: 'leaf', wind: 0.3, life: 6, size: 0.07, color: 0xffffff, g: 0, floor: this.game.world.groundY(x, z, y) }); }
  mote(x, y, z, color = 0xc8c0d8) { this.P(this.lit, { x, y, z, kind: 'firefly', life: 8, size: 0.05, color, g: 0 }); }
  pickupGlint(pos) { for (let i = 0; i < 6; i++) this.P(this.glow, { x: pos.x, y: pos.y, z: pos.z, vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 2, vz: (Math.random() - 0.5) * 2, life: 0.6, size: 0.05, color: 0xffe0a0, g: 2, shrink: true }); }
  flash(t) { this.flashT = Math.max(this.flashT, t); }
  telegraph(a) {
    // red glint near the weapon / head to warn of unblockable attacks
    const p = a.center.clone();
    for (let i = 0; i < 10; i++) this.P(this.glow, { x: p.x, y: p.y + a.height * 0.35, z: p.z, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, vz: (Math.random() - 0.5) * 3, life: 0.45, size: 0.12, color: 0xff2a1a, g: 0, shrink: true });
    this.game.audio && this.game.audio.telegraph(a.pos);
  }
  update(dt) {
    this.lit.update(dt); this.glow.update(dt);
    this.flashT = Math.max(0, this.flashT - dt);
  }
}
