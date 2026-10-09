// Tetherfall: game bootstrap, loop, camera, HUD, tutorial and free roam.
import * as THREE from 'three';
import { B, BLOCKS, buildAtlas } from './blocks.js';
import { World, SX, SZ, SY } from './world.js';
import { generate } from './worldgen.js';
import { ChunkRenderer } from './mesher.js';
import { Player, P } from './player.js';
import { Colossus } from './colossus.js';
import { Sfx } from './audio.js';
import { drawPortrait } from './models.js';
import { fbm } from './noise.js';

const $ = (id) => document.getElementById(id);

// ---------------- settings ----------------
const settings = { sens: 1.6, fov: 75, vol: 0.7, inv: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem('tetherfall-settings') || '{}')); } catch (e) { /* storage unavailable */ }
function saveSettings() { try { localStorage.setItem('tetherfall-settings', JSON.stringify(settings)); } catch (e) { /* ignore */ } }

// ---------------- renderer / scene ----------------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();
const HORIZON = new THREE.Color(0.80, 0.87, 0.95);
scene.fog = new THREE.Fog(HORIZON, 100, 380);
const camera = new THREE.PerspectiveCamera(settings.fov, window.innerWidth / window.innerHeight, 0.1, 1400);
camera.rotation.order = 'YXZ';

scene.add(makeSky());
const hemi = new THREE.HemisphereLight(0xe6f2ff, 0x5a6b45, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2dc, 1.05);
sun.position.set(0.45, 1, 0.3);
scene.add(sun);

function makeSky() {
  const geo = new THREE.SphereGeometry(1200, 24, 16);
  const col = [];
  const top = new THREE.Color(0.25, 0.5, 0.95);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = Math.max(0, p.getY(i) / 1200);
    const c = HORIZON.clone().lerp(top, Math.pow(t, 0.55));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -1;
  m.onBeforeRender = () => m.position.copy(camera.position);
  return m;
}

function makeClouds() {
  const cell = 14, n = 80, y0 = 116, h = 5;
  const filled = (i, j) => i >= 0 && j >= 0 && i < n && j < n && fbm(i / 7, j / 7, 55, 3) > 0.56;
  const pos = [], nor = [], idx = [];
  const quad = (a, b, c, d, nrm) => {
    const base = pos.length / 3;
    pos.push(...a, ...b, ...c, ...d);
    for (let k = 0; k < 4; k++) nor.push(...nrm);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    if (!filled(i, j)) continue;
    const x0 = i * cell, x1 = x0 + cell, z0 = j * cell, z1 = z0 + cell, ya = y0, yb = y0 + h;
    quad([x0, yb, z0], [x0, yb, z1], [x1, yb, z1], [x1, yb, z0], [0, 1, 0]);
    quad([x0, ya, z0], [x1, ya, z0], [x1, ya, z1], [x0, ya, z1], [0, -1, 0]);
    if (!filled(i - 1, j)) quad([x0, ya, z0], [x0, ya, z1], [x0, yb, z1], [x0, yb, z0], [-1, 0, 0]);
    if (!filled(i + 1, j)) quad([x1, ya, z1], [x1, ya, z0], [x1, yb, z0], [x1, yb, z1], [1, 0, 0]);
    if (!filled(i, j - 1)) quad([x1, ya, z0], [x0, ya, z0], [x0, yb, z0], [x1, yb, z0], [0, 0, -1]);
    if (!filled(i, j + 1)) quad([x0, ya, z1], [x1, ya, z1], [x1, yb, z1], [x0, yb, z1], [0, 0, 1]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setIndex(idx);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x8f99a8, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(-(n * cell - SX) / 2, 0, -(n * cell - SZ) / 2);
  return m;
}
const clouds = makeClouds();
const skirt = new THREE.Mesh(new THREE.PlaneGeometry(SX + 3000, SZ + 3000), new THREE.MeshLambertMaterial({ color: 0x5f8f3e }));
skirt.rotation.x = -Math.PI / 2;
skirt.position.set(SX / 2, 22.9, SZ / 2);
scene.add(skirt);
scene.add(clouds);

// ---------------- world ----------------
const atlas = buildAtlas();
const worldMat = new THREE.MeshLambertMaterial({ map: atlas.texture, vertexColors: true, alphaTest: 0.5, side: THREE.FrontSide });
const world = new World();
let info = null;
let chunks = null;

// green/cyan light pillars for depots, canisters and objectives
function beam(color, radius, height, opacity) {
  const geo = new THREE.CylinderGeometry(radius, radius, height, 8, 1, true);
  geo.translate(0, height / 2, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  return m;
}

// ---------------- particles ----------------
class Particles {
  constructor(n, size, color, opacity) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.PointsMaterial({ size, color, transparent: true, opacity, depthWrite: false, sizeAttenuation: true });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.next = 0;
    for (let i = 0; i < n; i++) this.pos[i * 3 + 1] = -999;
  }
  emit(p, count, spread, up, life = 2) {
    for (let k = 0; k < count; k++) {
      const i = this.next; this.next = (this.next + 1) % this.n;
      this.pos[i * 3] = p.x + (Math.random() - 0.5) * spread;
      this.pos[i * 3 + 1] = p.y + (Math.random() - 0.5) * spread;
      this.pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * spread;
      this.vel[i * 3] = (Math.random() - 0.5) * up;
      this.vel[i * 3 + 1] = Math.random() * up;
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * up;
      this.life[i] = life * (0.6 + Math.random() * 0.4);
    }
  }
  update(dt, gravity) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -999; continue; }
      this.vel[i * 3 + 1] -= gravity * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}
const steam = new Particles(600, 2.6, 0xf2f4f7, 0.5);
const sparks = new Particles(300, 0.35, 0xffb347, 0.95);
const dust = new Particles(400, 1.6, 0xc8b89a, 0.45);
const streaks = new Particles(240, 0.09, 0xffffff, 0.55);
scene.add(steam.points, sparks.points, dust.points, streaks.points);

// ---------------- game objects ----------------
const sfx = new Sfx();
sfx.setVolume(settings.vol);
let player = null;
let colossi = [];
let dummy = null;
const pickups = [];
const depots = [];
const ropes = [];
let objectiveBeam = null;
let slashArc = null;

const game = {
  state: 'loading', // loading | menu | playing | paused | dead
  mode: 'tutorial',
  kills: 0,
  firstPerson: false,
  showHelp: true,
  build: false,
  buildBlock: B.BRICK,
  shake: 0,
  spawnTimer: 0,
  time: 0,
  get world() { return world; },
  get player() { return player; },
  get info() { return info; },
};

// ---------------- input ----------------
const keys = new Set();
const input = { forward: false, back: false, left: false, right: false, boost: false, reel: false, brake: false, jumpPressed: false };
let swapped = false;

function locked() { return document.pointerLockElement === canvas; }
function lockPointer() { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* not supported */ } }

