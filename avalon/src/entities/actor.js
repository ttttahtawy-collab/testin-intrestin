// Actors: NPCs, enemies, wildlife. Handles AI, movement, combat and animation.
import * as THREE from 'three';
import { ACTORS, HOSTILE_FACTIONS } from '../game/actors.js';
import { buildHumanoid, buildAnimal, setHeld, animate } from './models.js';
import { moveEntity } from './physics.js';
import { findPath } from './pathfind.js';
import { B, SOLID } from '../world/blocks.js';
import { rng } from '../core/noise.js';

let NEXT_ID = 1;
const tmp = new THREE.Vector3();
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
export const yawTo = (dx, dz) => Math.atan2(-dx, -dz);

export class Actor {
  constructor(game, o) {
    this.game = game;
    this.id = NEXT_ID++;
    this.type = o.type;
    this.npc = o.npc || null;
    const def = this.npc ? { ...ACTORS.guard, ai: 'npc', faction: 'villager', name: o.npc.name, hp: 100, ...(o.npc.combat || {}) } : ACTORS[o.type];
    this.def = def;
    this.name = this.npc ? o.npc.name : def.name;
    this.title = this.npc ? o.npc.title : null;
    this.faction = def.faction;
    this.ai = this.npc && this.npc.ai ? this.npc.ai : def.ai;
    this.pos = new THREE.Vector3(o.x, o.y, o.z);
    this.vel = new THREE.Vector3();
    this.yaw = o.yaw ?? Math.random() * 6.28;
    this.radius = def.radius || 0.4;
    this.height = def.height || 3.5;
    this.stepUp = true;
    this.maxHp = def.hp; this.hp = this.maxHp;
    this.maxPoise = def.poise || 30; this.poise = this.maxPoise;
    this.alive = true;
    this.home = { x: o.x, y: o.y, z: o.z };
    this.group = o.group || null;
    this.spawnId = o.spawnId ?? null;
    this.unique = o.unique || def.unique || null;
    this.state = 'idle'; this.stateT = 0;
    this.aggro = false; this.target = null;
    this.cool = Math.random(); this.attack = null; this.attackT = 0; this.hitDone = false; this.comboLeft = 0;
    this.path = null; this.pathI = 0; this.repath = 0; this.stuckT = 0; this.lastPos = this.pos.clone();
    this.wanderT = Math.random() * 3; this.wanderTo = null;
    this.r = rng(this.id * 7919 + (o.seed || 0));
    this.st = { speed: 0, phase: 0, attack: -1, attackType: 'swing', block: false, hurt: 0, dead: false, deadT: 0, time: Math.random() * 10, look: 0, headYaw: 0 };
    this.barkT = 3 + Math.random() * 10;
    this.loot = null;
    this.deadT = 0;
    this.blocking = 0;
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.essential = this.npc ? true : false;
    this.flags = {};
    // model
    const model = def.model || 'human';
    if (model === 'human' || this.npc) {
      const app = this.npc ? this.npc.app : (def.apps ? def.apps[Math.floor(this.r() * def.apps.length)] : {});
      const fullApp = { ...app, scale: app.scale || def.scale || 1, quiver: def.quiver };
      this.rig = buildHumanoid(fullApp);
      const wpn = this.npc ? this.npc.weapon : def.weapon;
      if (wpn) setHeld(this.rig, wpn, 'R');
      const sh = this.npc ? this.npc.offhand : def.shield;
      if (sh) setHeld(this.rig, sh, 'L');
      this.height = (def.height || 3.5) * (fullApp.scale || 1) / (def.scale && !this.npc ? def.scale : 1);
      if (fullApp.scale) this.height = 3.5 * fullApp.scale;
    } else {
      this.rig = buildAnimal(model);
    }
    this.rig.root.userData.actor = this;
    game.scene.add(this.rig.root);
    if (this.ai === 'bird' || this.ai === 'duck') this.stepUp = true;
    this.speedMul = 1;
  }

  get isHostile() { return HOSTILE_FACTIONS.has(this.faction) && !this.flags.pacified; }
  get center() { return tmp.set(this.pos.x, this.pos.y + this.height * 0.6, this.pos.z); }
  dist2D(p) { return Math.hypot(p.x - this.pos.x, p.z - this.pos.z); }

  remove() {
    this.game.scene.remove(this.rig.root);
    this.removed = true;
  }

