// The Game: owns the world, systems, entities and the main update loop.
import * as THREE from 'three';
import { Renderer } from '../render/renderer.js';
import { ChunkManager } from '../render/chunks.js';
import { generateWorld } from '../world/worldgen.js';
import { B, KIND, SOLID } from '../world/blocks.js';
import { WX, WZ, SEA, BIOME, CS } from '../world/world.js';
import { SETTLE, POIS, REGIONS } from '../world/layout.js';
import { Input } from '../core/input.js';
import { Player } from './player.js';
import { ViewModel } from './viewmodel.js';
import { Inventory } from './inventory.js';
import { ITEMS, LOOT, RECIPES } from './items.js';
import { Combat } from './combat.js';
import { FX } from '../render/fx.js';
import { Weather } from '../render/weather.js';
import { Events, QuestLog } from './quests.js';
import { QUESTS } from './questdata.js';
import { DLG } from './dialogdata.js';
import { NpcManager } from './npcs.js';
import { SHOPS, GENERIC_BARKS, ENEMY_BARKS } from './npcdata.js';
import { Spawner } from './spawner.js';
import { Actor } from '../entities/actor.js';
import { itemShape } from './itemshapes.js';
import { charMat } from '../entities/voxmodel.js';
import { rng, hash2 } from '../core/noise.js';
import { UI } from '../ui/ui.js';
import { Audio } from '../audio/audio.js';

