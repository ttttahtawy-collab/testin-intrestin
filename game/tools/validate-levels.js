#!/usr/bin/env node
// Headless level validator.
//
// Loads the real game physics + player controller in Node and explores each
// level with a scripted "bot" that tries many jump / double-jump / wall-jump
// input patterns from every reachable standing spot. Reports whether the goal
// and each prism shard can be reached, and what fraction of gems are reachable.
//
//   node tools/validate-levels.js            # all levels
//   node tools/validate-levels.js 1-1 2-3    # specific levels
//
// Approximations: enemies are ignored, breakable blocks count as broken,
// moving platforms are treated as one-way platforms along their whole path.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { console, Math, Date, JSON, Map, Set, Array, Object, Float32Array, Uint8Array, Error };
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of [
  'js/core/util.js', 'js/game/physics.js', 'js/game/level.js', 'js/game/abilities.js', 'js/game/player.js',
  'js/data/worlds.js', 'js/data/levels/world1.js', 'js/data/levels/world2.js', 'js/data/levels/world3.js', 'js/data/levels/world4.js',
]) {
  const p = path.join(root, f);
  if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f });
}
const G = ctx.G;
const T = G.TILE;
const DT = 1 / 60;

function prepare(def) {
  const L = new G.Level(def);
  for (let i = 0; i < L.tiles.length; i++) if (L.tiles[i] === G.T.BREAK) L.tiles[i] = 0;
  const springs = [];
  for (const s of L.spawns) {
    if (s.ch === 'M') {
      const n = Math.round(s.travel / T);
      for (let x = s.tx; x <= s.tx + n + 1; x++) if (L.get(x, s.ty) === 0) L.set(x, s.ty, G.T.ONEWAY);
    } else if (s.ch === 'N') {
      const n = Math.round(s.travel / T);
      for (let y = s.ty; y <= s.ty + n; y++) for (let x = s.tx; x <= s.tx + 1; x++) if (L.get(x, y) === 0) L.set(x, y, G.T.ONEWAY);
    } else if (s.ch === 'J') {
      springs.push({ x: s.x + 6, y: s.y + T - 22, w: 36, h: 22 });
    }
  }
  return { L, springs };
}

function targets(L, def) {
  const out = { goal: null, shards: [], gems: [] };
  for (const s of L.spawns) {
    if (s.ch === 'G') out.goal = { x: s.x + 4, y: s.y - T * 2 + 20, w: 40, h: T * 3 - 20 };
    else if ('123'.includes(s.ch)) out.shards.push({ id: s.ch, x: s.x + 6, y: s.y + 2, w: 36, h: 44 });
    else if (s.ch === 'o') out.gems.push({ x: s.x + 14, y: s.y + 12, w: 20, h: 24 });
  }
  return out;
}

const ov = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function validate(def) {
  const t0 = Date.now();
  const { L, springs } = prepare(def);
  const tg = targets(L, def);
  const P = new G.Player(L, L.start.x, L.start.y, {});
  // settle the player onto the ground
  const idle = mkCtrl();
  for (let i = 0; i < 30; i++) { P.update(DT, idle); P.events.length = 0; }
  const startKey = key(P);
  const seen = new Map();
  const queue = [];
  const push = (p) => {
    const k = key(p);
    if (!seen.has(k)) { seen.set(k, { x: p.cx, y: p.bottom }); queue.push(k); }
  };
  push(P);
  const touched = { goal: false, shards: new Set(), gems: new Set() };
  const checkTouch = (p) => {
    if (tg.goal && ov(p, tg.goal)) touched.goal = true;
    for (const s of tg.shards) if (ov(p, s)) touched.shards.add(s.id);
    for (let i = 0; i < tg.gems.length; i++) if (!touched.gems.has(i) && ov(p, tg.gems[i])) touched.gems.add(i);
  };

  const policies = [];
  for (const dir of [-1, 1]) policies.push({ dir, hold: 0, dj: -1, runup: false }); // walk / walk off ledges
  for (const dir of [-1, 0, 1])
    for (const hold of [5, 12, 40])
      for (const dj of [-1, 6, 14, 24, 36]) policies.push({ dir, hold, dj, runup: true });
  for (const dir of [-1, 1]) for (const hold of [5, 40]) policies.push({ dir, hold, dj: -1, runup: false });
  // mid-air reversal for overshoot corrections
  for (const dir of [-1, 1]) for (const rev of [10, 20]) for (const dj of [-1, 14]) policies.push({ dir, hold: 40, dj, runup: true, rev });

  let sims = 0;
  while (queue.length) {
    const k = queue.shift();
    const node = seen.get(k);
    for (const off of [-18, 0, 18]) {
      for (const base of policies) {
        for (const wall of ['none', 'same', 'flip']) {
          if (wall !== 'none' && base.dir === 0) break;
          const pol = Object.assign({ wall }, base);
          P.spawnAt(node.x + off, node.y);
          if (G.Phys.solidRect(L, P.x, P.y, P.w, P.h) || !supported(L, P)) break;
          P.onGround = true; P.coyote = G.Player.C.COYOTE;
          if (pol.runup && pol.dir) P.vx = pol.dir * G.Player.C.RUN;
          sims++;
          const wallTouched = simulate(P, L, springs, pol, push, checkTouch);
          if (!wallTouched) break; // wall policies only matter if a wall was touched
        }
      }
    }
    if (seen.size > 6000) break;
  }
  if (process.env.MAP) {
    const rows = def.map.map((r) => r.split(''));
    for (const v of seen.values()) {
      const tx = Math.floor(v.x / T), ty = Math.floor(v.y / T) - 1;
      if (rows[ty] && rows[ty][tx] !== undefined) rows[ty][tx] = '*';
    }
    console.log(rows.map((r) => r.join('')).join('\n'));
  }
  return {
    id: def.id, name: def.name, nodes: seen.size, sims, ms: Date.now() - t0,
    goal: !tg.goal ? 'n/a' : touched.goal,
    shards: tg.shards.map((s) => s.id + (touched.shards.has(s.id) ? '✓' : '✗')).join(' '),
    shardsOk: tg.shards.every((s) => touched.shards.has(s.id)),
    gems: touched.gems.size + '/' + tg.gems.length,
    startKey,
  };
}