  // -------------------- movement helpers --------------------
  faceTo(x, z, dt, rate = 8) {
    const ty = yawTo(x - this.pos.x, z - this.pos.z);
    const d = angDiff(this.yaw, ty);
    this.yaw += Math.max(-rate * dt, Math.min(rate * dt, d));
    return Math.abs(d);
  }
  steer(tx, tz, speed, dt, face = true) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) { this.brake(dt); return d; }
    const vx = (dx / d) * speed, vz = (dz / d) * speed;
    const k = Math.min(1, dt * 8);
    this.vel.x += (vx - this.vel.x) * k;
    this.vel.z += (vz - this.vel.z) * k;
    if (face) this.faceTo(tx, tz, dt);
    // jump small ledges if blocked
    if (this.hitWall && this.onGround && this.stepUp && this.ai !== 'bird') {
      const fx = Math.floor(this.pos.x + (dx / d) * (this.radius + 0.6)), fz = Math.floor(this.pos.z + (dz / d) * (this.radius + 0.6));
      const fy = Math.floor(this.pos.y);
      if (SOLID[this.game.world.get(fx, fy + 1, fz)] && !SOLID[this.game.world.get(fx, fy + 2, fz)] && !SOLID[this.game.world.get(fx, fy + 3, fz)]) this.vel.y = 14;
    }
    return d;
  }
  brake(dt) { const k = Math.min(1, dt * 10); this.vel.x -= this.vel.x * k; this.vel.z -= this.vel.z * k; }

  // goto with pathfinding fallback
  goTo(tx, ty, tz, speed, dt, arrive = 0.8) {
    const d = Math.hypot(tx - this.pos.x, tz - this.pos.z);
    if (d < arrive) { this.brake(dt); this.path = null; return true; }
    this.repath -= dt;
    const needPath = (!this.path && (this.stuckT > 0.8 || this.usePaths)) || (this.path && this.repath <= 0 && this.ai !== 'npc');
    if (needPath && this.repath <= 0) {
      const res = findPath(this.game.world, this.pos.x, this.pos.y, this.pos.z, tx, ty, tz, this.ai === 'npc' ? 6000 : 1500, Math.ceil(this.height));
      this.path = res && res.path.length > 1 ? res.path : null;
      this.pathI = 1; this.repath = this.ai === 'npc' ? 6 : 1.5; this.stuckT = 0;
      this.pathTarget = { x: tx, z: tz };
    }
    if (this.path && this.pathTarget && Math.hypot(this.pathTarget.x - tx, this.pathTarget.z - tz) > 4) { this.path = null; }
    if (this.path) {
      const p = this.path[this.pathI];
      if (!p) { this.path = null; return false; }
      this.steer(p.x, p.z, speed, dt);
      if (Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 0.7) { this.pathI++; if (this.pathI >= this.path.length) this.path = null; }
    } else this.steer(tx, tz, speed, dt);
    return false;
  }

  trackStuck(dt, wantsMove) {
    const moved = Math.hypot(this.pos.x - this.lastPos.x, this.pos.z - this.lastPos.z);
    if (wantsMove && moved < 0.6 * dt * 4) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt * 2);
    this.lastPos.copy(this.pos);
  }

  // -------------------- perception --------------------
  canSee(p, range) {
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > range) return false;
    const ang = Math.abs(angDiff(this.yaw, yawTo(dx, dz)));
    const near = d < 6;
    if (!near && ang > 1.25) return false;
    const w = this.game.world;
    return w.lineOfSight(this.pos.x, this.pos.y + this.height * 0.85, this.pos.z, p.pos.x, p.pos.y + (p.height || 3) * 0.85, p.pos.z);
  }

  becomeAggro(target, propagate = true) {
    if (!this.alive) return;
    if (!this.aggro) {
      this.aggro = true;
      this.state = 'alert'; this.stateT = this.def.boss ? 0.2 : 0.5;
      this.game.onAggro && this.game.onAggro(this);
      if (this.def.barks) this.game.bark(this, 'aggro');
      this.game.audio && this.game.audio.creature(this.def.sounds || 'human', 'alert', this.pos);
    }
    this.target = target;
    if (propagate) {
      for (const a of this.game.actors) {
        if (a === this || !a.alive || a.aggro || a.faction !== this.faction) continue;
        const d = a.dist2D(this.pos);
        if (d < 22 || (this.group && a.group === this.group && d < 60)) a.becomeAggro(target, false);
      }
    }
  }

  // -------------------- damage --------------------
  takeDamage(amount, src, o = {}) {
    if (!this.alive) return 0;
    if (this.essential || this.flags.invulnerable) {
      if (src && src.isPlayer && this.npc) this.game.bark(this, 'hit');
      return 0;
    }
    let dmg = amount;
    const armor = this.def.armor || 0;
    dmg *= 100 / (100 + armor * 4);
    // blocking
    if (this.blocking > 0 && src && !o.bow) {
      const toSrc = yawTo(src.pos.x - this.pos.x, src.pos.z - this.pos.z);
      if (Math.abs(angDiff(this.yaw, toSrc)) < 1.2) {
        if (o.heavy) {
          this.blocking = 0; this.stagger(1.1);
          this.game.fx.sparks(this.center, 14);
          this.game.audio && this.game.audio.clang(this.pos, 0.8);
          dmg *= 0.5;
        } else {
          this.game.fx.sparks(this.center, 8);
          this.game.audio && this.game.audio.clang(this.pos, 1);
          this.poise -= dmg * 0.4;
          if (src.isPlayer) src.onBlocked && src.onBlocked();
          return 0;
        }
      }
    }
    dmg = Math.max(1, Math.round(dmg));
    this.hp -= dmg;
    this.st.hurt = 1;
    this.lastHitBy = src;
    // poise
    this.poise -= dmg * (o.stagger || 1) * (o.heavy ? 1.8 : 1);
    if (this.poise <= 0 && this.alive) { this.stagger(this.def.boss ? 0.9 : 0.7); this.poise = this.maxPoise; }
    // knockback
    if (src && !this.def.boss) {
      const dx = this.pos.x - src.pos.x, dz = this.pos.z - src.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const kb = (o.heavy ? 9 : 5) * (this.height < 2 ? 1.6 : 1);
      this.vel.x += (dx / d) * kb; this.vel.z += (dz / d) * kb;
    }
    this.game.fx.blood(this.center, Math.min(16, 4 + dmg / 2), this.def.model && this.def.model !== 'human' ? 0x6a1010 : 0x7a1010);
    this.game.audio && this.game.audio.creature(this.def.sounds || 'human', 'hurt', this.pos);
    if (this.hp <= 0) { this.die(src); return dmg; }
    if (src && (this.ai === 'melee' || this.ai === 'archer' || this.ai === 'guard')) this.becomeAggro(src);
    if (this.ai === 'prey' || this.ai === 'livestock' || this.ai === 'bird' || this.ai === 'duck' || this.ai === 'pet') { this.state = 'flee'; this.stateT = 4 + this.r() * 3; this.fleeFrom = src ? src.pos.clone() : this.pos.clone(); if (this.ai === 'bird') this.takeOff(); }
    if (this.def.territorial && src) this.becomeAggro(src);
    return dmg;
  }

  stagger(t) {
    this.state = 'stagger'; this.stateT = t; this.attack = null; this.st.attack = -1; this.blocking = 0;
    this.game.audio && this.game.audio.creature(this.def.sounds || 'human', 'hurt', this.pos);
  }

  die(src) {
    this.alive = false; this.hp = 0; this.state = 'dead'; this.st.dead = true; this.st.deadT = 0; this.st.attack = -1;
    this.vel.x *= 0.3; this.vel.z *= 0.3;
    this.game.onActorDeath(this, src);
  }

  // -------------------- update --------------------
  update(dt, full = true) {
    const st = this.st;
    st.time += dt;
    if (st.hurt > 0) st.hurt = Math.max(0, st.hurt - dt * 4);
    if (!this.alive) {
      st.deadT += dt; this.deadT += dt;
      this.brake(dt);
      if (this.ai !== 'bird' || true) moveEntity(this.game.world, this, dt);
      this.syncRig(dt);
      return;
    }
    if (full) {
      switch (this.ai) {
        case 'melee': this.aiMelee(dt); break;
        case 'archer': this.aiArcher(dt); break;
        case 'guard': this.aiGuard(dt); break;
        case 'npc': this.aiNpc(dt); break;
        case 'prey': this.aiPrey(dt); break;
        case 'livestock': this.aiLivestock(dt); break;
        case 'bird': this.aiBird(dt); break;
        case 'duck': this.aiDuck(dt); break;
        case 'pet': this.aiPet(dt); break;
        case 'follow': this.aiFollow(dt); break;
        default: this.brake(dt);
      }
    }
    if (this.blocking > 0) this.blocking -= dt;
    if (this.ai !== 'bird' || !this.flying) {
      this.hitWall = false;
      moveEntity(this.game.world, this, dt);
    } else {
      this.pos.addScaledVector(this.vel, dt);
    }
    if (this.pos.y < -10) { this.pos.set(this.home.x, this.home.y + 2, this.home.z); this.vel.set(0, 0, 0); }
    const hs = Math.hypot(this.vel.x, this.vel.z);
    st.speed = hs;
    st.phase += hs * dt * (this.rig.kind === 'human' ? 1.15 : 1.4);
    this.syncRig(dt);
  }

  syncRig(dt) {
    const r = this.rig.root;
    r.position.copy(this.pos);
    if (this.sleepPose) { r.rotation.set(0, this.yaw, 0); this.rig.body.rotation.z = Math.PI / 2; this.rig.body.position.y = 0.6; }
    else r.rotation.set(0, this.yaw, 0);
    this.st.block = this.blocking > 0;
    if (!this.sleepPose) animate(this.rig, this.st, dt);
  }

  // -------------------- AI: melee enemies --------------------
  pickTarget() {
    const P = this.game.player;
    if (this.target && this.target.alive !== false && !(this.target.isPlayer && P.dead)) return this.target;
    return P.dead ? null : P;
  }

  aiMelee(dt) {
    const game = this.game, P = game.player, def = this.def;
    this.cool -= dt;
    this.stateT -= dt;
    let wantsMove = false;
    if (this.state === 'stagger') { this.brake(dt); if (this.stateT <= 0) this.state = 'chase'; return; }
    if (!this.aggro) {
      // idle wander & perception
      const night = game.isNight();
      const d = this.dist2D(P.pos);
      let notice = false;
      if (!P.dead) {
        const sight = (def.sight || 20) * (P.sneak ? 0.55 : 1) * (night ? 0.75 : 1);
        if (def.territorial) notice = d < def.territorial * (P.sneak ? 0.6 : 1) || (this.lastHitBy === P);
        else notice = this.canSee(P, sight) || (d < (P.noise || 0)) || (def.nightAggro && night && d < sight * 0.7);
        if (this.flags.pacified) notice = false;
      }
      if (notice) { this.becomeAggro(P); return; }
      wantsMove = this.wander(dt, 14, def.walk);
      this.trackStuck(dt, wantsMove);
      return;
    }
    const T = this.pickTarget();
    if (!T) { this.aggro = false; this.state = 'return'; return; }
    const dHome = Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z);
    const dT = this.dist2D(T.pos);
    if ((dHome > (def.boss ? 60 : 90) && dT > 18) || (T.isPlayer && P.dead)) { this.aggro = false; this.target = null; this.state = 'idle'; this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.5); this.wanderTo = { x: this.home.x, z: this.home.z }; return; }
    if (this.state === 'alert') { this.brake(dt); this.faceTo(T.pos.x, T.pos.z, dt, 10); if (this.stateT <= 0) this.state = 'chase'; return; }
    if (def.fleeHp && this.hp < this.maxHp * def.fleeHp && this.state !== 'flee' && !this.fled) { this.state = 'flee'; this.stateT = 5; this.fled = true; game.releaseToken(this); }
    if (this.state === 'flee') {
      const dx = this.pos.x - T.pos.x, dz = this.pos.z - T.pos.z, d = Math.hypot(dx, dz) || 1;
      this.steer(this.pos.x + dx / d * 10, this.pos.z + dz / d * 10, def.run, dt);
      if (this.stateT <= 0) this.state = 'chase';
      return;
    }
    if (this.state === 'attack') { this.runAttack(dt, T); return; }
    if (this.state === 'block') { this.brake(dt); this.faceTo(T.pos.x, T.pos.z, dt, 10); if (this.blocking <= 0) this.state = 'chase'; return; }
    // choose attack
    const a0 = def.attacks[0];
    const reach = a0.reach + (T.radius || 0.4);
    const hasToken = game.requestToken(this, T);
    if (dT <= reach * 0.95 && this.cool <= 0 && hasToken) {
      this.startAttack(T, dT);
      return;
    }
    // ranged-type special moves at mid range (lunge / charge / slam)
    if (this.cool <= 0 && hasToken && dT < 10 && dT > reach) {
      const far = def.attacks.find((a) => (a.type === 'charge' && dT > 5) || (a.type === 'lunge' && dT < (a.reach + 3)));
      if (far && this.r() < 0.04) { this.startAttack(T, dT, far); return; }
    }
    if (dT > reach * 0.9) {
      const spd = hasToken || dT > 9 ? def.run : def.walk * 1.3;
      if (!hasToken && dT < 8) { this.strafe(T, dt, 6.5); }
      else this.goTo(T.pos.x, T.pos.y, T.pos.z, spd * this.speedMul, dt, reach * 0.8);
      wantsMove = true;
    } else {
      this.strafe(T, dt, reach * 0.9);
      wantsMove = true;
    }
    this.trackStuck(dt, wantsMove);
  }

  strafe(T, dt, radius) {
    const dx = this.pos.x - T.pos.x, dz = this.pos.z - T.pos.z, d = Math.hypot(dx, dz) || 1;
    const a = Math.atan2(dz, dx) + this.strafeDir * 0.6;
    const tx = T.pos.x + Math.cos(a) * radius, tz = T.pos.z + Math.sin(a) * radius;
    this.steer(tx, tz, this.def.walk * 0.9, dt, false);
    this.faceTo(T.pos.x, T.pos.z, dt, 10);
    if (this.r() < dt * 0.4) this.strafeDir *= -1;
  }

  startAttack(T, dT, forced = null) {
    const def = this.def;
    let atk = forced;
    if (!atk) {
      const opts = def.attacks.filter((a) => a.type !== 'charge' || dT > 4);
      atk = opts[Math.floor(this.r() * opts.length)];
      if (atk.type === 'roar' && this.r() < 0.5) atk = opts[0];
    }
    this.attack = atk; this.attackT = 0; this.hitDone = false; this.state = 'attack';
    this.comboLeft = atk.combo ? atk.combo - 1 : 0;
    this.st.attackType = atk.anim === 'overhead' || atk.anim === 'maul' ? 'overhead' : 'swing';
    this.target = T;
    if (atk.unblockable) this.game.fx.telegraph(this);
    this.game.audio && this.game.audio.creature(def.sounds || 'human', atk.type === 'roar' ? 'roar' : 'attack', this.pos);
  }

  runAttack(dt, T) {
    const a = this.attack, def = this.def;
    this.attackT += dt;
    const t = this.attackT;
    const total = a.windup + (a.active || 0.15);
    this.st.attack = Math.min(1, t / total);
    if (t < a.windup) {
      this.brake(dt);
      this.faceTo(T.pos.x, T.pos.z, dt, a.type === 'charge' ? 12 : 5);
      return;
    }
    // active phase
    if (a.type === 'lunge' && t < a.windup + 0.25) {
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      this.vel.x = fx * (a.lunge || 12); this.vel.z = fz * (a.lunge || 12);
    }
    if (a.type === 'charge') {
      if (t < a.windup + (a.charge || 1)) {
        const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
        this.vel.x = fx * (a.speed || 16); this.vel.z = fz * (a.speed || 16);
        this.faceTo(T.pos.x, T.pos.z, dt, 1.5);
        if (!this.hitDone && this.dist2D(T.pos) < a.reach) { this.hitDone = true; this.game.combat.actorHits(this, T, a); }
        return;
      }
    }
    if (!this.hitDone) {
      this.hitDone = true;
      if (a.type === 'shoot') this.game.combat.shootArrow(this, T, a);
      else if (a.type === 'slam') this.game.combat.slam(this, a);
      else if (a.type === 'roar') this.game.combat.roar(this, a);
      else {
        const d = this.dist2D(T.pos);
        const ang = Math.abs(angDiff(this.yaw, yawTo(T.pos.x - this.pos.x, T.pos.z - this.pos.z)));
        if (d <= a.reach + (T.radius || 0.4) + 0.4 && ang < (a.arc || 1.2) && Math.abs(T.pos.y - this.pos.y) < 4) this.game.combat.actorHits(this, T, a);
        else this.game.audio && this.game.audio.whoosh(this.pos, 0.6);
      }
    }
    this.brake(dt);
    if (t > total + (a.recover || 0.5)) {
      if (this.comboLeft > 0) { this.comboLeft--; this.attackT = a.windup * 0.4; this.hitDone = false; return; }
      this.state = 'chase'; this.attack = null; this.st.attack = -1;
      this.cool = (def.boss ? 0.5 : 0.9) + this.r() * (def.boss ? 0.8 : 1.4);
      this.game.releaseToken(this);
    }
  }

  // player swing notification: maybe raise shield
  onThreat(src) {
    if (!this.alive || !this.aggro || this.state === 'attack' || this.state === 'stagger') return;
    const bc = this.def.blockChance || 0;
    if (bc && this.r() < bc && this.dist2D(src.pos) < 7) { this.blocking = 0.7; this.state = 'block'; }
  }

  aiArcher(dt) {
    const game = this.game, P = game.player, def = this.def;
    this.cool -= dt; this.stateT -= dt;
    if (this.state === 'stagger') { this.brake(dt); if (this.stateT <= 0) this.state = 'chase'; return; }
    if (!this.aggro) {
      if (!P.dead && !this.flags.pacified && (this.canSee(P, def.sight * (P.sneak ? 0.55 : 1)) || this.dist2D(P.pos) < (P.noise || 0))) this.becomeAggro(P);
      else this.trackStuck(dt, this.wander(dt, 10, def.walk));
      return;
    }
    const T = this.pickTarget();
    if (!T) { this.aggro = false; return; }
    const d = this.dist2D(T.pos);
    if (this.state === 'alert') { this.brake(dt); this.faceTo(T.pos.x, T.pos.z, dt, 10); if (this.stateT <= 0) this.state = 'chase'; return; }
    if (this.state === 'attack') { this.st.aim = this.attackT < this.attack.windup; this.runAttack(dt, T); if (this.state !== 'attack') this.st.aim = false; return; }
    const see = game.world.lineOfSight(this.pos.x, this.pos.y + 3, this.pos.z, T.pos.x, T.pos.y + 2.8, T.pos.z);
    if (d < 7) { // back off
      const dx = this.pos.x - T.pos.x, dz = this.pos.z - T.pos.z;
      this.steer(this.pos.x + dx, this.pos.z + dz, def.run * 0.8, dt, false); this.faceTo(T.pos.x, T.pos.z, dt);
    } else if (d > 32 || !see) this.goTo(T.pos.x, T.pos.y, T.pos.z, def.run, dt, 6);
    else {
      this.strafe(T, dt, d);
      if (this.cool <= 0) { this.startAttack(T, d, def.attacks[0]); }
    }
  }

  aiGuard(dt) {
    // stand at post, engage hostile actors that come near
    this.cool -= dt; this.stateT -= dt;
    if (this.state === 'attack' && this.target && this.target.alive) { this.runAttack(dt, this.target); return; }
    let foe = null, best = 26;
    for (const a of this.game.actors) {
      if (!a.alive || !a.isHostile || a.ai === 'prey') continue;
      const d = this.dist2D(a.pos);
      if (d < best && (a.aggro || d < 12)) { best = d; foe = a; }
    }
    if (foe) {
      this.target = foe;
      const reach = this.def.attacks[0].reach + foe.radius;
      if (best > reach * 0.9) this.goTo(foe.pos.x, foe.pos.y, foe.pos.z, this.def.run, dt, reach * 0.8);
      else if (this.cool <= 0) { this.startAttack(foe, best, this.def.attacks[0]); }
      else { this.brake(dt); this.faceTo(foe.pos.x, foe.pos.z, dt); }
      if (foe.target !== this && foe.state !== 'attack' && this.r() < dt) foe.becomeAggro(this, false);
      return;
    }
    if (this.npc) { this.aiNpc(dt); return; }
    const arrived = this.goTo(this.home.x, this.home.y, this.home.z, this.def.walk, dt, 1.0);
    if (arrived && this.home.yaw !== undefined) { const d = angDiff(this.yaw, this.home.yaw); this.yaw += d * Math.min(1, dt * 3); }
    this.lookAtPlayer(dt, 7);
  }

  wander(dt, radius, speed) {
    this.wanderT -= dt;
    if (this.wanderT <= 0) {
      this.wanderT = 3 + this.r() * 6;
      if (this.r() < 0.55) {
        const a = this.r() * 6.28, d = this.r() * radius;
        this.wanderTo = { x: this.home.x + Math.cos(a) * d, z: this.home.z + Math.sin(a) * d };
      } else this.wanderTo = null;
    }
    if (this.wanderTo) {
      const d = this.steer(this.wanderTo.x, this.wanderTo.z, speed * 0.7, dt);
      if (d < 0.8 || this.stuckT > 1.5) { this.wanderTo = null; this.stuckT = 0; }
      return true;
    }
    this.brake(dt);
    return false;
  }

  lookAtPlayer(dt, range) {
    const P = this.game.player;
    const d = this.dist2D(P.pos);
    let target = 0;
    if (d < range) {
      target = angDiff(this.yaw, yawTo(P.pos.x - this.pos.x, P.pos.z - this.pos.z));
      target = Math.max(-1.1, Math.min(1.1, target));
      if (Math.abs(angDiff(this.yaw, yawTo(P.pos.x - this.pos.x, P.pos.z - this.pos.z))) > 1.6) target = 0;
    }
    this.st.headYaw += (target - this.st.headYaw) * Math.min(1, dt * 5);
  }

  // -------------------- AI: wildlife --------------------
  scaredBy() {
    const P = this.game.player;
    const d = this.dist2D(P.pos);
    const sk = (this.def.skittish || 0) * (P.sneak ? 0.5 : 1) * (P.sprinting ? 1.5 : 1);
    if (!P.dead && d < sk) return P.pos;
    for (const a of this.game.actors) {
      if (a.alive && a.isHostile && a.aggro && a.dist2D(this.pos) < 10) return a.pos;
    }
    return null;
  }

  aiPrey(dt) {
    this.stateT -= dt;
    const scare = this.scaredBy();
    if (scare && this.state !== 'flee') { this.state = 'flee'; this.stateT = 4 + this.r() * 3; this.fleeFrom = scare.clone ? scare.clone() : { ...scare }; this.game.audio && this.game.audio.creature(this.def.model, 'flee', this.pos); }
    if (this.state === 'flee') {
      const dx = this.pos.x - this.fleeFrom.x, dz = this.pos.z - this.fleeFrom.z, d = Math.hypot(dx, dz) || 1;
      this.steer(this.pos.x + dx / d * 8 + Math.sin(this.st.time) * 2, this.pos.z + dz / d * 8, this.def.run, dt);
      if (this.def.hop && this.onGround) this.vel.y = 6;
      if (this.stateT <= 0) { this.state = 'idle'; this.home = { x: this.pos.x, y: this.pos.y, z: this.pos.z }; }
      return;
    }
    const moving = this.wander(dt, 12, this.def.walk);
    this.st.graze = !moving && Math.sin(this.st.time * 0.5 + this.id) > 0;
    if (this.def.hop && moving && this.onGround && this.r() < dt * 3) this.vel.y = 4;
  }

  aiLivestock(dt) {
    this.stateT -= dt;
    const scare = this.def.skittish ? this.scaredBy() : null;
    if (scare && this.state !== 'flee' && this.r() < dt * 2) { this.state = 'flee'; this.stateT = 1.5; this.fleeFrom = scare.clone(); }
    if (this.state === 'flee') {
      const dx = this.pos.x - this.fleeFrom.x, dz = this.pos.z - this.fleeFrom.z, d = Math.hypot(dx, dz) || 1;
      this.steer(this.pos.x + dx / d * 6, this.pos.z + dz / d * 6, this.def.run, dt);
      if (this.stateT <= 0) this.state = 'idle';
      return;
    }
    const moving = this.wander(dt, 7, this.def.walk);
    this.st.graze = !moving && Math.sin(this.st.time * 0.4 + this.id) > -0.3;
    this.st.peck = this.def.peck && !moving;
    if (this.barkT -= dt, this.barkT < 0) { this.barkT = 8 + this.r() * 20; this.game.audio && this.game.audio.creature(this.def.model, 'idle', this.pos); }
  }

  takeOff() { this.flying = true; this.st.fly = true; this.stateT = 6; const P = this.game.player; const dx = this.pos.x - P.pos.x, dz = this.pos.z - P.pos.z, d = Math.hypot(dx, dz) || 1; this.vel.set(dx / d * 9, 7, dz / d * 9); this.yaw = yawTo(dx, dz); this.game.audio && this.game.audio.creature('crow', 'flee', this.pos); }

  aiBird(dt) {
    if (this.flying) {
      this.stateT -= dt;
      this.vel.y = Math.min(this.vel.y + dt * 2, 6);
      this.vel.x += Math.sin(this.st.time * 0.7 + this.id) * dt * 4;
      this.yaw = yawTo(this.vel.x, this.vel.z);
      if (this.stateT <= 0) { this.despawnMe = true; }
      return;
    }
    const scare = this.scaredBy();
    if (scare) { this.takeOff(); return; }
    const moving = this.wander(dt, 4, this.def.walk);
    this.st.peck = !moving;
    if (moving && this.onGround && this.r() < dt * 4) this.vel.y = 3.5;
    if ((this.barkT -= dt) < 0) { this.barkT = 6 + this.r() * 18; this.game.audio && this.game.audio.creature('crow', 'idle', this.pos); }
  }

  aiDuck(dt) {
    const w = this.game.world;
    if (this.inWater) { this.vel.y = Math.max(this.vel.y, 0); }
    const scare = this.scaredBy();
    if (scare) {
      const dx = this.pos.x - scare.x, dz = this.pos.z - scare.z, d = Math.hypot(dx, dz) || 1;
      this.steer(this.pos.x + dx / d * 5, this.pos.z + dz / d * 5, this.def.run, dt);
      return;
    }
    this.wander(dt, 10, this.def.walk);
  }

  aiPet(dt) {
    const moving = this.wander(dt, 14, this.def.walk);
    this.lookAtPlayer(dt, 6);
    this.trackStuck(dt, moving);
  }

  aiFollow(dt) {
    // escort / companion: follow the player at a distance
    const P = this.game.player;
    const d = this.dist2D(P.pos);
    if (d > 60) { this.pos.set(P.pos.x + 2, P.pos.y + 1, P.pos.z + 2); return; }
    if (d > 5) this.goTo(P.pos.x, P.pos.y, P.pos.z, d > 12 ? 11 : 6, dt, 3.5);
    else { this.brake(dt); this.lookAtPlayer(dt, 8); }
    this.trackStuck(dt, d > 5);
  }

  // -------------------- AI: NPC routines --------------------
  aiNpc(dt) {
    const game = this.game, P = game.player;
    const talking = game.dialogue && game.dialogue.actor === this;
    this.st.talk = talking && game.dialogue.speaking;
    this.st.sit = false; this.st.work = false; this.sleepPose = false;
    if (talking) {
      this.brake(dt); this.faceTo(P.pos.x, P.pos.z, dt, 6); this.st.headYaw *= 0.8;
      this.st.look = Math.atan2((P.pos.y + 3.2) - (this.pos.y + 3.2), this.dist2D(P.pos)) * -0.5;
      return;
    }
    this.st.look = 0;
    // fear of nearby fighting
    if (!this.npc.brave) {
      for (const a of game.actors) {
        if (a.alive && a.isHostile && a.aggro && a.dist2D(this.pos) < 14) { this.fearT = 6; this.fearFrom = a.pos.clone(); break; }
      }
    }
    if (this.fearT > 0) {
      this.fearT -= dt;
      const dx = this.pos.x - this.fearFrom.x, dz = this.pos.z - this.fearFrom.z, d = Math.hypot(dx, dz) || 1;
      this.steer(this.pos.x + dx / d * 6, this.pos.z + dz / d * 6, 10, dt);
      if ((this.barkT -= dt) < 0) { this.barkT = 4; game.bark(this, 'fear'); }
      return;
    }
    const task = game.npcs.currentTask(this);
    if (!task) { this.brake(dt); this.lookAtPlayer(dt, 6); return; }
    const spot = task.spotPos;
    if (task !== this.curTask) { this.curTask = task; this.path = null; this.repath = 0; this.taskArrive = false; this.wanderTo = null; }
    const farFromPlayer = this.dist2D(P.pos) > 110;
    if (spot && !this.taskArrive) {
      if (farFromPlayer) { this.pos.set(spot.x, spot.y + 0.05, spot.z); this.vel.set(0, 0, 0); this.taskArrive = true; }
      else {
        this.usePaths = true;
        const arrived = this.goTo(spot.x, spot.y, spot.z, task.run ? 9 : 4.2, dt, 0.7);
        this.trackStuck(dt, true);
        if (this.stuckT > 6) { this.pos.set(spot.x, spot.y + 0.05, spot.z); this.stuckT = 0; }
        if (arrived) this.taskArrive = true;
        this.lookAtPlayer(dt, 5);
        return;
      }
    }
    // perform activity
    switch (task.act) {
      case 'sleep':
        this.brake(dt);
        if (spot && this.dist2D(spot) < 1.5) { this.sleepPose = true; this.pos.set(spot.x, spot.y + 0.2, spot.z); }
        break;
      case 'sit': this.brake(dt); this.st.sit = true; if (spot && spot.yaw !== undefined) this.yaw += angDiff(this.yaw, spot.yaw) * Math.min(1, dt * 4); break;
      case 'work': this.brake(dt); this.st.work = true; if (spot && spot.yaw !== undefined) this.yaw += angDiff(this.yaw, spot.yaw) * Math.min(1, dt * 4); break;
      case 'wander': {
        this.home = { x: spot.x, y: spot.y, z: spot.z };
        this.usePaths = false;
        const m = this.wander(dt, task.r || 8, 3.2);
        this.trackStuck(dt, m);
        break;
      }
      case 'patrol': {
        const pts = task.patrol;
        this.pi = this.pi || 0;
        const p = pts[this.pi % pts.length];
        if (this.goTo(p.x, p.y, p.z, 3.6, dt, 1.0)) this.pi++;
        this.trackStuck(dt, true);
        break;
      }
      default: this.brake(dt); if (spot && spot.yaw !== undefined && this.dist2D(P.pos) > 5) this.yaw += angDiff(this.yaw, spot.yaw) * Math.min(1, dt * 3);
    }
    this.lookAtPlayer(dt, 6);
    // greetings
    this.barkT -= dt;
    if (this.barkT < 0 && this.dist2D(P.pos) < 6 && !this.sleepPose) { this.barkT = 25 + this.r() * 30; game.bark(this, 'greet'); }
  }
}
