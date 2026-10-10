// Player physics: running, the tether rig (two grappling anchors), gas, braking, impacts.
import * as THREE from 'three';
import { SX, SZ } from './world.js';
import { makePlayerModel } from './models.js';

export const P = {
  halfW: 0.3, height: 1.8, chest: 1.05,
  gravity: 22, runSpeed: 7.5, groundAccel: 45, jump: 8.5, airAccel: 11,
  hookRange: 95, hookSpeed: 300,
  pull: 19, reel: 48, boost: 27, drag: 0.0011,
  // gas use per second (the tank holds 100 units, upgrades make it bigger)
  gasHook: 0.22, gasReel: 2.2, gasBoost: 3.0, gasBrake: 1.6, gasStrike: 7,
  impactSafe: 33, impactMul: 1.6,
  strikeSpeed: 52,
};

// Upgradable stats; main.js applies the bought levels.
export const STATS = { gasMax: 100, spareMax: 8, healthMax: 100, bladeWear: 1, motor: 1, rangeBonus: 0 };

const tmp = new THREE.Vector3();

export class Hook {
  constructor(side) {
    this.side = side; // -1 left, +1 right
    this.state = 'idle'; // idle | flying | attached | retract
    this.tip = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.anchor = new THREE.Vector3();
    this.len = 0;
    this.obj = null; // attached Object3D (titan part)
    this.local = new THREE.Vector3();
    this.owner = null; // titan instance
    this.vox = null; // [x, y, z] of the block it bit into
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
    this.kind = 'player';
    this.reset({ x: 0, y: 0, z: 0, yaw: 0 });
  }
  reset(sp) {
    this.pos.set(sp.x, sp.y, sp.z);
    this.vel.set(0, 0, 0);
    this.yaw = sp.yaw || 0; this.pitch = -0.1;
    this.health = STATS.healthMax; this.gas = STATS.gasMax; this.sharp = 100; this.spares = STATS.spareMax;
    this.alive = true;
    this.strike = null; // {titan, t} while dashing at a nape
    this.grabbed = null; // {titan, presses, need} while held in a titan's fist
    this.assist = true;
    this.slashT = 0; this.slashCD = 0; this.swapT = 0; this.spin = false;
    this.hurtT = 0; this.airTime = 0; this.boosting = false; this.reeling = false; this.braking = false;
    this.walkPhase = 0; this.animT = 0; this.landT = 0; this.landHard = 0;
    this._ropeDir = new THREE.Vector3(); this._tmp2 = new THREE.Vector3();
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
    h.vox = null;
    const range = P.hookRange + STATS.rangeBonus;
    if (aim && aim.dist <= range) {
      h.target.copy(aim.point);
      h.miss = false;
      if (aim.vox) h.vox = aim.vox;
      if (aim.object) {
        h.obj = aim.object; h.owner = aim.owner;
        h.local.copy(aim.point); aim.object.worldToLocal(h.local);
      }
    } else {
      // shoot to max range and fall back
      const d = aim ? tmp.copy(aim.point).sub(origin).normalize() : this.lookDir(tmp);
      h.target.copy(origin).addScaledVector(d, range);
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
      if (this.grabbed) return;
      this.vel.y -= P.gravity * dt;
      this.vel.multiplyScalar(0.98);
      this.integrate(dt, false);
      return;
    }
    if (this.grabbed) { this.vel.set(0, 0, 0); return; } // the titan's hand carries us
    if (this.strike) { this.stepStrike(dt); return; }
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
        const a = (reel ? P.reel : P.pull) * STATS.motor;
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
    if (this.assist && !this.onGround) this.glide(dt, input);
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

  // Movement assist: glance off walls and trunks instead of smashing into them, and fire
  // the landing thrusters automatically when about to hit the ground too fast.
  glide(dt, input) {
    const v = this.vel, sp = v.length();
    if (sp < 14) return;
    const c = this.chestPos(this._tmp2);
    const look = Math.min(14, sp * 0.32);
    const hit = this.world.raycast(c.x, c.y, c.z, v.x, v.y, v.z, look);
    if (hit) {
      const n = hit.normal;
      const into = v.x * n[0] + v.y * n[1] + v.z * n[2];
      if (into < 0) {
        const floor = n[1] > 0.5;
        if (floor) {
          // ground ahead: soften the drop
          if (-v.y > P.impactSafe * 0.6 && this.gas > 0) {
            v.y *= Math.exp(-6 * dt);
            v.x *= Math.exp(-1.2 * dt); v.z *= Math.exp(-1.2 * dt);
            this.gas = Math.max(0, this.gas - P.gasBrake * dt);
            this.braking = true;
          }
        } else if (!input.reel) {
          // wall ahead: strip the part of our speed that points into it, keep the rest
          const k = Math.min(1, dt * (hit.dist < 4 ? 14 : 7));
          v.x -= n[0] * into * k; v.y -= n[1] * into * k; v.z -= n[2] * into * k;
          v.x += n[0] * 3 * dt; v.z += n[2] * 3 * dt;
        }
      }
    }
  }

  // Nape strike: a straight, gas-fed dash to a point just behind the titan's neck.
  stepStrike(dt) {
    const s = this.strike;
    s.t += dt;
    const target = s.titan.strikePoint(tmp);
    const c = this.chestPos(this._tmp2);
    const d = target.sub(c);
    const dist = d.length();
    if (!s.titan.alive || s.t > 1.8) { this.strike = null; this.events.push({ type: 'strikeAbort' }); return; }
    if (dist < 1.6) { this.strike = null; this.events.push({ type: 'strikeArrive', titan: s.titan, speed: Math.max(this.speed(), 30) }); return; }
    const want = Math.max(P.strikeSpeed, s.v0) * STATS.motor;
    d.divideScalar(dist).multiplyScalar(Math.min(want, dist / dt * 0.9));
    this.vel.lerp(d, Math.min(1, dt * 14));
    this.gas = Math.max(0, this.gas - P.gasStrike * dt);
    this.boosting = true;
    this.onGround = false;
    // pass through foliage, stop at real walls
    const ix = this.moveAxis('x', this.vel.x * dt), iz = this.moveAxis('z', this.vel.z * dt), iy = this.moveAxis('y', this.vel.y * dt);
    if (Math.max(ix, iz, iy) > 0) { this.strike = null; this.events.push({ type: 'strikeAbort' }); }
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
    if (!wasGround && this.onGround && iy > 5) {
      this.landT = 0.35; this.landHard = Math.min(1, iy / 16);
      this.events.push({ type: 'land', speed: iy });
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
          if (h.miss || (h.owner && !h.owner.alive)) { h.state = 'retract'; h.obj = null; h.owner = null; }
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
        // the block it bit into was smashed
        if (h.vox && this.world.get(h.vox[0], h.vox[1], h.vox[2]) === 0) { h.state = 'retract'; h.vox = null; }
      } else if (h.state === 'retract') {
        const d = tmp.copy(hip).sub(h.tip);
        const step = P.hookSpeed * 1.3 * dt;
        if (d.length() <= step) h.state = 'idle';
        else h.tip.addScaledVector(d.normalize(), step);
      }
    }
  }

