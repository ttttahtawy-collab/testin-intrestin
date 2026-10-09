// Player physics: running, the tether rig (two grappling anchors), gas, braking, impacts.
import * as THREE from 'three';
import { SX, SZ } from './world.js';
import { makePlayerModel } from './models.js';

export const P = {
  halfW: 0.3, height: 1.8, chest: 1.05,
  gravity: 22, runSpeed: 7.5, groundAccel: 45, jump: 8.5, airAccel: 11,
  hookRange: 90, hookSpeed: 260,
  pull: 19, reel: 48, boost: 27, drag: 0.0011,
  gasHook: 0.9, gasReel: 7, gasBoost: 9, gasBrake: 6,
  impactSafe: 24, impactMul: 2.4,
};

const tmp = new THREE.Vector3();

export class Hook {
  constructor(side) {
    this.side = side; // -1 left, +1 right
    this.state = 'idle'; // idle | flying | attached | retract
    this.tip = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.anchor = new THREE.Vector3();
    this.len = 0;
    this.obj = null; // attached Object3D (colossus part)
    this.local = new THREE.Vector3();
    this.owner = null; // colossus instance
    this.miss = false;
  }
  get attached() { return this.state === 'attached'; }
  updateAnchor() {
    if (this.obj) { this.anchor.copy(this.local); this.obj.localToWorld(this.anchor); }
  }
}

