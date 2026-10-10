// Persistent progress: three save slots + global options in localStorage.
// All storage access is wrapped so private-mode / blocked storage never
// crashes the game (progress simply won't persist).
(function (G) {
  'use strict';
  const SLOT_KEY = 'ember_prism_slots_v1';
  const OPT_KEY = 'ember_prism_options_v1';
  const SLOT_COUNT = 3;

  const S = (G.Save = {
    slots: [],
    slot: -1, // active slot index
    data: null, // active slot data
    options: { music: 0.6, sfx: 0.8, shake: true, touch: 'auto', timer: false, assist: false },
    storageOk: true,
  });

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { S.storageOk = false; return null; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { S.storageOk = false; return false; }
  }

  S.fresh = function () {
    return {
      version: 1,
      created: Date.now(),
      updated: Date.now(),
      playTime: 0,
      gems: 0, // wallet
      gemsTotal: 0, // lifetime
      deaths: 0,
      levels: {}, // id -> { done, shards:[b,b,b], bestGems, bestTime }
      unlocked: ['1-1'],
      upgrades: { heart: 0, power: 0, magnet: 0, dash: false },
      story: {},
      node: '1-1',
      complete: false,
    };
  };

  S.load = function () {
    const raw = read(SLOT_KEY);
    S.slots = [];
    for (let i = 0; i < SLOT_COUNT; i++) S.slots.push(raw && raw[i] ? migrate(raw[i]) : null);
    const o = read(OPT_KEY);
    if (o) Object.assign(S.options, o);
  };
  function migrate(d) {
    const f = S.fresh();
    const out = Object.assign(f, d);
    out.upgrades = Object.assign(S.fresh().upgrades, d.upgrades || {});
    return out;
  }

  S.persist = function () {
    if (S.slot >= 0 && S.data) {
      S.data.updated = Date.now();
      S.slots[S.slot] = S.data;
    }
    write(SLOT_KEY, S.slots);
  };
  S.saveOptions = function () { write(OPT_KEY, S.options); };

  S.newGame = function (i) {
    S.slot = i;
    S.data = S.fresh();
    S.slots[i] = S.data;
    S.persist();
  };
  S.loadSlot = function (i) {
    if (!S.slots[i]) return false;
    S.slot = i;
    S.data = S.slots[i];
    return true;
  };
  S.deleteSlot = function (i) {
    S.slots[i] = null;
    if (S.slot === i) { S.slot = -1; S.data = null; }
    write(SLOT_KEY, S.slots);
  };
  S.hasAnySave = () => S.slots.some((s) => !!s);
  S.mostRecentSlot = function () {
    let best = -1, t = -1;
    S.slots.forEach((s, i) => { if (s && s.updated > t) { t = s.updated; best = i; } });
    return best;
  };

  // --- progress helpers ---------------------------------------------------
  S.levelRec = function (id) {
    const d = S.data;
    if (!d.levels[id]) d.levels[id] = { done: false, shards: [false, false, false], bestGems: 0, bestTime: null };
    return d.levels[id];
  };
  S.isUnlocked = (id) => !!S.data && S.data.unlocked.indexOf(id) >= 0;
  S.unlock = function (id) {
    if (id && S.data.unlocked.indexOf(id) < 0) { S.data.unlocked.push(id); return true; }
    return false;
  };
  S.shardCount = function (worldIdx) {
    let n = 0;
    const d = S.data;
    if (!d) return 0;
    for (const id in d.levels) {
      if (worldIdx != null && !id.startsWith(worldIdx + '-')) continue;
      n += d.levels[id].shards.filter(Boolean).length;
    }
    return n;
  };
  S.maxHp = function () { return 3 + (S.data ? S.data.upgrades.heart : 0); };
  S.slotSummary = function (s) {
    if (!s) return null;
    const done = Object.values(s.levels).filter((l) => l.done).length;
    let shards = 0;
    Object.values(s.levels).forEach((l) => (shards += l.shards.filter(Boolean).length));
    return { done, shards, gems: s.gems, time: s.playTime, complete: s.complete, updated: s.updated };
  };
})(window.G);
