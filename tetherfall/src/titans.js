// Titans: giants that hunt people, pound the walls, smash through towns and forests.
// The only lethal cut is to the glowing core at the nape.
import * as THREE from 'three';
import { makeTitanModel, TITAN_TYPES } from './models.js';
import { SX, SZ } from './world.js';
import { B } from './blocks.js';

const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpD = new THREE.Vector3();

// speed/run are in body heights per second; hp is the nape's toughness.
export const TYPE_STATS = {
  pure: { speed: 0.3, run: 0.42, sight: 115, hp: 100, cool: 1.3, wind: 0.62, grab: true },
  abnormal: { speed: 0.45, run: 0.95, sight: 170, hp: 100, cool: 0.8, wind: 0.42, grab: true, leap: true, erratic: true },
  crawler: { speed: 0.65, run: 1.2, sight: 140, hp: 90, cool: 0.9, wind: 0.38, grab: true, leap: true, crawl: true },
  jaw: { speed: 1.5, run: 3.3, sight: 220, hp: 240, cool: 0.55, wind: 0.28, grab: true, leap: true, boss: true, struggle: 9 },
  armored: { speed: 0.42, run: 0.8, sight: 190, hp: 650, cool: 1.0, wind: 0.5, grab: false, boss: true, armor: true, bash: 6.5, bashRate: 0.9 },
  beast: { speed: 0.26, run: 0.36, sight: 280, hp: 450, cool: 1.4, wind: 0.55, grab: true, boss: true, throws: true },
  colossal: { speed: 0.055, run: 0.07, sight: 320, hp: 650, cool: 3, wind: 1.1, grab: false, boss: true, steam: true, bash: 14, bashRate: 4 },
};

let nextId = 1;

export class Titan {
  constructor(scene, type, x, z, H, opts = {}) {
    this.id = nextId++;
    this.type = type;
    this.st = TYPE_STATS[type] || TYPE_STATS.pure;
    this.name = (TITAN_TYPES[type] || TITAN_TYPES.pure).name;
    this.boss = !!this.st.boss;
    this.dummy = !!opts.dummy;
    this.passive = !!opts.passive;
    this.H = H;
    this.m = makeTitanModel(type, opts.seed ?? Math.floor(Math.random() * 1e6), this.dummy);
    this.scale = H / this.m.height;
    this.m.root.scale.setScalar(this.scale);
    this.pos = new THREE.Vector3(x, 0, z);
    this.vy = 0; this.air = 0; // leap height above ground
    this.leapV = new THREE.Vector3();
    this.yaw = opts.yaw ?? Math.random() * Math.PI * 2;
    this.maxHp = Math.round(this.st.hp * (type === 'pure' && H > 12 ? 1.5 : 1));
    this.hp = this.maxHp;
    this.state = 'walk';
    this.t = Math.random() * 10;
    this.timer = 0;
    this.cool = 1 + Math.random();
    this.armOut = [0, 0];
    this.legOut = [0, 0];
    this.attackArm = 0;
    this.hitDone = false;
    this.wander = new THREE.Vector2(x, z);
    this.removed = false;
    this.target = null; this.retarget = 0;
    this.route = null; // waypoints through a breach
    this.blockPt = null; this.wallCheck = 0; this.carveT = 0;
    this.victim = null;
    this.goal = opts.goal || null; // {x, z} the director wants us to head for
    this.special = 3 + Math.random() * 3; // throws, roars, steam
    this.steamT = 0;
    this.erraticT = 0;
    this.walkPhase = Math.random() * 6;
    this.parts = [];
    this.m.root.traverse((o) => { if (o.isMesh) { o.userData.titan = this; this.parts.push(o); } });
    scene.add(this.m.root);
    this.scene = scene;
    this.stuckT = 0;
  }
  get alive() { return this.state !== 'dying' && !this.removed; }
  radius() { return this.H * (this.st.crawl ? 0.28 : 0.2); }
  napeWorld(out = new THREE.Vector3()) { return this.m.core.getWorldPosition(out); }
  forward(out = new THREE.Vector3()) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  // Where a nape strike ends: just behind and above the core.
  strikePoint(out = new THREE.Vector3()) {
    const nape = this.napeWorld(out);
    const head = this.m.head.getWorldPosition(tmpD);
    const back = tmpC.copy(nape).sub(head); back.y = 0;
    if (back.lengthSq() < 1e-4) back.copy(this.forward(back)).negate();
    back.normalize();
    return nape.addScaledVector(back, 1.1 + this.H * 0.04).add(tmpC.set(0, 0.3, 0));
  }
  handWorld(i, out = new THREE.Vector3()) { return (i ? this.m.armR : this.m.armL).userData.tip.getWorldPosition(out); }
  limbSegment(limb, len, out1, out2) {
    limb.getWorldPosition(out1);
    out2.set(0, -len, 0); limb.localToWorld(out2);
  }
  legsOut() { return this.legOut[0] > 0 || this.legOut[1] > 0; }
  // 1 when standing behind us, -1 when in front
  behindness(p) {
    const f = this.forward(tmpD);
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z;
    const l = Math.hypot(dx, dz) || 1;
    return -(dx * f.x + dz * f.z) / l;
  }

