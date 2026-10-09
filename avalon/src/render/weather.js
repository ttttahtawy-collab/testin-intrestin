// Weather state machine, voxel clouds, rain/snow and lightning.
import * as THREE from 'three';
import { boxShape } from '../entities/voxmodel.js';
import { rng } from '../core/noise.js';

const STATES = {
  clear: { overcast: 0.05, rain: 0, fog: 0.75, wind: 0.6, next: { clear: 2, cloudy: 3, fog: 1 } },
  cloudy: { overcast: 0.45, rain: 0, fog: 1.0, wind: 1.0, next: { clear: 2, cloudy: 1, overcast: 2, fog: 1 } },
  overcast: { overcast: 0.8, rain: 0, fog: 1.25, wind: 1.3, next: { cloudy: 2, rain: 3, storm: 1 } },
  fog: { overcast: 0.55, rain: 0, fog: 2.6, wind: 0.3, next: { cloudy: 2, clear: 1, overcast: 1 } },
  rain: { overcast: 0.9, rain: 0.7, fog: 1.6, wind: 1.6, next: { overcast: 2, cloudy: 2, storm: 1 } },
  storm: { overcast: 1.0, rain: 1.0, fog: 1.9, wind: 2.4, next: { rain: 2, overcast: 1 } },
};

export class Weather {
  constructor(game) {
    this.game = game;
    this.state = 'cloudy';
    this.cur = { ...STATES.cloudy };
    this.timer = 3; // in-game hours until change
    this.flash = 0; this.nextBolt = 5;
    this.r = rng(1234);
    this.buildClouds();
    this.buildRain();
  }

  set(state) { this.state = state; this.timer = 4 + this.r() * 6; }

  buildClouds() {
    const scene = this.game.scene;
    this.cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false, depthWrite: false });
    this.clouds = [];
    const r = rng(77);
    for (let i = 0; i < 46; i++) {
      const boxes = [];
      const n = 3 + Math.floor(r() * 6);
      let x = 0, z = 0;
      for (let k = 0; k < n; k++) {
        const w = 10 + r() * 22, d = 8 + r() * 16, h = 3 + r() * 4;
        boxes.push([x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, 0xffffff]);
        boxes.push([x - w / 2 + 2, -1.5, z - d / 2 + 2, x + w / 2 - 2, 0, z + d / 2 - 2, 0xd8dce4]);
        x += (r() - 0.5) * 24; z += (r() - 0.5) * 16;
      }
      const m = new THREE.Mesh(boxShape(boxes, 1), this.cloudMat);
      m.position.set((r() - 0.5) * 1400, 150 + r() * 40, (r() - 0.5) * 1400);
      m.renderOrder = -0.5;
      m.frustumCulled = false;
      m.userData.dense = r();
      scene.add(m);
      this.clouds.push(m);
    }
  }

  buildRain() {
    const N = 2400;
    const pos = new Float32Array(N * 6);
    this.drops = [];
    for (let i = 0; i < N; i++) this.drops.push({ x: (Math.random() - 0.5) * 60, y: Math.random() * 40, z: (Math.random() - 0.5) * 60, s: 0.8 + Math.random() * 0.4 });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rainMat = new THREE.LineBasicMaterial({ color: 0x9aa6b4, transparent: true, opacity: 0.45, fog: true });
    this.rain = new THREE.LineSegments(g, this.rainMat);
    this.rain.frustumCulled = false;
    this.game.scene.add(this.rain);
  }

  // dtHours: in-game hours elapsed
  update(dt, dtHours, cam, region, sky) {
    this.timer -= dtHours;
    if (this.timer <= 0) {
      const nx = STATES[this.state].next;
      let tot = 0; for (const k in nx) tot += nx[k];
      let p = this.r() * tot;
      for (const k in nx) { p -= nx[k]; if (p <= 0) { this.set(k); break; } }
    }
    const tgt = STATES[this.state];
    const k = Math.min(1, dt / 25);
    for (const key of ['overcast', 'rain', 'fog', 'wind']) this.cur[key] += (tgt[key] - this.cur[key]) * k;
    // lightning
    if (this.state === 'storm' && this.cur.rain > 0.6) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) { this.nextBolt = 6 + this.r() * 14; this.flash = 1; const delay = 0.5 + this.r() * 2.5; setTimeout(() => this.game.audio.thunder(), delay * 1000); }
    }
    this.flash = Math.max(0, this.flash - dt * 3);
    // clouds drift & wrap
    const wind = this.cur.wind;
    const night = sky.night;
    const cc = this.cloudMat.color;
    cc.copy(sky.hor).lerp(new THREE.Color(1, 1, 1), 0.35 * (1 - night)).multiplyScalar(1 - this.cur.overcast * 0.45);
    if (this.flash > 0) cc.lerp(new THREE.Color(0.9, 0.92, 1), this.flash * 0.6);
    for (const c of this.clouds) {
      c.position.x += wind * 2.2 * dt;
      c.position.z += wind * 0.8 * dt;
      const dx = c.position.x - cam.x, dz = c.position.z - cam.z;
      if (dx > 700) c.position.x -= 1400; if (dx < -700) c.position.x += 1400;
      if (dz > 700) c.position.z -= 1400; if (dz < -700) c.position.z += 1400;
      c.visible = c.userData.dense < 0.25 + this.cur.overcast * 0.8;
    }
    this.cloudMat.opacity = 0.55 + this.cur.overcast * 0.4;
    // precipitation
    const rainAmt = this.cur.rain * (region.dry ? 0 : 1);
    const indoor = this.game.indoor;
    const snow = region.cold;
    this.rain.visible = rainAmt > 0.05 && !indoor && !snow;
    if (this.rain.visible) {
      const arr = this.rain.geometry.attributes.position.array;
      const n = Math.floor(this.drops.length * rainAmt);
      const slant = wind * 0.15;
      for (let i = 0; i < this.drops.length; i++) {
        const d = this.drops[i];
        d.y -= 38 * d.s * dt;
        if (d.y < -8) { d.y += 40; d.x = (Math.random() - 0.5) * 60; d.z = (Math.random() - 0.5) * 60; }
        const o = i * 6;
        if (i >= n) { arr[o] = arr[o + 1] = arr[o + 2] = arr[o + 3] = arr[o + 4] = arr[o + 5] = 0; continue; }
        const x = cam.x + d.x, y = cam.y + d.y - 15, z = cam.z + d.z;
        arr[o] = x; arr[o + 1] = y; arr[o + 2] = z;
        arr[o + 3] = x + slant; arr[o + 4] = y + 0.9; arr[o + 5] = z;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
      this.rainMat.color.copy(sky.hor).multiplyScalar(1.2);
      // splashes
      if (Math.random() < rainAmt * dt * 40) {
        const x = cam.x + (Math.random() - 0.5) * 16, z = cam.z + (Math.random() - 0.5) * 16;
        const y = this.game.world.groundY(x, z, cam.y + 20);
        this.game.fx.splash(x, y, z);
      }
    }
    if (snow && this.cur.rain > 0.1 && !indoor && Math.random() < dt * 60 * this.cur.rain) {
      this.game.fx.snow(cam.x + (Math.random() - 0.5) * 30, cam.y + 8 + Math.random() * 6, cam.z + (Math.random() - 0.5) * 30);
    }
    return { overcast: this.cur.overcast, rain: rainAmt, fog: this.cur.fog, wind, flash: this.flash, snow: snow && this.cur.rain > 0.1 };
  }
}