export class Player {
  constructor(world, scene) {
    this.world = world;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.onGround = false;
    this.hooks = [new Hook(-1), new Hook(1)];
    this.model = makePlayerModel();
    scene.add(this.model.root);
    this.events = []; // {type, ...} consumed by the game each frame
    this.reset({ x: 0, y: 0, z: 0, yaw: 0 });
  }
  reset(sp) {
    this.pos.set(sp.x, sp.y, sp.z);
    this.vel.set(0, 0, 0);
    this.yaw = sp.yaw || 0; this.pitch = -0.1;
    this.health = 100; this.gas = 100; this.sharp = 100; this.spares = 8;
    this.alive = true;
    this.slashT = 0; this.slashCD = 0; this.swapT = 0; this.spin = false;
    this.hurtT = 0; this.airTime = 0; this.boosting = false; this.reeling = false; this.braking = false;
    this.walkPhase = 0;
    for (const h of this.hooks) { h.state = 'idle'; h.obj = null; h.owner = null; }
  }
  chestPos(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + P.chest, this.pos.z); }
  hipPos(side, out = new THREE.Vector3()) {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    // right vector for yaw: (cos, 0, -sin)
    return out.set(this.pos.x + c * 0.35 * side, this.pos.y + 0.85, this.pos.z - s * 0.35 * side);
  }
  lookDir(out = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }
  speed() { return this.vel.length(); }
  anyAttached() { return this.hooks.some((h) => h.attached); }

  fireHook(i, aim) {
    const h = this.hooks[i];
    if (!this.alive) return;
    const origin = this.hipPos(h.side);
    h.tip.copy(origin);
    h.obj = null; h.owner = null;
    if (aim && aim.dist <= P.hookRange) {
      h.target.copy(aim.point);
      h.miss = false;
      if (aim.object) {
        h.obj = aim.object; h.owner = aim.owner;
        h.local.copy(aim.point); aim.object.worldToLocal(h.local);
      }
    } else {
      // shoot to max range and fall back
      const d = aim ? tmp.copy(aim.point).sub(origin).normalize() : this.lookDir(tmp);
      h.target.copy(origin).addScaledVector(d, P.hookRange);
      h.miss = true;
    }
    h.state = 'flying';
    this.events.push({ type: 'hookFire' });
  }
  releaseHook(i) {
    const h = this.hooks[i];
    if (h.state === 'idle') return;
    h.state = 'retract'; h.obj = null; h.owner = null;
  }
  detachFrom(owner) {
    this.hooks.forEach((h, i) => { if (h.owner === owner) this.releaseHook(i); });
  }

  damage(amount, cause) {
    if (!this.alive || amount <= 0) return;
    this.health -= amount;
    this.hurtT = 0.4;
    this.events.push({ type: 'hurt', amount, cause });
    if (this.health <= 0) {
      this.health = 0; this.alive = false;
      this.events.push({ type: 'death', cause });
      this.hooks.forEach((_, i) => this.releaseHook(i));
    }
  }

  // Move along one axis with voxel collision. Returns the speed of impact (0 if none).
  moveAxis(axis, amount) {
    if (amount === 0) return 0;
    const w = this.world, hw = P.halfW;
    const p = this.pos;
    const next = p.clone(); next[axis] += amount;
    const hit = w.boxHits(next.x - hw, next.y, next.z - hw, next.x + hw, next.y + P.height, next.z + hw);
    if (!hit) { p.copy(next); return 0; }
    // auto step-up onto single blocks while walking
    if (axis !== 'y' && this.onGround && Math.abs(this.vel.y) < 2) {
      const up = next.clone(); up.y += 1.02;
      if (!w.boxHits(up.x - hw, up.y, up.z - hw, up.x + hw, up.y + P.height, up.z + hw) &&
          !w.boxHits(p.x - hw, p.y + 1.02, p.z - hw, p.x + hw, p.y + 1.02 + P.height, p.z + hw)) {
        p.copy(up); return 0;
      }
    }
    // snap flush against the blocking face
    if (axis === 'y') {
      if (amount < 0) p.y = Math.floor(next.y) + 1; else p.y = Math.floor(next.y + P.height) - P.height - 1e-4;
    } else {
      const lo = axis === 'x' ? 'x' : 'z';
      if (amount > 0) p[lo] = Math.floor(next[lo] + hw) - hw - 1e-4;
      else p[lo] = Math.floor(next[lo] - hw) + 1 + hw + 1e-4;
    }
    const impact = Math.abs(this.vel[axis]);
    if (axis === 'y' && amount < 0) this.onGround = true;
    this.vel[axis] = 0;
    return impact;
  }

  step(dt, input) {
    if (!this.alive) {
      this.vel.y -= P.gravity * dt;
      this.vel.multiplyScalar(0.98);
      this.integrate(dt, false);
      return;
    }
    const gasOk = this.gas > 0;
    // wish direction from WASD relative to camera yaw
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let wx = 0, wz = 0;
    if (input.forward) { wx += fx; wz += fz; }
    if (input.back) { wx -= fx; wz -= fz; }
    if (input.right) { wx += rx; wz += rz; }
    if (input.left) { wx -= rx; wz -= rz; }
    const wl = Math.hypot(wx, wz);
    if (wl > 0) { wx /= wl; wz /= wl; }

    const attached = this.hooks.filter((h) => h.attached);
    if (this.onGround && attached.length === 0) {
      const tx = wx * P.runSpeed, tz = wz * P.runSpeed;
      const k = Math.min(1, P.groundAccel * dt / Math.max(1, Math.hypot(this.vel.x - tx, this.vel.z - tz)));
      this.vel.x += (tx - this.vel.x) * k;
      this.vel.z += (tz - this.vel.z) * k;
    } else {
      this.vel.x += wx * P.airAccel * dt;
      this.vel.z += wz * P.airAccel * dt;
    }
    if (input.jumpPressed && this.onGround) {
      this.vel.y = P.jump; this.onGround = false;
    }

    // hooks pull toward their anchors; shift reels in hard
    this.reeling = false;
    const chest = this.chestPos();
    for (const h of attached) {
      h.updateAnchor();
      const d = tmp.copy(h.anchor).sub(chest);
      const dist = d.length();
      if (dist < 1.2) continue;
      d.divideScalar(dist);
      if (gasOk) {
        const reel = input.reel;
        const a = reel ? P.reel : P.pull;
        this.vel.addScaledVector(d, a * dt);
        this.gas -= (reel ? P.gasReel : P.gasHook) * dt;
        if (reel) this.reeling = true;
      }
    }
    // gas boost in the air (space held), along the look direction
    this.boosting = false;
    if (input.boost && !this.onGround && gasOk) {
      const ld = this.lookDir(tmp);
      // blend with movement intent so you can boost sideways
      ld.x += wx * 0.6; ld.z += wz * 0.6; ld.normalize();
      this.vel.addScaledVector(ld, P.boost * dt);
      this.gas -= P.gasBoost * dt;
      this.boosting = true;
    }
    // landing thrusters / brake
    this.braking = false;
    if (input.brake && gasOk && this.speed() > 0.5) {
      this.vel.multiplyScalar(Math.exp(-2.8 * dt));
      if (this.vel.y < 0) this.vel.y *= Math.exp(-2.0 * dt);
      this.gas -= P.gasBrake * dt;
      this.braking = true;
    }
    this.gas = Math.max(0, this.gas);

    this.vel.y -= P.gravity * dt;
    const sp = this.speed();
    if (sp > 0) this.vel.multiplyScalar(Math.max(0, 1 - P.drag * sp * dt));
    this.integrate(dt, true);

    // inextensible ropes: shorten freely, never stretch
    for (const h of attached) {
      this.chestPos(chest);
      const d = tmp.copy(chest).sub(h.anchor);
      const dist = d.length();
      h.len = Math.min(h.len, dist);
      if (dist > h.len && dist > 0.001) {
        d.divideScalar(dist);
        const excess = dist - h.len;
        // pull back onto the rope sphere through the collision solver
        this.moveAxis('x', -d.x * excess);
        this.moveAxis('y', -d.y * excess);
        this.moveAxis('z', -d.z * excess);
        const vr = this.vel.dot(d);
        if (vr > 0) this.vel.addScaledVector(d, -vr);
      }
    }

    if (this.onGround) this.airTime = 0; else this.airTime += dt;
  }

  integrate(dt, hurtOnImpact) {
    const v = this.vel;
    const wasGround = this.onGround;
    this.onGround = false;
    const ix = this.moveAxis('x', v.x * dt);
    const iz = this.moveAxis('z', v.z * dt);
    const iy = this.moveAxis('y', v.y * dt);
    // keep standing when walking along flat ground
    if (!this.onGround && wasGround && v.y <= 0) {
      const hw = P.halfW, p = this.pos;
      if (this.world.boxHits(p.x - hw, p.y - 0.08, p.z - hw, p.x + hw, p.y, p.z + hw)) this.onGround = true;
    }
    const impact = Math.max(ix, iz, iy);
    if (hurtOnImpact && impact > P.impactSafe) {
      this.damage((impact - P.impactSafe) * P.impactMul, iy >= Math.max(ix, iz) ? 'fall' : 'wall');
      this.events.push({ type: 'impact', speed: impact });
    }
    // world bounds
    this.pos.x = Math.max(1, Math.min(SX - 1, this.pos.x));
    this.pos.z = Math.max(1, Math.min(SZ - 1, this.pos.z));
    if (this.pos.y < -10) { this.damage(999, 'void'); this.pos.y = 30; }
  }

  // Animate hooks travelling out and back.
  updateHooks(dt) {
    for (const h of this.hooks) {
      const hip = this.hipPos(h.side);
      if (h.state === 'flying') {
        if (h.obj) { h.target.copy(h.local); h.obj.localToWorld(h.target); }
        const d = tmp.copy(h.target).sub(h.tip);
        const step = P.hookSpeed * dt;
        if (d.length() <= step) {
          h.tip.copy(h.target);
          if (h.miss) { h.state = 'retract'; }
          else {
            h.state = 'attached';
            h.anchor.copy(h.target);
            h.len = this.chestPos().distanceTo(h.anchor);
            this.events.push({ type: 'hookHit' });
          }
        } else h.tip.addScaledVector(d.normalize(), step);
      } else if (h.state === 'attached') {
        h.updateAnchor();
        h.tip.copy(h.anchor);
      } else if (h.state === 'retract') {
        const d = tmp.copy(hip).sub(h.tip);
        const step = P.hookSpeed * 1.3 * dt;
        if (d.length() <= step) h.state = 'idle';
        else h.tip.addScaledVector(d.normalize(), step);
      }
    }
  }

  // Blocky pose animation.
  animate(dt, firstPerson) {
    const m = this.model;
    m.root.visible = !firstPerson;
    m.root.position.copy(this.pos);
    const sp = Math.hypot(this.vel.x, this.vel.z);
    // face the movement direction in the air, the camera on the ground
    let face = this.yaw + Math.PI;
    if (!this.onGround && sp > 4) face = Math.atan2(this.vel.x, this.vel.z);
    const cur = m.root.rotation.y;
    let diff = ((face - cur + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    m.root.rotation.y = cur + diff * Math.min(1, dt * 10);

    if (this.onGround) {
      this.walkPhase += dt * sp * 1.6;
      const s = Math.sin(this.walkPhase) * Math.min(1, sp / 6) * 0.9;
      m.legL.rotation.x = s; m.legR.rotation.x = -s;
      m.armL.rotation.x = -s * 0.8; m.armR.rotation.x = s * 0.8;
      m.armL.rotation.z = 0; m.armR.rotation.z = 0;
    } else {
      // flying pose: legs trailing, arms out holding blades
      const lean = Math.min(1, this.speed() / 30);
      m.legL.rotation.x = 0.5 + lean * 0.4; m.legR.rotation.x = 0.3 + lean * 0.4;
      m.armL.rotation.x = -0.9; m.armR.rotation.x = -0.9;
      m.armL.rotation.z = -0.35; m.armR.rotation.z = 0.35;
    }
    if (this.slashT > 0) {
      const k = 1 - this.slashT / 0.32;
      const a = -2.4 + k * 3.2;
      m.armL.rotation.x = a; m.armR.rotation.x = a;
    }
    if (this.swapT > 0) { m.armL.rotation.x = 0.6; m.armR.rotation.x = 0.6; }
    m.spin.rotation.y = this.spin && this.slashT > 0 ? (1 - this.slashT / 0.32) * Math.PI * 2 : 0;
    m.head.rotation.x = -this.pitch * 0.4;
    const bladeVisible = this.sharp > 0 && this.swapT <= 0;
    m.armL.userData.blade.visible = bladeVisible; m.armR.userData.blade.visible = bladeVisible;
  }
}