  update(dt, game) {
    const { world } = game;
    this.t += dt;
    const m = this.m;
    if (this.state === 'dying') { this.updateDying(dt, game); return; }
    for (let i = 0; i < 2; i++) { this.armOut[i] = Math.max(0, this.armOut[i] - dt); this.legOut[i] = Math.max(0, this.legOut[i] - dt); }
    this.cool -= dt;
    this.special -= dt;

    const near = game.player.alive ? this.napeWorld(tmpA).distanceTo(game.player.chestPos(tmpB)) : 99;
    m.glow.emissiveIntensity = (this.dummy ? 0.5 : 1.0) + Math.sin(this.t * 4) * 0.3 + (near < 30 ? 0.8 : 0);
    if (this.dummy) { this.place(world); this.pose(0, dt); return; }

    // re-pick a target now and then
    this.retarget -= dt;
    if (this.retarget <= 0 && this.state !== 'eat') {
      this.retarget = 0.35 + Math.random() * 0.3;
      this.target = this.passive ? null : game.pickTarget(this);
    }
    const tgt = this.target && this.target.alive ? this.target : null;

    if (this.st.steam) this.updateSteam(dt, game);

    switch (this.state) {
      case 'walk': this.updateWalk(dt, game, tgt); break;
      case 'windup': case 'swipe': this.updateAttack(dt, game, tgt); break;
      case 'bash': this.updateBash(dt, game); break;
      case 'eat': this.updateEat(dt, game); break;
      case 'leap': this.updateLeap(dt, game); break;
      case 'stagger': this.timer -= dt; if (this.timer <= 0) this.state = 'walk'; break;
      case 'throw': this.updateThrow(dt, game, tgt); break;
      case 'kick': this.updateKick(dt, game); break;
      case 'roar': this.timer -= dt; if (this.timer <= 0) this.state = 'walk'; break;
      case 'idle': this.timer -= dt; if (this.timer <= 0 || (tgt && this.distTo(tgt) < 40)) this.state = 'walk'; break;
    }
    this.separate(game);
    this.carveT -= dt;
    const moving = this.state === 'walk' || this.state === 'leap' || this.state === 'bash' || this.state === 'kick';
    if (this.carveT <= 0 && moving) { this.carveT = 0.12; game.smash.carveTitan(this); }
    this.place(world);
    this.pose(this.state === 'walk' ? 1 : 0, dt);
  }

  distTo(h) { return Math.hypot(h.pos.x - this.pos.x, h.pos.z - this.pos.z); }

