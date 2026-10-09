// DOM user interface: HUD, book, dialogue, trade, loot, campfire, menus.
import * as THREE from 'three';
import { ITEMS, CATEGORIES, RARITY_COLOR, RARITY_NAME, TYPE_NAME, RECIPES } from '../game/items.js';
import { PERKS } from '../game/player.js';
import { iconURL, portraitURL, PaperDoll } from './icons.js';
import { COLORS, B, SRGB } from '../world/blocks.js';
import { WX, WZ, SEA } from '../world/world.js';
import { POIS, REGIONS } from '../world/layout.js';

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const POI_GLYPH = { village: '⌂', castle: '♜', ruin: '⛫', camp: '⛺', danger: '☠', cave: '◒', tower: '♖', house: '⌂', secret: '✦', landmark: '❀' };

export class UI {
  constructor(game) {
    this.g = game;
    this.root = $('#ui');
    this.settings = { quality: 'high', sens: 1, fov: 72, view: 176, touch: 'ontouchstart' in window, subtitles: true, volume: 0.8 };
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem('avalon_settings') || '{}')); } catch (e) { /* ignore */ }
    this.modal = null; // 'book' | 'dialogue' | 'loot' | 'shop' | 'fire' | 'pause' | 'title' | 'ending'
    this.toasts = [];
    this.dmgs = [];
    this.hurtFlash = 0;
    this.bookTab = 'satchel';
    this.cat = 'all';
    this.sel = null;
    this.buildHUD();
    this.buildTouch();
  }

  get blocking() { return !!this.modal || this.g.player?.dead; }
  get hideViewModel() { return this.modal === 'book' || this.modal === 'title' || this.modal === 'ending'; }

  saveSettings() { try { localStorage.setItem('avalon_settings', JSON.stringify(this.settings)); } catch (e) { /* ignore */ } }
  applySettings() {
    const g = this.g;
    g.renderer.setQuality(this.settings.quality);
    g.input.sensitivity = this.settings.sens;
    if (g.chunks) g.chunks.nearRadius = this.settings.view;
    g.audio.setVolume(this.settings.volume);
    $('#touch').classList.toggle('hidden', !this.settings.touch || g.state !== 'play');
  }

  // ------------------------------------------------------------------ HUD
  buildHUD() {
    const r = this.root;
    r.innerHTML = `
    <div id="hud" class="hidden">
      <div id="compass"></div><div id="compass-notch"></div>
      <div id="bossbar" class="hidden"><div class="name"></div><div class="bar"><div class="lag"></div><div class="fill"></div></div></div>
      <div id="minimap-wrap"><canvas id="minimap" width="304" height="304"></canvas><div id="minimap-frame"></div><div id="clock"></div></div>
      <div id="tracker" class="dark-frame orn hidden"><div class="chap"></div><div class="qname"></div><div class="obj"></div><div class="dist"></div></div>
      <div id="abilities"></div>
      <div id="vitals"><div id="medal"><div class="lv">I</div><div class="lt">LEVEL</div></div>
        <div id="bars"><div id="counters"><div class="pill"><span class="coin"></span><span id="goldn">0</span></div><div class="pill" id="arrowpill">➶ <span id="arrown">0</span></div><div class="pill hidden" id="maskpill">⛆ <span id="maskn">0</span>s</div></div>
          <div class="bar hp"><div class="ghost"></div><div class="f"></div><div class="txt"></div></div>
          <div class="bar res"><div class="f"></div></div>
          <div class="bar st"><div class="f"></div></div>
          <div class="bar xp"><div class="f"></div></div>
        </div></div>
      <div id="quick"><div class="dia"></div><img alt=""><div class="n"></div><div class="key use">X</div><div class="key cyc">Z</div></div>
      <div id="weaponmode"></div>
      <div id="crosshair"></div>
      <div id="prompt"></div>
      <div id="toasts"></div>
      <div id="subtitle"></div>
      <div id="pickups"></div>
      <div id="banner"></div>
      <div id="xpfloat"></div>
      <div id="dmglayer"></div>
    </div>
    <div id="touch" class="hidden"></div>
    <div id="modal"></div>
    <div id="death"><div class="t">You Have Fallen</div><div class="s"></div></div>
    <div id="fade"></div>`;
    this.compass = $('#compass');
    // compass ticks (built once, positioned per frame)
    this.cTicks = [];
    for (let deg = 0; deg < 360; deg += 15) {
      const t = el('div', 'tick' + (deg % 45 === 0 ? ' big' : ''));
      this.compass.appendChild(t);
      let lbl = null;
      if (deg % 45 === 0) {
        const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
        lbl = el('div', 'lbl' + (deg % 90 === 0 ? ' card' : '') + (deg === 0 ? ' n' : ''), names[deg]);
        this.compass.appendChild(lbl);
      }
      this.cTicks.push({ deg, t, lbl });
    }
    this.cMarks = [];
    const ab = $('#abilities');
    const icons = { 1: '⚔', 2: '⛨', 3: '📯', 4: '❖' };
    for (let i = 1; i <= 4; i++) ab.appendChild(el('div', 'abil', `${icons[i]}<span class="k">${i}</span>`));
    const fr = $('#minimap-frame');
    for (const [l, x, y] of [['N', 50, 4], ['E', 96, 50], ['S', 50, 96], ['W', 4, 50]]) { const d = el('div', 'rose', l); d.style.left = x + '%'; d.style.top = y + '%'; d.dataset.l = l; fr.appendChild(d); }
    this.mm = $('#minimap').getContext('2d');
  }

  show(id, on) { const e = $(id); if (e) e.classList.toggle('hidden', !on); }

  toast(text, dur = 2) {
    const box = $('#toasts');
    const t = el('div', 'toast', esc(text));
    box.appendChild(t);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(() => t.remove(), dur * 1000);
  }
  subtitle(name, text, actor) {
    if (!this.settings.subtitles) return;
    const s = $('#subtitle');
    s.innerHTML = `<b>${esc(name)}</b>${esc(text)}`;
    clearTimeout(this.subT);
    this.subT = setTimeout(() => { s.innerHTML = ''; }, 3200);
  }
  pickup(id, n) {
    const box = $('#pickups');
    const name = id === 'gold' ? 'Crowns' : ITEMS[id].name;
    const icon = id === 'gold' ? iconURL('coins') : iconURL(id);
    const p = el('div', 'pick', `<img src="${icon}" alt=""><span>${esc(name)}</span><span class="n">×${n}</span>`);
    if (id !== 'gold') p.querySelector('span').style.color = RARITY_COLOR[ITEMS[id].rarity];
    box.appendChild(p);
    while (box.children.length > 6) box.removeChild(box.firstChild);
    setTimeout(() => p.remove(), 3500);
    this.g.audio.pickup();
  }
  xpPopup(n, why) {
    const x = $('#xpfloat');
    x.textContent = `+${n} XP${why ? ' · ' + why : ''}`;
    x.style.opacity = 1;
    clearTimeout(this.xpT);
    this.xpT = setTimeout(() => { x.style.transition = 'opacity 1s'; x.style.opacity = 0; }, 1600);
    x.style.transition = 'none';
  }
  banner(kind, title, sub = '', cls = '') {
    const b = $('#banner');
    b.className = '';
    void b.offsetWidth;
    b.innerHTML = `<div class="kind">${esc(kind)}</div><div class="rule"></div><div class="title">${esc(title)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}<div class="rule"></div>`;
    b.className = 'banner-in ' + cls;
  }
  questBanner(kind, name, sub) { this.banner(kind, name, sub || ''); }
  discover(name) { this.banner('Discovered', name); this.g.audio.discover(); }
  levelUp(lv) { this.banner('Level Up', `Level ${lv}`, 'You have new points to spend. Open the Bearer page [K].'); }
  hurt(n) { this.hurtFlash = Math.min(0.6, 0.25 + n / 60); }
  damageNumber(a, n, heavy) { this.dmgs.push({ a, n, heavy, t: 0.9, x: (Math.random() - 0.5) * 30, el: null }); }
  flashAbility(i) { const e = $('#abilities').children[i - 1]; e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); }

  setBoss(a) { this.boss = a; this.show('#bossbar', !!a); if (a) $('#bossbar .name').textContent = a.name; }

  prompt(it) {
    const p = $('#prompt');
    if (!it) { if (this.lastPrompt) { p.innerHTML = ''; this.lastPrompt = null; } return; }
    const key = it.kind + it.label;
    if (key === this.lastPrompt) return;
    this.lastPrompt = key;
    p.innerHTML = `<span class="key">E</span><span class="verb">${esc(it.verb)}</span>${esc(it.label)}`;
  }

  roman(n) { const R = [['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1]]; let s = ''; for (const [l, v] of R) while (n >= v) { s += l; n -= v; } return s; }

  update(dt) {
    const g = this.g, P = g.player;
    if (g.state !== 'play') return;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.5);
    if (this.modal === 'book' && this.doll && this.bookTab === 'satchel') this.doll.render(g.time.real);
    // bars
    const set = (sel, frac) => { const e = $(sel); const w = Math.max(0, Math.min(1, frac)) * 100 + '%'; if (e.style.width !== w) e.style.width = w; };
    set('#bars .hp .f', P.hp / P.maxHp); set('#bars .hp .ghost', P.hp / P.maxHp);
    set('#bars .res .f', P.resolve / P.maxResolve); set('#bars .st .f', P.stamina / P.maxStamina); set('#bars .xp .f', P.xp / P.xpNext);
    $('#bars .hp .txt').textContent = `${Math.ceil(Math.max(0, P.hp))} / ${P.maxHp}`;
    $('#medal .lv').textContent = this.roman(P.level);
    $('#goldn').textContent = P.gold;
    const arrows = g.inventory.count('arrow');
    $('#arrown').textContent = arrows;
    this.show('#arrowpill', !!P.bow || arrows > 0);
    const masked = g.inventory.has('fog_mask');
    this.show('#maskpill', masked && (P.maskTime > 0 || P.fog > 0));
    if (masked) $('#maskn').textContent = Math.ceil(P.maskTime);
    // abilities
    const abl = $('#abilities').children;
    for (let i = 1; i <= 4; i++) {
      const id = Object.keys(PERKS).find((k) => PERKS[k].ability === i);
      const have = P.perks.has(id);
      abl[i - 1].className = 'abil' + (have ? '' : ' locked') + (have && P.resolve < PERKS[id].cost ? ' low' : '') + (abl[i - 1].classList.contains('flash') ? ' flash' : '');
      abl[i - 1].title = PERKS[id].name;
    }
    // quickslot
    P.refreshQuick();
    const qid = P.quick[P.quickIdx];
    const qi = $('#quick img');
    if (qid) { const u = iconURL(qid); if (qi.dataset.id !== qid) { qi.src = u; qi.dataset.id = qid; } qi.style.display = ''; $('#quick .n').textContent = g.inventory.count(qid); }
    else { qi.style.display = 'none'; $('#quick .n').textContent = ''; qi.dataset.id = ''; }
    $('#weaponmode').innerHTML = P.mode === 'bow' && P.bow ? `${esc(P.bow.name)}<br><span style="opacity:.7">[B] swap</span>` : `${esc(P.equip.main ? ITEMS[P.equip.main].name : 'Fists')}${P.sheathed ? ' (sheathed)' : ''}${P.bow ? '<br><span style="opacity:.7">[B] bow</span>' : ''}`;
    $('#crosshair').className = (P.atk && P.atk.phase === 'charge') || (P.drawing && P.draw > 0.95) ? 'charge' : '';
    // boss bar
    if (this.boss) {
      if (!this.boss.alive || this.boss.removed) this.setBoss(null);
      else { $('#bossbar .fill').style.width = (this.boss.hp / this.boss.maxHp * 100) + '%'; $('#bossbar .lag').style.width = (this.boss.hp / this.boss.maxHp * 100) + '%'; }
    } else {
      // show the nearest aggro enemy being fought
      let best = null, bd = 18;
      for (const a of g.actors) if (a.alive && a.aggro && a.isHostile) { const d = a.dist2D(P.pos); if (d < bd) { bd = d; best = a; } }
      if (best) { this.show('#bossbar', true); $('#bossbar .name').textContent = best.name; $('#bossbar .fill').style.width = (best.hp / best.maxHp * 100) + '%'; $('#bossbar .lag').style.width = (best.hp / best.maxHp * 100) + '%'; }
      else this.show('#bossbar', false);
    }
    this.updateCompass();
    this.updateTracker();
    this.drawMinimap();
    const h = g.time.hour, hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    $('#clock').textContent = `Day ${g.time.day} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    // damage numbers
    const layer = $('#dmglayer');
    const cam = g.renderer.camera;
    const v = new THREE.Vector3();
    for (const d of this.dmgs) {
      d.t -= dt;
      if (!d.el) { d.el = el('div', 'dmg' + (d.heavy ? ' heavy' : ''), d.n); layer.appendChild(d.el); }
      v.set(d.a.pos.x, d.a.pos.y + d.a.height + 0.5 + (0.9 - d.t) * 1.5, d.a.pos.z).project(cam);
      if (v.z > 1) { d.el.style.display = 'none'; continue; }
      d.el.style.display = '';
      d.el.style.left = ((v.x * 0.5 + 0.5) * innerWidth + d.x) + 'px';
      d.el.style.top = ((-v.y * 0.5 + 0.5) * innerHeight) + 'px';
      d.el.style.opacity = Math.min(1, d.t * 2);
    }
    for (const d of this.dmgs) if (d.t <= 0 && d.el) d.el.remove();
    this.dmgs = this.dmgs.filter((d) => d.t > 0);
    // explored map cells
    const cx = Math.floor(P.pos.x / 32), cz = Math.floor(P.pos.z / 32);
    g.explored = g.explored || new Set();
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) g.explored.add((cz + dz) * 64 + cx + dx);
  }

  heading() { return -this.g.player.yaw; }
  bearing(dx, dz) { return Math.atan2(dx, -dz); }

  updateCompass() {
    const g = this.g, P = g.player;
    const h = this.heading();
    const W = this.compass.clientWidth;
    const pos = (ang) => { const rel = angDiff(h, ang); return Math.abs(rel) > Math.PI * 0.55 ? null : W / 2 + (rel / (Math.PI / 2)) * (W / 2); };
    for (const c of this.cTicks) {
      const x = pos((c.deg * Math.PI) / 180);
      c.t.style.display = x === null ? 'none' : '';
      if (x !== null) c.t.style.left = x + 'px';
      if (c.lbl) { c.lbl.style.display = x === null ? 'none' : ''; if (x !== null) c.lbl.style.left = x + 'px'; }
    }
    // markers
    const marks = [];
    const tgt = g.quests.target();
    if (tgt) marks.push({ cls: 'quest', glyph: '◆', x: tgt.x, z: tgt.z });
    for (const poi of POIS) if (g.discovered.has(poi.id) && Math.hypot(poi.x - P.pos.x, poi.z - P.pos.z) < 260) marks.push({ cls: 'poi', glyph: POI_GLYPH[poi.type] || '•', x: poi.x, z: poi.z });
    for (const a of g.actors) if (a.alive && a.aggro && a.isHostile && a.dist2D(P.pos) < 40) marks.push({ cls: 'enemy', glyph: '●', x: a.pos.x, z: a.pos.z });
    while (this.cMarks.length < marks.length) { const e = el('div', 'mk'); this.compass.appendChild(e); this.cMarks.push(e); }
    this.cMarks.forEach((e, i) => {
      const m = marks[i];
      if (!m) { e.style.display = 'none'; return; }
      const x = pos(this.bearing(m.x - P.pos.x, m.z - P.pos.z));
      if (x === null) { e.style.display = 'none'; return; }
      e.style.display = ''; e.className = 'mk ' + m.cls; e.textContent = m.glyph; e.style.left = x + 'px';
    });
  }

  updateTracker() {
    const g = this.g, P = g.player;
    const id = g.quests.tracked;
    const tr = $('#tracker');
    if (!id || !g.quests.isActive(id)) { tr.classList.add('hidden'); return; }
    tr.classList.remove('hidden');
    const d = g.quests.def(id), st = g.quests.stageDef(id);
    $('#tracker .chap').textContent = d.main ? `The Withering · ${d.chapter || ''}` : 'Side Tale';
    $('#tracker .qname').textContent = d.name;
    let objText = st ? st.text : '';
    if (st && st.obj && !Array.isArray(st.obj) && st.obj.type === 'kill' && st.obj.n > 1) objText += ` (${g.quests.state[id].counts[st.obj.tag] || 0}/${st.obj.n})`;
    if (st && st.obj && !Array.isArray(st.obj) && st.obj.type === 'item' && st.obj.n > 1) objText += ` (${Math.min(st.obj.n, g.inventory.count(st.obj.id))}/${st.obj.n})`;
    if (st && Array.isArray(st.obj) && id === 'sq_pages') objText += ` (${[1, 2, 3, 4, 5, 6, 7, 8].filter((i) => g.inventory.has('page' + i)).length}/8)`;
    $('#tracker .obj').textContent = objText;
    const t = g.quests.target(id);
    if (t) {
      const dx = t.x - P.pos.x, dz = t.z - P.pos.z;
      const dist = Math.hypot(dx, dz);
      const paces = Math.round(dist / 1.5);
      const dir = DIRS[((Math.round(this.bearing(dx, dz) / (Math.PI / 4)) % 8) + 8) % 8];
      $('#tracker .dist').textContent = paces < 8 ? 'close by' : `${paces} paces ${dir}${Math.abs(t.y - P.pos.y) > 8 && paces < 60 ? (t.y < P.pos.y ? ', below' : ', above') : ''}`;
    } else $('#tracker .dist').textContent = '';
  }

  // ------------------------------------------------------------------ maps
  buildMaps() {
    const w = this.g.world;
    const S = 2, N = WX / S;
    const cv = document.createElement('canvas'); cv.width = N; cv.height = N;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(N, N);
    const pv = document.createElement('canvas'); pv.width = N; pv.height = N;
    const pctx = pv.getContext('2d');
    const pimg = pctx.createImageData(N, N);
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const i = (z * S) * WX + x * S;
      const h = w.height[i], s = w.surf[i], wl = w.water[i];
      let r, g, b;
      const hex = SRGB[s];
      r = (hex >> 16) & 255; g = (hex >> 8) & 255; b = hex & 255;
      const hx = w.height[Math.min(WX * WZ - 1, i + S)] - h, hz = w.height[Math.min(WX * WZ - 1, i + S * WX)] - h;
      const shade = 1 + (-hx - hz) * 0.06 + (h - 45) * 0.004;
      r *= shade; g *= shade; b *= shade;
      if (wl > h) { const dpt = Math.min(1, (wl - h) / 6); r = 52 - dpt * 20; g = 82 - dpt * 20; b = 92 - dpt * 10; }
      const o = (z * N + x) * 4;
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
      // parchment version
      const l = (r * 0.3 + g * 0.55 + b * 0.15) / 255;
      let pr = 120 + l * 120, pg = 96 + l * 105, pb = 60 + l * 70;
      if (wl > h) { pr = 108; pg = 128; pb = 120; }
      if (h % 8 === 0 && wl <= h && (Math.abs(hx) + Math.abs(hz)) > 0) { pr *= 0.82; pg *= 0.8; pb *= 0.78; }
      if (s === B.DIRT_PATH || s === B.GRAVEL || s === B.COBBLE) { pr = 120; pg = 80; pb = 50; }
      pimg.data[o] = pr; pimg.data[o + 1] = pg; pimg.data[o + 2] = pb; pimg.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    pctx.putImageData(pimg, 0, 0);
    // buildings
    ctx.fillStyle = 'rgba(70,40,30,0.95)'; pctx.fillStyle = 'rgba(70,40,25,0.9)';
    for (const it of w.meta.interiors) { if (it.dungeon) continue; ctx.fillRect(it.x0 / S, it.z0 / S, (it.x1 - it.x0) / S, (it.z1 - it.z0) / S); pctx.fillRect(it.x0 / S, it.z0 / S, (it.x1 - it.x0) / S, (it.z1 - it.z0) / S); }
    this.mapImg = cv; this.parchMap = pv; this.mapS = S;
  }

  drawMinimap() {
    const g = this.g, P = g.player, ctx = this.mm;
    const W = ctx.canvas.width, C = W / 2, R = W / 2;
    const scale = 2.1 * (W / 152); // canvas px per image px
    ctx.save();
    ctx.clearRect(0, 0, W, W);
    ctx.beginPath(); ctx.arc(C, C, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#2a3a3a'; ctx.fillRect(0, 0, W, W);
    ctx.translate(C, C);
    const rot = P.yaw;
    ctx.rotate(rot);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.mapImg, -P.pos.x / this.mapS * scale, -P.pos.z / this.mapS * scale, this.mapImg.width * scale, this.mapImg.height * scale);
    // markers
    const toMap = (x, z) => [(x - P.pos.x) / this.mapS * scale, (z - P.pos.z) / this.mapS * scale];
    for (const c of g.world.meta.campfires) { if (c.hearth) continue; const [mx, mz] = toMap(c.x, c.z); if (Math.hypot(mx, mz) < R) { ctx.fillStyle = '#ff9a30'; ctx.beginPath(); ctx.arc(mx, mz, 4, 0, 7); ctx.fill(); } }
    for (const a of g.actors) {
      if (!a.alive || a.hidden) continue;
      const [mx, mz] = toMap(a.pos.x, a.pos.z);
      if (Math.hypot(mx, mz) > R) continue;
      if (a.npc && !a.npc.generic) { ctx.fillStyle = '#ffd870'; ctx.fillRect(mx - 3, mz - 3, 6, 6); }
      else if (a.npc) { ctx.fillStyle = 'rgba(240,230,200,0.7)'; ctx.fillRect(mx - 2, mz - 2, 4, 4); }
      else if (a.aggro && a.isHostile) { ctx.fillStyle = '#e03020'; ctx.beginPath(); ctx.arc(mx, mz, 4, 0, 7); ctx.fill(); }
    }
    const t = g.quests.target();
    if (t) {
      let [mx, mz] = toMap(t.x, t.z);
      const d = Math.hypot(mx, mz);
      if (d > R - 12) { mx *= (R - 12) / d; mz *= (R - 12) / d; }
      ctx.save(); ctx.translate(mx, mz); ctx.rotate(-rot);
      ctx.fillStyle = '#ffcf5a'; ctx.strokeStyle = '#3a1a00'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(7, 0); ctx.lineTo(0, 9); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    // player arrow (always up)
    ctx.save(); ctx.translate(C, C);
    ctx.fillStyle = '#c82a1a'; ctx.strokeStyle = '#2a0a04'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(8, 9); ctx.lineTo(0, 4); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // rose labels rotate with map
    for (const d of $('#minimap-frame').querySelectorAll('.rose')) {
      const base = { N: 0, E: Math.PI / 2, S: Math.PI, W: -Math.PI / 2 }[d.dataset.l];
      const a = base + rot;
      d.style.left = 50 + Math.sin(a) * 46 + '%'; d.style.top = 50 - Math.cos(a) * 46 + '%';
    }
  }

  // ------------------------------------------------------------------ modal plumbing
  openModal(name, html, cls = '') {
    const m = $('#modal');
    m.innerHTML = html;
    m.className = 'interactive ' + cls;
    this.modal = name;
    this.g.input.unlock();
    this.g.audio.ui('open');
    return m;
  }
  closeModal(relock = true) {
    const m = $('#modal');
    m.innerHTML = ''; m.className = '';
    const was = this.modal;
    this.modal = null;
    if (this.doll) { this.doll = null; }
    if (['pause', 'settings', 'controls'].includes(was)) this.g.paused = false;
    if (was === 'fire') this.atFire = null;
    if (relock && this.g.state === 'play') this.g.input.lock();
    if (was === 'dialogue') this.g.endDialogue();
    this.g.audio.ui('close');
  }

  handleKeys(input) {
    const g = this.g;
    if (g.state !== 'play') return;
    const k = (c) => input.pressed.has(c);
    if (this.modal === 'dialogue') { this.dialogueKeys(input); return; }
    if (k('Escape')) {
      if (this.modal) this.closeModal();
      else this.openPause();
      return;
    }
    if (this.modal === 'loot' && (k('KeyE') || k('KeyR'))) { this.lootTakeAll && this.lootTakeAll(); return; }
    if (k('Tab') || k('KeyI')) { this.toggleBook('satchel'); return; }
    if (k('KeyJ') || k('KeyQ')) { this.toggleBook('path'); return; }
    if (k('KeyK')) { this.toggleBook('bearer'); return; }
    if (k('KeyM')) { this.toggleBook('map'); return; }
    if (k('KeyH') && !this.modal) { this.openControls(); return; }
    if (this.modal === 'book' && this.bookTab === 'satchel' && this.sel !== null) {
      if (k('KeyE') || k('Enter')) this.itemAction(this.sel);
    }
  }

  // ------------------------------------------------------------------ book
  toggleBook(tab) {
    if (this.modal === 'book' && this.bookTab === tab) { this.closeModal(); return; }
    if (this.modal && this.modal !== 'book') return;
    this.bookTab = tab;
    if (this.modal !== 'book') this.openModal('book', '<div id="book-wrap"></div>');
    this.renderBook();
  }
  refreshAll() { if (this.modal === 'book') this.renderBook(); }

  renderBook() {
    const g = this.g;
    const wrap = $('#book-wrap');
    if (!wrap) return;
    const tabs = [['satchel', 'Satchel', ''], ['path', 'The Path', 'blue'], ['bearer', 'Bearer', 'green'], ['map', 'Map', 'ochre']];
    const ribbons = tabs.map(([id, n, c]) => `<div class="ribbon ${c} ${this.bookTab === id ? 'active' : ''}" data-tab="${id}">${n}</div>`).join('');
    let left = '', right = '', single = '';
    if (this.bookTab === 'satchel') { left = this.pageBearer(); right = this.pageSatchel(); }
    else if (this.bookTab === 'path') { left = this.pagePathList(); right = this.pagePathDetail(); }
    else if (this.bookTab === 'bearer') { left = this.pageAttributes(); right = this.pagePerks(); }
    else single = `<div class="page parchment" style="padding:12px"><canvas id="mapcanvas"></canvas><div class="maplegend">◆ quest · ✶ campfire (click to travel when resting) · drag to pan · wheel to zoom</div></div>`;
    wrap.innerHTML = `<div id="book"><div class="ribbons">${ribbons}</div>
      ${single || `<div class="page left parchment">${left}</div><div class="spine"></div><div class="page right parchment">${right}</div>`}
      <div class="close">Close</div>
      <div class="foot">${this.bookTab === 'satchel' ? 'click to look · double-click or <span class="k">E</span> to wear / use · <span class="k">Tab</span> close · <span class="k">J</span> the Path · <span class="k">M</span> map' : '<span class="k">Esc</span> close'}</div></div>`;
    wrap.querySelectorAll('.ribbon').forEach((r) => r.addEventListener('click', () => { this.bookTab = r.dataset.tab; this.renderBook(); g.audio.ui('page'); }));
    wrap.querySelector('.close').addEventListener('click', () => this.closeModal());
    if (this.bookTab === 'satchel') this.bindSatchel();
    if (this.bookTab === 'path') this.bindPath();
    if (this.bookTab === 'bearer') this.bindBearer();
    if (this.bookTab === 'map') this.bindMap();
  }

  pageBearer() {
    const g = this.g, P = g.player;
    const slot = (key, label, glyph, style) => {
      const id = P.equip[key];
      return `<div class="slot" style="${style}"><div class="box ${id ? '' : 'empty'}" data-glyph="${glyph}" data-slot="${key}">${id ? `<img src="${iconURL(id)}" alt="">` : ''}</div><div class="lab">${label}</div></div>`;
    };
    const hearts = Math.max(1, Math.round(P.hp / P.maxHp * 5));
    const dmg = Math.round(P.weapon.dmg * P.meleeMult);
    return `<h2>THE BEARER</h2><div class="divider"></div>
      <div class="doll"><div id="dollslot" style="height:100%;display:flex;align-items:center"></div><div class="platform"></div>
        ${slot('back', 'On the back', '➶', 'left:50%;top:0;transform:translateX(-50%)')}
        ${slot('main', 'In hand', '⚔', 'left:4%;top:18%')}
        ${slot('off', 'Off hand', '⛨', 'left:4%;top:58%')}
        ${slot('body', 'Worn', '♙', 'right:4%;top:18%')}
        ${slot('head', 'Head', '◠', 'right:4%;top:44%')}
        ${slot('belt', 'Belt', '⊟', 'right:4%;top:70%')}
      </div>
      <div style="text-align:center;font-style:italic;font-size:12px;color:var(--ink-soft)">drag to turn</div>
      <div class="nameplate">THE LANTERN-BEARER</div>
      <div class="hearts">${'♥'.repeat(hearts)}${'♡'.repeat(5 - hearts)}<span>${Math.ceil(P.hp)} of ${P.maxHp}</span></div>
      <div class="xpline"><div class="bar"><div class="f" style="width:${P.xp / P.xpNext * 100}%;background:linear-gradient(90deg,#5a8a3a,#9ac870)"></div></div><div class="cap">${P.xp} of ${P.xpNext} to the next level</div></div>
      <div class="chips">
        <div class="chip"><i style="background:#3a7a2a">≈</i>Stamina <b>${P.maxStamina}</b></div>
        <div class="chip"><i style="background:#7a3a1a">⚔</i>Sword-arm <b>${dmg}</b></div>
        <div class="chip"><i style="background:#2a4a7a">⛨</i>Armour <b>${P.armor}</b></div>
        <div class="chip"><i style="background:#3a5a9a">✦</i>Resolve <b>${P.maxResolve}</b></div>
        <div class="chip"><i style="background:#b0801a">☼</i>Light <b>${P.lantern ? P.lantern.light : 0}</b></div>
      </div>`;
  }

  satchelItems() {
    const g = this.g;
    const cat = CATEGORIES.find((c) => c.id === this.cat) || CATEGORIES[0];
    return g.inventory.items.map((s, i) => ({ s, i })).filter(({ s }) => cat.test(ITEMS[s.id]));
  }

  pageSatchel() {
    const g = this.g, P = g.player;
    const cats = CATEGORIES.map((c) => {
      const n = g.inventory.items.filter((s) => c.test(ITEMS[s.id])).length;
      return `<div class="cat ${this.cat === c.id ? 'active' : ''}" data-cat="${c.id}" title="${c.name}"><img src="${iconURL(c.icon)}" alt=""><span class="cnt">${n}</span></div>`;
    }).join('');
    const items = this.satchelItems();
    const eqIds = new Set(Object.values(P.equip).filter(Boolean));
    let cells = items.map(({ s, i }) => {
      const d = ITEMS[s.id];
      return `<div class="cell ${this.sel === i ? 'sel' : ''} ${eqIds.has(s.id) ? 'eq' : ''}" data-i="${i}" title="${esc(d.name)}"><img src="${iconURL(s.id)}" alt="">${s.n > 1 ? `<span class="n">${s.n}</span>` : ''}${g.inventory.newIds.has(s.id) ? '<span class="new">new</span>' : ''}<span class="r" style="background:${RARITY_COLOR[d.rarity]}"></span></div>`;
    }).join('');
    for (let k = items.length; k < Math.max(18, Math.ceil(items.length / 9) * 9); k++) cells += '<div class="cell empty"></div>';
    const catName = (CATEGORIES.find((c) => c.id === this.cat) || CATEGORIES[0]).name;
    return `<h2>THE SATCHEL</h2><div class="divider"></div><div class="cats">${cats}</div><div class="catname">${catName}</div>
      <div class="grid">${cells}</div>${this.detailsHTML()}`;
  }

  detailsHTML() {
    const g = this.g, P = g.player;
    const s = this.sel !== null ? g.inventory.items[this.sel] : null;
    if (!s) return `<div class="details"><div class="mid" style="text-align:center;font-style:italic;color:var(--ink-soft);align-self:center">Select an item to look closer.</div></div>`;
    const d = ITEMS[s.id];
    const rows = [];
    const cmp = (v, cur) => { const diff = v - cur; return diff === 0 ? '' : `<span class="${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '▲ +' : '▼ '}${Math.round(diff * 100) / 100}</span>`; };
    if (d.dmg !== undefined) { const cur = d.type === 'bow' ? (P.bow ? P.bow.dmg : 0) : (P.equip.main ? ITEMS[P.equip.main].dmg : 4); rows.push(['Damage', `+${d.dmg}`], ['Against yours', cmp(d.dmg, cur) || '='], ['Speed', d.speed ? (d.speed >= 1.2 ? 'Quick' : d.speed <= 0.8 ? 'Slow' : 'Steady') : '—']); }
    if (d.block !== undefined) rows.push(['Blocks', Math.round(d.block * 100) + '%']);
    if (d.armor !== undefined) { const cur = P.equip[d.slot] ? (ITEMS[P.equip[d.slot]].armor || 0) : 0; rows.push(['Armour', `+${d.armor}`], ['Against yours', cmp(d.armor, cur) || '=']); }
    if (d.light) rows.push(['Light', d.light]);
    if (d.use && d.use.hot) rows.push(['Restores', `${d.use.hot} health`]);
    if (d.use && d.use.heal) rows.push(['Restores', `${d.use.heal} health`]);
    if (d.use && d.use.stamRegen) rows.push(['Stamina', 'faster recovery']);
    if (d.stamBonus) rows.push(['Stamina', `+${d.stamBonus}`]);
    if (d.healBonus) rows.push(['Remedies', `+${Math.round(d.healBonus * 100)}%`]);
    if (d.bowBonus) rows.push(['Bow damage', `+${Math.round(d.bowBonus * 100)}%`]);
    if (d.dmgBonus) rows.push(['Melee', `+${Math.round(d.dmgBonus * 100)}%`]);
    rows.push(['You carry', g.inventory.count(s.id)], ['Worth', `${d.value || 0} crowns`]);
    let action = '';
    const eq = d.slot && P.equip[d.slot] === s.id;
    if (d.slot) action = eq ? 'Put it away' : d.slot === 'main' ? 'Take it in hand' : d.slot === 'off' ? (d.type === 'light' ? 'Carry it' : 'Take it in hand') : d.slot === 'back' ? 'Sling it' : 'Wear it';
    else if (d.use) action = d.type === 'food' ? 'Eat' : d.use.mask ? 'Fit filter' : 'Use';
    else if (d.type === 'quest' || d.type === 'lore') action = 'Read';
    return `<div class="details"><div class="big"><img src="${iconURL(s.id)}" alt=""></div>
      <div class="mid"><div class="nm" style="color:${d.rarity === 'common' ? 'var(--ink)' : RARITY_COLOR[d.rarity]};${d.rarity !== 'common' ? 'text-shadow:0 0 1px #0006' : ''}">${esc(d.name)}</div><div class="ty">${RARITY_NAME[d.rarity]} ${TYPE_NAME[d.type] || ''}</div><div class="ds">${esc(d.desc || '')}</div></div>
      <div class="st">${rows.map(([a, b]) => `<div class="row"><span>${a}</span><span class="v">${b}</span></div>`).join('')}
        <div class="btns">${action ? `<div class="btn" id="act">${action}</div>` : ''}${d.type !== 'quest' && d.type !== 'lore' ? '<div class="btn alt" id="drop">Drop</div>' : ''}</div></div></div>`;
  }

  bindSatchel() {
    const g = this.g;
    const slot = $('#dollslot');
    if (slot) {
      if (!this.dollCanvas) { this.dollCanvas = document.createElement('canvas'); this.dollCanvas.style.cssText = 'width:230px;height:330px;max-height:100%;cursor:grab;position:relative;z-index:1'; this.dollObj = new PaperDoll(this.dollCanvas); }
      slot.appendChild(this.dollCanvas);
      this.doll = this.dollObj;
      this.doll.setPlayer({ skin: 0xc8946c, hair: 0x4a3020, eyes: 0x5a7a9a, top: 0x7a6a4a, legs: 0x4a3e30 }, g.player.equip, ITEMS);
    }
    $('#book').querySelectorAll('.cat').forEach((e) => e.addEventListener('click', () => { this.cat = e.dataset.cat; this.sel = null; this.renderBook(); g.audio.ui('click'); }));
    $('#book').querySelectorAll('.cell[data-i]').forEach((e) => {
      e.addEventListener('click', () => { this.sel = +e.dataset.i; const s = g.inventory.items[this.sel]; if (s) g.inventory.newIds.delete(s.id); this.renderBook(); g.audio.ui('click'); });
      e.addEventListener('dblclick', () => { this.sel = +e.dataset.i; this.itemAction(this.sel); });
    });
    $('#book').querySelectorAll('.slot .box').forEach((e) => e.addEventListener('click', () => { const id = g.player.equip[e.dataset.slot]; if (id) { g.equipItem(id); } }));
    const act = $('#act'); if (act) act.addEventListener('click', () => this.itemAction(this.sel));
    const drop = $('#drop'); if (drop) drop.addEventListener('click', () => { const s = g.inventory.items[this.sel]; if (s) { g.inventory.remove(s.id, s.n); this.sel = null; g.player.refreshQuick(); this.renderBook(); } });
  }

  itemAction(i) {
    const g = this.g;
    const s = g.inventory.items[i];
    if (!s) return;
    const d = ITEMS[s.id];
    if (d.slot) g.equipItem(s.id);
    else if (d.use) { g.useItem(s.id); if (!g.inventory.items[i] || g.inventory.items[i].id !== s.id) this.sel = null; }
    else if (d.type === 'quest' || d.type === 'lore') this.toast(d.desc, 6);
    this.renderBook();
  }

  pagePathList() {
    const g = this.g, Q = g.quests;
    const ids = Object.keys(Q.state);
    const main = ids.filter((id) => Q.def(id).main), side = ids.filter((id) => !Q.def(id).main);
    if (!this.selQ || !Q.state[this.selQ]) this.selQ = Q.tracked || ids[0];
    const item = (id) => { const d = Q.def(id), s = Q.state[id]; return `<div class="qitem ${s.done ? 'done' : ''} ${this.selQ === id ? 'sel' : ''}" data-q="${id}">${Q.tracked === id ? '<span class="trk">◆ tracked</span>' : ''}<div class="n">${esc(d.name)}</div><div class="c">${s.done ? 'Completed' : s.failed ? 'Failed' : esc(d.chapter || 'Side tale')}</div></div>`; };
    return `<h2>THE PATH</h2><div class="divider"></div><div class="qlist"><h3>The Withering</h3>${main.map(item).join('') || '<i>—</i>'}<h3>Side Tales</h3>${side.map(item).join('') || '<div class="qitem"><div class="c">None yet. Talk to the folk of Avalon.</div></div>'}</div>`;
  }
  pagePathDetail() {
    const g = this.g, Q = g.quests, id = this.selQ;
    if (!id || !Q.state[id]) return '<h2>&nbsp;</h2><div class="qdesc"><i>Your tale has not yet begun.</i></div>';
    const d = Q.def(id), s = Q.state[id];
    const keys = Object.keys(d.stages);
    const cur = keys.indexOf(s.stage);
    const steps = keys.slice(0, s.done ? keys.length : cur + 1).map((k, j) => `<div class="qstep ${s.done || j < cur ? 'past' : ''}">${esc(d.stages[k].text)}</div>`).join('');
    const rw = d.reward || {};
    return `<h2>${esc(d.name)}</h2><div class="divider"></div><div class="qdesc"><i>${esc(d.chapter || 'A side tale')}</i></div><h3>Journal</h3>${steps}
      <h3>Reward</h3><div class="qdesc">${rw.xp ? rw.xp + ' experience' : ''}${rw.gold ? ` · ${rw.gold} crowns` : ''}${rw.items ? ' · ' + rw.items.map(([i]) => ITEMS[i].name).join(', ') : ''}</div>
      ${!s.done ? `<div style="margin-top:16px;width:180px" class="btn" id="track">${Q.tracked === id ? 'Tracked' : 'Track this tale'}</div>` : ''}`;
  }
  bindPath() {
    $('#book').querySelectorAll('.qitem[data-q]').forEach((e) => e.addEventListener('click', () => { this.selQ = e.dataset.q; this.renderBook(); this.g.audio.ui('click'); }));
    const t = $('#track'); if (t) t.addEventListener('click', () => { this.g.quests.tracked = this.selQ; this.renderBook(); });
  }

  pageAttributes() {
    const P = this.g.player;
    const A = [['might', 'Might', 'Melee damage +6% each'], ['vigor', 'Vigour', '+12 health each'], ['endurance', 'Endurance', '+10 stamina each'], ['resolve', 'Resolve', '+10 resolve, stronger abilities']];
    return `<h2>THE BEARER'S MEASURE</h2><div class="divider"></div>
      <div style="text-align:center;font-style:italic">Level ${P.level} · ${P.points} attribute point${P.points === 1 ? '' : 's'} to spend</div>
      ${A.map(([k, n, ds]) => `<div class="attr"><div class="nm">${n}</div><div class="ds">${ds}</div><div class="v">${P.attr[k]}</div><div class="btn plus ${P.points ? '' : 'dis'}" data-attr="${k}">+</div></div>`).join('')}
      <h3>Reckoning</h3>
      <div class="chips"><div class="chip">Health <b>${P.maxHp}</b></div><div class="chip">Stamina <b>${P.maxStamina}</b></div><div class="chip">Resolve <b>${P.maxResolve}</b></div><div class="chip">Armour <b>${P.armor}</b></div><div class="chip">Melee ×<b>${P.meleeMult.toFixed(2)}</b></div></div>
      <h3>Controls</h3><div class="qdesc" style="font-size:14px">Abilities use <b>Resolve</b>, earned by landing blows and parrying. Press <span class="k">1</span>–<span class="k">4</span> to use them.</div>`;
  }
  pagePerks() {
    const P = this.g.player;
    return `<h2>FEATS</h2><div class="divider"></div><div style="text-align:center;font-style:italic">${P.perkPoints} feat point${P.perkPoints === 1 ? '' : 's'} — earned each level</div>
      <div class="perks">${Object.entries(PERKS).map(([id, p]) => `<div class="perk ${P.perks.has(id) ? 'have' : P.perkPoints ? '' : 'na'}" data-perk="${id}"><div class="ic">${p.icon}</div><div><div class="pn">${p.name}${p.ability ? ` [${p.ability}]` : ''}</div><div class="pd">${esc(p.desc)}</div></div></div>`).join('')}</div>`;
  }
  bindBearer() {
    const P = this.g.player;
    $('#book').querySelectorAll('[data-attr]').forEach((e) => e.addEventListener('click', () => { if (P.points > 0) { P.attr[e.dataset.attr]++; P.points--; this.g.audio.ui('click'); this.renderBook(); } }));
    $('#book').querySelectorAll('[data-perk]').forEach((e) => e.addEventListener('click', () => { const id = e.dataset.perk; if (!P.perks.has(id) && P.perkPoints > 0) { P.perks.add(id); P.perkPoints--; this.g.audio.levelUp(); this.renderBook(); } }));
  }

  bindMap() {
    const g = this.g, P = g.player;
    const cv = $('#mapcanvas');
    const ctx = cv.getContext('2d');
    const view = this.mapView || (this.mapView = { cx: P.pos.x, cz: P.pos.z, zoom: 0.55 });
    view.cx = P.pos.x; view.cz = P.pos.z;
    const draw = () => {
      const W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== W) { cv.width = W; cv.height = H; }
      ctx.fillStyle = '#c8b48a'; ctx.fillRect(0, 0, W, H);
      const z = view.zoom;
      const ox = W / 2 - view.cx * z, oz = H / 2 - view.cz * z;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.parchMap, ox, oz, WX * z, WZ * z);
      // fog of war
      ctx.fillStyle = 'rgba(200,180,138,0.88)';
      const ex = g.explored || new Set();
      for (let cz = 0; cz < 64; cz++) for (let cx = 0; cx < 64; cx++) if (!ex.has(cz * 64 + cx) && !this.nearPOIDiscovered(cx, cz)) ctx.fillRect(ox + cx * 32 * z - 0.5, oz + cz * 32 * z - 0.5, 32 * z + 1, 32 * z + 1);
      // region names
      ctx.textAlign = 'center';
      ctx.font = `italic ${Math.round(14 + z * 10)}px 'IM Fell English', serif`; ctx.fillStyle = 'rgba(60,35,15,0.55)';
      for (const R of Object.values(REGIONS)) ctx.fillText(R.name, ox + R.x * z, oz + R.z * z - 30 * z);
      // POIs
      ctx.font = `${Math.round(12 + z * 6)}px 'IM Fell English', serif`;
      for (const poi of POIS) {
        if (!g.discovered.has(poi.id)) continue;
        const x = ox + poi.x * z, y = oz + poi.z * z;
        ctx.fillStyle = '#3a1a0a'; ctx.font = `${Math.round(16 + z * 8)}px serif`; ctx.fillText(POI_GLYPH[poi.type] || '•', x, y + 5);
        ctx.font = `${Math.round(11 + z * 6)}px 'IM Fell English', serif`; ctx.fillText(poi.name, x, y + 20 + z * 4);
      }
      // campfires
      this.mapWps = [];
      for (const w of g.world.waypoints) {
        if (!g.waypointsKnown.has(w.id)) continue;
        const x = ox + w.x * z, y = oz + w.z * z;
        ctx.fillStyle = '#c85a10'; ctx.font = `${Math.round(14 + z * 6)}px serif`; ctx.fillText('✶', x, y + 4);
        this.mapWps.push({ w, x, y });
      }
      const t = g.quests.target();
      if (t) { ctx.fillStyle = '#b8860b'; ctx.strokeStyle = '#3a1a00'; ctx.lineWidth = 2; const x = ox + t.x * z, y = oz + t.z * z; ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x + 8, y); ctx.lineTo(x, y + 10); ctx.lineTo(x - 8, y); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      // player
      const px = ox + P.pos.x * z, py = oz + P.pos.z * z;
      ctx.save(); ctx.translate(px, py); ctx.rotate(-P.yaw); ctx.fillStyle = '#a81a10'; ctx.strokeStyle = '#2a0500'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(8, 9); ctx.lineTo(0, 4); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      // vignette
      const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(70,40,10,0.45)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    };
    draw();
    let drag = null;
    cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, cx: view.cx, cz: view.cz, moved: false }; });
    cv.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; view.cx = drag.cx - dx / view.zoom; view.cz = drag.cz - dy / view.zoom; draw(); });
    cv.addEventListener('pointerup', (e) => {
      if (drag && !drag.moved && this.atFire) {
        const r = cv.getBoundingClientRect();
        const mx = e.clientX - r.left, my = e.clientY - r.top;
        const hit = (this.mapWps || []).find((w) => Math.hypot(w.x - mx, w.y - my) < 14);
        if (hit) { this.closeModal(); g.fastTravel(hit.w); }
      }
      drag = null;
    });
    cv.addEventListener('wheel', (e) => { view.zoom = Math.max(0.3, Math.min(3, view.zoom * (e.deltaY > 0 ? 0.88 : 1.14))); draw(); e.preventDefault(); }, { passive: false });
  }
  nearPOIDiscovered() { return false; }

  // ------------------------------------------------------------------ dialogue
  openDialogue(actor, def, node) {
    const g = this.g;
    this.dlg = { actor, def, node: null };
    const portrait = actor.rig && actor.rig.kind === 'human' ? portraitURL(actor) : '';
    const tracked = g.quests.tracked;
    const qtag = tracked && g.quests.isActive(tracked) ? g.quests.def(tracked).name : '';
    this.openModal('dialogue', `<div id="dialogue" class="parchment frame orn"><div class="portrait">${portrait ? `<img src="${portrait}" alt="">` : ''}</div>
      <div class="body"><div class="head"><span class="who">${esc(actor.name)}</span><span class="title">${actor.npc && actor.npc.title ? '· ' + esc(actor.npc.title) : ''}</span>${qtag ? `<span class="qtag">${esc(qtag)}</span>` : ''}</div>
      <div class="text"></div><div class="opts"></div><div class="hint"><span class="k">E</span> continue · <span class="k">1</span>–<span class="k">9</span> choose · <span class="k">Esc</span> leave</div></div></div>`);
    this.dlgGo(node);
  }
  dlgGo(nodeId) {
    const g = this.g, D = this.dlg;
    if (!D) return;
    if (nodeId === 'end' || !nodeId) { this.closeModal(); return; }
    if (nodeId === 'shop') { const a = D.actor; this.closeModal(false); this.openShop(a); return; }
    const node = D.def.nodes[nodeId];
    if (!node) { this.closeModal(); return; }
    D.node = node; D.nodeId = nodeId;
    const text = typeof node.t === 'function' ? node.t(g, D.actor) : node.t;
    D.full = text; D.shown = 0; D.typing = true;
    if (g.dialogue) g.dialogue.speaking = true;
    $('#dialogue .text').textContent = '';
    $('#dialogue .opts').innerHTML = '';
    g.audio.voice(D.actor, text);
  }
  dlgOptions() {
    const g = this.g, D = this.dlg;
    const opts = (D.node.o || []).filter((o) => !o.c || o.c(g, D.actor));
    const box = $('#dialogue .opts');
    const list = opts.length ? opts : [{ t: 'Farewell.', n: 'end' }];
    D.opts = list;
    box.innerHTML = list.map((o, i) => {
      const locked = o.check && g.player.attr[o.check.attr] < o.check.min;
      return `<div class="opt ${locked ? 'locked' : ''}" data-i="${i}"><span class="num">${i + 1}.</span>${esc(o.t)}${locked ? ` <i>(requires ${o.check.attr} ${o.check.min})</i>` : ''}</div>`;
    }).join('');
    box.querySelectorAll('.opt').forEach((e) => e.addEventListener('click', () => this.dlgChoose(+e.dataset.i)));
  }
  dlgChoose(i) {
    const g = this.g, D = this.dlg;
    if (!D || !D.opts) return;
    const o = D.opts[i];
    if (!o) return;
    if (o.check && g.player.attr[o.check.attr] < o.check.min) { g.audio.ui('deny'); return; }
    g.audio.ui('click');
    if (o.d) o.d(g, D.actor);
    if (this.modal !== 'dialogue') return;
    this.dlgGo(o.n || 'end');
  }
  dialogueKeys(input) {
    const D = this.dlg;
    const k = (c) => input.pressed.has(c);
    if (k('Escape')) { this.closeModal(); return; }
    if (D.typing) { if (k('KeyE') || k('Space') || k('Enter') || input.mPressed.has(0)) { D.shown = D.full.length; } return; }
    for (let i = 1; i <= 9; i++) if (k('Digit' + i)) { this.dlgChoose(i - 1); return; }
    if ((k('KeyE') || k('Enter') || k('Space')) && D.opts && D.opts.length === 1) this.dlgChoose(0);
  }
  updateDialogue(dt) {
    const D = this.dlg;
    if (this.modal !== 'dialogue' || !D || !D.typing) return;
    D.shown = Math.min(D.full.length, D.shown + dt * 60);
    $('#dialogue .text').textContent = D.full.slice(0, Math.floor(D.shown));
    if (D.shown >= D.full.length) { D.typing = false; if (this.g.dialogue) this.g.dialogue.speaking = false; this.dlgOptions(); }
  }

  // ------------------------------------------------------------------ trade
  openShop(actor) {
    const g = this.g;
    const shop = g.shopFor(actor);
    if (!shop) { this.closeModal(); return; }
    this.shopActor = actor;
    this.openModal('shop', `<div class="panel parchment frame shop orn" id="shopp"></div>`);
    this.renderShop();
  }
  renderShop() {
    const g = this.g, a = this.shopActor;
    const shop = g.shopFor(a);
    const P = g.player;
    const box = $('#shopp');
    const stock = shop.stock.filter((s) => s.n > 0);
    const mine = g.inventory.items.filter((s) => ITEMS[s.id].type !== 'quest' && ITEMS[s.id].type !== 'lore');
    box.innerHTML = `<div class="col"><h2>${esc(a.name)}'s Wares</h2><div class="sub">click to buy</div><div class="list">${stock.map((s, i) => { const d = ITEMS[s.id]; const pr = g.price(s.id, true); return `<div class="row-item ${P.gold < pr ? 'dis' : ''}" data-b="${i}"><img src="${iconURL(s.id)}" alt=""><span class="nm" style="color:${d.rarity === 'common' ? '' : RARITY_COLOR[d.rarity]}">${esc(d.name)}</span><span class="q">×${s.n}</span><span class="pr"><span class="coin" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#c9a020"></span>${pr}</span></div>`; }).join('') || '<i>Sold out.</i>'}</div></div>
      <div class="col"><h2>Your Satchel</h2><div class="sub">click to sell</div><div class="list">${mine.map((s, i) => { const d = ITEMS[s.id]; const eq = Object.values(P.equip).includes(s.id) && g.inventory.count(s.id) <= 1; return `<div class="row-item ${eq ? 'dis' : ''}" data-s="${g.inventory.items.indexOf(s)}"><img src="${iconURL(s.id)}" alt=""><span class="nm">${esc(d.name)}${eq ? ' <i>(equipped)</i>' : ''}</span><span class="q">×${s.n}</span><span class="pr">${g.price(s.id, false)}</span></div>`; }).join('')}</div>
      <div class="gold">Your purse: ${P.gold} crowns</div><div class="btn" id="shopclose" style="margin-top:8px">Done</div></div>`;
    box.querySelectorAll('[data-b]').forEach((e) => e.addEventListener('click', () => {
      const s = stock[+e.dataset.b]; const pr = g.price(s.id, true);
      if (P.gold < pr) { g.audio.ui('deny'); return; }
      P.gold -= pr; s.n--; g.inventory.add(s.id, 1, true); g.audio.coins(); this.renderShop();
    }));
    box.querySelectorAll('[data-s]').forEach((e) => e.addEventListener('click', () => {
      const s = g.inventory.items[+e.dataset.s]; if (!s) return;
      if (Object.values(P.equip).includes(s.id) && g.inventory.count(s.id) <= 1) { g.audio.ui('deny'); return; }
      P.gold += g.price(s.id, false); g.inventory.remove(s.id, 1);
      const st = shop.stock.find((x) => x.id === s.id); if (st) st.n++; else shop.stock.push({ id: s.id, n: 1 });
      g.audio.coins(); this.renderShop();
    }));
    $('#shopclose').addEventListener('click', () => this.closeModal());
  }

  // ------------------------------------------------------------------ loot
  openLoot(title, loot, onOpen) {
    const g = this.g;
    if (onOpen) onOpen();
    this.lootList = loot;
    this.openModal('loot', `<div class="panel parchment frame orn" id="lootp"></div>`);
    const render = () => {
      const box = $('#lootp');
      if (!box) return;
      box.innerHTML = `<h2>${esc(title)}</h2><div class="divider"></div><div class="list">${loot.map((l, i) => { const d = l.id === 'gold' ? { name: 'Crowns', rarity: 'common' } : ITEMS[l.id]; return `<div class="row-item" data-i="${i}"><img src="${iconURL(l.id === 'gold' ? 'coins' : l.id)}" alt=""><span class="nm" style="color:${RARITY_COLOR[d.rarity] === '#d8cfb8' ? '' : RARITY_COLOR[d.rarity]}">${esc(d.name)}</span><span class="q">×${l.n}</span></div>`; }).join('') || '<div class="sub">Empty.</div>'}</div>
        <div style="display:flex;gap:8px"><div class="btn" id="takeall" style="flex:1">Take all <span class="k">E</span></div><div class="btn alt" id="lootclose" style="flex:1">Close <span class="k">Esc</span></div></div>`;
      box.querySelectorAll('[data-i]').forEach((e) => e.addEventListener('click', () => { const l = loot.splice(+e.dataset.i, 1)[0]; g.inventory.add(l.id, l.n); render(); }));
      $('#takeall').addEventListener('click', () => this.lootTakeAll());
      $('#lootclose').addEventListener('click', () => this.closeModal());
    };
    this.lootTakeAll = () => { while (loot.length) { const l = loot.shift(); g.inventory.add(l.id, l.n); } this.closeModal(); };
    render();
  }

  // ------------------------------------------------------------------ campfire
  openCampfire(fire) {
    const g = this.g;
    this.atFire = fire;
    const recipes = RECIPES.filter((r) => r.at === 'fire' || r.at === 'any');
    const known = g.world.waypoints.filter((w) => g.waypointsKnown.has(w.id));
    const render = () => {
      const box = $('#firep');
      box.innerHTML = `<h2>${fire.hearth ? 'The Hearth' : 'The Campfire'}</h2><div class="sub">${esc(fire.name || 'Warmth, and a moment\'s peace')}</div><div class="divider"></div>
        <h3 style="font-family:var(--caps);font-size:12px;letter-spacing:.2em;color:var(--blood);margin:6px 0 2px">Rest</h3>
        <div style="display:flex;gap:6px">${fire.hearth ? '' : '<div class="btn" data-rest="1">1 hour</div><div class="btn" data-rest="4">4 hours</div><div class="btn" data-rest="dawn">Until dawn</div><div class="btn" data-rest="dusk">Until dusk</div>'}</div>
        <h3 style="font-family:var(--caps);font-size:12px;letter-spacing:.2em;color:var(--blood);margin:10px 0 2px">Cook & Brew</h3>
        <div class="list" style="max-height:220px">${recipes.map((r, i) => { const ok = Object.entries(r.needs).every(([id, n]) => g.inventory.has(id, n)); return `<div class="row-item ${ok ? '' : 'dis'}" data-r="${i}"><img src="${iconURL(r.out)}" alt=""><span class="nm">${esc(ITEMS[r.out].name)}${r.n > 1 ? ' ×' + r.n : ''}<br><span class="req">${Object.entries(r.needs).map(([id, n]) => `${ITEMS[id].name} ${g.inventory.count(id)}/${n}`).join(' · ')}</span></span></div>`; }).join('')}</div>
        ${fire.hearth ? '' : `<h3 style="font-family:var(--caps);font-size:12px;letter-spacing:.2em;color:var(--blood);margin:6px 0 2px">Travel</h3><div class="list" style="max-height:140px">${known.map((w, i) => `<div class="row-item" data-w="${i}"><span class="nm">✶ ${esc(w.name)}</span><span class="q">${Math.round(Math.hypot(w.x - g.player.pos.x, w.z - g.player.pos.z) / 1.5)} paces</span></div>`).join('')}</div>`}
        <div class="btn alt" id="fireclose" style="margin-top:6px">Leave <span class="k">Esc</span></div>`;
      box.querySelectorAll('[data-rest]').forEach((e) => e.addEventListener('click', () => {
        const v = e.dataset.rest; let h;
        if (v === 'dawn') h = ((6.5 - g.time.hour) + 24) % 24 || 24; else if (v === 'dusk') h = ((19 - g.time.hour) + 24) % 24 || 24; else h = +v;
        this.closeModal(); g.rest(h, fire.name || 'a campfire');
      }));
      box.querySelectorAll('[data-r]').forEach((e) => e.addEventListener('click', () => { if (g.craft(recipes[+e.dataset.r])) render(); else g.audio.ui('deny'); }));
      box.querySelectorAll('[data-w]').forEach((e) => e.addEventListener('click', () => { this.closeModal(); g.fastTravel(known[+e.dataset.w]); }));
      $('#fireclose').addEventListener('click', () => this.closeModal());
    };
    this.openModal('fire', `<div class="panel parchment frame orn" id="firep"></div>`);
    render();
  }

  // ------------------------------------------------------------------ menus
  openPause() {
    const g = this.g;
    this.openModal('pause', `<div class="overlay-dim"></div><div class="panel parchment frame orn menu"><h2>Paused</h2><div class="sub">Day ${g.time.day} · ${g.region ? REGIONS[g.region].name : ''}</div><div class="divider"></div>
      <div class="btn" data-m="resume">Resume</div><div class="btn" data-m="save">Save the Tale</div><div class="btn" data-m="load">Load Last Save</div><div class="btn" data-m="settings">Settings</div><div class="btn" data-m="controls">Controls</div><div class="btn alt" data-m="title">Return to Title</div></div>`);
    g.paused = true;
    $('#modal').querySelectorAll('[data-m]').forEach((e) => e.addEventListener('click', () => {
      const m = e.dataset.m;
      if (m === 'resume') { g.paused = false; this.closeModal(); }
      if (m === 'save') { g.save(); }
      if (m === 'load') { if (g.hasSave()) { g.paused = false; this.closeModal(); location.hash = 'continue'; location.reload(); } else this.toast('No saved tale.', 2); }
      if (m === 'settings') this.openSettings(true);
      if (m === 'controls') this.openControls(true);
      if (m === 'title') { location.hash = ''; location.reload(); }
    }));
  }
  closeModalHook() { this.g.paused = false; }

  openSettings(fromPause) {
    const s = this.settings;
    this.openModal('settings', `<div class="overlay-dim"></div><div class="panel parchment frame orn"><h2>Settings</h2><div class="divider"></div>
      <div class="setting">Graphics quality <select id="s-q"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
      <div class="setting">View distance <select id="s-v"><option value="112">Near</option><option value="144">Moderate</option><option value="176">Far</option><option value="224">Very far</option></select></div>
      <div class="setting">Mouse sensitivity <input id="s-s" type="range" min="0.3" max="2.5" step="0.05"></div>
      <div class="setting">Field of view <input id="s-f" type="range" min="60" max="95" step="1"></div>
      <div class="setting">Volume <input id="s-a" type="range" min="0" max="1" step="0.05"></div>
      <div class="setting">Touch controls <input id="s-t" type="checkbox"></div>
      <div class="setting">Subtitles <input id="s-b" type="checkbox"></div>
      <div class="btn" id="s-done">Done</div></div>`);
    $('#s-q').value = s.quality; $('#s-v').value = String(s.view); $('#s-s').value = s.sens; $('#s-f').value = s.fov; $('#s-a').value = s.volume; $('#s-t').checked = s.touch; $('#s-b').checked = s.subtitles;
    $('#s-done').addEventListener('click', () => {
      s.quality = $('#s-q').value; s.view = +$('#s-v').value; s.sens = +$('#s-s').value; s.fov = +$('#s-f').value; s.volume = +$('#s-a').value; s.touch = $('#s-t').checked; s.subtitles = $('#s-b').checked;
      this.saveSettings(); this.applySettings();
      if (fromPause) this.openPause(); else if (this.g.state === 'title') this.titleScreen(); else { this.g.paused = false; this.closeModal(); }
    });
  }

  openControls(fromPause) {
    const C = [['Move', 'W A S D'], ['Look', 'Mouse'], ['Sprint', 'Shift'], ['Jump / swim up', 'Space'], ['Sneak', 'C'], ['Dodge', 'V / Alt'], ['Attack (tap) · Heavy (hold)', 'LMB'], ['Block · Parry (just before a hit)', 'RMB'], ['Interact / Talk / Loot', 'E'], ['Draw / sheathe', 'F'], ['Swap to bow', 'B'], ['Abilities', '1 2 3 4'], ['Use quick item', 'X'], ['Cycle quick item', 'Z'], ['Throw pitch pot / knife', 'G'], ['Toggle lantern', 'L'], ['Satchel (inventory)', 'Tab / I'], ['The Path (quests)', 'J / Q'], ['Bearer (levels & feats)', 'K'], ['Map', 'M'], ['Pause / close', 'Esc'], ['This help', 'H']];
    this.openModal('controls', `<div class="overlay-dim"></div><div class="panel parchment frame orn" style="width:min(720px,94vw)"><h2>Controls</h2><div class="divider"></div>
      <div class="controls">${C.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('')}</div>
      <p style="font-size:14px;font-style:italic;margin:10px 0 4px">Red sparks around a foe mean an <b>unblockable</b> attack — dodge it. Strike unaware enemies while sneaking for heavy damage. Rest at campfires to heal, save, cook and travel.</p>
      <div class="btn" id="c-done">Done</div></div>`);
    $('#c-done').addEventListener('click', () => { if (fromPause) this.openPause(); else if (this.g.state === 'title') this.titleScreen(); else { this.g.paused = false; this.closeModal(); } });
  }

  loading(p, msg) {
    let L = $('#loading');
    if (!L) { L = el('div', '', `<div class="logo">Avalon</div><div class="logo2 caps" style="color:var(--gold);letter-spacing:.5em;margin-top:6px">THE WITHERING</div><div class="bar"><div class="f"></div></div><div class="msg"></div>`); L.id = 'loading'; this.root.appendChild(L); }
    L.querySelector('.f').style.width = p * 100 + '%';
    L.querySelector('.msg').textContent = msg;
    if (p >= 1) L.remove();
  }

  titleScreen() {
    const g = this.g;
    const hasSave = g.hasSave();
    this.show('#hud', false);
    this.openModal('title', `<div id="title"><div class="logo">Avalon</div><div class="logo2">THE WITHERING</div><div class="tag">A voxel tale of a cursed isle — and a lantern against the fog.</div>
      <div class="menu interactive">${hasSave ? '<div class="btn" data-t="continue">Continue the Tale</div>' : ''}<div class="btn" data-t="new">Begin a New Tale</div><div class="btn" data-t="settings">Settings</div><div class="btn" data-t="controls">Controls</div></div>
      <div class="foot">Chapter One · Inspired by the dark Arthurian world of Tainted Grail · No magic, only steel, herbs and resolve</div></div>`);
    $('#modal').querySelectorAll('[data-t]').forEach((e) => e.addEventListener('click', () => {
      const t = e.dataset.t;
      if (t === 'new') { this.closeModal(false); g.newGame(); this.startPlay(); }
      if (t === 'continue') { this.closeModal(false); if (g.loadSave()) this.startPlay(); else { g.newGame(); this.startPlay(); } }
      if (t === 'settings') this.openSettings(false);
      if (t === 'controls') this.openControls(false);
    }));
  }
  startPlay() {
    this.show('#hud', true);
    this.applySettings();
    this.g.input.lock();
    this.g.audio.start();
  }

  intro() {
    const f = $('#fade');
    f.style.transition = 'none'; f.style.opacity = 1;
    f.innerHTML = '<div style="text-align:center;max-width:640px;font-family:var(--serif);letter-spacing:0;font-size:20px;line-height:1.5;padding:0 20px"><div style="font-family:var(--caps);letter-spacing:.3em;color:var(--gold);font-size:14px;margin-bottom:14px">CHAPTER ONE</div>The old king is dead. A grey fog creeps from the Mire, and with it the Withering — blackened wheat, grey lungs, quiet graves.<br><br>The sea gave you back with nothing but a lantern in your fist.</div>';
    setTimeout(() => { f.style.transition = 'opacity 2.5s'; f.style.opacity = 0; }, 4500);
    setTimeout(() => { f.innerHTML = ''; }, 7200);
  }

  fadeRest(cb, hours, text) {
    const f = $('#fade');
    this.modal = this.modal || 'fade';
    f.style.transition = 'opacity 0.7s'; f.style.opacity = 1;
    f.textContent = text || (hours ? `You rest for ${Math.round(hours)} hour${Math.round(hours) === 1 ? '' : 's'}…` : '');
    setTimeout(() => { cb(); setTimeout(() => { f.style.opacity = 0; if (this.modal === 'fade') this.modal = null; this.g.input.lock(); setTimeout(() => { f.textContent = ''; }, 800); }, 900); }, 800);
  }

  death(by) {
    const d = $('#death');
    d.querySelector('.s').textContent = by ? `Slain by ${by}.` : 'The darkness takes you.';
    d.style.opacity = 1;
  }
  respawned(lost) {
    $('#death').style.opacity = 0;
    this.toast(`You wake by ${this.g.lastRest ? this.g.lastRest.name : 'the fire'}${lost ? `, ${lost} crowns lighter` : ''}.`, 4);
  }

  ending() {
    const g = this.g, F = g.flags;
    let body;
    if (F.side_harlan) body = 'You sold the Grey Draught to Steward Harlan. The treasury filled; the villages waited. Maeve stopped speaking your name. In Greywater, the coughing went on through the winter — and in Caer Dawn, behind a locked door, the cure gathered dust and value.';
    else body = `The Grey Draught passed from hand to hand down the Kingsway, carried by the Watch in blue tabards. In Greywater the coughing quieted. ${F.harlan_arrested ? 'Harlan awaits judgement in the cells beneath Caer Dawn.' : 'Harlan sailed west from Saltby on a fishing boat, and did not look back.'} Captain Ysolde holds the castle "until the heir is found." She looks at you strangely when she says it.`;
    const heir = F.heir_hint ? '<p><i>Archivist Elowen\'s words return to you at night: the king\'s only child, sent across the sea, bearing the royal lantern…</i></p>' : '';
    this.openModal('ending', `<div id="ending"><div class="panel parchment frame orn"><div class="caps" style="color:var(--blood);letter-spacing:.3em">End of Chapter One</div><h2 style="font-family:var(--deco);font-size:34px;margin:6px 0">The Grey Draught</h2><div class="divider"></div>
      <p>${body}</p>${heir}<p>But the fog still rolls out of the Mire. Corvin says something in the deep peat breathes it. The Withering is checked — not ended.</p>
      <p style="font-family:var(--caps);letter-spacing:.15em;color:var(--ink-soft)">Your tale continues. Avalon remains yours to explore.</p>
      <div class="btn" id="e-cont">Continue exploring</div></div></div>`);
    $('#e-cont').addEventListener('click', () => this.closeModal());
  }

  // ------------------------------------------------------------------ touch
  buildTouch() {
    const t = $('#touch');
    t.innerHTML = `<div class="stick interactive"><div class="knob"></div></div>
      <div class="tb interactive" data-k="mouse0" style="right:40px;bottom:170px;width:76px;height:76px">ATTACK</div>
      <div class="tb interactive" data-k="mouse2" style="right:130px;bottom:150px">BLOCK</div>
      <div class="tb interactive" data-k="Space" style="right:40px;bottom:260px">JUMP</div>
      <div class="tb interactive" data-k="KeyE" style="right:130px;bottom:240px">USE</div>
      <div class="tb interactive" data-k="KeyV" style="right:210px;bottom:180px">DODGE</div>
      <div class="tb interactive" data-k="ShiftLeft" data-toggle="1" style="left:190px;bottom:170px">RUN</div>
      <div class="tb interactive" data-k="Tab" style="right:24px;top:220px;width:52px;height:52px">BAG</div>
      <div class="tb interactive" data-k="KeyX" style="right:150px;bottom:40px;width:52px;height:52px">HEAL</div>
      <div class="tb interactive" data-k="Escape" style="left:20px;top:20px;width:48px;height:48px">❚❚</div>`;
    const input = () => this.g.input;
    const stick = t.querySelector('.stick'), knob = t.querySelector('.knob');
    let sid = null, sx = 0, sy = 0;
    stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; sx = e.clientX; sy = e.clientY; stick.setPointerCapture(e.pointerId); input().touch.active = true; });
    stick.addEventListener('pointermove', (e) => {
      if (e.pointerId !== sid) return;
      let dx = e.clientX - sx, dy = e.clientY - sy; const l = Math.hypot(dx, dy); if (l > 50) { dx *= 50 / l; dy *= 50 / l; }
      knob.style.left = 40 + dx + 'px'; knob.style.top = 40 + dy + 'px';
      input().touch.move.x = dx / 50; input().touch.move.y = dy / 50;
    });
    const end = () => { sid = null; knob.style.left = '40px'; knob.style.top = '40px'; input().touch.move.x = 0; input().touch.move.y = 0; };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
    t.querySelectorAll('.tb').forEach((b) => {
      const k = b.dataset.k;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (k.startsWith('mouse')) input().virtualMouse(+k.slice(5), true);
        else if (b.dataset.toggle) { const on = !input().keys.has(k); input().virtualDown(k, on); b.style.background = on ? 'rgba(122,20,20,.6)' : ''; }
        else input().virtualDown(k, true);
      });
      const up = () => { if (k.startsWith('mouse')) input().virtualMouse(+k.slice(5), false); else if (!b.dataset.toggle) input().virtualDown(k, false); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    });
    // look: drag anywhere else on the canvas
    const canvas = document.getElementById('c');
    let lid = null, lx = 0, ly = 0;
    canvas.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') return; lid = e.pointerId; lx = e.clientX; ly = e.clientY; input().touch.active = true; });
    canvas.addEventListener('pointermove', (e) => { if (e.pointerId !== lid) return; input().touch.look.x += (e.clientX - lx) * 0.006; input().touch.look.y += (e.clientY - ly) * 0.006; lx = e.clientX; ly = e.clientY; });
    canvas.addEventListener('pointerup', (e) => { if (e.pointerId === lid) lid = null; });
  }
}