const HARVEST = {};
HARVEST[B.FLOWER_WHITE] = { item: 'yarrow', name: 'Yarrow' };
HARVEST[B.FLOWER_PURPLE] = { item: 'comfrey', name: 'Comfrey' };
HARVEST[B.FLOWER_YELLOW] = { item: 'marigold', name: 'Marigold' };
HARVEST[B.MUSHROOM_BROWN] = { item: 'mushroom', name: 'Brown Cap' };
HARVEST[B.MUSHROOM_RED] = { item: 'redcap', name: 'Redcap' };
HARVEST[B.SUNPETAL] = { item: 'sunpetal', name: 'Sunpetal' };
HARVEST[B.BITTERROOT] = { item: 'bitterroot', name: 'Bitterroot' };
HARVEST[B.BERRY_BUSH] = { item: 'berries', name: 'Berry bush', keep: true };
HARVEST[B.PUMPKIN] = { item: 'apple', name: 'Gourd', n: 0 };

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.scene = this.renderer.scene;
    this.input = new Input(canvas);
    this.events = new Events();
    this.audio = new Audio(this);
    this.ui = new UI(this);
    this.flags = {};
    this.flagVersion = 0;
    this.time = { hour: 7.5, day: 1, total: 7.5, real: 0, scale: 1 / 60 }; // 1 real minute = 1 game hour
    this.actors = [];
    this.dynLights = [];
    this.state = 'loading';
    this.paused = false;
    this.discovered = new Set();
    this.looted = new Set();
    this.harvested = new Set();
    this.containerLoot = new Map();
    this.shopStock = {};
    this.lastRest = null;
  }

  // ------------------------------------------------------------------ loading
  async load(progress) {
    const step = (p, t) => { progress(p, t); return new Promise((r) => setTimeout(r, 0)); };
    await step(0.02, 'Charting the isle…');
    this.world = generateWorld(() => {});
    this.addScriptedProps();
    await step(0.45, 'Carving the valleys…');
    this.chunks = new ChunkManager(this.world, this.scene, this.renderer.voxelMat, this.renderer.waterMat);
    this.chunks.buildLOD2All();
    await step(0.6, 'Kindling the hearths…');
    this.fx = new FX(this);
    this.weather = new Weather(this);
    this.combat = new Combat(this);
    this.player = new Player(this);
    this.inventory = new Inventory(this);
    this.quests = new QuestLog(this, QUESTS);
    this.npcs = new NpcManager(this);
    this.viewmodel = new ViewModel(this);
    this.dialogue = null;
    this.buildDoors();
    this.buildWindmills();
    this.buildPickups();
    this.playerLight = new THREE.PointLight(0xffc070, 0, 26, 1.2);
    this.scene.add(this.playerLight);
    await step(0.7, 'Waking the villagers…');
    this.npcs.spawnAll();
    this.spawner = new Spawner(this);
    this.ui.buildMaps();
    await step(0.85, 'Gathering the fog…');
    this.state = 'title';
    this.events.on('kill', () => {});
  }

  addScriptedProps() {
    const w = this.world, M = w.meta;
    const gy = (x, z) => w.height[Math.round(z) * WX + Math.round(x)] + 1;
    const Q = SETTLE.quarantine;
    M.spots['q.chest'] = { x: Q.x + 18.5, y: gy(Q.x + 18, Q.z + 18), z: Q.z + 17, yaw: 0 };
    // yarrow patch east of the tents
    const hx = Q.x + 44, hz = Q.z - 10;
    M.spots['q.herbs'] = { x: hx, y: gy(hx, hz), z: hz, yaw: 0 };
    const r = rng(5);
    for (let i = 0; i < 26; i++) {
      const x = Math.round(hx + (r() - 0.5) * 16), z = Math.round(hz + (r() - 0.5) * 16);
      if (w.water[z * WX + x]) continue;
      w.set(x, gy(x, z), z, r() < 0.75 ? B.FLOWER_WHITE : B.FLOWER_PURPLE);
    }
    // broken herb cart on the Kingsway
    const cx = 790, cz = 1222, cy = gy(cx, cz);
    M.spots['cart.wreck'] = { x: cx, y: cy, z: cz + 3, yaw: 0 };
    for (let dz = -3; dz <= 3; dz++) for (let dx = -1; dx <= 1; dx++) if (hash2(dx, dz, 3) > 0.2) w.set(cx + dx, cy, cz + dz, B.PLANKS_DARK);
    w.set(cx - 2, cy, cz - 2, B.LOG); w.set(cx - 2, cy + 1, cz - 2, B.LOG); w.set(cx + 2, cy, cz + 1, B.LOG);
    w.set(cx + 3, cy, cz + 3, B.CRATE); w.set(cx - 3, cy, cz + 2, B.BARREL); w.set(cx + 1, cy + 1, cz, B.CRATE);
    // kingsfall
    const K = SETTLE.kingsfall, kx = K.x, kz = K.z - 10, ky = K.ty + 1;
    M.spots['kingsfall.stairs'] = { x: kx + 9.5, y: ky, z: kz - 1, yaw: Math.PI };
    M.spots['kingsfall.cell'] = { x: kx - 27.5, y: ky - 14, z: kz - 17.5, yaw: Math.PI };
    for (let x = kx - 30; x <= kx - 25; x++) for (let y = ky - 14; y < ky - 9; y++) if ((x & 1) === 0) w.set(x, y, kz - 20, B.IRON);
    M.spots['deserter.camp'] = { x: SETTLE.deserterCamp.x, y: gy(SETTLE.deserterCamp.x, SETTLE.deserterCamp.z), z: SETTLE.deserterCamp.z, yaw: 0 };
    M.spots['watchtower'] = { x: SETTLE.watchtower.x + 8, y: gy(SETTLE.watchtower.x + 8, SETTLE.watchtower.z + 8), z: SETTLE.watchtower.z + 8, yaw: 0 };
    M.spots['wreck'] = { x: SETTLE.wreck.x, y: gy(SETTLE.wreck.x, SETTLE.wreck.z), z: SETTLE.wreck.z, yaw: 0 };
    M.spots['lighthouse.base'] = { x: SETTLE.lighthouse.x, y: gy(SETTLE.lighthouse.x, SETTLE.lighthouse.z), z: SETTLE.lighthouse.z - 7, yaw: 0 };
    // bitterroot around the heart of the mire
    const MH = SETTLE.mireHeart;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, d = 8 + (i % 3) * 3;
      const x = Math.round(MH.x + Math.cos(a) * d), z = Math.round(MH.z + Math.sin(a) * d);
      w.set(x, gy(x, z), z, B.BITTERROOT);
    }
    // the elder bloom: a hollow among the roots holds a chronicle page
    const EB = SETTLE.elderBloom;
    M.containers.push({ x: EB.x - 3, y: gy(EB.x - 3, EB.z + 4), z: EB.z + 4, kind: 'roots', loot: 'bloom', id: 'bloom.roots' });
    LOOT.bloom = [['page1', 1, 1, 1], ['gold', 1, 10, 15]];
    // the ring on the mere shore
    M.spots['ring.spot'] = { x: 700, y: gy(700, 1458), z: 1458, yaw: 0 };
    M.pickups = [
      { id: 'ring', item: 'lost_ring', spot: 'ring.spot', cond: (g) => g.quests.isActive('sq_ring') },
      { id: 'net', item: 'net', spot: 'wreck', cond: (g) => g.quests.isActive('sq_net'), off: [4, 0, 3] },
    ];
    // grimtooth arena edge
    M.spots['meadow.edge'] = { x: SETTLE.sunMeadow.x - 30, y: gy(SETTLE.sunMeadow.x - 30, SETTLE.sunMeadow.z + 20), z: SETTLE.sunMeadow.z + 20, yaw: 0 };
    // waypoint ids for campfires
    for (const c of M.campfires) if (c.id) c.wp = c.id;
  }

  // ------------------------------------------------------------------ new game / save
  newGame() {
    const P = this.player;
    const sp = this.world.meta.spots['start.cot'];
    P.pos.set(sp.x, sp.y + 0.6, sp.z);
    P.yaw = Math.PI / 2; P.pitch = -0.1;
    P.hp = 60; P.stamina = P.maxStamina; P.resolve = 20;
    this.time.hour = 7.2; this.time.total = 7.2; this.time.day = 1;
    this.weather.set('fog');
    this.weather.cur = { overcast: 0.55, rain: 0, fog: 2.0, wind: 0.4 };
    this.quests.start('mq_tents');
    this.lastRest = { x: P.pos.x, y: P.pos.y, z: P.pos.z, name: 'The Sick-Tents' };
    this.discovered.add('quarantine');
    this.waypointsKnown = new Set(['wp_tents']);
    this.state = 'play';
    this.ui.intro();
  }

  save(slot = 'avalon_save') {
    const P = this.player;
    const data = {
      v: 1, t: Date.now(),
      player: { pos: [P.pos.x, P.pos.y, P.pos.z], yaw: P.yaw, hp: P.hp, st: P.stamina, res: P.resolve, level: P.level, xp: P.xp, points: P.points, perkPoints: P.perkPoints, attr: P.attr, perks: [...P.perks], gold: P.gold, equip: P.equip, mode: P.mode },
      inv: this.inventory.serialize(), quests: this.quests.serialize(), flags: this.flags,
      time: this.time, discovered: [...this.discovered], looted: [...this.looted], harvested: [...this.harvested], wps: [...this.waypointsKnown],
      lastRest: this.lastRest, spawns: this.spawner.serialize(), weather: this.weather.state, shops: this.shopStock,
    };
    try { localStorage.setItem(slot, JSON.stringify(data)); this.ui.toast('Your tale is saved.', 2); return true; } catch (e) { this.ui.toast('Could not save (storage unavailable).', 3); return false; }
  }
  hasSave(slot = 'avalon_save') { try { return !!localStorage.getItem(slot); } catch (e) { return false; } }
  loadSave(slot = 'avalon_save') {
    let data;
    try { data = JSON.parse(localStorage.getItem(slot)); } catch (e) { return false; }
    if (!data) return false;
    const P = this.player, d = data.player;
    P.pos.set(...d.pos); P.yaw = d.yaw; P.hp = d.hp; P.stamina = d.st; P.resolve = d.res; P.level = d.level; P.xp = d.xp; P.points = d.points; P.perkPoints = d.perkPoints;
    P.attr = d.attr; P.perks = new Set(d.perks); P.gold = d.gold; P.equip = d.equip; P.mode = d.mode || 'melee';
    this.inventory.load(data.inv); this.quests.load(data.quests); this.flags = data.flags || {};
    Object.assign(this.time, data.time);
    this.discovered = new Set(data.discovered); this.looted = new Set(data.looted); this.harvested = new Set(data.harvested || []);
    this.waypointsKnown = new Set(data.wps || ['wp_tents']);
    this.lastRest = data.lastRest; this.spawner.load(data.spawns); this.weather.set(data.weather || 'cloudy'); this.shopStock = data.shops || {};
    for (const k of this.harvested) { const [x, y, z] = k.split(',').map(Number); this.world.set(x, y, z, B.AIR); }
    for (const u of ['osric', 'malric', 'gorm', 'grimtooth']) if (this.flags['dead_' + u]) this.flags['dead_' + u] = true;
    this.flagVersion++;
    // reposition npcs to their schedule
    for (const a of this.npcs.list) { a._task = null; const t = this.npcs.currentTask(a); if (t && t.spotPos) a.pos.set(t.spotPos.x, t.spotPos.y + 0.1, t.spotPos.z); }
    this.state = 'play';
    this.ui.toast('Tale resumed.', 2);
    return true;
  }

  // ------------------------------------------------------------------ helpers
  setFlag(f, v = true) { this.flags[f] = v; this.flagVersion++; this.events.emit('flag', { flag: f }); }
  isNight() { return this.time.hour < 5.5 || this.time.hour > 20.3; }
  bark(a, kind) {
    let lines = null;
    if (a.npc) {
      lines = (a.npc.barks && a.npc.barks[kind]) || GENERIC_BARKS[kind];
      if (kind === 'greet' && this.isNight() && Math.random() < 0.4) lines = GENERIC_BARKS.night;
      if (kind === 'greet' && this.weather.cur.rain > 0.4 && Math.random() < 0.4) lines = GENERIC_BARKS.rain;
    } else if (a.def.barks && ENEMY_BARKS[a.def.barks]) lines = ENEMY_BARKS[a.def.barks][kind];
    if (!lines || !lines.length) return;
    const text = lines[Math.floor(Math.random() * lines.length)];
    this.ui.subtitle(a.name, text, a);
    this.audio.voice(a, text);
  }
  requestToken(a, t) { return this.combat.requestToken(a, t); }
  releaseToken(a) { this.combat.releaseToken(a); }
  fogExposure(p) {
    const MH = SETTLE.mireHeart;
    const d = Math.hypot(p.x - MH.x, p.z - MH.z);
    if (d > 170) return 0;
    return Math.min(1, (170 - d) / 70);
  }

  onAggro(a) {
    if (a.group === 'osric') this.unpacifyOsric();
    if (a.def.boss) this.ui.setBoss(a);
  }

  onActorDeath(a, src) {
    const tags = [a.type];
    if (a.group) tags.push(a.group);
    if (a.unique) { tags.push(a.unique); this.flags['dead_' + a.unique] = true; this.flagVersion++; }
    if (a.unique === 'grimtooth') this.setFlag('grimtooth_done');
    this.events.emit('kill', { type: a.type, tags, actor: a });
    if (src && src.isPlayer && a.def.xp) this.player.gainXp(a.def.xp, a.name);
    this.releaseToken(a);
    // loot
    const table = a.def.loot;
    a.loot = table ? this.rollLoot(table, a.id) : [];
    if (a.unique === 'osric') a.loot.push({ id: 'sword_red', n: 1 }, { id: 'osric_letter', n: 1 }, { id: 'gold', n: 45 });
    if (a.unique === 'malric') a.loot.push({ id: 'sword_oath', n: 1 }, { id: 'gold', n: 30 });
    if (a.unique === 'gorm') a.loot.push({ id: 'club_gorm', n: 1 }, { id: 'bitterroot', n: 1 });
    if (a.unique === 'grimtooth') a.loot.push({ id: 'bear_pelt', n: 2 }, { id: 'fang', n: 4 });
    if (a.def.boss) { this.ui.setBoss(null); this.audio.victory(); }
    this.audio.creature(a.def.sounds || 'human', 'die', a.pos);
  }

  rollLoot(table, seed) {
    const T = LOOT[table];
    if (!T) return [];
    const r = rng(seed * 7 + table.length + Math.floor(this.time.total));
    const out = [];
    for (const [id, p, lo, hi] of T) if (r() < p) out.push({ id, n: lo + Math.floor(r() * (hi - lo + 1)) });
    return out;
  }

  onPlayerDeath(by) {
    this.ui.death(by);
    this.audio.death();
    setTimeout(() => this.respawn(), 4200);
  }
  respawn() {
    const P = this.player;
    const r = this.lastRest || this.world.meta.spots['start.cot'];
    P.pos.set(r.x, r.y + 1, r.z); P.vel.set(0, 0, 0);
    P.dead = false; P.hp = P.maxHp * 0.6; P.stamina = P.maxStamina; P.staggerT = 0;
    const lost = Math.floor(P.gold * 0.1); P.gold -= lost;
    for (const a of this.actors) if (a.aggro && !a.def.boss) { a.aggro = false; a.target = null; a.state = 'idle'; }
    for (const a of this.actors) if (a.aggro && a.def.boss) { a.aggro = false; a.hp = a.maxHp; a.pos.set(a.home.x, a.home.y + 0.5, a.home.z); a.state = 'idle'; }
    this.ui.setBoss(null);
    this.ui.respawned(lost);
  }

  useItem(id) {
    const d = ITEMS[id], P = this.player;
    if (!d || !this.inventory.has(id)) return;
    const u = d.use;
    if (!u) return;
    if (u.mask) {
      if (!this.inventory.has('fog_mask')) { this.ui.toast('You need a fen-mask to use filters.', 2); return; }
      P.maskTime = u.mask; this.inventory.remove(id, 1); this.ui.toast('Fresh filter fitted to your mask.', 2); this.audio.cloth(); return;
    }
    const mult = (P.perks.has('herb_wise') && d.type === 'consumable' ? 1.3 : 1) * (P.equip.belt === 'belt_herbalist' && d.type === 'consumable' ? 1.35 : 1);
    if (u.heal) P.hp = Math.min(P.maxHp, P.hp + u.heal * mult);
    if (u.hot) P.hot.push({ rate: (u.hot * mult) / u.dur, t: u.dur });
    if (u.stamRegen) P.buffs.tea = u.dur;
    this.inventory.remove(id, 1);
    P.useAnim = 0.8;
    this.audio.consume(d.type === 'food');
    this.ui.toast(`${d.type === 'food' ? 'Ate' : 'Used'}: ${d.name}`, 1.2);
  }

  equipItem(id) {
    const d = ITEMS[id], P = this.player;
    if (!d || !d.slot) return;
    if (P.equip[d.slot] === id) { P.equip[d.slot] = null; this.audio.cloth(); this.afterEquip(); return; }
    P.equip[d.slot] = id;
    if (d.slot === 'back') { P.mode = 'melee'; }
    if (d.slot === 'main' && P.mode === 'bow') P.mode = 'melee';
    this.audio[d.slot === 'main' || d.slot === 'off' ? 'sheathe' : 'cloth']();
    this.afterEquip();
  }
  afterEquip() {
    const P = this.player;
    if (P.equip.main && P.equip.body && this.quests.stageOf('mq_tents') === 'equip') this.setFlag('armed');
    P.hp = Math.min(P.hp, P.maxHp); P.stamina = Math.min(P.stamina, P.maxStamina);
    this.ui.refreshAll();
  }

  // ------------------------------------------------------------------ time
  advanceTime(hours) {
    this.time.total += hours;
    this.time.hour = (this.time.hour + hours) % 24;
    this.time.day = Math.floor(this.time.total / 24) + 1;
    this.flagVersion++;
  }
  rest(hours, where) {
    const P = this.player;
    for (const a of this.actors) if (a.aggro && a.alive && a.dist2D(P.pos) < 40) { this.ui.toast('You cannot rest with enemies nearby.', 2); return false; }
    this.ui.fadeRest(() => {
      this.advanceTime(hours);
      P.hp = P.maxHp; P.stamina = P.maxStamina; P.resolve = Math.max(P.resolve, P.maxResolve * 0.5);
      this.lastRest = { x: P.pos.x, y: P.pos.y, z: P.pos.z, name: where };
      this.checkDraughtTimer();
      this.save('avalon_save');
      // restock shops each new day
      this.shopStock = {};
      for (const a of this.npcs.list) { a._task = null; const t = this.npcs.currentTask(a); if (t && t.spotPos && a.dist2D(P.pos) > 12) a.pos.set(t.spotPos.x, t.spotPos.y + 0.1, t.spotPos.z); a.taskArrive = false; }
    }, hours);
    return true;
  }
  checkDraughtTimer() {
    if (this.quests.stageOf('mq_draught') === 'wait' && this.flags.draught_brew_t !== undefined && this.time.total - this.flags.draught_brew_t >= 6 && (this.time.hour >= 6 && this.time.hour < 20)) this.setFlag('draught_ready');
  }
  checkDraught() {
    if (this.quests.isDone('mq_mire') && this.quests.isDone('mq_peak') && !this.quests.stageOf('mq_draught')) this.quests.start('mq_draught');
  }

  // ------------------------------------------------------------------ scripts
  unpacifyOsric() {
    if (this.flags.osric_parley) return;
    this.flags.osric_parley = true;
    for (const a of this.actors) if (a.group === 'osric') a.flags.pacified = false;
  }
  osricFight() {
    this.unpacifyOsric();
    for (const a of this.actors) if (a.group === 'osric' && a.alive) a.becomeAggro(this.player, false);
  }
  osricLeaves() {
    this.flags.osric_parley = true;
    this.setFlag('osric_gone');
    this.ui.fadeRest(() => { for (const a of this.actors) if (a.group === 'osric') a.remove(); this.actors = this.actors.filter((a) => !a.removed); }, 0);
  }
  scriptGrimtooth() {
    if (this.flags.dead_grimtooth) { this.setFlag('grimtooth_done'); return; }
    let g = this.actors.find((a) => a.unique === 'grimtooth' && a.alive);
    const sp = this.world.meta.spots['meadow.edge'];
    if (!g) {
      g = new Actor(this, { type: 'grimtooth', x: sp.x, y: sp.y + 0.5, z: sp.z, unique: 'grimtooth' });
      this.actors.push(g);
    } else { g.pos.set(sp.x, sp.y + 0.5, sp.z); g.home = { x: sp.x, y: sp.y, z: sp.z }; }
    g.home = { x: SETTLE.sunMeadow.x, y: sp.y, z: SETTLE.sunMeadow.z };
    this.ui.toast('Something huge is moving in the pines…', 3);
    this.audio.creature('bear', 'roar', g.pos);
  }
  endChapter() {
    this.setFlag('chapter_done');
    setTimeout(() => this.ui.ending(), 2500);
  }

  // ------------------------------------------------------------------ props
  buildDoors() {
    this.doors = [];
    const mat = charMat;
    for (const d of this.world.meta.doors) {
      const g = new THREE.Group();
      const boxes = [];
      for (let k = 0; k < d.w; k++) boxes.push([k, 0, 0, k + 1, d.h, 0.25, 0x5a3a22]);
      boxes.push([0, 1, -0.05, d.w, 1.2, 0.3, 0x2a2a2e], [0, d.h - 1.2, -0.05, d.w, d.h - 1, 0.3, 0x2a2a2e], [d.w - 0.5, 2.3, -0.12, d.w - 0.3, 2.6, 0.37, 0x8a7a3a]);
      const { boxShape } = THREE_HELPERS;
      const mesh = new THREE.Mesh(boxShape(boxes, 1), mat);
      mesh.castShadow = true;
      g.add(mesh);
      // hinge at door left edge (relative to rdx)
      g.position.set(d.x + (d.rdx < 0 ? 1 : 0) + (d.rdz !== 0 ? (d.fdx < 0 ? 0.75 : 0) : 0), d.y, d.z + (d.rdz < 0 ? 1 : 0) + (d.rdx !== 0 ? (d.fdz < 0 ? 0.75 : 0) : 0));
      g.rotation.y = Math.atan2(-d.rdz, d.rdx);
      this.scene.add(g);
      this.doors.push({ d, g, open: 0, cx: d.x + d.rdx * d.w / 2 + 0.5, cz: d.z + d.rdz * d.w / 2 + 0.5, base: g.rotation.y });
    }
  }
  buildWindmills() {
    this.mills = [];
    const { boxShape } = THREE_HELPERS;
    const boxes = [[-0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0x3a2a1a]];
    for (let k = 0; k < 4; k++) {
      // each blade: long arm + sail (rotated by group)
    }
    for (const m of this.world.meta.windmills) {
      const g = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const arm = new THREE.Mesh(boxShape([[-0.25, 0, -0.2, 0.25, 11, 0.2, 0x4a3420], [0.25, 3, -0.1, 2.6, 11, 0.1, 0xd8d0b8], [0.25, 3, -0.15, 2.6, 3.3, 0.15, 0x4a3420], [0.25, 7, -0.15, 2.6, 7.3, 0.15, 0x4a3420]], 1), charMat);
        arm.rotation.z = k * Math.PI / 2;
        arm.castShadow = true;
        g.add(arm);
      }
      g.add(new THREE.Mesh(boxShape(boxes, 1), charMat));
      g.position.set(m.x, m.y, m.z);
      g.rotation.y = Math.atan2(m.dx, m.dz);
      const inner = new THREE.Group();
      this.scene.add(g);
      this.mills.push({ g, m });
    }
  }
  buildPickups() {
    this.pickups = [];
    for (const p of this.world.meta.pickups || []) {
      const sp = this.world.meta.spots[p.spot];
      if (!sp) continue;
      const s = itemShape(p.item);
      const mesh = new THREE.Mesh(s.geom(0.07), charMat);
      const off = p.off || [0, 0, 0];
      mesh.position.set(sp.x + off[0], sp.y + 0.5 + off[1], sp.z + off[2]);
      mesh.visible = false;
      this.scene.add(mesh);
      this.pickups.push({ ...p, mesh, taken: false });
    }
  }

  // ------------------------------------------------------------------ interaction
  findInteraction() {
    const P = this.player;
    const eye = P.eyePos(new THREE.Vector3());
    const f = P.forward(new THREE.Vector3());
    let best = null, bestScore = 1e9;
    const consider = (kind, obj, pos, maxD, label, verb) => {
      const dx = pos.x - eye.x, dy = pos.y - eye.y, dz = pos.z - eye.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > maxD) return;
      const dot = (dx * f.x + dy * f.y + dz * f.z) / (d || 1);
      if (dot < (d < 2 ? 0.3 : 0.82)) return;
      const score = d * (1.6 - dot);
      if (score < bestScore) { bestScore = score; best = { kind, obj, label, verb }; }
    };
    for (const a of this.actors) {
      if (a.removed || a.hidden) continue;
      const pos = { x: a.pos.x, y: a.pos.y + a.height * 0.7, z: a.pos.z };
      if (a.alive && a.npc) consider('talk', a, pos, 5.5, a.name + (a.npc.title ? ` — ${a.npc.title}` : ''), 'Talk');
      else if (!a.alive && a.loot && a.loot.length) consider('corpse', a, { x: a.pos.x, y: a.pos.y + 0.5, z: a.pos.z }, 4.5, a.name, 'Search');
    }
    for (const c of this.world.meta.containers) {
      if (this.looted.has(c.id) && !(this.containerLoot.get(c.id) || []).length) continue;
      const kindName = { chest: 'Chest', crate: 'Crate', barrel: 'Barrel', desk: 'Writing Desk', remains: 'Remains', roots: 'Hollow Roots' }[c.kind] || 'Container';
      consider('container', c, { x: c.x + 0.5, y: c.y + 0.5, z: c.z + 0.5 }, 4.5, kindName, 'Open');
    }
    for (const c of this.world.meta.campfires) {
      if (c.hearth) { consider('fire', c, { x: c.x, y: c.y + 0.6, z: c.z }, 4, 'Hearth', 'Cook'); continue; }
      consider('fire', c, { x: c.x, y: c.y + 0.4, z: c.z }, 4.5, c.name ? `Campfire — ${c.name}` : 'Campfire', 'Rest');
    }
    for (const p of this.pickups) if (!p.taken && p.mesh.visible) consider('pickup', p, p.mesh.position, 4, ITEMS[p.item].name, 'Take');
    for (const s of this.world.meta.signs) consider('sign', s, { x: s.x + 0.5, y: s.y + 4, z: s.z + 0.5 }, 5, 'Signpost', 'Read');
    // lighthouse lamp
    const lt = this.world.meta.spots['lighthouse.top'];
    if (lt && this.quests.stageOf('sq_light') === 'light') consider('lamp', lt, { x: lt.x, y: lt.y + 1.5, z: lt.z }, 5, 'Lamp Oil Reservoir', 'Fill');
    // harvestable plant voxel under crosshair
    const hit = this.world.raycast(eye.x, eye.y, eye.z, f.x, f.y, f.z, 5, PLANT_FILTER);
    if (hit && HARVEST[hit.b] && !(HARVEST[hit.b].n === 0)) {
      const sc = hit.dist * 0.9;
      if (sc < bestScore + 0.5) { best = { kind: 'harvest', obj: hit, label: HARVEST[hit.b].name, verb: 'Gather' }; bestScore = sc; }
    }
    return best;
  }

  interact(it) {
    const g = this;
    switch (it.kind) {
      case 'talk': this.startDialogue(it.obj); break;
      case 'corpse': this.ui.openLoot(it.obj.name, it.obj.loot, () => {}); break;
      case 'container': {
        const c = it.obj;
        if (!this.containerLoot.has(c.id)) {
          const loot = this.looted.has(c.id) ? [] : this.rollLoot(c.loot, hash2(c.x, c.z, 7) * 1e6 | 0);
          if (c.id === 'tents.chest') { loot.unshift({ id: 'sword_rusty', n: 1 }, { id: 'tunic_tattered', n: 1 }, { id: 'lantern_tin', n: 1 }); }
          if (c.id === 'wreck.chest' && this.quests.isActive('sq_net')) loot.unshift({ id: 'net', n: 1 });
          if (c.loot === 'lighthouse') { const i = loot.findIndex((l) => l.id === 'lantern_brass'); if (i >= 0) loot.splice(i, 1); }
          this.containerLoot.set(c.id, loot);
          this.looted.add(c.id);
        }
        this.audio.chest();
        this.ui.openLoot(it.label, this.containerLoot.get(c.id), () => { this.setFlag('loot_' + c.id); });
        break;
      }
      case 'fire': this.ui.openCampfire(it.obj); break;
      case 'pickup': it.obj.taken = true; it.obj.mesh.visible = false; this.inventory.add(it.obj.item, 1); this.fx.pickupGlint(it.obj.mesh.position); break;
      case 'sign': this.ui.toast(it.obj.text, 5); break;
      case 'lamp': if (this.inventory.has('lamp_oil')) { this.inventory.remove('lamp_oil', 1); this.setFlag('lighthouse_lit'); this.ui.toast('The great lamp flares to life. Its beam sweeps the dark sea.', 4); this.audio.fireBurst(this.player.pos); } else this.ui.toast('You need lamp oil.', 2); break;
      case 'harvest': {
        const h = it.obj, H = HARVEST[h.b];
        const n = (this.player.perks.has('herb_wise') && ['yarrow', 'comfrey', 'marigold'].includes(H.item)) ? 2 : 1;
        if (H.keep) {
          const key = `${h.x},${h.y},${h.z}`;
          if (this.harvested.has(key + ':' + this.time.day)) { this.ui.toast('Already picked clean today.', 1.5); break; }
          this.harvested.add(key + ':' + this.time.day);
        } else {
          this.world.set(h.x, h.y, h.z, B.AIR);
          this.harvested.add(`${h.x},${h.y},${h.z}`);
        }
        this.inventory.add(H.item, n);
        this.audio.harvest();
        this.fx.pickupGlint(new THREE.Vector3(h.x + 0.5, h.y + 0.5, h.z + 0.5));
        break;
      }
    }
  }

  startDialogue(a) {
    const id = a.npcId && DLG[a.npcId] ? a.npcId : 'villager';
    const def = DLG[id];
    if (a.sleepPose && !(a.npc && a.npc.alwaysTalk)) { this.ui.toast(`${a.name} is asleep.`, 1.5); return; }
    this.dialogue = { actor: a, def, id, speaking: true };
    this.events.emit('talk', { npc: a.npcId });
    this.ui.openDialogue(a, def, def.start(this, a));
  }
  endDialogue() { this.dialogue = null; }

  shopFor(a) {
    const key = (DLG[a.npcId] && DLG[a.npcId].shop) || a.npc.shop;
    if (!key) return null;
    if (!this.shopStock[key]) this.shopStock[key] = SHOPS[key].map(([id, n]) => ({ id, n }));
    return { key, stock: this.shopStock[key] };
  }
  price(id, buying) {
    const d = ITEMS[id];
    const P = this.player;
    let v = d.value || 1;
    if (buying) { v *= P.perks.has('haggler') ? 0.85 : 1; if (this.flags.haldor_discount) v *= 0.9; return Math.max(1, Math.round(v)); }
    v *= 0.4 * (P.perks.has('haggler') ? 1.15 : 1);
    return Math.max(d.type === 'quest' ? 0 : 1, Math.floor(v));
  }

  craft(r) {
    for (const [id, n] of Object.entries(r.needs)) if (!this.inventory.has(id, n)) return false;
    for (const [id, n] of Object.entries(r.needs)) this.inventory.remove(id, n);
    this.inventory.add(r.out, r.n);
    this.audio.craft();
    return true;
  }

  fastTravel(wp) {
    const P = this.player;
    for (const a of this.actors) if (a.aggro && a.alive && a.dist2D(P.pos) < 40) { this.ui.toast('Not with enemies about.', 2); return; }
    const dist = Math.hypot(wp.x - P.pos.x, wp.z - P.pos.z);
    const hours = Math.max(1, Math.round(dist / 9 / 60 * 2)); // walking time estimate
    this.ui.fadeRest(() => {
      P.pos.set(wp.x, wp.y + 1, wp.z); P.vel.set(0, 0, 0);
      this.advanceTime(hours);
      this.chunks.update(P.pos.x, P.pos.z, 1e9, true);
      this.lastRest = { x: wp.x, y: wp.y, z: wp.z, name: wp.name };
    }, hours, `You travel to ${wp.name}…`);
  }

  // ------------------------------------------------------------------ main update
  update(dt) {
    const P = this.player, input = this.input;
    if (this.state !== 'play') return;
    if (this.paused) return;
    const hitStop = P.hitStop > 0;
    const sdt = hitStop ? dt * 0.15 : dt;
    // time
    const dh = dt * this.time.scale;
    this.time.real += dt;
    this.advanceTimeSmall(dh);
    // ui hotkeys
    this.ui.handleKeys(input);
    // interaction
    if (!this.ui.blocking && !P.dead) {
      const it = this.findInteraction();
      this.ui.prompt(it);
      if (it && input.hit('KeyE')) this.interact(it);
    } else this.ui.prompt(null);
    P.update(sdt, input);
    // actors
    const px = P.pos.x, pz = P.pos.z;
    for (const a of this.actors) {
      if (a.removed) continue;
      const d = Math.abs(a.pos.x - px) + Math.abs(a.pos.z - pz);
      const near = d < 170;
      const chunkReady = this.world.hasChunk(Math.floor(a.pos.x / CS), Math.floor(a.pos.z / CS));
      a.rig.root.visible = near && !a.hidden && chunkReady;
      if (a.hidden) continue;
      if (!chunkReady) continue;
      if (near || a.aggro) a.update(sdt, true);
      else if (a.npc && (this.frame + a.id) % 20 === 0) a.update(sdt * 20, true);
      if (!a.alive && a.deadT > 120 && !(a.loot && a.loot.length && d < 40)) a.remove();
    }
    // simple separation between actors
    for (let i = 0; i < this.actors.length; i++) {
      const a = this.actors[i];
      if (!a.alive || a.ai === 'bird' || a.sleepPose) continue;
      for (let j = i + 1; j < this.actors.length; j++) {
        const b = this.actors[j];
        if (!b.alive || b.ai === 'bird' || b.sleepPose) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const r = a.radius + b.radius;
        if (Math.abs(dx) > r || Math.abs(dz) > r) continue;
        const d = Math.hypot(dx, dz);
        if (d < r && d > 0.001 && Math.abs(a.pos.y - b.pos.y) < 2) {
          const push = (r - d) * 0.5;
          a.pos.x -= dx / d * push; a.pos.z -= dz / d * push;
          b.pos.x += dx / d * push; b.pos.z += dz / d * push;
        }
      }
      // keep actors out of the player
      const dx = a.pos.x - P.pos.x, dz = a.pos.z - P.pos.z;
      const r = a.radius + P.radius;
      if (Math.abs(dx) < r && Math.abs(dz) < r && Math.abs(a.pos.y - P.pos.y) < 2.5) {
        const d = Math.hypot(dx, dz) || 0.01;
        if (d < r) { const push = (r - d); if (a.npc || a.height > 3.6) { P.pos.x -= dx / d * push; P.pos.z -= dz / d * push; } else { a.pos.x += dx / d * push * 0.5; a.pos.z += dz / d * push * 0.5; P.pos.x -= dx / d * push * 0.5; P.pos.z -= dz / d * push * 0.5; } }
      }
    }
    this.combat.update(sdt);
    this.spawner.update(dt);
    this.fx.update(sdt);
    this.scripts(dt);
    this.updateProps(dt);
    this.frame = (this.frame || 0) + 1;
  }

  advanceTimeSmall(dh) {
    this.time.total += dh;
    this.time.hour += dh;
    if (this.time.hour >= 24) { this.time.hour -= 24; this.time.day++; this.shopStock = {}; }
    this.checkDraughtTimer();
  }

  scripts(dt) {
    const P = this.player;
    this.scriptT = (this.scriptT || 0) - dt;
    if (this.scriptT > 0) return;
    this.scriptT = 0.5;
    // reach objectives
    for (const id of Object.keys(this.quests.state)) {
      if (!this.quests.isActive(id)) continue;
      const st = this.quests.stageDef(id);
      if (!st || !st.obj) continue;
      for (const o of Array.isArray(st.obj) ? st.obj : [st.obj]) {
        if (o.type !== 'reach') continue;
        const sp = this.world.meta.spots[o.spot];
        if (sp && Math.hypot(sp.x - P.pos.x, sp.z - P.pos.z) < (o.r || 14) && Math.abs(sp.y - P.pos.y) < 10) this.events.emit('reach', { id: o.spot });
      }
    }
    // discovery of places
    for (const poi of POIS) {
      if (this.discovered.has(poi.id)) continue;
      if (Math.hypot(poi.x - P.pos.x, poi.z - P.pos.z) < 45) {
        this.discovered.add(poi.id);
        this.ui.discover(poi.name);
        P.gainXp(25, 'Discovery');
      }
    }
    // waypoint discovery
    for (const c of this.world.meta.campfires) if (c.id && !this.waypointsKnown.has(c.id) && Math.hypot(c.x - P.pos.x, c.z - P.pos.z) < 12) { this.waypointsKnown.add(c.id); this.ui.toast(`Campfire found: ${c.name}. You can rest and travel here.`, 3); }
    // Osric parley
    if (!this.flags.osric_parley && this.quests.stageOf('mq_greywater') === 'osric') {
      const o = this.actors.find((a) => a.unique === 'osric' && a.alive);
      if (o && o.dist2D(P.pos) < 13 && !this.dialogue) { o.flags.pacified = true; this.startDialogue({ ...o, npcId: 'osric', npc: { name: 'Red Osric', title: 'Bandit Chief', alwaysTalk: true }, name: 'Red Osric', rig: o.rig, pos: o.pos, height: o.height, isProxy: true, real: o }); }
    }
    // Caer Dawn gate
    if (!this.flags.cd_pass && P.pos.x > 1414 && P.pos.x < 1566 && P.pos.z > 558 && P.pos.z < 724) {
      const sp = this.world.meta.spots['cd.gate'];
      P.pos.set(sp.x, sp.y + 0.5, sp.z + 4); P.vel.set(0, 0, 0);
      this.ui.toast('"Halt! No one enters Caer Dawn without a writ of passage."', 3);
    }
    // corvin in cell visible when quest has started
    this.npcs.updateVisibility();
    // pickups visibility
    for (const p of this.pickups) p.mesh.visible = !p.taken && !this.inventory.has(p.item) && p.cond(this);
    // pip follows home when saved
    // malric awakens when reaching vault
    if (this.quests.stageOf('mq_kingsfall') === 'malric' || this.quests.stageOf('mq_kingsfall') === 'dungeon') {
      const m = this.actors.find((a) => a.unique === 'malric' && a.alive);
      if (m && m.dist2D(P.pos) < 20 && !m.aggro && Math.abs(m.pos.y - P.pos.y) < 6) m.becomeAggro(P);
    }
    // region / indoor detection
    this.updateRegion();
  }

  updateRegion() {
    const P = this.player;
    const x = Math.floor(P.pos.x), z = Math.floor(P.pos.z);
    const i = Math.max(0, Math.min(WX * WZ - 1, z * WX + x));
    this.biome = this.world.biome[i];
    // indoor if something solid above head within 24
    const eye = P.eyePos(new THREE.Vector3());
    const up = this.world.raycast(eye.x, eye.y, eye.z, 0.0001, 1, 0.0001, 24);
    this.indoor = !!up;
    this.underground = this.indoor && eye.y < this.world.height[i] - 1;
    let best = null, bd = 1e9;
    for (const [id, R] of Object.entries(REGIONS)) { const d = Math.hypot(R.x - x, R.z - z) / R.r; if (d < bd) { bd = d; best = id; } }
    if (best !== this.region) { this.region = best; }
  }

  updateProps(dt) {
    const P = this.player;
    // doors
    for (const D of this.doors) {
      if (Math.abs(D.cx - P.pos.x) > 40 || Math.abs(D.cz - P.pos.z) > 40) { D.g.visible = false; continue; }
      D.g.visible = true;
      let near = Math.hypot(D.cx - P.pos.x, D.cz - P.pos.z) < 3.2;
      if (!near) for (const a of this.npcs.list) if (Math.abs(a.pos.x - D.cx) < 3 && Math.abs(a.pos.z - D.cz) < 3 && Math.hypot(a.pos.x - D.cx, a.pos.z - D.cz) < 2.6) { near = true; break; }
      const tgt = near ? 1 : 0;
      if (tgt !== D.target) { D.target = tgt; if (Math.hypot(D.cx - P.pos.x, D.cz - P.pos.z) < 20) this.audio.door(tgt); }
      D.open += (tgt - D.open) * Math.min(1, dt * 6);
      D.g.rotation.y = D.base + D.open * 1.6;
    }
    for (const M of this.mills) { M.g.rotation.z = 0; M.g.children.forEach((c, k) => { if (k < 4) c.rotation.z = k * Math.PI / 2 + this.time.real * 0.5 * (0.5 + this.weather.cur.wind); }); }
    // fires, smoke, ambient particles near player
    const camp = this.world.meta.campfires;
    for (const c of camp) {
      const d = Math.abs(c.x - P.pos.x) + Math.abs(c.z - P.pos.z);
      if (d < 70) this.fx.campfire(c.x, c.y + (c.hearth ? 0 : 0), c.z, dt, c.hearth);
    }
    this.smokeT = (this.smokeT || 0) - dt;
    if (this.smokeT <= 0) {
      this.smokeT = 0.35;
      for (const s of this.world.meta.smoke) if (Math.abs(s.x - P.pos.x) + Math.abs(s.z - P.pos.z) < 140) this.fx.smoke(s.x, s.y, s.z, this.weather.cur.wind * 0.8);
    }
    // ambient: leaves in forests, fireflies at night, blight motes in mire
    const r = Math.random();
    if (this.biome === BIOME.WEALD && r < dt * 6 && !this.indoor) this.fx.leaf(P.pos.x + (Math.random() - 0.5) * 30, P.pos.y + 12 + Math.random() * 6, P.pos.z + (Math.random() - 0.5) * 30, Math.random() < 0.5 ? 0x5a7a2a : 0x8a7a2a, this.weather.cur.wind * 0.5);
    if (this.isNight() && (this.biome === BIOME.MEADOW || this.biome === BIOME.WEALD || this.biome === BIOME.MIRE) && r < dt * 4 && !this.indoor) this.fx.firefly(P.pos.x + (Math.random() - 0.5) * 30, P.pos.y + 1 + Math.random() * 3, P.pos.z + (Math.random() - 0.5) * 30);
    if (this.player.fog > 0.05 && Math.random() < dt * 25 * this.player.fog) this.fx.mote(P.pos.x + (Math.random() - 0.5) * 16, P.pos.y + Math.random() * 6, P.pos.z + (Math.random() - 0.5) * 16, 0x9a8aa8);
    // pickups spin
    for (const p of this.pickups) if (p.mesh.visible) { p.mesh.rotation.y += dt * 1.5; if (Math.random() < dt * 2) this.fx.pickupGlint(p.mesh.position); }
    this.dynLights = this.dynLights.filter((l) => (l.t -= dt) > 0);
  }

  // assign nearest light sources to the point light pool
  updateLights() {
    const P = this.player, R = this.renderer;
    const night = this.sky ? this.sky.night : 0;
    const cands = [];
    const consider = (l) => {
      const d = Math.hypot(l.x - P.pos.x, l.y - P.pos.y, l.z - P.pos.z);
      if (d > 70 && !l.beacon) return;
      cands.push({ l, d: d - (l.beacon ? 60 : 0) });
    };
    for (const l of this.world.meta.lights) { if (Math.abs(l.x - P.pos.x) > 80 || Math.abs(l.z - P.pos.z) > 80) { if (!l.beacon) continue; } consider(l); }
    for (const l of this.dynLights) consider(l);
    cands.sort((a, b) => a.d - b.d);
    const t = this.time.real;
    const lightOn = (l) => l.beacon ? (this.flags.lighthouse_lit ? 1 : 0) : 1;
    for (let i = 0; i < R.points.length; i++) {
      const p = R.points[i];
      const c = cands[i];
      if (!c) { p.intensity = 0; continue; }
      const l = c.l;
      p.position.set(l.x, l.y, l.z);
      p.color.setHex(l.color);
      p.distance = l.radius;
      const fl = l.flicker ? 0.85 + Math.sin(t * 11 + l.x) * 0.08 + Math.sin(t * 23 + l.z) * 0.07 : 1;
      const dayDim = this.indoor || this.underground ? 1 : 0.25 + night * 0.75;
      p.intensity = l.intensity * fl * 9 * dayDim * lightOn(l) * Math.min(1, Math.max(0, 1 - (c.d - 50) / 20));
    }
    // player lantern
    const lan = P.lantern;
    const want = lan && !P.lanternOff && (night > 0.2 || this.indoor || this.underground);
    const strength = lan ? lan.light / 60 * (P.perks.has('lantern_bearer') ? 1.4 : 1) : 0;
    this.playerLight.intensity += ((want ? 11 * strength * (0.94 + Math.sin(t * 13) * 0.05) : 0) - this.playerLight.intensity) * 0.2;
    this.playerLight.distance = 22 * strength + 4;
    const f = P.forward(new THREE.Vector3());
    this.playerLight.position.set(P.pos.x - f.z * 0.8 + f.x * 0.6, P.pos.y + 2.4, P.pos.z + f.x * 0.8 + f.z * 0.6);
  }

  render(dt) {
    const P = this.player, R = this.renderer, cam = R.camera;
    // camera
    const eye = P.eyePos(new THREE.Vector3());
    const shake = P.camShake;
    P.camShake = Math.max(0, P.camShake - dt * 1.5);
    const bobY = Math.abs(Math.sin(P.bob)) * 0.12 * P.bobAmt;
    const bobX = Math.cos(P.bob) * 0.06 * P.bobAmt;
    cam.position.set(eye.x + (Math.random() - 0.5) * shake * 0.25, eye.y + bobY - (P.sneak ? 0.8 : 0) + (Math.random() - 0.5) * shake * 0.25 - (P.dead ? 2.6 : 0), eye.z);
    cam.rotation.order = 'YXZ';
    cam.rotation.set(P.pitch, P.yaw, (P.dead ? 0.6 : 0) + bobX * 0.02 + (P.dodgeT > 0 ? Math.sin(P.dodgeT * 12) * 0.03 : 0));
    const fovTarget = (this.ui.settings.fov || 72) + (P.sprinting ? 6 : 0) - (P.drawing ? P.draw * 12 : 0);
    cam.fov += (fovTarget - cam.fov) * Math.min(1, dt * 6);
    cam.updateProjectionMatrix();
    // environment
    const regionMire = this.biome === BIOME.MIRE;
    const w = this.weather.update(dt, dt * this.time.scale, cam.position, { cold: this.biome === BIOME.SNOW || P.pos.y > 92, dry: false }, this.sky || { hor: new THREE.Color(0.6, 0.6, 0.6), night: 0 });
    const baseFog = 0.0032 * w.fog * (this.biome === BIOME.WEALD ? 1.35 : 1) * (this.indoor ? 0.6 : 1);
    const mireFog = this.player.fog * 0.03 + (regionMire ? 0.004 : 0);
    const env = {
      hour: this.time.hour, time: this.time.real, overcast: Math.min(1, w.overcast + (regionMire ? 0.3 : 0)), fogDensity: baseFog + mireFog + (this.underground ? 0.01 : 0),
      fogTint: regionMire ? new THREE.Color(0.42, 0.44, 0.36) : null, fogTintAmt: regionMire ? 0.5 + P.fog * 0.4 : 0, wind: w.wind, rain: w.rain,
      aurora: this.time.day % 3 === 0 ? 1 : 0.3, murk: regionMire ? 0.6 : 0, indoor: this.indoor, saturation: regionMire ? 0.6 : this.biome === BIOME.SNOW ? 0.78 : 0.8,
    };
    this.sky = R.updateEnvironment(env);
    this.chunks.cullRadius = Math.max(380, Math.min(1150, 2.1 / env.fogDensity));
    if (w.flash > 0) { R.hemi.intensity += w.flash * 3; R.sky.uniforms.uZen.value.lerp(new THREE.Color(0.8, 0.85, 1), w.flash * 0.5); }
    if (this.underground) { R.hemi.intensity *= 0.25; R.sun.intensity *= 0.1; }
    // grading effects
    const g = R.grade.uniforms;
    g.uHurt.value = Math.max(0, Math.min(1, (0.35 - P.hp / P.maxHp) * 2.2)) + (this.ui.hurtFlash || 0);
    g.uFogMask.value = Math.min(1, P.fog * (P.maskTime > 0 && this.inventory.has('fog_mask') ? 0.35 : 1));
    if (this.fx.flashT > 0) R.renderer.toneMappingExposure += this.fx.flashT * 2;
    this.updateLights();
    if (this.state === 'play' || this.state === 'title') this.chunks.update(P.pos.x, P.pos.z, this.state === 'title' ? 12 : 7);
    if (this.viewmodel) this.viewmodel.update(dt);
    R.vp.enabled = this.state === 'play' && !P.dead;
    R.render();
  }
}

const PLANT_FILTER = new Uint8Array(256);
for (let i = 0; i < 256; i++) PLANT_FILTER[i] = SOLID[i] || HARVEST[i] ? 1 : 0;

import { boxShape } from '../entities/voxmodel.js';
const THREE_HELPERS = { boxShape };
