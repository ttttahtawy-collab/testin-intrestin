// Combat resolution: player melee/ranged, enemy hits, projectiles, area effects.
import * as THREE from 'three';
import { itemShape } from './itemshapes.js';
import { charMat } from '../entities/voxmodel.js';
import { SOLID, B } from '../world/blocks.js';
import { yawTo } from '../entities/actor.js';

const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();

export class Combat {
  constructor(game) {
    this.game = game;
    this.projectiles = [];
    this.fires = [];
    this.tokens = new Map(); // target -> Set of actors
  }

  // ----- attack tokens: limit simultaneous melee attackers -----
  requestToken(actor, target) {
    let s = this.tokens.get(target);
    if (!s) { s = new Set(); this.tokens.set(target, s); }
    for (const a of s) if (!a.alive || !a.aggro || a.target !== target) s.delete(a);
    if (s.has(actor)) return true;
    const limit = target.isPlayer ? (actor.def.boss ? 3 : 2) : 2;
    if (s.size < limit || actor.def.boss) { s.add(actor); return true; }
    return false;
  }
  releaseToken(actor) { for (const s of this.tokens.values()) s.delete(actor); }

  // ----- player melee -----
  playerMelee(p, weapon, mult, o) {
    const g = this.game;
    const eye = p.eyePos(v1);
    const reach = (weapon.reach || 4) + 0.6;
    const yaw = p.yaw;
    const hits = [];
    for (const a of g.actors) {
      if (!a.alive || a.removed) continue;
      const dx = a.pos.x - p.pos.x, dz = a.pos.z - p.pos.z;
      const d = Math.hypot(dx, dz) - a.radius;
      if (d > reach) continue;
      const dy = (a.pos.y + a.height * 0.5) - eye.y;
      if (Math.abs(dy) > a.height * 0.8 + 2.5) continue;
      const ang = Math.abs(angDiff(yaw, yawTo(dx, dz)));
      if (ang > (d < 1.5 ? 1.4 : 0.85)) continue;
      if (!g.world.lineOfSight(eye.x, eye.y, eye.z, a.pos.x, a.pos.y + a.height * 0.6, a.pos.z)) continue;
      hits.push({ a, score: ang + d * 0.1 });
    }
    hits.sort((x, y) => x.score - y.score);
    const n = o.cleave ? 3 : 1;
    let any = false;
    for (let i = 0; i < Math.min(n, hits.length); i++) {
      const a = hits[i].a;
      if (a.npc || a.essential) { a.takeDamage(0, p); continue; }
      const base = weapon.dmg * mult * (0.9 + Math.random() * 0.2);
      // sneak attack on unaware foes
      let sneak = 1;
      if (!a.aggro && p.sneak && a.isHostile) { sneak = 2.5; g.ui.toast('Sneak attack!', 0.8); }
      const dealt = a.takeDamage(base * sneak, p, { heavy: o.heavy, stagger: o.stagger });
      if (dealt > 0) { any = true; g.ui.damageNumber(a, dealt, o.heavy); p.resolve = Math.min(p.maxResolve, p.resolve + 2.5); }
      if (a.alive && a.ai !== 'npc' && !a.aggro && a.isHostile) a.becomeAggro(p);
    }
    if (any) {
      p.hitStop = o.heavy ? 0.09 : 0.055; p.camShake = Math.max(p.camShake, o.heavy ? 0.25 : 0.12);
      g.audio.hit(o.heavy);
    } else {
      // hit a wall?
      const f = p.forward(v2);
      const r = g.world.raycast(eye.x, eye.y, eye.z, f.x, f.y, f.z, reach * 0.8);
      if (r) { g.fx.sparks(new THREE.Vector3(r.x + 0.5 + r.nx * 0.5, r.y + 0.5 + r.ny * 0.5, r.z + 0.5 + r.nz * 0.5), 6); g.audio.clang(p.pos, 0.6); p.camShake = 0.08; }
    }
  }