window.addEventListener('keydown', (e) => {
  if (game.state !== 'playing') {
    if (e.code === 'Escape' && game.state === 'paused') resume();
    return;
  }
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'Space') { input.jumpPressed = true; e.preventDefault(); }
  if (e.code === 'KeyQ') pressHook(0);
  if (e.code === 'KeyC') pressHook(1);
  if (e.code === 'KeyF') slash();
  if (e.code === 'KeyR') swapBlades();
  if (e.code === 'KeyE') resupply();
  if (e.code === 'KeyV' || e.code === 'F5') { game.firstPerson = !game.firstPerson; e.preventDefault(); }
  if (e.code === 'KeyH') { game.showHelp = !game.showHelp; $('help').classList.toggle('hidden', !game.showHelp); }
  if (e.code === 'KeyB') toggleBuild();
  if (e.code === 'KeyP' || e.code === 'Escape') pause();
  const BUILD = [B.BRICK, B.PLANKS, B.LOG, B.LEAVES, B.ROOF_RED, B.COBBLE];
  if (game.build && /^Digit[1-6]$/.test(e.code)) game.buildBlock = BUILD[+e.code.slice(5) - 1];
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (e.code === 'KeyQ') releaseHook(0);
  if (e.code === 'KeyC') releaseHook(1);
});
canvas.addEventListener('mousedown', (e) => {
  if (game.state !== 'playing') return;
  if (!locked()) lockPointer();
  if (e.button === 0) pressHook(0);
  if (e.button === 2) pressHook(1);
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) releaseHook(0);
  if (e.button === 2) releaseHook(1);
});
window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('mousemove', (e) => {
  if (game.state !== 'playing' || !locked() || !player) return;
  const k = settings.sens * 0.0022;
  player.yaw -= e.movementX * k;
  player.pitch -= e.movementY * k * (settings.inv ? -1 : 1);
  player.pitch = Math.max(-1.52, Math.min(1.52, player.pitch));
});
document.addEventListener('pointerlockchange', () => {
  if (!locked() && game.state === 'playing') pause();
});
window.addEventListener('blur', () => keys.clear());
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

function readInput() {
  input.forward = keys.has('KeyW') || keys.has('ArrowUp');
  input.back = keys.has('KeyS') || keys.has('ArrowDown');
  input.left = keys.has('KeyA') || keys.has('ArrowLeft');
  input.right = keys.has('KeyD') || keys.has('ArrowRight');
  input.boost = keys.has('Space');
  input.reel = keys.has('ShiftLeft') || keys.has('ShiftRight');
  input.brake = keys.has('KeyG');
}

// ---------------- aiming ----------------
const raycaster = new THREE.Raycaster();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();

function aim() {
  const origin = camera.position;
  const dir = camera.getWorldDirection(_v1);
  const maxD = P.hookRange + 12;
  const vox = world.raycast(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, maxD);
  let best = null;
  if (vox) best = { point: new THREE.Vector3(...vox.point), object: null, owner: null, camDist: vox.dist };
  const parts = [];
  for (const c of colossi) if (c.alive) parts.push(...c.parts);
  if (parts.length) {
    raycaster.set(origin, dir);
    raycaster.far = best ? best.camDist : maxD;
    const hits = raycaster.intersectObjects(parts, false);
    if (hits.length) {
      const h = hits[0];
      best = { point: h.point.clone(), object: h.object, owner: h.object.userData.colossus, camDist: h.distance, core: h.object === h.object.userData.colossus.m.core };
    }
  }
  if (!best) return null;
  const chest = player.chestPos(_v2);
  const toT = _v3.copy(best.point).sub(chest);
  best.dist = toT.length();
  // the line from the rig must be clear, otherwise anchor where it is blocked
  const block = world.raycast(chest.x, chest.y, chest.z, toT.x, toT.y, toT.z, best.dist - 0.3);
  if (block) {
    best.point.set(...block.point);
    best.object = null; best.owner = null; best.core = false;
    best.dist = block.dist;
  }
  return best;
}