  updateWalk(dt, game, tgt) {
    const st = this.st;
    let tx, tz, run = false;
    // follow a route through a breach first
    if (this.route && this.route.length) {
      const w = this.route[0];
      tx = w.x - this.pos.x; tz = w.z - this.pos.z;
      if (Math.hypot(tx, tz) < 4 + this.radius()) { this.route.shift(); if (!this.route.length) this.route = null; }
      run = !!tgt;
    } else if (tgt) {
      tx = tgt.pos.x - this.pos.x; tz = tgt.pos.z - this.pos.z;
      run = true;
    } else if (this.goal) {
      tx = this.goal.x - this.pos.x; tz = this.goal.z - this.pos.z;
      if (Math.hypot(tx, tz) < 12) this.goal = null;
    } else {
      if (Math.hypot(this.wander.x - this.pos.x, this.wander.y - this.pos.z) < 6 || Math.random() < dt * 0.05) {
        this.wander.set(this.pos.x + (Math.random() - 0.5) * 90, this.pos.z + (Math.random() - 0.5) * 90);
      }
      tx = this.wander.x - this.pos.x; tz = this.wander.y - this.pos.z;
    }
    // abnormals change their mind without warning
    if (st.erratic) {
      this.erraticT -= dt;
      if (this.erraticT <= 0) {
        this.erraticT = 2 + Math.random() * 4;
        this.erraticYaw = Math.random() < 0.35 ? (Math.random() - 0.5) * 2.4 : 0;
        if (Math.random() < 0.08 && !tgt) { this.state = 'idle'; this.timer = 2 + Math.random() * 3; return; }
      }
    }
    let want = Math.atan2(tx, tz) + (st.erratic ? this.erraticYaw || 0 : 0);
    this.turnToward(want, dt * (run ? 2.2 : 1.4) * (st.erratic ? 1.6 : 1));
    let speed = (run ? st.run : st.speed) * this.H;
    if (this.legsOut()) speed *= 0.1;
    const dist = tgt ? this.distTo(tgt) : 999;
    const reach = this.reach();
    if (tgt && dist < reach * 0.6) speed *= 0.2;

    // the great walls stop us: bash them, or head for a known breach
    this.wallCheck -= dt;
    if (this.wallCheck <= 0) {
      this.wallCheck = 0.2;
      this.blockPt = this.wallAhead(game.world);
      if (this.blockPt) {
        if (!this.route) this.route = game.breachRoute(this, this.blockPt);
        if (!this.route || this.stuckT > 4) { this.state = 'bash'; this.timer = 0; this.stuckT = 0; return; }
      }
    }
    if (this.blockPt) { speed = 0; this.stuckT += dt; }
    else this.stuckT = 0;
    this.pos.x += Math.sin(this.yaw) * speed * dt;
    this.pos.z += Math.cos(this.yaw) * speed * dt;
    this.pos.x = Math.max(8, Math.min(SX - 8, this.pos.x));
    this.pos.z = Math.max(8, Math.min(SZ - 8, this.pos.z));
    this.walkPhase += dt * speed / this.H * 7;

    if (!tgt) return;
    const above = tgt.pos.y - this.pos.y;
    // leapers jump at anyone flying nearby or close on the ground
    if (st.leap && this.cool <= 0 && dist < (this.type === 'jaw' ? 55 : 38) && dist > reach * 0.5 && above < this.H * 2.2 && Math.random() < dt * 2.5) {
      this.startLeap(tgt);
      return;
    }
    if (st.throws && this.special <= 0 && dist > 30 && dist < st.sight) {
      this.state = 'throw'; this.timer = 0; this.special = 3.2 + Math.random() * 1.5;
      return;
    }
    if (this.cool <= 0 && dist < reach && above < this.H * 1.2 && above > -6) {
      const side = (tgt.pos.x - this.pos.x) * Math.cos(this.yaw) - (tgt.pos.z - this.pos.z) * Math.sin(this.yaw);
      let arm = side > 0 ? 1 : 0;
      if (this.armOut[arm] > 0) arm = 1 - arm;
      if (this.armOut[arm] <= 0) { this.state = 'windup'; this.timer = 0; this.attackArm = arm; this.hitDone = false; }
    }
  }

  reach() { return this.H * (this.st.crawl ? 0.65 : 0.55) + 3; }

  updateAttack(dt, game, tgt) {
    this.timer += dt;
    if (tgt) this.turnToward(Math.atan2(tgt.pos.x - this.pos.x, tgt.pos.z - this.pos.z), dt * 2.6);
    if (this.state === 'windup' && this.timer > this.st.wind) { this.state = 'swipe'; this.timer = 0; }
    const dist = tgt ? this.distTo(tgt) : 999;
    if (dist > this.reach() * 0.45 && !this.legsOut() && !this.blockPt) {
      this.pos.x += Math.sin(this.yaw) * this.H * 0.22 * dt;
      this.pos.z += Math.cos(this.yaw) * this.H * 0.22 * dt;
    }
    if (this.state === 'swipe') {
      if (!this.hitDone && this.timer > 0.05) {
        this.limbSegment(this.attackArm ? this.m.armR : this.m.armL, this.m.armLen + 0.8, tmpA, tmpC);
        const victim = game.humanNearSegment(tmpA, tmpC, this.H * 0.12 + 1.9, this);
        if (victim) { this.hitDone = true; game.onTitanHit(this, victim, this.attackArm); }
      }
      if (this.timer > 0.35 && this.state === 'swipe') { this.state = 'walk'; this.cool = this.st.cool + Math.random() * 0.8; }
    }
  }