  bash(p) {
    const g = this.game;
    g.audio.hit(true);
    for (const a of g.actors) {
      if (!a.alive || a.npc) continue;
      const dx = a.pos.x - p.pos.x, dz = a.pos.z - p.pos.z, d = Math.hypot(dx, dz);
      if (d > 4.5 || Math.abs(angDiff(p.yaw, yawTo(dx, dz))) > 0.9) continue;
      a.takeDamage(6 + p.attr.might * 2, p, { stagger: 4 });
      a.stagger(a.def.boss ? 0.7 : 1.4);
      a.vel.x += dx / d * 10; a.vel.z += dz / d * 10;
      if (a.isHostile) a.becomeAggro(p);
    }
    p.camShake = 0.2;
  }

  battleCry(p) {
    const g = this.game;
    g.audio.battleCry();
    p.camShake = 0.3;
    for (const a of g.actors) {
      if (!a.alive || a.npc || a.faction === 'neutral') continue;
      const d = a.dist2D(p.pos);
      if (d > 12) continue;
      if (a.ai === 'prey' || a.ai === 'livestock' || a.ai === 'bird') { a.state = 'flee'; a.stateT = 5; a.fleeFrom = p.pos.clone(); if (a.ai === 'bird') a.takeOff(); continue; }
      if (!a.def.boss) a.stagger(1.2 + p.attr.resolve * 0.1);
      if (a.faction === 'beast' && !a.def.boss) { a.state = 'flee'; a.stateT = 3; }
    }
  }

  // ----- enemy hits -----
  actorHits(a, T, atk) {
    const g = this.game;
    const dmg = (a.def.dmg || 8) * (atk.mult || 1) * (0.9 + Math.random() * 0.2);
    if (T.isPlayer) {
      const dealt = T.hurt(dmg, a, { unblockable: atk.unblockable, stagger: atk.stagger || (atk.type === 'bash' ? 2 : 1), knock: atk.type === 'charge' ? 12 : 4 });
      if (dealt > 0 && a.def.rot && Math.random() < 0.3) g.ui.toast('The hound\'s bite festers.', 1.2);
    } else if (T.takeDamage) {
      T.takeDamage(dmg, a, {});
    }
  }

  slam(a, atk) {
    const g = this.game;
    const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
    const cx = a.pos.x + fx * 3, cz = a.pos.z + fz * 3;
    g.fx.dust(new THREE.Vector3(cx, a.pos.y + 0.2, cz), 40, atk.radius || 5);
    g.audio.slam(a.pos);
    const P = g.player;
    const d = Math.hypot(P.pos.x - cx, P.pos.z - cz);
    P.camShake = Math.max(P.camShake, 0.5 * Math.max(0, 1 - d / 20));
    if (d < (atk.radius || 5) && Math.abs(P.pos.y - a.pos.y) < 3) {
      P.hurt((a.def.dmg || 20) * (atk.mult || 1.5), a, { unblockable: true, stagger: 2, knock: 14 });
      P.vel.y = 9;
    }
    for (const o of g.actors) {
      if (o === a || !o.alive || o.faction === a.faction) continue;
      if (Math.hypot(o.pos.x - cx, o.pos.z - cz) < (atk.radius || 5)) o.takeDamage((a.def.dmg || 20) * 0.8, a, {});
    }
  }

  roar(a, atk) {
    const g = this.game, P = g.player;
    g.audio.creature('bear', 'roar', a.pos);
    P.camShake = 0.6;
    if (a.dist2D(P.pos) < (atk.reach || 7) && !P.blocking) { P.staggerT = 1.1; g.ui.toast('The roar shakes you to the bone!', 1.2); }
  }

  // ----- projectiles -----
  spawnProjectile(o) {
    const shape = itemShape(o.shape);
    const mesh = new THREE.Mesh(shape.geom(o.px || 0.06), charMat);
    mesh.castShadow = true;
    this.game.scene.add(mesh);
    const p = { ...o, mesh, life: o.life || 6, stuck: false };
    this.projectiles.push(p);
    return p;
  }