let lastAim = null;
function pressHook(i) {
  if (!player || !player.alive || game.state !== 'playing') return;
  sfx.init();
  if (game.build) { buildAction(i); return; }
  player.fireHook(i, lastAim || aim());
}
function releaseHook(i) { if (player) player.releaseHook(i); }

// ---------------- combat ----------------
function slash() {
  if (!player.alive || player.slashCD > 0 || player.swapT > 0 || game.build) return;
  player.slashT = 0.32; player.slashCD = 0.42;
  const speed = player.speed();
  player.spin = speed > 22;
  sfx.slash();
  showArc();
  if (player.sharp <= 0) { popup('Blades dull', 'Press R to swap in a fresh pair'); return; }
  const chest = player.chestPos();
  for (const c of colossi) {
    if (!c.alive) continue;
    const r = c.tryCut(chest, speed, player.spin);
    if (!r) continue;
    if (r.kind === 'nape') {
      sfx.cut();
      sparks.emit(c.napeWorld(_v1), 40, 1, 10, 0.7);
      steam.emit(c.napeWorld(_v1), 12, 1.5, 3, 1.5);
      player.sharp = Math.max(0, player.sharp - 34);
      if (r.killed) {
        c.kill();
        player.detachFrom(c);
        if (!c.dummy) game.kills++;
        sfx.kill();
        popup(c.dummy ? 'Core cut!' : 'COLOSSUS FELLED', `${r.dmg} damage at ${Math.round(speed * 3.6)} km/h${player.spin ? ' · spin cut' : ''}`);
        game.shake = 0.5;
        if (c.dummy) setTimeout(() => { if (game.state !== 'menu') spawnDummy(); }, 9000);
      } else {
        popup('Shallow cut', `${r.dmg} damage — hit it faster (${Math.max(0, c.hp)} left)`);
      }
    } else {
      sfx.cut();
      sparks.emit(chest, 20, 1, 8, 0.5);
      player.sharp = Math.max(0, player.sharp - 18);
      if (!c.dummy) popup(r.part === 'arm' ? 'Arm severed' : 'Tendon cut', r.part === 'arm' ? 'It can’t grab with that arm for a while' : 'It’s kneeling — go for the nape!');
    }
    break;
  }
}

function swapBlades() {
  if (!player.alive || player.swapT > 0) return;
  if (player.spares <= 0) { popup('No spare blades', 'Resupply at a green beacon (E)'); return; }
  player.spares--; player.sharp = 100; player.swapT = 0.7;
  swapped = true;
  sfx.swap();
}

function resupply() {
  const d = nearestDepot();
  if (!d || d.dist > 5) return;
  player.gas = 100; player.sharp = 100; player.spares = 8; player.health = Math.min(100, player.health + 30);
  sfx.pickup();
  popup('Resupplied', 'Gas, blades and bandages topped up');
}

function nearestDepot() {
  let best = null;
  for (const d of depots) {
    const dist = Math.hypot(d.x - player.pos.x, d.y - player.pos.y, d.z - player.pos.z);
    if (!best || dist < best.dist) best = { ...d, dist };
  }
  return best;
}

function showArc() {
  if (!slashArc) {
    const geo = new THREE.RingGeometry(0.9, 2.3, 20, 1, -Math.PI * 0.15, Math.PI * 1.3);
    slashArc = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(slashArc);
  }
  slashArc.userData.t = 0.22;
  slashArc.scale.setScalar(player.spin ? 1.6 : 1);
}

game.onGrabbed = (c) => {
  if (!player.alive) return;
  player.damage(34, 'colossus');
  const away = _v1.set(player.pos.x - c.pos.x, 0, player.pos.z - c.pos.z).normalize();
  player.vel.set(away.x * 18, 11, away.z * 18);
  player.hooks.forEach((_, i) => player.releaseHook(i));
  game.shake = 0.6;
};
game.onColossusLand = (c) => {
  sfx.stomp();
  dust.emit(_v1.copy(c.pos).add(new THREE.Vector3(Math.sin(c.yaw) * c.H * 0.6, 1, Math.cos(c.yaw) * c.H * 0.6)), 60, c.H * 0.5, 4, 2);
  steam.emit(c.napeWorld(_v1), 80, c.H * 0.4, 4, 4);
  if (c.pos.distanceTo(player.pos) < 60) game.shake = Math.max(game.shake, 0.4);
};

// ---------------- building ----------------
function toggleBuild() {
  game.build = !game.build;
  $('build-tag').classList.toggle('hidden', !game.build);
  if (game.build) player.hooks.forEach((_, i) => player.releaseHook(i));
}
function buildAction(button) {
  const o = camera.position, d = camera.getWorldDirection(_v1);
  const reach = game.firstPerson ? 8 : 13;
  const hit = world.raycast(o.x, o.y, o.z, d.x, d.y, d.z, reach, (b) => b !== B.AIR && b !== B.WATER);
  if (!hit) return;
  if (button === 0) world.edit(hit.x, hit.y, hit.z, B.AIR);
  else {
    const x = hit.x + hit.normal[0], y = hit.y + hit.normal[1], z = hit.z + hit.normal[2];
    const p = player.pos, hw = P.halfW;
    const overlaps = x + 1 > p.x - hw && x < p.x + hw && z + 1 > p.z - hw && z < p.z + hw && y + 1 > p.y && y < p.y + P.height;
    if (!overlaps && world.get(x, y, z) === B.AIR) world.edit(x, y, z, game.buildBlock);
  }
  chunks.flushDirty();
  sfx.swap();
}