  // Seize a victim (player or NPC) and lift them to the mouth.
  seize(victim, arm) {
    this.state = 'eat'; this.timer = 0; this.victim = victim; this.attackArm = arm;
    this.eatTime = 2.4 + this.H * 0.05;
  }
  updateEat(dt, game) {
    this.timer += dt;
    const v = this.victim;
    if (!v || !v.alive || this.armOut[this.attackArm] > 0) {
      if (v && v.alive) game.releaseVictim(this, v);
      this.victim = null; this.state = 'walk'; this.cool = 1.5;
      return;
    }
    game.holdVictim(this, v, this.handWorld(this.attackArm, tmpA));
    if (this.timer >= this.eatTime) {
      game.onEaten(this, v);
      this.victim = null; this.state = 'stagger'; this.timer = 1.6; this.cool = 1;
    }
  }

  startLeap(tgt) {
    const st = this.st;
    const p = tgt.pos;
    const v = tgt.vel || tmpD.set(0, 0, 0);
    const T = 0.9 + Math.min(0.6, this.distTo(tgt) / 60);
    const tx = p.x + v.x * T * 0.6, tz = p.z + v.z * T * 0.6, ty = Math.max(0, p.y + 1 - this.pos.y - this.H * 0.6);
    this.leapV.set((tx - this.pos.x) / T, ty / T + 0.5 * 22 * T, (tz - this.pos.z) / T);
    this.state = 'leap'; this.timer = 0; this.hitDone = false;
    this.yaw = Math.atan2(this.leapV.x, this.leapV.z);
    this.cool = st.cool + 2.5;
  }
  updateLeap(dt, game) {
    this.timer += dt;
    this.leapV.y -= 22 * dt;
    this.pos.x += this.leapV.x * dt; this.pos.z += this.leapV.z * dt;
    this.air += this.leapV.y * dt;
    this.pos.x = Math.max(8, Math.min(SX - 8, this.pos.x));
    this.pos.z = Math.max(8, Math.min(SZ - 8, this.pos.z));
    if (!this.hitDone) {
      // jaws and hands snap at anyone close
      const head = this.m.head.getWorldPosition(tmpA);
      const victim = game.humanNear(head, this.H * 0.3 + 2.2, this) || game.humanNear(this.handWorld(0, tmpB), this.H * 0.12 + 2, this) || game.humanNear(this.handWorld(1, tmpB), this.H * 0.12 + 2, this);
      if (victim) { this.hitDone = true; game.onTitanHit(this, victim, 1); if (this.state === 'eat') { this.air = Math.max(0, this.air); return; } }
    }
    if (this.air <= 0 && this.leapV.y < 0) {
      this.air = 0;
      this.state = 'stagger'; this.timer = this.type === 'jaw' ? 0.5 : 1.2;
      game.onTitanStomp(this);
    }
  }

  updateThrow(dt, game, tgt) {
    this.timer += dt;
    if (tgt) this.turnToward(Math.atan2(tgt.pos.x - this.pos.x, tgt.pos.z - this.pos.z), dt * 3);
    if (this.timer > 0.85 && !this.hitDone) {
      this.hitDone = true;
      if (tgt) game.throwBoulder(this, tgt);
    }
    if (this.timer > 1.3) { this.state = 'walk'; this.hitDone = false; }
  }

  updateSteam(dt, game) {
    if (this.steamT > 0) {
      this.steamT -= dt;
      game.steamBurst(this, dt);
    } else if (this.special <= 0) {
      this.special = 9 + Math.random() * 4;
      this.steamT = 4.5;
      game.onSteamStart(this);
    }
  }

  // Pound the wall in front of us until a hole opens.
  updateBash(dt, game) {
    const rate = this.st.bashRate || 1.5;
    if (this.legsOut()) return; // can't pound a wall while kneeling
    this.timer += dt;
    if (!this.blockPt) { this.state = 'walk'; return; }
    this.turnToward(Math.atan2(this.blockPt.x - this.pos.x, this.blockPt.z - this.pos.z), dt * 2);
    if (this.timer >= rate) {
      this.timer = 0;
      this.attackArm = 1 - this.attackArm;
      const hand = this.handWorld(this.attackArm, tmpA);
      const p = { x: this.blockPt.x, y: Math.min(this.pos.y + this.H * (0.3 + Math.random() * 0.55), this.blockPt.y + 6), z: this.blockPt.z };
      if (hand.distanceTo(tmpB.set(p.x, p.y, p.z)) < this.H) p.y = (p.y + hand.y) / 2;
      game.bashWall(p, this.st.bash || (1.2 + this.H * 0.12), this);
      this.blockPt = this.wallAhead(game.world);
      if (!this.blockPt) { this.state = 'walk'; }
    }
    // somebody interesting came close: fight them instead
    const tgt = this.target;
    if (tgt && tgt.alive && this.distTo(tgt) < this.reach() * 0.9 && this.cool <= 0) { this.state = 'walk'; this.blockPt = null; this.wallCheck = 0.5; }
  }
  kickAt(p) { this.state = 'kick'; this.timer = 0; this.kickPt = p; this.hitDone = false; }
  updateKick(dt, game) {
    this.timer += dt;
    this.turnToward(Math.atan2(this.kickPt.x - this.pos.x, this.kickPt.z - this.pos.z), dt * 2);
    if (this.timer > 1.6 && !this.hitDone) { this.hitDone = true; game.bashWall(this.kickPt, this.st.bash || 12, this, true); }
    if (this.timer > 3) this.state = 'walk';
  }

