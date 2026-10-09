// Quest engine. Quests are data-driven stage machines whose objectives react
// to game events (talk, kill, item, reach, flag).

export class Events {
  constructor() { this.h = {}; }
  on(n, f) { (this.h[n] = this.h[n] || []).push(f); }
  emit(n, d) { for (const f of this.h[n] || []) f(d); }
}

export class QuestLog {
  constructor(game, defs) {
    this.game = game;
    this.defs = defs;
    this.state = {}; // id -> {stage, done, failed, counts:{}, started}
    this.tracked = null;
    const E = game.events;
    E.on('talk', (d) => this.check('talk', d));
    E.on('kill', (d) => this.check('kill', d));
    E.on('item', (d) => this.check('item', d));
    E.on('flag', (d) => this.check('flag', d));
    E.on('reach', (d) => this.check('reach', d));
    E.on('lore', (d) => this.check('item', d));
  }

  get flags() { return this.game.flags; }
  isActive(id) { const s = this.state[id]; return !!s && !s.done && !s.failed; }
  isDone(id) { const s = this.state[id]; return !!s && s.done; }
  stageOf(id) { const s = this.state[id]; return s ? s.stage : null; }
  def(id) { return this.defs[id]; }
  stageDef(id) { const s = this.state[id]; if (!s) return null; return this.defs[id].stages[s.stage]; }

  start(id, stage = null) {
    if (this.state[id]) return;
    const d = this.defs[id];
    if (!d) { console.warn('no quest', id); return; }
    const first = stage || Object.keys(d.stages)[0];
    this.state[id] = { stage: first, done: false, counts: {}, started: this.game.time.day };
    if (!this.tracked || d.main) this.tracked = id;
    this.game.ui.questBanner(d.main ? 'New Chapter Quest' : 'New Quest', d.name);
    this.game.audio.quest();
    this.enterStage(id);
  }

  setStage(id, stage) {
    const s = this.state[id];
    if (!s) { this.start(id, stage); return; }
    if (s.done) return;
    s.stage = stage; s.counts = {};
    const d = this.defs[id];
    this.game.ui.questBanner('Quest Updated', d.name, d.stages[stage] && d.stages[stage].text);
    this.game.audio.quest(true);
    this.enterStage(id);
  }

  enterStage(id) {
    const st = this.stageDef(id);
    if (!st) return;
    if (st.onEnter) st.onEnter(this.game);
    // objectives already satisfied (e.g. items in pack)?
    this.check('item', {});
    this.check('flag', {});
  }

  complete(id) {
    const s = this.state[id];
    if (!s || s.done) return;
    s.done = true;
    const d = this.defs[id];
    this.game.ui.questBanner('Quest Complete', d.name);
    this.game.audio.quest(true, true);
    const rw = d.reward || {};
    if (rw.xp) this.game.player.gainXp(rw.xp, d.name);
    if (rw.gold) this.game.inventory.add('gold', rw.gold);
    if (rw.items) for (const [it, n] of rw.items) this.game.inventory.add(it, n);
    if (d.onComplete) d.onComplete(this.game);
    if (this.tracked === id) this.tracked = Object.keys(this.state).find((q) => this.isActive(q) && this.defs[q].main) || Object.keys(this.state).find((q) => this.isActive(q)) || null;
  }

  fail(id) { const s = this.state[id]; if (!s || s.done) return; s.failed = true; this.game.ui.questBanner('Quest Failed', this.defs[id].name); }

  // objective: {type:'talk', npc}, {type:'kill', tag, n}, {type:'item', id, n}, {type:'reach', spot|x,z, r}, {type:'flag', flag}
  objectiveMet(o, id) {
    const g = this.game, s = this.state[id];
    switch (o.type) {
      case 'item': return g.inventory.count(o.id) >= (o.n || 1);
      case 'flag': return !!g.flags[o.flag];
      case 'kill': return (s.counts[o.tag] || 0) >= (o.n || 1);
      default: return false;
    }
  }

  check(type, data) {
    for (const id of Object.keys(this.state)) {
      const s = this.state[id];
      if (s.done || s.failed) continue;
      const st = this.defs[id].stages[s.stage];
      if (!st || !st.obj) continue;
      const objs = Array.isArray(st.obj) ? st.obj : [st.obj];
      let changed = false;
      for (const o of objs) {
        if (o.type === 'kill' && type === 'kill' && data.tags && data.tags.includes(o.tag)) {
          s.counts[o.tag] = (s.counts[o.tag] || 0) + 1; changed = true;
          if (o.n > 1 && s.counts[o.tag] <= o.n) this.game.ui.toast(`${o.label || 'Slain'}: ${s.counts[o.tag]} / ${o.n}`, 2);
        }
        if (o.type === 'talk' && type === 'talk' && data.npc === o.npc) { s.counts['talk:' + o.npc] = 1; changed = true; }
        if (o.type === 'reach' && type === 'reach' && data.id === (o.spot || o.id)) { s.counts['reach:' + (o.spot || o.id)] = 1; changed = true; }
      }
      const all = objs.every((o) => {
        if (o.type === 'talk') return s.counts['talk:' + o.npc];
        if (o.type === 'reach') return s.counts['reach:' + (o.spot || o.id)];
        return this.objectiveMet(o, id);
      });
      if (all && (changed || type === 'item' || type === 'flag')) {
        if (st.auto === false) continue;
        if (st.next === 'complete') this.complete(id);
        else if (st.next) this.setStage(id, st.next);
      }
    }
  }

  // current target position for tracked quest (for compass / tracker)
  target(id = this.tracked) {
    if (!id || !this.isActive(id)) return null;
    const st = this.stageDef(id);
    if (!st) return null;
    const g = this.game;
    let t = st.target;
    if (typeof t === 'function') t = t(g);
    if (!t) return null;
    if (typeof t === 'string') {
      if (t.startsWith('npc:')) { const a = g.npcs.byId(t.slice(4)); return a ? { x: a.pos.x, y: a.pos.y, z: a.pos.z } : null; }
      const sp = g.world.meta.spots[t];
      return sp ? { x: sp.x, y: sp.y, z: sp.z } : null;
    }
    return t;
  }

  serialize() { return { state: this.state, tracked: this.tracked }; }
  load(d) { this.state = d.state || {}; this.tracked = d.tracked || null; }
}