// ---------------- spawning ----------------
function spawnDummy() {
  if (dummy && !dummy.removed) dummy.remove();
  const y = info.yard;
  dummy = new Colossus(scene, y.x + 0.5, y.z - 1.5, 7.5, 0, { dummy: true, yaw: 0 });
  colossi.push(dummy);
}
function randomHeight() { return 12 + Math.random() * 10 + (Math.random() < 0.15 ? 8 : 0); }
function spawnColossus(x, z, H, opts = {}) {
  const c = new Colossus(scene, x, z, H ?? randomHeight(), Math.floor(Math.random() * 5), opts);
  c.pos.y = world.groundAt(x, z);
  colossi.push(c);
  return c;
}
// Find open ground outside the walls within [rMin, rMax] of a point.
function spawnNear(px, pz, rMin, rMax, opts) {
  const { town } = info;
  for (let tries = 0; tries < 60; tries++) {
    const a = Math.random() * Math.PI * 2, r = rMin + Math.random() * (rMax - rMin);
    const x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
    if (x < 20 || z < 20 || x > SX - 20 || z > SZ - 20) continue;
    if (Math.hypot(x - town.cx, z - town.cz) < town.R + 16) continue;
    if (info.trees.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + 8)) continue;
    return spawnColossus(x, z, undefined, opts);
  }
  return null;
}
function spawnAroundPlayer() {
  return spawnNear(player.pos.x, player.pos.z, 80, 170) || spawnNear(info.town.cx, info.town.cz, info.town.R + 25, info.town.R + 160);
}
// Colossi milling around outside the walls, visible from the ramparts.
function spawnRing(n, opts) {
  for (let i = 0; i < n; i++) spawnNear(info.town.cx, info.town.cz, info.town.R + 25, info.town.R + 130, opts);
}

// ---------------- HUD ----------------
let popupTimer = 0;
function popup(title, sub = '') {
  const el = $('popup');
  el.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
  el.classList.add('show');
  popupTimer = 2.2;
}
function dialog(html) {
  const el = $('dialog');
  el.classList.toggle('hidden', !html);
  $('dialog-text').innerHTML = html || '';
}
function setMode(title, sub) { $('mode-title').textContent = title; $('mode-sub').textContent = sub; }
drawPortrait($('portrait'));

let mapBase = null;
function buildMapBase() {
  const c = document.createElement('canvas'); c.width = SX; c.height = SZ;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(SX, SZ);
  for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
    let y = SY - 1, b = 0;
    for (; y > 0; y--) { b = world.get(x, y, z); if (b && !BLOCKS[b].cross) break; }
    const col = atlas.mapColor[b] || [80, 140, 60];
    const shade = 0.75 + Math.min(0.45, (y - 20) / 120);
    const i = (z * SX + x) * 4;
    img.data[i] = col[0] * shade; img.data[i + 1] = col[1] * shade; img.data[i + 2] = col[2] * shade; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  mapBase = c;
}
function drawMinimap() {
  const c = $('minimap'), ctx = c.getContext('2d');
  const W = c.width, scale = 1.25;
  ctx.save();
  ctx.fillStyle = '#4c6b3a'; ctx.fillRect(0, 0, W, W);
  ctx.translate(W / 2, W / 2);
  ctx.rotate(player.yaw);
  ctx.scale(scale, scale);
  ctx.translate(-player.pos.x, -player.pos.z);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(mapBase, 0, 0);
  const dot = (x, z, r, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, z, r / scale, 0, Math.PI * 2); ctx.fill(); };
  for (const d of depots) dot(d.x, d.z, 4, '#5fe39a');
  for (const p of pickups) if (p.active) dot(p.x, p.z, 3, '#7ff0ff');
  if (objectiveBeam && objectiveBeam.visible) dot(objectiveBeam.position.x, objectiveBeam.position.z, 5, '#ffd34a');
  for (const k of colossi) if (k.alive && !k.dummy) dot(k.pos.x, k.pos.z, 4 + k.H / 6, '#e0453a');
  ctx.restore();
  // player arrow
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(W / 2, W / 2 - 8); ctx.lineTo(W / 2 - 6, W / 2 + 6); ctx.lineTo(W / 2 + 6, W / 2 + 6); ctx.closePath(); ctx.fill();
}