  shootArrow(a, T, atk) {
    const from = new THREE.Vector3(a.pos.x, a.pos.y + a.height * 0.82, a.pos.z);
    const to = new THREE.Vector3(T.pos.x, T.pos.y + (T.isPlayer ? 2.6 : T.height * 0.6), T.pos.z);
    // lead target
    const d = from.distanceTo(to);
    const speed = 48;
    const tt = d / speed;
    to.x += (T.vel ? T.vel.x : 0) * tt * 0.7; to.z += (T.vel ? T.vel.z : 0) * tt * 0.7;
    to.y += 0.5 * 28 * tt * tt; // compensate gravity
    const dir = to.sub(from).normalize();
    // inaccuracy
    dir.x += (Math.random() - 0.5) * 0.05; dir.y += (Math.random() - 0.5) * 0.04; dir.z += (Math.random() - 0.5) * 0.05;
    dir.normalize();
    this.spawnProjectile({ shape: 'arrow1', px: 0.05, pos: from, vel: dir.multiplyScalar(speed), owner: a, dmg: a.def.dmg * (atk.mult || 1), kind: 'arrow', grav: 28 });
    this.game.audio.bowShot(a.pos);
  }

  playerArrow(p, bow, draw) {
    const eye = p.eyePos(new THREE.Vector3());
    const f = p.forward(new THREE.Vector3());
    const speed = (30 + 45 * draw) * (p.perks.has('hunters_eye') ? 1.2 : 1);
    let dmg = bow.dmg * (0.35 + 0.65 * draw) * (p.perks.has('hunters_eye') ? 1.25 : 1);
    const belt = this.game.inventory && p.equip.belt === 'belt_hunter' ? 1.15 : 1;
    dmg *= belt;
    eye.addScaledVector(f, 0.8);
    this.spawnProjectile({ shape: 'arrow1', px: 0.05, pos: eye, vel: f.multiplyScalar(speed), owner: p, dmg, kind: 'arrow', grav: p.perks.has('hunters_eye') ? 14 : 20 });
    this.game.audio.bowShot(p.pos);
  }

  playerThrow(p, id) {
    const eye = p.eyePos(new THREE.Vector3());
    const f = p.forward(new THREE.Vector3());
    f.y += 0.15; f.normalize();
    eye.addScaledVector(f, 0.8);
    if (id === 'firepot') this.spawnProjectile({ shape: 'firepot', px: 0.06, pos: eye, vel: f.multiplyScalar(26), owner: p, dmg: 18, kind: 'firepot', grav: 30, spin: true });
    else this.spawnProjectile({ shape: 'throwknife', px: 0.05, pos: eye, vel: f.multiplyScalar(40), owner: p, dmg: 14 + p.attr.might * 2, kind: 'knife', grav: 18, spin: true });
    this.game.audio.whoosh(p.pos, 0.9);
  }