function supported(L, p) {
  const y = p.y + p.h + 1;
  const ty = Math.floor(y / T);
  for (let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + p.w - 0.01) / T); tx++) {
    if (G.Phys.solid(L, tx, ty) || G.Phys.oneway(L, tx, ty)) return true;
  }
  return false;
}
function key(p) { return Math.floor(p.cx / (T / 2)) + ',' + Math.floor((p.bottom + 1) / T); }

function mkCtrl() {
  return { left: false, right: false, up: false, down: false, jump: false, jumpPressed: false, attackPressed: false, dashPressed: false, downPressed: false };
}

function simulate(P, L, springs, pol, push, checkTouch) {
  const c = mkCtrl();
  let dir = pol.dir;
  let jumpHeldUntil = pol.hold > 0 ? pol.hold : -1;
  let lastWallPress = -100;
  let wallTouched = false;
  let airborne = false;
  let springF = -1;
  let lastTileX = Math.floor(P.cx / (T / 2));
  for (let f = 0; f < 200; f++) {
    if (pol.rev && f === pol.rev) dir = -dir;
    c.left = dir < 0; c.right = dir > 0;
    c.jumpPressed = false;
    if (f === 0 && pol.hold > 0) c.jumpPressed = true;
    if ((springF < 0 && f === pol.dj) || (springF >= 0 && f === springF + pol.dj)) { c.jumpPressed = true; jumpHeldUntil = f + 14; }
    if (pol.wall !== 'none' && !P.onGround && P.wallDir !== 0 && P.vy > -60 && f - lastWallPress > 8) {
      c.jumpPressed = true; jumpHeldUntil = f + 14; lastWallPress = f;
      if (pol.wall === 'flip') dir = -P.wallDir;
    }
    c.jump = f < jumpHeldUntil;
    P.update(DT, c);
    P.events.length = 0;
    if (P.wallDir) wallTouched = true;
    // springs
    for (const s of springs) {
      if (P.vy >= 0 && ov(P, s) && (P.bottom - P.vy * DT <= s.y + 10 || P.onGround)) { P.y = s.y - P.h; P.bounce(G.Player.C.SPRING, false); if (springF < 0) springF = f; }
    }
    checkTouch(P);
    const hz = G.Phys.hazard(L, P);
    if (hz) return wallTouched;
    if (P.y > L.ph + 40) return wallTouched;
    if (!P.onGround) airborne = true;
    if (P.onGround) {
      const tx = Math.floor(P.cx / (T / 2));
      if (airborne && f > 1) { push(P); return wallTouched; }
      if (tx !== lastTileX) { push(P); lastTileX = tx; if (pol.hold === 0 && f > 40) return wallTouched; }
      if (pol.hold > 0 && f > 3 && !airborne) return wallTouched; // jump never left the ground
      if (pol.dir === 0 && f > 3) return wallTouched;
    }
  }
  return wallTouched;
}

const ids = process.argv.slice(2);
const all = G.Worlds.order().filter((id) => G.Worlds.levels[id]);
const run = ids.length ? ids : all;
let bad = 0;
for (const id of run) {
  const def = G.Worlds.levels[id];
  if (!def) { console.log(id, 'MISSING'); bad++; continue; }
  if (def.boss) {
    const L = new G.Level(def);
    const hasK = L.spawns.some((s) => s.ch === 'K'), hasG = L.spawns.some((s) => s.ch === 'G');
    console.log(`${id.padEnd(5)} ${def.name.padEnd(24)} boss=${def.boss} K=${hasK} G=${hasG} size=${L.w}x${L.h}`);
    if (!hasK || !hasG) bad++;
    continue;
  }
  const r = validate(def);
  const ok = r.goal === true && r.shardsOk;
  if (!ok) bad++;
  console.log(`${ok ? 'OK ' : 'BAD'} ${id.padEnd(5)} ${def.name.padEnd(24)} goal=${r.goal} shards=[${r.shards}] gems=${r.gems} nodes=${r.nodes} sims=${r.sims} ${r.ms}ms`);
}
process.exit(bad ? 1 : 0);
