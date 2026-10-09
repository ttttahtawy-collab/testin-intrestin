// Colossi: lumbering stone giants. The only lethal cut is to the glowing core at the nape.
import * as THREE from 'three';
import { makeColossusModel } from './models.js';

const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();

export class Colossus {
  constructor(scene, x, z, H, variant, opts = {}) {
    this.dummy = !!opts.dummy;
    this.H = H;
    this.m = makeColossusModel(variant, this.dummy);
    this.scale = H / this.m.height;
    this.m.root.scale.setScalar(this.scale);
    this.pos = new THREE.Vector3(x, 0, z);
    this.yaw = opts.yaw ?? Math.random() * Math.PI * 2;
    this.hp = 100;
    this.state = 'walk';
    this.t = Math.random() * 10;
    this.timer = 0;
    this.cool = 1 + Math.random();
    this.armOut = [0, 0]; // seconds an arm stays severed
    this.legOut = 0;
    this.attackArm = 0;
    this.hitDone = false;
    this.wander = new THREE.Vector2(x, z);
    this.removed = false;
    this.parts = [];
    this.m.root.traverse((o) => { if (o.isMesh) { o.userData.colossus = this; this.parts.push(o); } });
    scene.add(this.m.root);
    this.scene = scene;
  }
  get alive() { return this.state !== 'dying' && !this.removed; }
  radius() { return this.H * 0.2; }
  napeWorld(out = new THREE.Vector3()) { return this.m.core.getWorldPosition(out); }
  limbSegment(limb, out1, out2, len) {
    limb.getWorldPosition(out1);
    out2.set(0, -len, 0); limb.localToWorld(out2);
  }

  update(dt, game) {
    const { world, player } = game;
    this.t += dt;
    const m = this.m;
    if (this.state === 'dying') {
      this.timer += dt;
      const k = Math.min(1, this.timer / 1.6);
      m.fall.rotation.x = k * k * 1.45;
      if (this.timer > 1.6 && !this.landed) { this.landed = true; game.onColossusLand(this); }
      if (this.timer > 2.2) m.root.position.y -= dt * this.H * 0.06;
      if (this.timer > 5.5) this.remove();
      return;
    }
    for (let i = 0; i < 2; i++) this.armOut[i] = Math.max(0, this.armOut[i] - dt);
    this.legOut = Math.max(0, this.legOut - dt);
    this.cool -= dt;

    // glow pulses; stronger when the player is near
    const near = player.alive ? this.napeWorld(tmpA).distanceTo(player.chestPos(tmpB)) : 99;
    m.glow.emissiveIntensity = (this.dummy ? 0.5 : 1.0) + Math.sin(this.t * 4) * 0.3 + (near < 25 ? 0.8 : 0);

    if (this.dummy) { this.place(world); this.pose(0, dt); return; }

    const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const aggro = player.alive && dist < 120;
    const reach = this.H * 0.5 + 2.5;

    if (this.state === 'walk') {
      let tx, tz;
      if (aggro) { tx = dx; tz = dz; }
      else {
        if (Math.hypot(this.wander.x - this.pos.x, this.wander.y - this.pos.z) < 6 || Math.random() < dt * 0.05) {
          this.wander.set(this.pos.x + (Math.random() - 0.5) * 80, this.pos.z + (Math.random() - 0.5) * 80);
        }
        tx = this.wander.x - this.pos.x; tz = this.wander.y - this.pos.z;
      }
      this.turnToward(Math.atan2(tx, tz), dt * 1.4);
      let speed = (aggro ? 0.34 : 0.16) * this.H;
      if (this.legOut > 0) speed *= 0.12;
      if (aggro && dist < reach * 0.7) speed *= 0.2;
      this.pos.x += Math.sin(this.yaw) * speed * dt;
      this.pos.z += Math.cos(this.yaw) * speed * dt;
      this.avoid(game);
      const stride = speed / this.H * 7;
      this.walkPhase = (this.walkPhase || 0) + dt * stride;

      // start a grab if the player is close and not far above us
      const above = player.pos.y - this.pos.y;
      if (aggro && this.cool <= 0 && dist < reach && above < this.H * 1.15 && above > -4) {
        const side = dx * Math.cos(this.yaw) - dz * Math.sin(this.yaw); // >0: player on the armR (+x) side
        let arm = side > 0 ? 1 : 0;
        if (this.armOut[arm] > 0) arm = 1 - arm;
        if (this.armOut[arm] <= 0) {
          this.state = 'windup'; this.timer = 0; this.attackArm = arm; this.hitDone = false;
        }
      }
    } else if (this.state === 'windup' || this.state === 'swipe') {
      this.timer += dt;
      if (player.alive) this.turnToward(Math.atan2(dx, dz), dt * 2.2);
      if (this.state === 'windup' && this.timer > 0.75) { this.state = 'swipe'; this.timer = 0; }
      // lunge in while winding up so a hovering scout is not safe just outside reach
      if (dist > reach * 0.45 && this.legOut <= 0) {
        this.pos.x += Math.sin(this.yaw) * this.H * 0.18 * dt;
        this.pos.z += Math.cos(this.yaw) * this.H * 0.18 * dt;
        this.avoid(game);
      }
      if (this.state === 'swipe') {
        if (!this.hitDone && this.timer > 0.05) {
          const arm = this.attackArm ? m.armR : m.armL;
          this.limbSegment(arm, tmpA, tmpC, 3.9);
          if (player.alive && distToSegment(player.chestPos(tmpB), tmpA, tmpC) < this.H * 0.1 + 1.6) {
            this.hitDone = true;
            game.onGrabbed(this);
          }
        }
        if (this.timer > 0.35) { this.state = 'walk'; this.cool = 1.6 + Math.random(); }
      }
    }
    this.place(world);
    this.pose(this.state === 'walk' ? 1 : 0, dt);
  }