function updateHud(dt) {
  $('health-bar').style.width = player.health + '%';
  $('gas-bar').style.width = player.gas + '%';
  $('gas-pct').textContent = Math.round(player.gas) + '%';
  const s = player.sharp + '%';
  $('blade-l').firstChild.style.height = s; $('blade-r').firstChild.style.height = s;
  $('spares').textContent = '×' + player.spares;
  $('speed').textContent = Math.round(player.speed() * 3.6) + ' km/h';
  $('kill-count').textContent = game.kills;
  if (popupTimer > 0) { popupTimer -= dt; if (popupTimer <= 0) $('popup').classList.remove('show'); }
  const vig = $('vignette');
  const low = player.health < 35 ? 0.35 : 0;
  vig.style.boxShadow = `inset 0 0 160px rgba(200,0,0,${Math.max(low, player.hurtT * 1.6)})`;
  // crosshair state
  const ch = $('crosshair');
  ch.classList.remove('far', 'locked', 'core');
  if (lastAim && lastAim.dist <= P.hookRange) {
    ch.classList.add(lastAim.core ? 'core' : 'locked');
    $('aim-dist').textContent = Math.round(lastAim.dist) + ' m';
  } else { ch.classList.add('far'); $('aim-dist').textContent = ''; }
  const d = nearestDepot();
  const pr = $('prompt');
  if (d && d.dist < 5) { pr.classList.remove('hidden'); pr.textContent = `E — resupply at ${d.name}`; }
  else pr.classList.add('hidden');
}

// ---------------- tutorial ----------------
const tut = { i: 0, acc: 0, done: false, startKills: 0 };
const TUT = [
  {
    text: 'Welcome to the wall, recruit. See those colossi beyond the walls? You will learn to cut them down. Walk with <b>WASD</b>, look with the mouse, and head to the yellow beacon.',
    beacon: () => info.wallBeacon,
    obj: () => `Reach the beacon · ${Math.round(distTo(info.wallBeacon))} m`,
    check: () => distTo(info.wallBeacon) < 3.5,
  },
  {
    text: 'Now the left anchor: <b>hold LEFT MOUSE</b> while aiming at a tower or a tree. Hang on and stay off the ground.',
    obj: () => `Left anchor ${player.hooks[0].attached ? '✓' : '✗'} · Air time ${tut.acc.toFixed(1)} / 3.0 s`,
    tick: (dt) => { if (player.hooks[0].attached && !player.onGround) tut.acc += dt; },
    check: () => tut.acc >= 3,
  },
  {
    text: 'Good! Now the right anchor: <b>hold RIGHT MOUSE</b>. Release one, fire the other — chain them and swing like a pendulum. Keep your momentum!',
    obj: () => `Right anchor ${player.hooks[1].attached ? '✓' : '✗'} · Air time ${tut.acc.toFixed(1)} / 3.0 s`,
    tick: (dt) => { if (player.hooks[1].attached && !player.onGround) tut.acc += dt; },
    check: () => tut.acc >= 3,
  },
  {
    text: 'Hold <b>SPACE</b> in the air to fire your gas jets along your aim. Use <b>WASD</b> to pump your swings.',
    obj: () => `Gas boost ${tut.acc.toFixed(1)} / 1.5 s`,
    tick: (dt) => { if (player.boosting) tut.acc += dt; },
    check: () => tut.acc >= 1.5,
  },
  {
    text: 'Hold <b>SHIFT</b> while anchored to reel in hard. Speed is your weapon — and your biggest danger.',
    obj: () => `Reel in ${tut.acc.toFixed(1)} / 1.0 s`,
    tick: (dt) => { if (player.reeling) tut.acc += dt; },
    check: () => tut.acc >= 1,
  },
  {
    text: 'Hit the ground too fast and it will break you. Hold <b>G</b> for the landing thrusters, then touch down in the training yard.',
    beacon: () => info.yard,
    obj: () => `Land in the training yard · ${Math.round(distTo(info.yard))} m`,
    check: () => player.onGround && inYard(),
  },
  {
    text: 'Meet the drill dummy. Every colossus hides its <b>core</b> at the back of the neck — that glowing plate. Get behind it and press <b>F</b>. Faster means a deeper cut.',
    enter: () => { if (!dummy || !dummy.alive) spawnDummy(); },
    obj: () => 'Cut the dummy’s core',
    check: () => !dummy || !dummy.alive,
  },
  {
    text: 'Every cut dulls your blades. Press <b>R</b> to swap in a fresh pair. Any green beacon will resupply gas and blades with <b>E</b>.',
    enter: () => { swapped = false; },
    obj: () => 'Swap blades (R)',
    check: () => swapped,
  },
  {
    text: 'A colossus is at the south gate! Get over the wall and cut its core. Watch its hands — it will grab anything that hovers in front of it.',
    enter: () => {
      tut.startKills = game.kills;
      tut.target = spawnColossus(info.gateOutside.x, info.gateOutside.z + 6, 12);
      tut.target.yaw = Math.PI;
    },
    beacon: () => (tut.target && tut.target.alive ? tut.target.pos : null),
    obj: () => `Fell the colossus · ${tut.target && tut.target.alive ? Math.round(distTo(tut.target.pos)) + ' m' : ''}`,
    tick: () => { if (tut.target && tut.target.removed && game.kills === tut.startKills) tut.target = spawnColossus(info.gateOutside.x, info.gateOutside.z + 6, 12); },
    check: () => game.kills > tut.startKills,
  },
  {
    text: 'Outstanding flying, scout. That’s First Flight done. More of them are coming — the field is yours.',
    obj: () => 'Training complete',
    tick: () => { if (tut.acc === 0) tut.endAt = game.time + 7; tut.acc = 1; },
    check: () => game.time > tut.endAt,
  },
];
function distTo(p) { return Math.hypot(p.x - player.pos.x, (p.y ?? player.pos.y) - player.pos.y, p.z - player.pos.z); }
function inYard() { const y = info.yard; return player.pos.x > y.x0 && player.pos.x < y.x1 + 1 && player.pos.z > y.z0 && player.pos.z < y.z1 + 1; }
function enterStep(i) {
  tut.i = i; tut.acc = 0;
  const s = TUT[i];
  if (!s) { startFreeRoam(true); return; }
  if (s.enter) s.enter();
  dialog(s.text);
}
function updateTutorial(dt) {
  const s = TUT[tut.i];
  if (!s) return;
  if (s.tick) s.tick(dt);
  $('objective').textContent = s.obj();
  const b = s.beacon ? s.beacon() : null;
  setObjectiveBeam(b);
  if (s.check()) { sfx.pickup(); enterStep(tut.i + 1); }
}
function setObjectiveBeam(p) {
  if (!objectiveBeam) { objectiveBeam = beam(0xffd34a, 0.6, 70, 0.35); scene.add(objectiveBeam); }
  objectiveBeam.visible = !!p;
  if (p) objectiveBeam.position.set(p.x, p.y ?? world.groundAt(p.x, p.z), p.z);
}