  updateDying(dt, game) {
    this.timer += dt;
    const k = Math.min(1, this.timer / 1.6);
    const m = this.m;
    m.fall.rotation.x = (this.st.crawl ? 0.9 : 0) + k * k * (this.st.crawl ? 0.5 : 1.45);
    if (this.timer > 1.6 && !this.landed) { this.landed = true; game.onTitanLand(this); }
    if (this.air > 0) { this.air = Math.max(0, this.air - dt * 20); }
    if (this.timer > 2.4) m.root.position.y -= dt * this.H * 0.06;
    if (this.timer > 7) this.remove();
  }

  turnToward(target, maxStep) {
    const d = ((target - this.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    this.yaw += Math.max(-maxStep, Math.min(maxStep, d));
  }

  // Probe in front of the body for great-wall blocks. Returns the contact point or null.
  wallAhead(world) {
    const r = this.radius();
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const g = world.groundAt(this.pos.x, this.pos.z);
    for (const lat of [0, -0.6, 0.6]) for (const hh of [1.5, 0.35, 0.7]) {
      const y = Math.floor(g + (hh > 1 ? hh : this.H * hh));
      for (const ahead of [r + 0.8, r + 2.2]) {
        const x = Math.floor(this.pos.x + fx * ahead + rx * lat * r), z = Math.floor(this.pos.z + fz * ahead + rz * lat * r);
        const b = world.get(x, y, z);
        if (b === B.WALL || b === B.GATE) return { x: x + 0.5, y: y + 0.5, z: z + 0.5 };
      }
    }
    return null;
  }

  separate(game) {
    const r = this.radius();
    for (const o of game.titans) {
      if (o === this || !o.alive || o.dummy) continue;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z;
      const d = Math.hypot(dx, dz), md = (r + o.radius()) * 0.8;
      if (d < md && d > 0.01) {
        const push = (md - d) * 0.5;
        this.pos.x += (dx / d) * push; this.pos.z += (dz / d) * push;
      }
    }
  }

  place(world) {
    const g = world.groundAt(this.pos.x, this.pos.z);
    this.pos.y += (g - this.pos.y) * 0.3;
    const kneel = this.legsOut() ? this.H * 0.18 : 0;
    this.m.root.position.set(this.pos.x, this.pos.y - kneel + this.air, this.pos.z);
    this.m.root.rotation.y = this.yaw;
  }

  pose(walking, dt) {
    const m = this.m;
    const s = walking ? Math.sin(this.walkPhase) * 0.5 : 0;
    const ease = (o, key, v, k) => { o[key] += (v - o[key]) * Math.min(1, dt * k); };
    const crawl = this.st.crawl;
    let legL = s, legR = -s;
    if (this.legOut[0] > 0) legL = -1.3;
    if (this.legOut[1] > 0) legR = -1.3;
    if (this.legsOut()) { if (this.legOut[0] <= 0) legL = 0.5; if (this.legOut[1] <= 0) legR = 0.5; }
    if (this.state === 'leap') { legL = -0.9; legR = 0.6; }
    if (this.state === 'kick' && this.timer > 0.6 && this.timer < 2.2) legR = -1.4;
    ease(m.legL.rotation, 'x', legL, 10); ease(m.legR.rotation, 'x', legR, 10);
    const arms = [m.armL, m.armR];
    for (let i = 0; i < 2; i++) {
      let target = crawl ? -1.2 + (i ? s : -s) * 0.6 : (i ? s : -s) * 0.8;
      let rate = 8;
      if (this.state === 'windup' && this.attackArm === i) target = -2.7 * Math.min(1, this.timer / (this.st.wind * 0.7));
      if (this.state === 'swipe' && this.attackArm === i) { target = -2.7 + (this.timer / 0.35) * 2.6; rate = 20; }
      if (this.state === 'bash') { target = this.attackArm === i ? -1.6 + Math.min(1, this.timer / 0.3) * 0.2 : -0.6; rate = 12; }
      if (this.state === 'eat' && this.attackArm === i) target = -0.4 - 2.3 * Math.min(1, this.timer / (this.eatTime * 0.6));
      if (this.state === 'throw' && i === 1) { target = this.timer < 0.8 ? -3.0 : -0.6; rate = 14; }
      if (this.state === 'roar') target = -2.6;
      if (this.state === 'leap') target = -2.4;
      if (this.armOut[i] > 0) target = 0.15;
      ease(arms[i].rotation, 'x', target, rate);
      arms[i].rotation.z = i ? -0.1 : 0.1;
      arms[i].scale.y = this.armOut[i] > 0 ? 0.45 : 1;
    }
    m.head.rotation.y = this.state === 'eat' ? 0 : Math.sin(this.t * (this.st.erratic ? 2.3 : 0.7)) * (this.st.erratic ? 0.6 : 0.25);
    m.head.rotation.x = this.state === 'eat' ? 0.3 : crawl ? -1.0 : 0;
    m.fall.position.y = walking ? Math.abs(Math.sin(this.walkPhase)) * 0.15 : 0;
    let lean = this.state === 'windup' || this.state === 'swipe' ? 0.45 : 0;
    if (crawl) lean = 1.15;
    if (this.type === 'beast') lean += 0.25;
    if (this.state === 'bash') lean = 0.25;
    if (this.state === 'leap') lean = 0.7;
    if (this.state === 'roar') lean = -0.3;
    ease(m.fall.rotation, 'x', lean, 6);
    if (crawl) { m.legL.rotation.x = -1.1 + s * 0.5; m.legR.rotation.x = -1.1 - s * 0.5; }
  }

  // A blade pass at `chest`. Returns {kind:'nape'|'limb'|'armor', ...} or null.
  tryCut(chest, speed, spin) {
    const nape = this.napeWorld(tmpA);
    const reachN = 2.4 + this.H * 0.06 + (spin ? 1.4 : 0);
    if (nape.distanceTo(chest) < reachN) {
      let dmg = Math.round((26 + speed * 2.8) * (spin ? 1.25 : 1));
      if (this.st.armor && !this.legsOut()) return { kind: 'armor' };
      if (this.st.armor) dmg = Math.round(dmg * 1.4);
      this.hp -= dmg;
      return { kind: 'nape', dmg, killed: this.hp <= 0 };
    }
    const m = this.m;
    const limbs = [[m.armL, m.armLen, 0, 'arm'], [m.armR, m.armLen, 1, 'arm'], [m.legL, m.legLen, 0, 'leg'], [m.legR, m.legLen, 1, 'leg']];
    for (const [limb, len, i, kind] of limbs) {
      if (kind === 'arm' && this.armOut[i] > 0) continue;
      this.limbSegment(limb, len, tmpB, tmpC);
      if (distToSegment(chest, tmpB, tmpC) < 0.6 * this.scale + 1.9 + (spin ? 1 : 0)) {
        if (this.dummy) return { kind: 'limb', part: kind };
        if (this.st.armor && kind === 'arm') return { kind: 'armor' };
        if (kind === 'arm') { this.armOut[i] = this.boss ? 6 : 10; }
        else { this.legOut[i] = this.boss ? 7 : 9; }
        return { kind: 'limb', part: kind, held: !!this.victim && this.attackArm === i };
      }
    }
    return null;
  }
  // A clean strike lands for this much nape damage.
  napeHit(dmg) {
    if (this.st.armor && !this.legsOut()) return { kind: 'armor' };
    this.hp -= dmg;
    return { kind: 'nape', dmg, killed: this.hp <= 0 };
  }

  kill() {
    this.state = 'dying'; this.timer = 0;
    this.m.glow.emissiveIntensity = 0.1;
    this.victim = null;
  }
  remove() {
    if (this.removed) return;
    this.removed = true;
    this.scene.remove(this.m.root);
    this.m.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  }
}

export function distToSegment(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / (abx * abx + aby * aby + abz * abz || 1)));
  return Math.hypot(a.x + abx * t - p.x, a.y + aby * t - p.y, a.z + abz * t - p.z);
}