  update(dt) {
    const g = this.game, w = g.world;
    for (const p of this.projectiles) {
      p.life -= dt;
      if (p.stuck) { if (p.life < 0) p.dead = true; continue; }
      const step = p.vel.clone().multiplyScalar(dt);
      const len = step.length();
      const dir = step.clone().normalize();
      // world collision
      const hit = w.raycast(p.pos.x, p.pos.y, p.pos.z, dir.x, dir.y, dir.z, len);
      // actor / player collision along segment
      let victim = null, vt = len + 1;
      const test = (ent, rad, hgt) => {
        const cx = ent.pos.x, cz = ent.pos.z, cy0 = ent.pos.y, cy1 = ent.pos.y + hgt;
        for (let s = 0; s <= 4; s++) {
          const t = (s / 4) * len;
          const x = p.pos.x + dir.x * t, y = p.pos.y + dir.y * t, z = p.pos.z + dir.z * t;
          if (Math.hypot(x - cx, z - cz) < rad + 0.25 && y > cy0 && y < cy1) return t;
        }
        return null;
      };
      if (p.owner && p.owner.isPlayer) {
        for (const a of g.actors) {
          if (!a.alive || a === p.owner) continue;
          if (Math.abs(a.pos.x - p.pos.x) > len + 4 || Math.abs(a.pos.z - p.pos.z) > len + 4) continue;
          const t = test(a, a.radius, a.height);
          if (t !== null && t < vt) { vt = t; victim = a; }
        }
      } else {
        const P = g.player;
        const t = test(P, P.radius, P.height);
        if (t !== null) { vt = t; victim = P; }
        for (const a of g.actors) {
          if (!a.alive || a === p.owner || a.faction === (p.owner && p.owner.faction)) continue;
          if (Math.abs(a.pos.x - p.pos.x) > len + 4 || Math.abs(a.pos.z - p.pos.z) > len + 4) continue;
          const tt = test(a, a.radius, a.height);
          if (tt !== null && tt < vt) { vt = tt; victim = a; }
        }
      }
      if (victim && (!hit || vt < hit.dist)) {
        p.pos.addScaledVector(dir, vt);
        if (p.kind === 'firepot') { this.explodeFire(p.pos, p.owner); p.dead = true; continue; }
        if (victim.isPlayer) victim.hurt(p.dmg, p.owner, {});
        else {
          let dmg = p.dmg;
          const headY = victim.pos.y + victim.height * 0.82;
          if (p.pos.y > headY && victim.model !== 'quad') { dmg *= 1.6; if (p.owner.isPlayer) g.ui.toast('Headshot!', 0.7); }
          const dealt = victim.takeDamage(dmg, p.owner, { bow: true, stagger: 1.2 });
          if (p.owner && p.owner.isPlayer) { if (dealt > 0) g.ui.damageNumber(victim, dealt, false); if (victim.isHostile && victim.alive) victim.becomeAggro(p.owner); }
        }
        g.audio.hit(false);
        p.dead = true;
        continue;
      }
      if (hit) {
        p.pos.addScaledVector(dir, Math.max(0, hit.dist - 0.1));
        if (p.kind === 'firepot') { this.explodeFire(p.pos, p.owner); p.dead = true; continue; }
        p.stuck = true; p.life = 15;
        g.audio.thud(p.pos);
        if (p.kind === 'knife' && p.owner && p.owner.isPlayer) { p.pickup = 'throwknife'; }
        if (p.kind === 'arrow' && p.owner && p.owner.isPlayer && Math.random() < 0.5) { p.pickup = 'arrow'; }
        continue;
      }
      p.pos.add(step);
      p.vel.y -= (p.grav || 20) * dt;
      p.mesh.position.copy(p.pos);
      // orient along velocity (shape points +y)
      if (p.spin) p.mesh.rotation.x += dt * 14;
      else p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.vel.clone().normalize());
      if (p.life < 0) p.dead = true;
    }
    for (const p of this.projectiles) {
      if (p.dead) { g.scene.remove(p.mesh); }
      else if (p.stuck && p.pickup) {
        const P = g.player;
        if (P.pos.distanceTo(p.pos) < 2.5) { g.inventory.add(p.pickup, 1, true); g.scene.remove(p.mesh); p.dead = true; }
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
    // fires
    for (const f of this.fires) {
      f.t -= dt;
      f.tick -= dt;
      g.fx.fire(f.pos, f.r, dt);
      if (f.tick <= 0) {
        f.tick = 0.5;
        for (const a of g.actors) {
          if (!a.alive || a.npc) continue;
          if (a.pos.distanceTo(f.pos) < f.r + a.radius) { a.takeDamage(7, f.owner, { stagger: 0.5 }); if (a.isHostile && f.owner && f.owner.isPlayer) a.becomeAggro(f.owner); if (a.faction === 'beast' && !a.def.boss) { a.state = 'flee'; a.stateT = 2; } }
        }
        const P = g.player;
        if (P.pos.distanceTo(f.pos) < f.r) P.hurt(5, null, { fall: true });
      }
    }
    this.fires = this.fires.filter((f) => f.t > 0);
  }

  explodeFire(pos, owner) {
    const g = this.game;
    g.audio.fireBurst(pos);
    g.fx.fireBurst(pos);
    this.fires.push({ pos: pos.clone(), r: 4, t: 6, tick: 0, owner });
    for (const a of g.actors) {
      if (!a.alive || a.npc) continue;
      if (a.pos.distanceTo(pos) < 4.5) { a.takeDamage(18, owner, { stagger: 2 }); if (a.isHostile) a.becomeAggro(owner); }
    }
    g.dynLights.push({ x: pos.x, y: pos.y + 1, z: pos.z, color: 0xff7020, intensity: 2.5, radius: 18, t: 6, flicker: true });
  }
}