function startFreeRoam(fromTutorial) {
  game.mode = 'free';
  for (const c of colossi) c.passive = false;
  setMode('Free Roam', 'Colossi never stop coming');
  setObjectiveBeam(null);
  dialog(fromTutorial ? null : 'Colossi roam outside the walls and they never stop coming. Resupply at the <b>green beacons</b>. Good hunting, scout.');
  if (!fromTutorial) setTimeout(() => { if (game.mode === 'free') dialog(null); }, 9000);
}

// ---------------- game flow ----------------
function clearColossi() {
  for (const c of colossi) c.remove();
  colossi = []; dummy = null;
}
function startGame(mode) {
  sfx.init();
  clearColossi();
  game.kills = 0; game.mode = mode; game.spawnTimer = 0;
  player.reset(info.spawn);
  spawnDummy();
  pickups.forEach((p) => { p.active = true; p.group.visible = true; });
  $('menu').classList.add('hidden');
  $('hud').classList.remove('hidden');
  if (mode === 'tutorial') { setMode('First Flight', 'Learn the Tether Rig'); enterStep(0); spawnRing(8, { passive: true }); }
  else { startFreeRoam(false); spawnRing(9); }
  game.state = 'playing';
  lockPointer();
}
function pause() {
  if (game.state !== 'playing') return;
  game.state = 'paused';
  keys.clear();
  player.hooks.forEach((_, i) => player.releaseHook(i));
  $('pause').classList.remove('hidden');
  if (locked()) document.exitPointerLock();
}
function resume() {
  $('pause').classList.add('hidden');
  game.state = 'playing';
  lockPointer();
}
function toMenu() {
  game.state = 'menu';
  ['pause', 'dead', 'settings'].forEach((id) => $(id).classList.add('hidden'));
  $('menu').classList.remove('hidden');
  $('hud').classList.add('hidden');
  if (locked()) document.exitPointerLock();
}
const DEATH = {
  fall: 'You hit the ground too hard. Hold G to brake before landing.',
  wall: 'You slammed into a wall at speed. Release an anchor or brake earlier.',
  colossus: 'A colossus caught you. Stay out of its reach unless you’re behind it.',
  void: 'You fell off the world.',
};
function onDeath(cause) {
  setTimeout(() => {
    if (game.state !== 'playing') return;
    game.state = 'dead';
    keys.clear();
    if (locked()) document.exitPointerLock();
    $('dead-text').textContent = DEATH[cause] || 'You fell.';
    $('dead').classList.remove('hidden');
  }, 1400);
}
function respawn() {
  $('dead').classList.add('hidden');
  player.reset(info.spawn);
  if (game.mode === 'free') {
    for (const c of colossi) if (!c.dummy && c.pos.distanceTo(player.pos) < 80) c.remove();
    colossi = colossi.filter((c) => !c.removed);
  }
  game.state = 'playing';
  lockPointer();
}

$('btn-tutorial').onclick = () => startGame('tutorial');
$('btn-free').onclick = () => startGame('free');
$('btn-resume').onclick = resume;
$('btn-quit').onclick = toMenu;
$('btn-quit2').onclick = toMenu;
$('btn-respawn').onclick = respawn;
let settingsFrom = 'menu';
const openSettings = (from) => { settingsFrom = from; $(from).classList.add('hidden'); $('settings').classList.remove('hidden'); };
$('btn-settings').onclick = () => openSettings('menu');
$('btn-settings2').onclick = () => openSettings('pause');
$('btn-back').onclick = () => { $('settings').classList.add('hidden'); $(settingsFrom).classList.remove('hidden'); saveSettings(); };
function bindSlider(id, key, fmt) {
  const el = $('s-' + id), out = $('o-' + id);
  el.value = settings[key]; out.textContent = fmt(settings[key]);
  el.oninput = () => {
    settings[key] = +el.value; out.textContent = fmt(settings[key]);
    if (key === 'vol') sfx.setVolume(settings.vol);
  };
}
bindSlider('sens', 'sens', (v) => v.toFixed(1) + '×');
bindSlider('fov', 'fov', (v) => v + '°');
bindSlider('vol', 'vol', (v) => Math.round(v * 100) + '%');
$('s-inv').checked = settings.inv;
$('s-inv').onchange = () => { settings.inv = $('s-inv').checked; };