  turnToward(target, maxStep) {
    let d = ((target - this.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    this.yaw += Math.max(-maxStep, Math.min(maxStep, d));
  }

  // Keep out of the walled town and out of giant tree trunks.
  avoid(game) {
    const { town, trees } = game.info;
    const r = this.radius();
    const dx = this.pos.x - town.cx, dz = this.pos.z - town.cz;
    const d = Math.hypot(dx, dz);
    const minD = town.R + 3 + r;
    if (d < minD) { this.pos.x = town.cx + (dx / d) * minD; this.pos.z = town.cz + (dz / d) * minD; }
    for (const t of trees) {
      const tx = this.pos.x - t.x, tz = this.pos.z - t.z;
      const td = Math.hypot(tx, tz), md = t.r + r + 1;
      if (td < md && td > 0.01) { this.pos.x = t.x + (tx / td) * md; this.pos.z = t.z + (tz / td) * md; }
    }
    this.pos.x = Math.max(8, Math.min(312, this.pos.x));
    this.pos.z = Math.max(8, Math.min(312, this.pos.z));
  }

  place(world) {
    const g = world.groundAt(this.pos.x, this.pos.z);
    this.pos.y += (g - this.pos.y) * 0.3;
    const kneel = this.legOut > 0 ? this.H * 0.18 : 0;
    this.m.root.position.set(this.pos.x, this.pos.y - kneel, this.pos.z);
    this.m.root.rotation.y = this.yaw;
  }

  pose(walking, dt) {
    const m = this.m;
    const s = walking ? Math.sin(this.walkPhase || 0) * 0.45 : 0;
    m.legL.rotation.x = s; m.legR.rotation.x = -s;
    if (this.legOut > 0) { m.legL.rotation.x = -1.2; m.legR.rotation.x = 0.4; }
    const arms = [m.armL, m.armR];
    for (let i = 0; i < 2; i++) {
      let target = (i ? s : -s) * 0.8;
      if (this.state === 'windup' && this.attackArm === i) target = -2.7 * Math.min(1, this.timer / 0.5);
      if (this.state === 'swipe' && this.attackArm === i) target = -2.7 + (this.timer / 0.35) * 2.3;
      if (this.armOut[i] > 0) target = 0.15;
      arms[i].rotation.x += (target - arms[i].rotation.x) * Math.min(1, dt * (this.state === 'swipe' ? 20 : 8));
      arms[i].rotation.z = i ? -0.08 : 0.08;
      arms[i].scale.y = this.armOut[i] > 0 ? 0.45 : 1;
    }
    m.head.rotation.y = Math.sin(this.t * 0.7) * 0.25;
    m.fall.position.y = walking ? Math.abs(Math.sin(this.walkPhase || 0)) * 0.15 : 0;
  }

  // Returns {kind:'nape'|'limb'|null, ...}
  tryCut(chest, speed, spin) {
    const nape = this.napeWorld(tmpA);
    const reachN = 2.2 + this.H * 0.06 + (spin ? 1.4 : 0);
    if (nape.distanceTo(chest) < reachN) {
      const dmg = Math.round((22 + speed * 2.7) * (spin ? 1.25 : 1));
      this.hp -= dmg;
      return { kind: 'nape', dmg, killed: this.hp <= 0 };
    }
    const m = this.m;
    const limbs = [[m.armL, 3.9, 0, 'arm'], [m.armR, 3.9, 1, 'arm'], [m.legL, 3.6, 0, 'leg'], [m.legR, 3.6, 1, 'leg']];
    for (const [limb, len, i, kind] of limbs) {
      if (kind === 'arm' && this.armOut[i] > 0) continue;
      this.limbSegment(limb, tmpB, tmpC, len);
      if (distToSegment(chest, tmpB, tmpC) < 0.6 * this.scale + 1.8 + (spin ? 1 : 0)) {
        if (this.dummy) return { kind: 'limb', part: kind };
        if (kind === 'arm') this.armOut[i] = 10; else this.legOut = 8;
        return { kind: 'limb', part: kind };
      }
    }
    return null;
  }

  kill() {
    this.state = 'dying'; this.timer = 0;
    this.m.glow.emissiveIntensity = 0.1;
  }
  remove() {
    if (this.removed) return;
    this.removed = true;
    this.scene.remove(this.m.root);
    this.m.root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); } });
  }
}

function distToSegment(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / (abx * abx + aby * aby + abz * abz || 1)));
  return Math.hypot(a.x + abx * t - p.x, a.y + aby * t - p.y, a.z + abz * t - p.z);
}