  // ---------------- animation ----------------
  // Each frame builds a target pose from the movement state, then eases the rig toward it.
  animate(dt, firstPerson, scene) {
    const m = this.model;
    m.root.visible = !firstPerson;
    m.root.position.copy(this.pos);
    this.animT += dt;
    this.landT = Math.max(0, this.landT - dt);
    const v = this.vel;
    const hsp = Math.hypot(v.x, v.z);
    const attached = this.hooks.filter((h) => h.attached);

    // heading: movement direction when running or flying fast, else the camera
    let face = this.yaw + Math.PI;
    if (hsp > (this.onGround ? 1 : 4)) face = Math.atan2(v.x, v.z);
    const cur = m.root.rotation.y;
    const diff = ((face - cur + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    m.root.rotation.y = cur + diff * Math.min(1, dt * (this.onGround ? 12 : 6));
    const ry = m.root.rotation.y;

    const T = {
      hipsY: 0.92, tiltX: 0, tiltZ: 0, torsoX: 0, torsoY: 0, headX: 0,
      lHip: 0, lHipZ: 0, lKnee: 0, rHip: 0, rHipZ: 0, rKnee: 0,
      lSh: 0, lShZ: 0.08, lEl: -0.15, rSh: 0, rShZ: -0.08, rEl: -0.15,
    };
    const t = this.animT;
    if (this.grabbed) {
      const w = t * 14;
      T.hipsY = 0.9; T.lSh = -2.6 + Math.sin(w) * 0.5; T.rSh = -2.6 + Math.sin(w + 1) * 0.5; T.lShZ = 0.5; T.rShZ = -0.5;
      T.lHip = Math.sin(w) * 0.8; T.rHip = -Math.sin(w) * 0.8; T.lKnee = T.rKnee = 0.6; T.headX = -0.4;
    } else if (!this.alive) {
      T.hipsY = 0.18; T.tiltX = -1.5; T.lShZ = 1.3; T.rShZ = -1.3; T.lHip = -0.2; T.rHip = 0.15; T.lKnee = 0.3;
    } else if (this.onGround) {
      if (this.landT > 0) {
        const c = this.landT / 0.35 * this.landHard;
        T.hipsY = 0.92 - 0.3 * c; T.lHip = T.rHip = -1.0 * c; T.lKnee = T.rKnee = 1.7 * c;
        T.torsoX = 0.55 * c; T.tiltX = 0.15 * c; T.lSh = T.rSh = -0.7 * c; T.lShZ = 0.6 * c; T.rShZ = -0.6 * c;
      } else if (hsp > 0.6) {
        this.walkPhase += dt * hsp * 1.35;
        const ph = this.walkPhase, s = Math.sin(ph), amp = Math.min(1, hsp / 7);
        T.lHip = s * 0.85 * amp; T.rHip = -s * 0.85 * amp;
        T.lKnee = amp * (0.15 + 1.1 * Math.max(0, Math.sin(ph - 1.4)));
        T.rKnee = amp * (0.15 + 1.1 * Math.max(0, Math.sin(ph + Math.PI - 1.4)));
        T.lSh = -s * 0.75 * amp; T.rSh = s * 0.75 * amp;
        T.lEl = T.rEl = -0.5 - 0.4 * amp;
        T.torsoX = 0.18 * amp; T.torsoY = -s * 0.12 * amp;
        T.hipsY = 0.92 - Math.abs(Math.cos(ph)) * 0.06 * amp;
      } else {
        const b = Math.sin(t * 2.2);
        T.torsoX = b * 0.025; T.headX = -b * 0.02; T.lShZ = 0.12 + b * 0.02; T.rShZ = -0.12 - b * 0.02;
        T.lEl = T.rEl = -0.25; T.lHipZ = 0.05; T.rHipZ = -0.05;
      }
    } else {
      const lean = Math.min(1, this.speed() / 35);
      if (this.braking) {
        // landing thrusters: upright, legs forward, arms out for balance
        T.tiltX = -0.4; T.lHip = T.rHip = -0.8; T.lKnee = T.rKnee = 0.7;
        T.lShZ = 1.2; T.rShZ = -1.2; T.lSh = T.rSh = -0.3; T.lEl = T.rEl = -0.4;
        T.headX = 0.3;
      } else if (this.boosting && !attached.length) {
        // flying dive along the boost
        T.tiltX = 0.9 + lean * 0.5; T.lHip = 0.15; T.rHip = 0.3; T.lKnee = 0.25; T.rKnee = 0.5;
        T.lSh = T.rSh = 0.6; T.lShZ = 0.35; T.rShZ = -0.35; T.lEl = T.rEl = -0.2; T.headX = -0.7;
      } else if (attached.length) {
        // hang from the rope: lean toward the anchor, legs tucked and trailing
        const a = this._ropeDir.set(0, 0, 0);
        for (const h of attached) a.add(h.anchor);
        a.divideScalar(attached.length).sub(this.chestPos(this._tmp2)).normalize();
        const lx = a.x * Math.cos(ry) - a.z * Math.sin(ry);
        const lz = a.x * Math.sin(ry) + a.z * Math.cos(ry);
        T.tiltX = clamp(Math.atan2(lz, Math.max(0.05, a.y)), -1.1, 1.3);
        T.tiltZ = clamp(-Math.atan2(lx, Math.max(0.05, a.y)), -1.0, 1.0);
        const kick = Math.sin(t * 3) * 0.15;
        T.lHip = -0.5 + kick; T.rHip = -0.25 - kick; T.lKnee = 1.0; T.rKnee = 0.7;
        T.lSh = T.rSh = -1.1; T.lShZ = 0.6; T.rShZ = -0.6; T.lEl = T.rEl = -0.5;
        if (this.reeling) { T.lHip = T.rHip = -1.1; T.lKnee = T.rKnee = 1.6; }
      } else if (v.y < -4) {
        // falling: flail, harder the faster we drop
        const f = Math.min(1, (-v.y - 4) / 22);
        const w = t * (8 + f * 8);
        T.tiltX = -0.25 * f + lean * 0.2;
        T.lSh = -2.3 + Math.sin(w) * 0.6 * f; T.rSh = -2.3 + Math.sin(w + 2) * 0.6 * f;
        T.lShZ = 0.6 + Math.sin(w * 0.7) * 0.4; T.rShZ = -0.6 - Math.sin(w * 0.7 + 1) * 0.4;
        T.lEl = T.rEl = -0.4;
        T.lHip = -0.4 + Math.sin(w) * 0.7 * f; T.rHip = -0.4 + Math.sin(w + Math.PI) * 0.7 * f;
        T.lKnee = 0.6 + Math.max(0, Math.sin(w)) * 0.8; T.rKnee = 0.6 + Math.max(0, Math.sin(w + Math.PI)) * 0.8;
        T.headX = 0.35 * f;
      } else {
        // rising / apex: tucked, arms spread
        T.tiltX = lean * 0.4; T.lHip = T.rHip = -0.7; T.lKnee = T.rKnee = 1.2;
        T.lSh = T.rSh = -0.5; T.lShZ = 1.0; T.rShZ = -1.0; T.lEl = T.rEl = -0.6;
      }
    }
    if (this.slashT > 0) {
      const k = 1 - this.slashT / 0.32;
      const a = -2.9 + k * 3.7;
      T.lSh = T.rSh = a; T.lShZ = 0.7 - k * 1.1; T.rShZ = -0.7 + k * 1.1;
      T.lEl = T.rEl = -0.15; T.torsoX += 0.35 * k; T.torsoY = (k - 0.5) * 0.6;
    }
    if (this.swapT > 0) { T.lSh = T.rSh = 0.35; T.lEl = T.rEl = -1.5; T.lShZ = 0.3; T.rShZ = -0.3; T.headX = 0.4; }
    if (this.hurtT > 0) { T.torsoX -= this.hurtT * 1.2; T.headX -= this.hurtT; }

    // ease toward the pose
    const k = 1 - Math.exp(-dt * (this.onGround ? 16 : 10));
    const L = (o, key, val) => { o[key] += (val - o[key]) * k; };
    L(m.hips.position, 'y', T.hipsY);
    L(m.hips.rotation, 'x', T.tiltX); L(m.hips.rotation, 'z', T.tiltZ);
    L(m.torso.rotation, 'x', T.torsoX); L(m.torso.rotation, 'y', T.torsoY);
    L(m.head.rotation, 'x', T.headX - this.pitch * 0.35);
    L(m.legL.hip.rotation, 'x', T.lHip); L(m.legL.hip.rotation, 'z', T.lHipZ); L(m.legL.knee.rotation, 'x', T.lKnee);
    L(m.legR.hip.rotation, 'x', T.rHip); L(m.legR.hip.rotation, 'z', T.rHipZ); L(m.legR.knee.rotation, 'x', T.rKnee);
    L(m.armL.sh.rotation, 'x', T.lSh); L(m.armL.sh.rotation, 'z', T.lShZ); L(m.armL.elbow.rotation, 'x', T.lEl);
    L(m.armR.sh.rotation, 'x', T.rSh); L(m.armR.sh.rotation, 'z', T.rShZ); L(m.armR.elbow.rotation, 'x', T.rEl);

    // the arm on each attached rope reaches toward its anchor
    if (this.alive && !this.onGround && this.slashT <= 0) {
      m.root.updateMatrixWorld(true);
      for (const h of this.hooks) {
        if (h.state !== 'attached' && h.state !== 'flying') continue;
        const arm = h.side < 0 ? m.armL : m.armR;
        const d = this._tmp2.copy(h.tip);
        m.torso.worldToLocal(d).sub(arm.sh.position).normalize();
        const ax = Math.atan2(-d.z, -d.y), az = Math.asin(clamp(d.x, -1, 1));
        arm.sh.rotation.x += (ax - arm.sh.rotation.x) * k * 1.5;
        arm.sh.rotation.z += (az - arm.sh.rotation.z) * k * 1.5;
        arm.elbow.rotation.x += (0 - arm.elbow.rotation.x) * k;
      }
    }
    m.hips.rotation.y = this.spin && this.slashT > 0 ? (1 - this.slashT / 0.32) * Math.PI * 2 : 0;
    const bladeVisible = this.sharp > 0 && this.swapT <= 0;
    m.armL.blade.visible = bladeVisible; m.armR.blade.visible = bladeVisible;
    this.updateScarf(dt, scene, firstPerson);
  }

  // Verlet scarf tail hanging from the back of the neck.
  updateScarf(dt, scene, hidden) {
    const N = 6, SEG = 0.13;
    const anchor = this.model.scarfAnchor.getWorldPosition(this._tmp2);
    if (!this.scarf) {
      this.scarf = { p: [], q: [], meshes: [] };
      const geo = new THREE.BoxGeometry(0.11, 0.025, SEG);
      geo.translate(0, 0, SEG / 2);
      for (let i = 0; i < N; i++) {
        this.scarf.p.push(anchor.clone()); this.scarf.q.push(anchor.clone());
        if (i < N - 1) { const mesh = new THREE.Mesh(geo, this.model.scarfMat); scene.add(mesh); this.scarf.meshes.push(mesh); }
      }
    }
    const { p, q, meshes } = this.scarf;
    if (p[0].distanceTo(anchor) > 5) for (let i = 0; i < N; i++) { p[i].copy(anchor); q[i].copy(anchor); }
    const h = Math.min(dt, 1 / 30);
    for (let i = 1; i < N; i++) {
      const vx = p[i].x - q[i].x, vy = p[i].y - q[i].y, vz = p[i].z - q[i].z;
      q[i].copy(p[i]);
      // air drag pulls each node toward rest; a little flutter noise
      const fl = Math.sin(this.animT * 23 + i * 1.7) * 0.004 * Math.min(1, this.speed() / 10);
      p[i].x += vx * 0.9 + fl; p[i].y += vy * 0.9 - 9 * h * h; p[i].z += vz * 0.9 - fl;
    }
    for (let it = 0; it < 4; it++) {
      p[0].copy(anchor);
      for (let i = 1; i < N; i++) {
        const a = p[i - 1], b = p[i];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const d = Math.hypot(dx, dy, dz) || 1e-4;
        const s = (d - SEG) / d;
        if (i === 1) { b.x -= dx * s; b.y -= dy * s; b.z -= dz * s; }
        else { a.x += dx * s * 0.5; a.y += dy * s * 0.5; a.z += dz * s * 0.5; b.x -= dx * s * 0.5; b.y -= dy * s * 0.5; b.z -= dz * s * 0.5; }
      }
    }
    for (let i = 0; i < N - 1; i++) {
      const mesh = meshes[i];
      mesh.visible = !hidden;
      mesh.position.copy(p[i]);
      mesh.lookAt(p[i + 1]);
    }
  }
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