// ---------------- per-frame updates ----------------
function updateRopes() {
  if (!ropes.length) {
    for (let i = 0; i < 2; i++) {
      const geo = new THREE.CylinderGeometry(0.03, 0.03, 1, 5, 1, true);
      geo.translate(0, 0.5, 0);
      const line = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x2a2a2a }));
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshLambertMaterial({ color: 0x9aa4ae }));
      scene.add(line, head);
      ropes.push({ line, head });
    }
  }
  const up = new THREE.Vector3(0, 1, 0);
  player.hooks.forEach((h, i) => {
    const r = ropes[i];
    const vis = h.state !== 'idle';
    r.line.visible = vis; r.head.visible = vis;
    if (!vis) return;
    const from = player.hipPos(h.side, _v1);
    const d = _v2.copy(h.tip).sub(from);
    const len = d.length();
    r.line.position.copy(from);
    r.line.scale.set(1, Math.max(0.01, len), 1);
    if (len > 0.001) r.line.quaternion.setFromUnitVectors(up, d.divideScalar(len));
    r.head.position.copy(h.tip);
  });
}

const camDir = new THREE.Vector3();
// the camera may pass through foliage so the canopy doesn't shove it into your back
const camBlocks = (b) => BLOCKS[b].solid && b !== B.LEAVES && b !== B.HEDGE;
let camDist = 5.5;
function updateCamera(dt) {
  const fovTarget = settings.fov + Math.min(22, Math.max(0, player.speed() - 8) * 0.35);
  camera.fov += (fovTarget - camera.fov) * Math.min(1, dt * 4);
  camera.updateProjectionMatrix();
  camera.rotation.set(player.pitch, player.yaw, 0);
  player.lookDir(camDir);
  if (game.firstPerson) {
    camera.position.set(player.pos.x, player.pos.y + 1.62, player.pos.z);
  } else {
    const pivot = _v1.set(player.pos.x, player.pos.y + 1.55, player.pos.z);
    const right = _v2.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    const want = 5.5;
    const back = _v3.copy(camDir).multiplyScalar(-1).addScaledVector(right, 0.12).normalize();
    const hit = world.raycast(pivot.x, pivot.y, pivot.z, back.x, back.y, back.z, want + 0.3, camBlocks);
    const target = hit ? Math.max(0.6, hit.dist - 0.35) : want;
    camDist = target < camDist ? target : camDist + (target - camDist) * Math.min(1, dt * 3);
    camera.position.copy(pivot).addScaledVector(back, camDist);
  }
  if (game.shake > 0) {
    game.shake = Math.max(0, game.shake - dt);
    const s = game.shake * 0.5;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
  }
}

function updatePickups(dt) {
  for (const p of pickups) {
    if (!p.active) {
      p.timer -= dt;
      if (p.timer <= 0) { p.active = true; p.group.visible = true; }
      continue;
    }
    p.group.children[0].rotation.y += dt * 1.5;
    if (player.alive && Math.hypot(p.x - player.pos.x, p.y - (player.pos.y + 0.9), p.z - player.pos.z) < 2.6) {
      if (player.gas >= 99.5) continue;
      player.gas = Math.min(100, player.gas + 40);
      p.active = false; p.group.visible = false; p.timer = 45;
      sfx.pickup();
      popup('Gas canister', '+40% gas');
    }
  }
}

function pushOutOfColossi() {
  for (const c of colossi) {
    if (!c.alive) continue;
    const dx = player.pos.x - c.pos.x, dz = player.pos.z - c.pos.z;
    const d = Math.hypot(dx, dz), r = c.radius();
    if (d < r && d > 0.01 && player.pos.y < c.pos.y + c.H * 0.75 && player.pos.y > c.pos.y - 1) {
      player.pos.x = c.pos.x + (dx / d) * r; player.pos.z = c.pos.z + (dz / d) * r;
    }
  }
}

