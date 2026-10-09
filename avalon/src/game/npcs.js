// Spawns named NPCs & villagers and resolves their daily schedules.
import { Actor } from '../entities/actor.js';
import { NPCS, VILLAGERS, NAMES_M, NAMES_F } from './npcdata.js';
import { rng } from '../core/noise.js';

const SKINS = [0xe0b098, 0xd8a888, 0xc8946c, 0xb88660, 0xa07a58, 0x8a6448];
const HAIRS = [0x1a1a1a, 0x2a1a10, 0x4a3020, 0x6a4a2a, 0x8a5a2a, 0xa86a2a, 0xb8a888, 0x9a9a9a];
const CLOTH = [0x6a5a3a, 0x5a6a4a, 0x4a5a6a, 0x7a4a3a, 0x6a6a5a, 0x5a4a5a, 0x8a7a5a, 0x3a4a3a, 0x7a6a4a];

export class NpcManager {
  constructor(game) {
    this.game = game;
    this.byIdMap = new Map();
    this.list = [];
  }

  spot(name) { return this.game.world.meta.spots[name]; }

  spawnAll() {
    const g = this.game;
    for (const [id, def] of Object.entries(NPCS)) {
      const d = { ...def, id };
      const task = this.taskFor(d);
      const p = task && task.spotPos ? task.spotPos : this.spot('gw.plaza');
      if (!p) { console.warn('no spot for', id); continue; }
      const a = new Actor(g, { type: 'npc', npc: d, x: p.x, y: p.y + 0.1, z: p.z, yaw: p.yaw });
      a.npcId = id;
      this.byIdMap.set(id, a);
      this.list.push(a);
      g.actors.push(a);
    }
    // generic villagers
    const r = rng(4242);
    for (const [settle, V] of Object.entries(VILLAGERS)) {
      for (let i = 0; i < V.n; i++) {
        const female = r() < 0.5;
        const name = female ? r.pick(NAMES_F) : r.pick(NAMES_M);
        const top = r.pick(CLOTH);
        const app = female
          ? { female: true, skin: r.pick(SKINS), hair: r.pick(HAIRS), scarf: r.pick(CLOTH), top, topStyle: 'dress', topTrim: r.pick(CLOTH), belt: 0x3a2414 }
          : { skin: r.pick(SKINS), hair: r.pick(HAIRS), hairStyle: r() < 0.15 ? 'bald' : 'short', beard: r.pick(['none', 'full', 'stubble', 'mustache']), top, topStyle: r.pick(['tunic', 'vest', 'coat', 'tunic']), shirt: r.pick(CLOTH), legs: r.pick([0x3a3028, 0x4a3e30, 0x2a2a24]), helmet: r() < 0.2 ? 'cap' : null, capColor: r.pick(CLOTH) };
        const home = V.homes[i % V.homes.length];
        const work = r.pick(V.spots);
        const wake = 6 + Math.floor(r() * 3), sleep = 20 + Math.floor(r() * 3);
        const def = {
          id: `${settle}.v${i}`, name, title: settle === 'caerdawn' ? 'Townsfolk' : 'Villager', app, settlement: settle, generic: true,
          schedule: [[0, wake, home + '.bed', 'sleep'], [wake, 12, work, 'wander', { r: 8 }], [12, 14, home + '.table', 'sit'], [14, sleep, r.pick(V.spots), 'wander', { r: 10 }], [sleep, 24, home + '.bed', 'sleep']],
          line: r.pick(['Grey again today.', 'Have you news from the other villages?', 'Mind the fog, stranger.', 'Can\'t sleep for the coughing next door.', 'My cousin went to the Mire. Didn\'t come back.', 'The Watch don\'t come round like they used to.']),
        };
        const task = this.taskFor(def);
        const p = task && task.spotPos ? task.spotPos : this.spot(work);
        if (!p) continue;
        const a = new Actor(g, { type: 'npc', npc: def, x: p.x + (r() - 0.5) * 2, y: p.y + 0.1, z: p.z + (r() - 0.5) * 2 });
        a.npcId = def.id;
        this.byIdMap.set(def.id, a);
        this.list.push(a);
        g.actors.push(a);
      }
    }
  }

  byId(id) { return this.byIdMap.get(id); }

  taskFor(def) {
    const g = this.game;
    const sched = typeof def.schedule === 'function' ? def.schedule(g) : def.schedule;
    if (!sched) return null;
    const h = g.time.hour;
    let e = sched.find(([a, b]) => (a <= b ? h >= a && h < b : h >= a || h < b)) || sched[0];
    const [, , spotName, act, extra] = e;
    let sp = this.spot(spotName);
    if (!sp && spotName.endsWith('.bed')) sp = this.spot(spotName.replace('.bed', '.in'));
    if (!sp && spotName.endsWith('.table')) sp = this.spot(spotName.replace('.table', '.in'));
    if (!sp && spotName.endsWith('.hearth')) sp = this.spot(spotName.replace('.hearth', '.in'));
    return { key: spotName + ':' + act, spotPos: sp || null, act, ...(extra || {}) };
  }

  currentTask(a) {
    const def = a.npc;
    // cache task per in-game hour step
    const stamp = Math.floor(this.game.time.total * 4) + ':' + (this.game.flagVersion || 0);
    if (a._taskStamp === stamp && a._task) return a._task;
    const t = this.taskFor(def);
    if (a._task && t && a._task.key === t.key) { a._taskStamp = stamp; return a._task; }
    a._task = t; a._taskStamp = stamp;
    return t;
  }

  // NPCs only visible when relevant
  updateVisibility() {
    for (const a of this.list) {
      const d = a.npc;
      const vis = d.hiddenUntil ? d.hiddenUntil(this.game) : true;
      a.hidden = !vis;
      a.rig.root.visible = vis && a.rig.root.visible;
    }
  }
}
