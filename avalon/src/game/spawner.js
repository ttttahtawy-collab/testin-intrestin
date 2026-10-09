// Activates creature spawn points near the player and handles respawning.
import { Actor } from '../entities/actor.js';
import { ACTORS } from './actors.js';
import { rng } from '../core/noise.js';
import { SOLID } from '../world/blocks.js';

export class Spawner {
  constructor(game) {
    this.game = game;
    this.spawns = game.world.spawns.map((s, i) => ({ ...s, id: i, active: false, actors: [], deadAt: null }));
    this.t = 0;
    this.r = rng(99);
  }

  findFloor(x, z, yHint, under) {
    const w = this.game.world;
    if (under && yHint !== undefined) {
      for (let y = Math.floor(yHint) + 3; y > yHint - 10; y--) if (SOLID[w.get(x, y - 1, z)] && !SOLID[w.get(x, y, z)] && !SOLID[w.get(x, y + 1, z)]) return y;
      return yHint;
    }
    return w.groundY(x, z);
  }

  spawnOne(s, k) {
    const g = this.game;
    const def = ACTORS[s.type];
    if (!def) return null;
    const a0 = this.r() * Math.PI * 2, d = s.n > 1 ? this.r() * s.r : 0;
    const x = s.x + Math.cos(a0) * d, z = s.z + Math.sin(a0) * d;
    const y = this.findFloor(x, z, s.y, s.under);
    if (!s.under && g.world.water[Math.floor(z) * 2048 + Math.floor(x)] > y && s.type !== 'duck') return null;
    const a = new Actor(g, { type: s.type, x, y: y + 0.05, z, group: s.group || null, spawnId: s.id, unique: s.unique, seed: s.id * 31 + k });
    if (s.group === 'osric' && !g.flags.osric_parley) a.flags.pacified = true;
    g.actors.push(a);
    return a;
  }

  update(dt) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.75;
    const g = this.game, P = g.player;
    const night = g.isNight();
    for (const s of this.spawns) {
      const d = Math.hypot(s.x - P.pos.x, s.z - P.pos.z);
      if (!s.active) {
        if (d > 150) continue;
        if (s.unique && g.flags['dead_' + s.unique]) continue;
        if (s.unique === 'osric' && g.flags.osric_gone) continue;
        if (s.deadAt !== null && g.time.total - s.deadAt < 36) continue;
        if (s.type === 'crow' && s.deadAt !== null && g.time.total - s.deadAt < 2) continue;
        // ambient prey avoid spawning right in view
        if (!s.under && !s.unique && d < 30 && s.everActive) continue;
        let n = s.n;
        if (night && (s.type === 'wolf' || s.type === 'plaguehound')) n += 1;
        if (!night && s.nightOnly) continue;
        s.actors = [];
        for (let k = 0; k < n; k++) { const a = this.spawnOne(s, k); if (a) s.actors.push(a); }
        s.active = true; s.everActive = true; s.killed = 0;
      } else {
        // remove fled birds
        for (const a of s.actors) if (a.despawnMe && !a.removed) { a.remove(); }
        const living = s.actors.filter((a) => a.alive && !a.removed);
        if (living.length === 0) {
          const killed = s.actors.some((a) => !a.alive);
          s.deadAt = killed || s.type === 'crow' ? g.time.total : null;
          // corpses stay until looted / far
          if (d > 120) { for (const a of s.actors) if (!a.removed) a.remove(); s.active = false; s.actors = []; }
          continue;
        }
        if (d > 220 && !living.some((a) => a.aggro)) {
          for (const a of s.actors) if (!a.removed) a.remove();
          s.actors = []; s.active = false;
        }
      }
    }
    g.actors = g.actors.filter((a) => !a.removed);
  }

  serialize() { return this.spawns.map((s) => s.deadAt); }
  load(arr) { if (!arr) return; arr.forEach((v, i) => { if (this.spawns[i]) this.spawns[i].deadAt = v; }); }
}
