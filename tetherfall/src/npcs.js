// People of the walls: scouts who fly and fight beside you, townsfolk who flee when the
// titans come, and named characters you can talk to.
import * as THREE from 'three';
import { makeHumanModel } from './models.js';
import { SX, SZ } from './world.js';

const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
const ropeMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
const ropeGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 4, 1, true);
ropeGeo.translate(0, 0.5, 0);
const UP = new THREE.Vector3(0, 1, 0);

let seedN = 1;

class Human {
  constructor(game, kind, x, y, z) {
    this.game = game;
    this.kind = kind;
    this.pos = new THREE.Vector3(x, y, z);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.alive = true;
    this.heldBy = null;
    this.anim = Math.random() * 10;
    this.model = makeHumanModel(kind === 'scout' ? 'scout' : kind === 'talker' ? 'civilian' : kind, seedN++);
    game.scene.add(this.model.root);
  }
  get airborne() { return this.pos.y > this.game.world.groundAt(this.pos.x, this.pos.z) + 1.5; }
  chestPos(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + 1.1, this.pos.z); }
  dispose() {
    this.game.scene.remove(this.model.root);
  }
  animateWalk(dt, speed) {
    const m = this.model;
    this.anim += dt * (1.5 + speed * 1.6);
    const s = Math.sin(this.anim) * Math.min(1, speed / 3);
    m.legL.rotation.x = s * 0.8; m.legR.rotation.x = -s * 0.8;
    m.armL.rotation.x = -s * 0.7; m.armR.rotation.x = s * 0.7;
    m.armL.rotation.z = 0.06; m.armR.rotation.z = -0.06;
    m.torso.rotation.x = speed > 4 ? 0.25 : 0.05;
    m.hips.position.y = 0.9 - Math.abs(Math.cos(this.anim)) * 0.04 * Math.min(1, speed / 3);
  }
  animateFlail(dt) {
    const m = this.model;
    this.anim += dt * 14;
    m.armL.rotation.x = -2.6 + Math.sin(this.anim) * 0.6; m.armR.rotation.x = -2.6 + Math.sin(this.anim + 1) * 0.6;
    m.legL.rotation.x = Math.sin(this.anim) * 0.9; m.legR.rotation.x = -Math.sin(this.anim) * 0.9;
  }
  place() {
    this.model.root.position.copy(this.pos);
    this.model.root.rotation.y = this.yaw;
  }
}