const STEP = 1 / 120;
let acc = 0;
let last = performance.now();
let frame = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (game.state === 'loading') return;
  frame++;
  clouds.position.x += dt * 1.2;
  if (clouds.position.x > 0) clouds.position.x -= 240;

  if (game.state === 'playing' || game.state === 'dead') {
    game.time += dt;
    readInput();
    acc += dt;
    while (acc >= STEP) {
      const n = Math.max(1, Math.min(8, Math.ceil(player.speed() * STEP / 0.35)));
      for (let k = 0; k < n; k++) player.step(STEP / n, input);
      input.jumpPressed = false;
      acc -= STEP;
    }
    player.slashT = Math.max(0, player.slashT - dt);
    player.slashCD = Math.max(0, player.slashCD - dt);
    player.swapT = Math.max(0, player.swapT - dt);
    player.hurtT = Math.max(0, player.hurtT - dt);
    pushOutOfColossi();
    player.updateHooks(dt);
    for (const e of player.events) {
      if (e.type === 'hookFire') sfx.hookFire();
      if (e.type === 'hookHit') sfx.hookHit();
      if (e.type === 'hurt') sfx.hurt();
      if (e.type === 'impact') game.shake = Math.max(game.shake, 0.4);
      if (e.type === 'land') { dust.emit(_v1.set(player.pos.x, player.pos.y + 0.1, player.pos.z), Math.min(30, e.speed * 1.5), 0.8, 3, 0.8); if (e.speed > 12) game.shake = Math.max(game.shake, 0.15); }
      if (e.type === 'death') onDeath(e.cause);
    }
    player.events.length = 0;

    for (const c of colossi) c.update(dt, game);
    for (const c of colossi) if (c.removed) player.detachFrom(c);
    colossi = colossi.filter((c) => !c.removed);
    if (game.mode === 'free' && game.state === 'playing') {
      game.spawnTimer -= dt;
      const alive = colossi.filter((c) => c.alive && !c.dummy).length;
      const want = Math.min(16, 8 + Math.floor(game.kills / 3));
      if (alive < want && game.spawnTimer <= 0) { spawnAroundPlayer(); game.spawnTimer = 4; }
      const near = colossi.filter((c) => c.alive && !c.dummy && c.pos.distanceTo(player.pos) < 160).length;
      $('objective').textContent = `Colossi nearby ${near} · Felled ${game.kills}`;
    } else if (game.mode === 'tutorial' && game.state === 'playing') updateTutorial(dt);

    updatePickups(dt);
    if (slashArc && slashArc.userData.t > 0) {
      slashArc.userData.t -= dt;
      slashArc.visible = slashArc.userData.t > 0;
      slashArc.material.opacity = Math.max(0, slashArc.userData.t / 0.22) * 0.75;
      slashArc.position.set(player.pos.x, player.pos.y + 1.1, player.pos.z);
      slashArc.rotation.set(-Math.PI / 2 + 0.3, 0, -player.model.root.rotation.y + (player.spin ? frame * 0.6 : 0));
    }
    player.animate(dt, game.firstPerson, scene);
    updateCamera(dt);
    lastAim = player.alive && !game.build ? aim() : null;
    updateRopes();
    updateHud(dt);
    if (frame % 3 === 0) drawMinimap();
    sfx.update(player.speed(), player.boosting);
  } else if (game.state === 'menu') {
    // slow fly-over behind the menu
    const t = now / 1000;
    camera.position.set(info.town.cx + Math.cos(t * 0.04) * 150, 105, info.town.cz + Math.sin(t * 0.04) * 150);
    camera.lookAt(info.town.cx, 30, info.town.cz);
    if (frame % 10 === 0) chunks.cull(camera.position, 420);
    sfx.update(0, false);
  } else {
    sfx.update(0, false);
  }
  if (player && game.state === 'playing') {
    const sp = player.speed();
    if (sp > 18) {
      const n = Math.min(8, Math.floor((sp - 18) / 5) + 1);
      for (let i = 0; i < n; i++) {
        _v1.copy(camera.position).addScaledVector(player.vel, 0.35).add(_v2.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 9));
        streaks.emit(_v1, 1, 0, 0, 0.35);
      }
    }
  }
  if (chunks && frame % 10 === 0) chunks.cull(camera.position, 420);
  steam.update(dt, -0.6);
  streaks.update(dt, 0);
  sparks.update(dt, 18);
  dust.update(dt, -0.3);
  renderer.render(scene, camera);
}

// ---------------- loading ----------------
async function boot() {
  const bar = $('load-bar'), txt = $('load-text');
  const tick = () => new Promise((r) => setTimeout(r, 0));
  txt.textContent = 'Shaping the land…'; await tick();
  info = generate(world);
  txt.textContent = 'Laying the stones…'; await tick();
  chunks = new ChunkRenderer(world, scene, worldMat);
  const gen = chunks.buildAll();
  let t0 = performance.now();
  for (const p of gen) {
    if (performance.now() - t0 > 30) { bar.style.width = (p * 100).toFixed(0) + '%'; await tick(); t0 = performance.now(); }
  }
  buildMapBase();
  player = new Player(world, scene);
  player.reset(info.spawn);
  player.model.root.visible = false;

  for (const c of info.canisters) {
    const group = new THREE.Group();
    const can = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.5), new THREE.MeshLambertMaterial({ color: 0x9fdcf0, emissive: 0x2a8fb0 }));
    can.position.y = 0.4;
    group.add(can, beam(0x7ff0ff, 0.25, 26, 0.3));
    group.position.set(c.x, c.y - 0.5, c.z);
    scene.add(group);
    pickups.push({ ...c, group, active: true, timer: 0 });
  }
  for (const d of info.depots) {
    const group = new THREE.Group();
    const crateMat = new THREE.MeshLambertMaterial({ color: 0x8a6a3e });
    for (const [x, z, s] of [[-0.7, 0, 0.9], [0.5, 0.3, 0.8], [0, -0.6, 0.7]]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMat);
      c.position.set(x, s / 2, z); group.add(c);
    }
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.2, 8), new THREE.MeshLambertMaterial({ color: 0x5fae7a, emissive: 0x1d4a2c }));
    tank.position.set(0.6, 0.6, -0.7); group.add(tank);
    group.add(beam(0x5fe39a, 0.5, 60, 0.3));
    group.position.set(d.x, d.y, d.z);
    scene.add(group);
    depots.push(d);
  }
  $('loading').classList.add('hidden');
  game.state = 'menu';
}

window.__tf = { game, world, get player() { return player; }, get info() { return info; }, get colossi() { return colossi; }, input, keys, startGame, spawnColossus, slash, aim: () => aim(), camera };
requestAnimationFrame(loop);
boot().catch((e) => { console.error(e); $('load-text').textContent = 'Failed to load: ' + e.message; });