// ---------------- townsfolk ----------------
export class Civilian extends Human {
  constructor(game, town, x, z) {
    super(game, 'civilian', x, game.world.groundAt(x, z), z);
    this.town = town;
    this.state = 'wander';
    this.path = [];
    this.speed = 1.4 + Math.random() * 0.5;
    this.wait = Math.random() * 3;
  }
  nearestNode() {
    const nodes = this.town.nodes;
    let best = 0, bd = 1e9;
    for (let i = 0; i < nodes.length; i++) {
      const d = Math.hypot(nodes[i].x - this.pos.x, nodes[i].z - this.pos.z);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  pathTo(goal) {
    const nodes = this.town.nodes;
    if (!nodes.length) return [];
    const start = this.nearestNode();
    const prev = new Int32Array(nodes.length).fill(-1);
    prev[start] = start;
    const q = [start];
    while (q.length) {
      const k = q.shift();
      if (k === goal) break;
      for (const m of nodes[k].adj) if (prev[m] < 0) { prev[m] = k; q.push(m); }
    }
    if (prev[goal] < 0) return [];
    const out = [];
    for (let k = goal; k !== start; k = prev[k]) out.push({ x: nodes[k].x + (Math.random() - 0.5) * 3, z: nodes[k].z + (Math.random() - 0.5) * 3 });
    out.push({ x: nodes[start].x, z: nodes[start].z });
    return out.reverse();
  }
  flee() {
    if (this.state === 'flee' || this.state === 'saved' || !this.alive || this.state === 'trapped') return;
    this.state = 'flee';
    const ev = this.town.evac;
    if (!ev) { this.path = []; return; }
    const nodes = this.town.nodes;
    let best = 0, bd = 1e9;
    for (let i = 0; i < nodes.length; i++) { const d = Math.hypot(nodes[i].x - ev.x, nodes[i].z - ev.z); if (d < bd) { bd = d; best = i; } }
    this.path = this.pathTo(best);
    this.path.push({ x: ev.x, z: ev.z });
    this.speed = 4.6 + Math.random() * 1.6;
  }
  update(dt, near) {
    if (!this.alive) return;
    if (this.heldBy) { if (near) { this.animateFlail(dt); this.place(); } return; }
    const g = this.game;
    if (this.state === 'trapped') {
      this.pos.y = g.world.groundAt(this.pos.x, this.pos.z);
      if (near) { this.animateFlail(dt * 0.3); this.place(); }
      return;
    }
    if (this.state === 'wander' && !this.path.length) {
      this.wait -= dt;
      if (this.wait <= 0 && this.town.nodes.length) {
        this.path = this.pathTo(Math.floor(Math.random() * this.town.nodes.length)).slice(0, 4);
        this.wait = 2 + Math.random() * 6;
      }
    }
    let speed = 0;
    if (this.path.length) {
      const w = this.path[0];
      let dx = w.x - this.pos.x, dz = w.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.2) {
        this.path.shift();
        if (!this.path.length && this.state === 'flee') { this.state = 'saved'; g.onCivilianSaved(this); return; }
      } else {
        // shy away from titans close by
        const t = this.state === 'flee' ? g.nearestTitan(this.pos, 26) : null;
        if (t) {
          const ax = this.pos.x - t.pos.x, az = this.pos.z - t.pos.z, al = Math.hypot(ax, az) || 1;
          dx = dx / d + (ax / al) * 0.8; dz = dz / d + (az / al) * 0.8;
        }
        const l = Math.hypot(dx, dz) || 1;
        speed = this.speed;
        this.pos.x += (dx / l) * speed * dt; this.pos.z += (dz / l) * speed * dt;
        const want = Math.atan2(dx, dz);
        let diff = want - this.yaw; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.yaw += diff * Math.min(1, dt * 8);
      }
    }
    this.pos.x = Math.max(2, Math.min(SX - 2, this.pos.x)); this.pos.z = Math.max(2, Math.min(SZ - 2, this.pos.z));
    this.pos.y = g.world.groundAt(this.pos.x, this.pos.z);
    this.vel.set(0, 0, 0);
    if (near) { this.animateWalk(dt, speed); this.place(); }
  }
}

// ---------------- scouts ----------------
const SCOUT_NAMES = ['Rourke', 'Fenn', 'Darrow', 'Hal', 'Corin', 'Bastian', 'Ivo', 'Anselm', 'Pell', 'Garret', 'Lucan', 'Oswin', 'Teague', 'Wyland', 'Brask', 'Emeric', 'Jory', 'Nils', 'Aldo', 'Severin', 'Quill', 'Marek'];
let nameI = 0;
export class Scout extends Human {
  constructor(game, x, y, z, opts = {}) {
    super(game, opts.garrison ? 'garrison' : 'scout', x, y, z);
    this.name = opts.name || SCOUT_NAMES[nameI++ % SCOUT_NAMES.length];
    this.squad = opts.squad || 'Squad';
    this.home = new THREE.Vector3(x, y, z); // where to fall back to
    this.area = opts.area || { x, z, r: 260 }; // where they look for titans
    this.state = 'perch';
    this.target = null;
    this.timer = Math.random() * 2;
    this.attacks = 0;
    this.cool = 0;
    this.speedMax = 30 + Math.random() * 8;
    this.skill = opts.skill ?? (0.28 + Math.random() * 0.16);
    this.ropes = [0, 1].map(() => { const m = new THREE.Mesh(ropeGeo, ropeMat); m.visible = false; game.scene.add(m); return { mesh: m, anchor: new THREE.Vector3(), t: 0 }; });
    this.ropeT = 0; this.ropeI = 0;
    this.kills = 0;
    this.chatter = 0;
  }
  dispose() { super.dispose(); for (const r of this.ropes) this.game.scene.remove(r.mesh); }
  fly(dt, goal, maxSpeed) {
    const w = this.game.world;
    const d = tmp.copy(goal).sub(this.pos);
    const dist = d.length();
    if (dist > 0.01) d.multiplyScalar(Math.min(maxSpeed, dist * 2.2) / dist);
    this.vel.lerp(d, Math.min(1, dt * 2.6));
    this.vel.y += Math.sin(this.anim * 0.7) * 5 * dt;
    this.pos.addScaledVector(this.vel, dt);
    const g = w.groundAt(this.pos.x, this.pos.z);
    if (this.pos.y < g + 1.5) { this.pos.y = g + 1.5; this.vel.y = Math.max(this.vel.y, 3); }
    // pop out of anything solid
    for (let k = 0; k < 6 && w.solid(Math.floor(this.pos.x), Math.floor(this.pos.y), Math.floor(this.pos.z)); k++) { this.pos.y += 1; this.vel.y = Math.max(this.vel.y, 4); }
    this.pos.x = Math.max(4, Math.min(SX - 4, this.pos.x)); this.pos.z = Math.max(4, Math.min(SZ - 4, this.pos.z));
    if (this.vel.lengthSq() > 1) this.yaw = Math.atan2(this.vel.x, this.vel.z);
    // keep a rope on something above and ahead, like a real rig
    this.ropeT -= dt;
    if (this.ropeT <= 0) {
      this.ropeT = 0.6 + Math.random() * 0.6;
      const v = tmp2.copy(this.vel).normalize().multiplyScalar(0.8);
      v.y += 0.9; v.x += (Math.random() - 0.5) * 0.8; v.z += (Math.random() - 0.5) * 0.8;
      const hit = w.raycast(this.pos.x, this.pos.y + 1, this.pos.z, v.x, v.y, v.z, 70);
      const r = this.ropes[this.ropeI = 1 - this.ropeI];
      if (hit) { r.anchor.set(...hit.point); r.t = 1.1; }
      else if (this.target && this.target.alive) { this.target.m.head.getWorldPosition(r.anchor); r.t = 0.8; }
    }
  }
  updateRopes(dt, near) {
    for (const r of this.ropes) {
      r.t -= dt;
      const vis = near && r.t > 0 && this.state !== 'perch' && this.alive && !this.heldBy;
      r.mesh.visible = vis;
      if (!vis) continue;
      const from = tmp2.set(this.pos.x, this.pos.y + 0.9, this.pos.z);
      const d = tmp.copy(r.anchor).sub(from);
      const len = d.length();
      r.mesh.position.copy(from);
      r.mesh.scale.set(1, Math.max(0.01, len), 1);
      if (len > 0.001) r.mesh.quaternion.setFromUnitVectors(UP, d.divideScalar(len));
    }
  }
  pickTarget() {
    const g = this.game;
    // a comrade in a titan's fist comes first
    if (g.player.grabbed && g.player.grabbed.titan.alive && g.player.grabbed.titan.pos.distanceTo(this.pos) < 160) return g.player.grabbed.titan;
    let best = null, bd = 1e9;
    for (const t of g.titans) {
      if (!t.alive || t.dummy || t.passive) continue;
      if (Math.hypot(t.pos.x - this.area.x, t.pos.z - this.area.z) > this.area.r) continue;
      const busy = g.scouts.filter((s) => s !== this && s.target === t && s.alive).length;
      const d = t.pos.distanceTo(this.pos) + busy * 60 + (t.victim ? -80 : 0);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }
  update(dt, near) {
    if (!this.alive) return;
    const g = this.game;
    this.anim += dt;
    this.cool -= dt;
    this.chatter -= dt;
    if (this.heldBy) { if (near) { this.animateFlail(dt); this.place(); } this.updateRopes(dt, false); return; }
    switch (this.state) {
      case 'perch': {
        this.vel.set(0, 0, 0);
        const gy = g.world.topSolid(Math.floor(this.pos.x), Math.floor(this.pos.z), Math.floor(this.pos.y + 1));
        this.pos.y += (gy - this.pos.y) * Math.min(1, dt * 6);
        this.timer -= dt;
        if (this.timer <= 0) {
          this.timer = 0.8;
          this.target = this.pickTarget();
          if (this.target && this.cool <= 0) { this.state = 'fly'; this.vel.set(0, 8, 0); }
        }
        if (near) { this.animateWalk(dt, 0); this.place(); }
        break;
      }
      case 'fly': {
        const t = this.target;
        if (!t || !t.alive) { this.target = this.pickTarget(); if (!this.target) this.state = 'return'; break; }
        // circle in from behind and above, then dive at the nape
        const sp = t.strikePoint(tmp2);
        const f = t.forward(tmp);
        const approach = new THREE.Vector3(sp.x - f.x * 10, sp.y + 7, sp.z - f.z * 10);
        this.fly(dt, approach, this.speedMax);
        if (this.pos.distanceTo(approach) < 9) { this.state = 'dive'; this.timer = 0; }
        break;
      }
      case 'dive': {
        const t = this.target;
        if (!t || !t.alive) { this.state = 'fly'; break; }
        this.timer += dt;
        const sp = t.strikePoint(tmp2).clone();
        this.fly(dt, sp, this.speedMax + 14);
        if (this.pos.distanceTo(sp) < 2.6) this.strike(t);
        else if (this.timer > 3) { this.state = 'fly'; }
        break;
      }
      case 'evade': {
        this.timer -= dt;
        this.fly(dt, tmp2.set(this.evadeTo.x, this.evadeTo.y, this.evadeTo.z), this.speedMax);
        // regroup now and then: scouts run low on gas and nerve too
        if (this.timer <= 0) this.state = this.attacks >= 3 || Math.random() < 0.3 ? 'return' : 'fly';
        break;
      }
      case 'return': {
        this.fly(dt, this.home, this.speedMax);
        if (this.pos.distanceTo(this.home) < 3) { this.state = 'perch'; this.attacks = 0; this.cool = 8 + Math.random() * 8; this.timer = 1; }
        break;
      }
    }
    if (this.state !== 'perch' && near) {
      // flying pose
      const m = this.model;
      m.torso.rotation.x = 0.5; m.legL.rotation.x = -0.6; m.legR.rotation.x = -0.3;
      m.armL.rotation.x = -1.2; m.armR.rotation.x = -1.2; m.armL.rotation.z = 0.5; m.armR.rotation.z = -0.5;
      if (this.state === 'dive') { m.armL.rotation.x = -2.8; m.armR.rotation.x = -2.8; }
      this.place();
    }
    this.updateRopes(dt, near);
  }
  strike(t) {
    const g = this.game;
    this.attacks++;
    // odds depend on how distracted the titan is and what kind it is
    let p = this.skill;
    if (t.state === 'eat' || t.state === 'bash' || t.state === 'stagger' || t.legsOut()) p += 0.3;
    if (t.target && t.target !== this && t.target.kind !== 'scout') p += 0.1;
    if (t.st.erratic || t.st.crawl) p -= 0.2;
    if (t.target === this && t.behindness(this.pos) < 0) p -= 0.25;
    if (t.boss) p -= 0.25;
    const rescue = g.player.grabbed && g.player.grabbed.titan === t;
    if (rescue && Math.random() < 0.6) {
      t.armOut[t.attackArm] = 10;
      g.radio(this.name, 'Got you! Get clear!', 'ally');
      this.evade(t);
      return;
    }
    if (Math.random() < p) {
      if (t.st.armor && !t.legsOut()) {
        t.legOut[Math.random() < 0.5 ? 0 : 1] = 7;
        if (this.chatter <= 0) { g.radio(this.name, 'Its knee! The armour cracks when it kneels!', 'ally'); this.chatter = 10; }
      } else {
        const r = t.napeHit(t.boss ? 45 : 130);
        if (r.killed) { this.kills++; g.onTitanKilled(t, this); }
        else if (this.chatter <= 0) { g.radio(this.name, t.boss ? 'It’s still standing — hit it again!' : 'Too shallow!', 'ally'); this.chatter = 6; }
      }
      this.evade(t);
    } else if (t.st.grab && Math.random() < 0.5 && t.state !== 'eat' && t.state !== 'dying') {
      t.seize(this, Math.random() < 0.5 ? 0 : 1);
      g.onHumanSeized(t, this);
    } else {
      if (this.chatter <= 0) { g.radio(this.name, 'Missed! Going around!', 'ally'); this.chatter = 6; }
      this.evade(t);
    }
  }
  evade(t) {
    const f = t.forward(tmp);
    this.state = 'evade'; this.timer = 1.4;
    this.evadeTo = { x: this.pos.x - f.x * 18 + (Math.random() - 0.5) * 20, y: this.pos.y + 10, z: this.pos.z - f.z * 18 + (Math.random() - 0.5) * 20 };
  }
}

// ---------------- named characters you can talk to ----------------
export class Talker extends Human {
  constructor(game, def) {
    super(game, def.outfit || 'talker', def.x, def.y ?? game.world.groundAt(def.x, def.z), def.z);
    this.def = def;
    this.name = def.name;
    this.yaw = def.yaw || 0;
    this.place();
  }
  update(dt, near) {
    if (!near) return;
    const p = this.game.player;
    const d = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    if (d < 12) {
      const want = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
      let diff = want - this.yaw; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.yaw += diff * Math.min(1, dt * 4);
    }
    this.anim += dt;
    const m = this.model;
    m.armL.rotation.x = Math.sin(this.anim * 1.3) * 0.05; m.armR.rotation.x = -Math.sin(this.anim * 1.3) * 0.05;
    m.head.rotation.y = Math.sin(this.anim * 0.5) * 0.2;
    this.place();
  }
}
