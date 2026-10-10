// Tetherfall: bootstrap, game loop, camera, combat, people, HUD and the glue for every system.
import * as THREE from 'three';
import { B, BLOCKS, buildAtlas } from './blocks.js';
import { World, SX, SZ, SY } from './world.js';
import { generate, zoneOf, ZONE_NAMES, WALLS, G } from './worldgen.js';
import { ChunkRenderer } from './mesher.js';
import { Player, P, STATS } from './player.js';
import { Titan, distToSegment } from './titans.js';
import { Smash, nearestWall } from './smash.js';
import { Civilian, Scout, Talker } from './npcs.js';
import { Sfx } from './audio.js';
import { drawPortrait } from './models.js';
import { fbm } from './noise.js';
import { createStory } from './story.js';

const $ = (id) => document.getElementById(id);

// ---------------- settings & save ----------------
const settings = { sens: 1.6, fov: 75, vol: 0.7, inv: false, view: 300, assist: true };
try { Object.assign(settings, JSON.parse(localStorage.getItem('tetherfall-settings') || '{}')); } catch (e) { /* storage unavailable */ }
function saveSettings() { try { localStorage.setItem('tetherfall-settings', JSON.stringify(settings)); } catch (e) { /* ignore */ } }
const SAVE_KEY = 'tetherfall-save-v2';
function freshSave() {
  return { chapter: 0, marks: 0, upg: { gas: 0, blades: 0, motor: 0, range: 0, armor: 0, spares: 0 }, insignias: [], caches: [], towers: [], depots: [], flags: {}, stats: { kills: 0, saved: 0, lost: 0 }, best: 0 };
}
let save = freshSave();
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s) save = Object.assign(freshSave(), s); } catch (e) { /* ignore */ }
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }

// ---------------- renderer / scene ----------------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();
const HORIZON = new THREE.Color(0.80, 0.87, 0.95);
scene.fog = new THREE.Fog(HORIZON, 140, 900);
const camera = new THREE.PerspectiveCamera(settings.fov, window.innerWidth / window.innerHeight, 0.1, 3000);
camera.rotation.order = 'YXZ';
scene.add(makeSky());
const hemi = new THREE.HemisphereLight(0xe6f2ff, 0x5a6b45, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2dc, 1.05);
sun.position.set(0.45, 1, 0.3);
scene.add(sun);

function makeSky() {
  const geo = new THREE.SphereGeometry(2500, 24, 16);
  const col = [];
  const top = new THREE.Color(0.25, 0.5, 0.95);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = Math.max(0, p.getY(i) / 2500);
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
  const cell = 24, n = 110, y0 = 150, h = 6;
  const filled = (i, j) => i >= 0 && j >= 0 && i < n && j < n && fbm(i / 7, j / 7, 55, 3) > 0.57;
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
scene.add(clouds);
const skirt = new THREE.Mesh(new THREE.PlaneGeometry(SX + 6000, SZ + 6000), new THREE.MeshLambertMaterial({ color: 0x6f7a6a }));
skirt.rotation.x = -Math.PI / 2;
skirt.position.set(SX / 2, G - 9, SZ / 2);
scene.add(skirt);

// ---------------- world ----------------
const atlas = buildAtlas();
const worldMat = new THREE.MeshLambertMaterial({ map: atlas.texture, vertexColors: true, alphaTest: 0.5, side: THREE.FrontSide });
const world = new World();
let info = null;
let chunks = null;
let smash = null;
let farMesh = null;

function beam(color, radius, height, opacity) {
  const geo = new THREE.CylinderGeometry(radius, radius, height, 8, 1, true);
  geo.translate(0, height / 2, 0);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
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
const steam = new Particles(1400, 3.2, 0xf2f4f7, 0.5);
const sparks = new Particles(300, 0.35, 0xffb347, 0.95);
const dust = new Particles(1200, 2.2, 0xc8b89a, 0.5);
const streaks = new Particles(240, 0.09, 0xffffff, 0.55);
const blood = new Particles(200, 0.4, 0xa0201a, 0.9);
scene.add(steam.points, sparks.points, dust.points, streaks.points, blood.points);
const fx = {
  dust: (p, n, spread, up, life = 2) => dust.emit(p, n, spread, up, life),
  steam: (p, n, spread, up, life = 2) => steam.emit(p, n, spread, up, life),
};

// ---------------- game objects ----------------
const sfx = new Sfx();
sfx.setVolume(settings.vol);
let player = null;
const pickups = [];
const depots = [];
const ropes = [];
let objectiveBeam = null;
let slashArc = null;
const markers = []; // story/collectible beams

const game = {
  state: 'loading', // loading | menu | playing | paused | dead | talk | shop | map
  mode: 'story',
  firstPerson: false,
  showHelp: true,
  build: false,
  buildBlock: B.BRICK,
  shake: 0,
  time: 0,
  titans: [], scouts: [], civilians: [], talkers: [],
  session: { kills: 0, saved: 0, lost: 0 },
  lock: null,
  strikeCD: 0,
  scene, fx, sfx,
  get world() { return world; },
  get player() { return player; },
  get info() { return info; },
  get smash() { return smash; },
  get save() { return save; },
  listeners: {},
};
game.on = (type, fn) => { (game.listeners[type] = game.listeners[type] || []).push(fn); };
game.emit = (type, ...a) => { for (const fn of game.listeners[type] || []) fn(...a); };

// ---------------- input ----------------
const keys = new Set();
const input = { forward: false, back: false, left: false, right: false, boost: false, reel: false, brake: false, jumpPressed: false };
let swapped = false;

function locked() { return document.pointerLockElement === canvas; }
function lockPointer() { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* not supported */ } }

window.addEventListener('keydown', (e) => {
  if (game.state === 'talk') {
    if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') { advanceTalk(); e.preventDefault(); }
    if (e.code === 'Escape') closeTalk();
    return;
  }
  if (game.state === 'shop' || game.state === 'map') {
    if (e.code === 'Escape' || e.code === 'KeyM' || e.code === 'KeyU') closeOverlay();
    return;
  }
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
  if (e.code === 'KeyX') napeStrike();
  if (e.code === 'KeyT' || e.code === 'Tab') { cycleLock(); e.preventDefault(); }
  if (e.code === 'KeyR') swapBlades();
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyM') openMap();
  if (e.code === 'KeyU') openShop(false);
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
  if (!locked()) { lockPointer(); return; } // the first click only takes the mouse
  if (e.button === 0) pressHook(0);
  if (e.button === 2) pressHook(1);
  if (e.button === 1 || e.button === 3 || e.button === 4) { napeStrike(); e.preventDefault(); }
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

// ---------------- aiming (with assist) ----------------
const raycaster = new THREE.Raycaster();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();

function castAim(origin, dir, maxD) {
  const vox = world.raycast(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, maxD);
  let best = null;
  if (vox) best = { point: new THREE.Vector3(...vox.point), object: null, owner: null, camDist: vox.dist, vox: [vox.x, vox.y, vox.z] };
  const parts = [];
  for (const c of game.titans) if (c.alive && c.pos.distanceTo(origin) < maxD + c.H) parts.push(...c.parts);
  if (parts.length) {
    raycaster.set(origin, dir);
    raycaster.far = best ? best.camDist : maxD;
    const hits = raycaster.intersectObjects(parts, false);
    if (hits.length) {
      const h = hits[0];
      const t = h.object.userData.titan;
      best = { point: h.point.clone(), object: h.object, owner: t, camDist: h.distance, core: h.object === t.m.core, vox: null };
    }
  }
  return best;
}
function aim() {
  const origin = camera.position;
  const dir = camera.getWorldDirection(_v1).clone();
  const range = P.hookRange + STATS.rangeBonus;
  const maxD = range + 14;
  let best = castAim(origin, dir, maxD);
  const chest = player.chestPos(_v2);
  const finish = (b) => {
    if (!b) return null;
    const toT = _v3.copy(b.point).sub(chest);
    b.dist = toT.length();
    const block = world.raycast(chest.x, chest.y, chest.z, toT.x, toT.y, toT.z, b.dist - 0.3);
    if (block) {
      b.point.set(...block.point);
      b.object = null; b.owner = null; b.core = false;
      b.dist = block.dist; b.vox = [block.x, block.y, block.z];
    }
    return b;
  };
  best = finish(best);
  if (best && best.dist <= range) return best;
  if (!settings.assist) return best;
  // assist: snap to a locked titan, or to the nearest surface in a small cone
  if (game.lock && game.lock.alive) {
    const head = game.lock.m.head.getWorldPosition(_v4);
    const to = head.clone().sub(origin);
    if (to.length() < range + 10 && to.normalize().dot(dir) > 0.94) {
      const b = finish({ point: head.clone(), object: game.lock.m.torso, owner: game.lock, camDist: 0, vox: null });
      if (b && b.dist <= range) { b.assisted = true; return b; }
    }
  }
  const right = _v4.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const up = new THREE.Vector3().crossVectors(right, dir).normalize();
  for (const ang of [0.05, 0.1, 0.16]) {
    let pick = null;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const d = dir.clone().addScaledVector(right, Math.cos(a) * ang).addScaledVector(up, Math.sin(a) * ang).normalize();
      const b = finish(castAim(origin, d, maxD));
      if (b && b.dist <= range && (!pick || b.dist < pick.dist)) pick = b;
    }
    if (pick) { pick.assisted = true; return pick; }
  }
  return best;
}

let lastAim = null;
function pressHook(i) {
  if (!player || !player.alive || game.state !== 'playing' || player.grabbed) return;
  sfx.init();
  if (game.build) { buildAction(i); return; }
  player.fireHook(i, lastAim || aim());
}
function releaseHook(i) { if (player) player.releaseHook(i); }

// ---------------- combat ----------------
function bladeWear(n) { player.sharp = Math.max(0, player.sharp - n * STATS.bladeWear); }

function slash() {
  if (!player.alive) return;
  if (player.grabbed) { struggle(); return; }
  if (player.slashCD > 0 || player.swapT > 0 || game.build) return;
  player.slashT = 0.32; player.slashCD = 0.42;
  const speed = player.speed();
  player.spin = speed > 22;
  sfx.slash();
  showArc();
  if (player.sharp <= 0) { popup('Blades dull', 'Press R to swap in a fresh pair'); return; }
  const chest = player.chestPos();
  for (const c of game.titans) {
    if (!c.alive) continue;
    const r = c.tryCut(chest, speed, player.spin);
    if (!r) continue;
    if (r.kind === 'armor') {
      sfx.clang(); sparks.emit(chest, 30, 1, 12, 0.6);
      player.sharp = 0;
      popup('Blades shattered!', 'Its hide is armoured — cut the knees to make it kneel');
    } else if (r.kind === 'nape') {
      sfx.cut();
      sparks.emit(c.napeWorld(_v1), 40, 1, 10, 0.7);
      steam.emit(c.napeWorld(_v1), 16, 1.5, 3, 1.5);
      bladeWear(34);
      if (r.killed) {
        onTitanKilled(c, player, { speed, spin: player.spin, dmg: r.dmg });
      } else {
        popup('Shallow cut', `${r.dmg} damage — hit it faster (${Math.max(0, c.hp)} left)`);
      }
    } else {
      sfx.cut();
      sparks.emit(chest, 20, 1, 8, 0.5);
      blood.emit(chest, 10, 1, 6, 0.6);
      bladeWear(16);
      if (r.held) popup('Freed them!', 'The arm is severed');
      else if (!c.dummy) popup(r.part === 'arm' ? 'Arm severed' : 'Tendon cut', r.part === 'arm' ? 'It can’t grab with that arm for a while' : 'It’s kneeling — go for the nape!');
    }
    break;
  }
}

// Pick the titan a nape strike would go for: the lock, else the best nape near the crosshair.
function strikeCandidate() {
  const range = 42 + STATS.rangeBonus * 0.3;
  const chest = player.chestPos(_v2);
  const dir = camera.getWorldDirection(_v1);
  const ok = (t) => {
    if (!t || !t.alive || t.dummy && game.mode !== 'training' && game.mode !== 'story') return false;
    const n = t.napeWorld(_v3);
    const d = n.distanceTo(chest);
    if (d > range) return false;
    const to = n.sub(chest);
    const block = world.raycast(chest.x, chest.y, chest.z, to.x, to.y, to.z, d - 1);
    return !block;
  };
  if (game.lock && ok(game.lock)) return game.lock;
  let best = null, bs = -1;
  for (const t of game.titans) {
    if (!t.alive) continue;
    const n = t.napeWorld(_v3);
    const d = n.distanceTo(chest);
    if (d > range) continue;
    const s = n.sub(camera.position).normalize().dot(dir);
    if (s > 0.8 && s > bs && ok(t)) { bs = s; best = t; }
  }
  return best;
}
function napeStrike() {
  if (!player.alive || player.grabbed || player.strike || game.build) return;
  if (game.strikeCD > 0) return;
  if (player.sharp <= 0) { popup('Blades dull', 'Swap blades first (R)'); return; }
  if (player.gas < 6) { popup('Out of gas', 'Not enough gas for a strike'); return; }
  const t = strikeCandidate();
  if (!t) { popup('No nape in reach', 'Get within ~40 m with a clear line to the neck'); return; }
  sfx.init();
  player.strike = { titan: t, t: 0, v0: player.speed() };
  player.hooks.forEach((h, i) => {
    h.state = 'flying'; h.miss = false; h.obj = t.m.head; h.owner = t; h.vox = null;
    h.local.set(i ? 0.8 : -0.8, 0.8, 0); h.tip.copy(player.hipPos(h.side));
  });
  game.strikeCD = 1.2;
  sfx.boost();
  game.lock = t;
}
function resolveStrike(t, speed) {
  player.hooks.forEach((_, i) => player.releaseHook(i));
  if (!t.alive) return;
  const behind = t.behindness(player.pos);
  const facing = t.target === player && behind < -0.25;
  const busy = t.state === 'eat' || t.state === 'stagger' || t.state === 'bash' || t.legsOut() || t.state === 'kick';
  // a titan that sees you coming can snatch you out of the air
  let catchP = facing && !busy ? (t.st.erratic || t.st.leap ? 0.7 : 0.45) : 0;
  if (t.st.erratic && !busy) catchP = Math.max(catchP, 0.15);
  if (t.type === 'jaw') catchP += 0.15;
  if (Math.random() < catchP) {
    popup('It saw you coming!', facing ? 'Approach from behind next time' : 'Abnormals are unpredictable');
    onTitanHit(t, player, Math.random() < 0.5 ? 0 : 1);
    return;
  }
  const mult = behind > 0.3 ? 1.25 : behind > -0.25 ? 1 : 0.8;
  const dmg = Math.round((62 + speed * 1.7) * mult * (0.6 + 0.4 * player.sharp / 100));
  const r = t.napeHit(dmg);
  player.slashT = 0.32; player.spin = true;
  showArc();
  sfx.cut();
  const back = t.forward(_v1).multiplyScalar(-1);
  player.vel.set(back.x * 10, 13, back.z * 10);
  if (r.kind === 'armor') {
    sfx.clang(); player.sharp = 0;
    sparks.emit(t.napeWorld(_v1), 40, 1, 12, 0.6);
    popup('Blades shattered!', 'The nape is armoured — cut its knees first');
    return;
  }
  sparks.emit(t.napeWorld(_v1), 50, 1.4, 12, 0.8);
  steam.emit(t.napeWorld(_v1), 20, 1.5, 3, 1.5);
  bladeWear(40);
  if (r.killed) onTitanKilled(t, player, { speed, spin: true, dmg, strike: true, mult });
  else popup('Nape strike', `${dmg} damage${mult > 1 ? ' · from behind' : mult < 1 ? ' · head-on' : ''} — ${Math.max(0, t.hp)} left`);
}
function struggle() {
  const g = player.grabbed;
  if (!g) return;
  g.presses++;
  sfx.slash(); game.shake = Math.max(game.shake, 0.2);
  blood.emit(player.chestPos(_v1), 6, 0.6, 4, 0.5);
  if (g.presses >= g.need) {
    g.titan.armOut[g.titan.attackArm] = 10;
    sfx.cut();
    popup('Cut free!', 'You carved through its fingers');
  }
}

function swapBlades() {
  if (!player.alive || player.swapT > 0 || player.grabbed) return;
  if (player.spares <= 0) { popup('No spare blades', 'Resupply at a green beacon (E)'); return; }
  player.spares--; player.sharp = 100; player.swapT = 0.7;
  swapped = true;
  sfx.swap();
}
function nearestDepot() {
  let best = null;
  for (const d of depots) {
    const dist = Math.hypot(d.x - player.pos.x, d.y - player.pos.y, d.z - player.pos.z);
    if (!best || dist < best.dist) best = { d, dist };
  }
  return best;
}
function resupply(d) {
  player.gas = STATS.gasMax; player.sharp = 100; player.spares = STATS.spareMax; player.health = Math.min(STATS.healthMax, player.health + 40);
  sfx.pickup();
  popup('Resupplied', 'Gas, blades and bandages topped up');
  game.emit('resupply', d);
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
function cycleLock() {
  const cands = game.titans.filter((t) => t.alive && t.pos.distanceTo(player.pos) < 160 && !t.passive)
    .map((t) => ({ t, s: t.napeWorld(_v1).sub(camera.position).normalize().dot(camera.getWorldDirection(_v2)) }))
    .filter((c) => c.s > 0.3).sort((a, b) => b.s - a.s);
  if (!cands.length) { game.lock = null; return; }
  const i = cands.findIndex((c) => c.t === game.lock);
  game.lock = cands[(i + 1) % cands.length].t;
  sfx.tick();
}

// ---------------- titans: spawning and the hooks they call ----------------
const DEFAULT_H = { pure: () => (Math.random() < 0.35 ? 5 + Math.random() * 4 : 9 + Math.random() * 7), abnormal: () => 7 + Math.random() * 7, crawler: () => 6 + Math.random() * 3, jaw: () => 5.5, armored: () => 15, beast: () => 17, colossal: () => 58 };
function spawnTitan(type, x, z, H, opts = {}) {
  const t = new Titan(scene, type, x, z, H ?? DEFAULT_H[type](), opts);
  t.pos.y = world.groundAt(x, z);
  game.titans.push(t);
  return t;
}
game.spawnTitan = spawnTitan;
function randomType(level = 0) {
  const r = Math.random();
  if (r < 0.1 + level * 0.015) return 'abnormal';
  if (r < 0.16 + level * 0.025) return 'crawler';
  return 'pure';
}
game.randomType = randomType;
function clearOfWalls(x, z, m = 14) {
  return WALLS.every((w) => {
    const d = Math.hypot(x - w.cx, z - w.cz);
    if (w.parent != null && Math.hypot(x - WALLS[w.parent].cx, z - WALLS[w.parent].cz) < WALLS[w.parent].R) return true;
    return Math.abs(d - w.R) > m;
  });
}
// Find open ground for a titan within [rMin, rMax] of a point, in one of the allowed zones.
function findSpawn(px, pz, rMin, rMax, zones, avoid = null, avoidR = 0) {
  for (let tries = 0; tries < 80; tries++) {
    const a = Math.random() * Math.PI * 2, r = rMin + Math.random() * (rMax - rMin);
    const x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
    if (x < 40 || z < 40 || x > SX - 40 || z > SZ - 40) continue;
    if (zones && !zones.includes(zoneOf(x, z))) continue;
    if (!clearOfWalls(x, z)) continue;
    if (world.groundAt(x, z) > G + 30) continue;
    if (avoid && Math.hypot(avoid.x - x, avoid.z - z) < avoidR) continue;
    return { x, z };
  }
  return null;
}
game.findSpawn = findSpawn;
game.spawnNear = (px, pz, rMin, rMax, zones, type, opts = {}) => {
  const s = findSpawn(px, pz, rMin, rMax, zones, opts.avoid ? player.pos : null, opts.avoidR || 0);
  if (!s) return null;
  return spawnTitan(type || randomType(opts.level || 0), s.x, s.z, opts.H, opts);
};

// Everyone a titan might eat.
function humans() {
  const list = [];
  if (player.alive && !game.build) list.push(player);
  for (const s of game.scouts) if (s.alive) list.push(s);
  for (const c of game.civilians) if (c.alive && c.state !== 'saved') list.push(c);
  for (const t of game.talkers) if (t.targetable && t.alive) list.push(t);
  return list;
}
let humanCache = [];
game.pickTarget = (t) => {
  let best = null, bs = 1e9;
  const sight = t.st.sight;
  for (const h of humanCache) {
    if (!h.alive || h.heldBy || (h === player && player.grabbed)) continue;
    const d = Math.hypot(h.pos.x - t.pos.x, h.pos.z - t.pos.z);
    if (d > sight) continue;
    let s = d;
    if (h === player) s -= t.st.erratic ? 70 : t.boss ? 50 : 15;
    if (h.kind === 'civilian') s -= 30; // townsfolk are what they really want
    if (h.pos.y - t.pos.y > t.H * 2.5 && !t.st.throws) s += 60; // out of reach up a wall: less interesting
    if (s < bs) { bs = s; best = h; }
  }
  return best;
};
const chestOf = (h, out) => (h === player ? player.chestPos(out) : h.chestPos(out));
game.humanNear = (p, r, titan) => {
  for (const h of humanCache) {
    if (!h.alive || h.heldBy || (h === player && (player.grabbed || player.strike && titan && player.strike.titan !== titan))) continue;
    if (chestOf(h, _v4).distanceTo(p) < r) return h;
  }
  return null;
};
game.humanNearSegment = (a, b, r, titan) => {
  let best = null, bd = r;
  for (const h of humanCache) {
    if (!h.alive || h.heldBy || (h === player && player.grabbed)) continue;
    const d = distToSegment(chestOf(h, _v4), a, b);
    if (d < bd) { bd = d; best = h; }
  }
  return best;
};
game.nearestTitan = (p, r) => {
  let best = null, bd = r;
  for (const t of game.titans) {
    if (!t.alive || t.dummy) continue;
    const d = Math.hypot(t.pos.x - p.x, t.pos.z - p.z);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
};

function onTitanHit(t, h, arm) {
  if (h === player) {
    if (!player.alive || player.grabbed) return;
    player.strike = null;
    if (t.st.grab && t.armOut[arm] <= 0) {
      const need = t.st.struggle || (4 + Math.floor(t.H / 5));
      player.grabbed = { titan: t, presses: 0, need };
      player.hooks.forEach((_, i) => player.releaseHook(i));
      t.seize(player, arm);
      game.shake = 0.6;
      sfx.hurt(); sfx.roar(0.5);
      popup('GRABBED!', `Hammer F to cut free (${need} cuts)`);
      player.damage(12, 'eaten');
      game.radio('You', 'It’s got me!', 'you');
    } else {
      const dmg = t.type === 'colossal' ? 70 : t.type === 'armored' ? 55 : 30 + t.H * 1.5;
      player.damage(dmg, 'titan');
      const away = _v1.set(player.pos.x - t.pos.x, 0, player.pos.z - t.pos.z).normalize();
      player.vel.set(away.x * 22, 12, away.z * 22);
      player.hooks.forEach((_, i) => player.releaseHook(i));
      game.shake = 0.7;
    }
    return;
  }
  // an NPC is caught
  if (t.st.grab) { t.seize(h, arm); onHumanSeized(t, h); }
  else { killHuman(h, t); }
}
game.onTitanHit = onTitanHit;
function onHumanSeized(t, h) {
  h.heldBy = t;
  if (h.kind === 'scout' || h.kind === 'garrison') game.radio(h.name, ['No— NO! Let go!', 'Help me! HELP—', 'It’s got me!', 'Somebody!'][Math.floor(Math.random() * 4)], 'down');
  if (h.kind === 'civilian' && h.pos.distanceTo(player.pos) < 120 && Math.random() < 0.4) popup('A civilian is caught!', 'Cut the arm or the nape to save him');
}
game.onHumanSeized = onHumanSeized;
game.holdVictim = (t, v, hand) => {
  if (v === player) { player.pos.set(hand.x, hand.y - 1.2, hand.z); player.vel.set(0, 0, 0); return; }
  v.pos.set(hand.x, hand.y - 1.1, hand.z);
};
game.releaseVictim = (t, v) => {
  if (v === player) {
    player.grabbed = null;
    const away = t.forward(_v1);
    player.vel.set(away.x * 8, 10, away.z * 8);
    return;
  }
  v.heldBy = null;
  v.pos.y = Math.max(v.pos.y, world.groundAt(v.pos.x, v.pos.z));
  if (v.kind === 'civilian') { v.state = 'wander'; v.flee(); if (v.pos.distanceTo(player.pos) < 80) addMarks(10, 'Saved him from its grip'); }
  if (v.kind === 'scout' || v.kind === 'garrison') {
    v.state = 'evade'; v.evadeTo = { x: v.pos.x + 10, y: v.pos.y + 8, z: v.pos.z + 10 }; v.timer = 1.5;
    if (v.pos.distanceTo(player.pos) < 60) { game.radio(v.name, 'Thanks — I owe you one!', 'ally'); addMarks(10, 'Rescued a comrade'); }
    else game.radio(v.name, 'I’m free — I’m free!', 'ally');
  }
};
game.onEaten = (t, v) => {
  if (v === player) {
    player.grabbed = null;
    player.damage(999, 'eaten');
    player.model.root.visible = false;
    blood.emit(t.m.head.getWorldPosition(_v1), 40, 1, 5, 1);
    return;
  }
  killHuman(v, t);
};
function killHuman(v, t) {
  if (!v.alive) return;
  v.alive = false; v.heldBy = null;
  game.talkers = game.talkers.filter((q) => q !== v);
  blood.emit(v.chestPos(_v1), 24, 0.8, 5, 1);
  v.dispose();
  if (v.kind === 'civilian') {
    game.session.lost++; save.stats.lost++;
    if (v.town) v.town.civilians = Math.max(0, v.town.civilians - 1);
    game.emit('civLost', v);
  } else if (v.kind === 'scout' || v.kind === 'garrison') {
    game.radio(v.squad, `${v.name} is down!`, 'down');
    game.emit('scoutLost', v);
  } else game.emit('npcLost', v);
}
function onTitanKilled(t, by, d = {}) {
  if (!t.alive) return;
  const victim = t.victim;
  t.kill();
  player.detachFrom(t);
  if (game.lock === t) game.lock = null;
  if (victim && victim !== player && victim.alive) game.releaseVictim(t, victim);
  if (player.grabbed && player.grabbed.titan === t) game.releaseVictim(t, player);
  sfx.kill();
  if (t.dummy) { popup('Core cut!', d.strike ? 'Nape strike!' : `${d.dmg} damage at ${Math.round((d.speed || 0) * 3.6)} km/h`); game.emit('titanKilled', t, by, d); return; }
  const reward = t.boss ? 300 : t.type === 'pure' ? 15 : 25;
  if (by === player) {
    game.session.kills++; save.stats.kills++;
    addMarks(reward);
    popup(t.boss ? `${t.name.toUpperCase()} FELLED` : 'TITAN FELLED', `${d.dmg || ''} damage${d.speed ? ` at ${Math.round(d.speed * 3.6)} km/h` : ''}${d.strike ? ' · nape strike' : d.spin ? ' · spin cut' : ''} · +${reward} marks`);
    game.shake = 0.5;
  } else if (by && by.name) {
    if (Math.random() < 0.6) game.radio(by.name, t.boss ? `${t.name} is DOWN!` : ['Got one!', 'Nape cut — it’s down!', 'One less!', 'Clean kill!'][Math.floor(Math.random() * 4)], 'ally');
  }
  game.emit('titanKilled', t, by, d);
  if (t.boss) game.emit('bossDown', t, by);
}
game.onTitanKilled = onTitanKilled;
game.onTitanLand = (t) => {
  sfx.stomp();
  const f = t.forward(_v2);
  const p = _v1.copy(t.pos).addScaledVector(f, t.H * 0.6); p.y += 1;
  dust.emit(p, 80, t.H * 0.5, 4, 2);
  steam.emit(t.napeWorld(_v1), 90, t.H * 0.4, 4, 4);
  // the body crushes whatever it falls on
  for (let k = 0.3; k <= 1; k += 0.25) smash.explode(_v3.copy(t.pos).addScaledVector(f, t.H * k).setY(t.pos.y + t.H * 0.08), Math.min(4.5, t.H * 0.14));
  if (t.pos.distanceTo(player.pos) < 70) game.shake = Math.max(game.shake, 0.4);
};
game.onTitanStomp = (t) => {
  dust.emit(_v1.copy(t.pos).setY(t.pos.y + 0.5), 30, t.H * 0.3, 3, 1.5);
  if (t.pos.distanceTo(player.pos) < 50) { game.shake = Math.max(game.shake, 0.3); sfx.stomp(); }
};
game.throwBoulder = (t, target) => {
  const hand = t.handWorld(1, _v1).clone();
  smash.throwBoulder(hand, target === player ? { pos: player.pos, vel: player.vel } : target);
  sfx.roar(0.25);
};
game.onBoulderImpact = (p, h) => {
  sfx.crash(Math.max(0.2, 1 - p.distanceTo(player.pos) / 200));
  dust.emit(p, 40, 4, 6, 2);
  if (p.distanceTo(player.pos) < 60) game.shake = Math.max(game.shake, 0.5);
  for (const hh of humanCache) {
    if (!hh.alive) continue;
    const d = chestOf(hh, _v4).distanceTo(p);
    if (d > 5.5) continue;
    if (hh === player) {
      player.damage(d < 2.8 ? 70 : 35, 'boulder');
      const away = _v4.copy(player.pos).sub(p).normalize();
      player.vel.addScaledVector(away, 22);
      player.hooks.forEach((_, i) => player.releaseHook(i));
    } else killHuman(hh, null);
  }
};
game.onSteamStart = (t) => {
  if (t.pos.distanceTo(player.pos) < 200) { game.radio('Garrison', 'It’s venting steam — pull back!', 'alert'); sfx.steam(); }
};
game.steamBurst = (t, dt) => {
  const c = _v1.copy(t.pos); c.y += t.H * 0.6;
  for (let k = 0; k < 6; k++) steam.emit(_v2.set(c.x + (Math.random() - 0.5) * t.H * 0.4, c.y + (Math.random() - 0.4) * t.H * 0.8, c.z + (Math.random() - 0.5) * t.H * 0.4), 1, 3, 8, 2.5);
  const R = t.H * 0.55;
  const d = player.chestPos(_v3).distanceTo(c);
  if (player.alive && d < R) {
    const away = _v3.sub(c).normalize();
    player.vel.addScaledVector(away, 60 * dt);
    player.damage(16 * dt, 'steam');
    if (Math.random() < dt * 4) player.hooks.forEach((h, i) => { if (h.owner === t) player.releaseHook(i); });
  }
  for (const s of game.scouts) if (s.alive && s.state !== 'perch' && s.pos.distanceTo(c) < R) { s.state = 'return'; }
};
game.bashWall = (p, r, t, kick) => smash.bashWall(p, r, t, kick);
game.onWallBash = (p, n, t, kick) => {
  if (game.quiet) return;
  const d = player.pos.distanceTo(_v1.set(p.x, p.y, p.z));
  if (d < 220) sfx.thud(Math.max(0.15, 1 - d / 220) * (kick ? 2 : 1));
  if (n > 0) dust.emit(_v1, Math.min(60, 6 + n), 3 + (kick ? 10 : 0), 4, 2);
  if (d < 60) game.shake = Math.max(game.shake, kick ? 1.2 : 0.18);
  if (kick) { steam.emit(_v1, 200, 20, 6, 5); dust.emit(_v1, 300, 22, 10, 4); }
};
game.breachRoute = (t, blockPt) => {
  const wid = nearestWall(blockPt.x, blockPt.z);
  const w = WALLS[wid];
  const side = Math.sign(Math.hypot(t.pos.x - w.cx, t.pos.z - w.cz) - w.R) || 1;
  let best = null, bd = 260;
  for (const b of smash.breaches) {
    if (!b.open || b.wallId !== wid) continue;
    const d = Math.hypot(b.x - t.pos.x, b.z - t.pos.z);
    if (d < bd) { bd = d; best = b; }
  }
  if (!best) return null;
  const r = t.radius();
  return [{ x: best.x + best.nx * side * (r + 12), z: best.z + best.nz * side * (r + 12) }, { x: best.x - best.nx * side * (r + 14), z: best.z - best.nz * side * (r + 14) }];
};
game.onBreach = (rec, t) => {
  const w = WALLS[rec.wallId];
  rec.openedAt = game.time;
  if (game.quiet) return;
  game.radio('Garrison', `BREACH in the ${w.name}!`, 'alert');
  sfx.bell();
  // townsfolk behind that wall and near the hole run for it
  const behind = [['inner'], ['middle'], ['outer', 'corvane'], ['tharsk'], ['corvane']][rec.wallId];
  for (const town of info.towns) {
    if (town.civilians <= 0 || !town.evac) continue;
    if (!behind.includes(zoneOf(town.ox, town.oz))) continue;
    if (Math.hypot(town.ox - rec.x, town.oz - rec.z) < 320) raiseAlarm(town);
  }
  game.emit('breach', rec, t);
};
game.onSealed = (rec) => { game.radio('Engineers', `The breach in the ${WALLS[rec.wallId].name} is sealed.`, 'ally'); game.emit('sealed', rec); };
game.onSmash = (t, n) => {
  const d = t.pos.distanceTo(player.pos);
  if (d < 160 && Math.random() < 0.3) sfx.crash(Math.max(0.1, 0.6 - d / 300));
  if (d < 40) game.shake = Math.max(game.shake, 0.15);
  dust.emit(_v1.copy(t.pos).addScaledVector(t.forward(_v2), t.radius()).setY(t.pos.y + t.H * 0.4), Math.min(14, n / 5), t.H * 0.4, 3, 1.5);
};
game.onCollapse = (b) => {
  const c = _v1.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
  dust.emit(c, 60, Math.max(b.x1 - b.x0, 6), 5, 2.5);
  const d = c.distanceTo(player.pos);
  if (d < 200) sfx.crash(Math.max(0.2, 1 - d / 200));
};
game.onTreeFall = (tr) => {
  const d = Math.hypot(tr.x - player.pos.x, tr.z - player.pos.z);
  if (d < 250) sfx.creak(Math.max(0.2, 1 - d / 250));
};
game.onTreeLand = (tr, dir) => {
  const end = _v1.set(tr.x + dir[0] * tr.h * 0.8, tr.g + 2, tr.z + dir[1] * tr.h * 0.8);
  for (let k = 0.2; k <= 1; k += 0.2) dust.emit(_v2.set(tr.x + dir[0] * tr.h * k, tr.g + 2, tr.z + dir[1] * tr.h * k), 14, 6, 4, 2);
  const d = end.distanceTo(player.pos);
  if (d < 220) { sfx.crash(Math.max(0.3, 1 - d / 220)); game.shake = Math.max(game.shake, d < 60 ? 0.6 : 0.2); }
  const a = _v2.set(tr.x, tr.g + 2, tr.z);
  for (const h of humanCache) if (h.alive && distToSegment(chestOf(h, _v3), a, end) < 4) { if (h === player) player.damage(45, 'tree'); else killHuman(h, null); }
};

// ---------------- people ----------------
function raiseAlarm(town) {
  if (town.alarm) return;
  town.alarm = true;
  for (const c of game.civilians) if (c.town === town) c.flee();
  game.emit('alarm', town);
}
game.raiseAlarm = raiseAlarm;
game.onCivilianSaved = (c) => {
  game.session.saved++; save.stats.saved++;
  c.town.civilians = Math.max(0, c.town.civilians - 1);
  c.town.evacuated = (c.town.evacuated || 0) + 1;
  addMarks(3, null);
  c.alive = false; c.dispose();
  game.emit('civSaved', c);
};
// Townsfolk only exist as models while you are close to their town.
function updateTownsfolk() {
  for (const town of info.towns) {
    if (!town.nodes || !town.nodes.length) continue;
    const d = Math.hypot(town.ox - player.pos.x, town.oz - player.pos.z);
    const here = game.civilians.filter((c) => c.town === town && c.alive);
    if (d < 380 && !town.live && town.civilians > 0) {
      town.live = true;
      const n = Math.min(town.civilians, town.village ? 14 : 34);
      for (let i = 0; i < n; i++) {
        const node = town.nodes[Math.floor(Math.random() * town.nodes.length)];
        const c = new Civilian(game, town, node.x + (Math.random() - 0.5) * 4, node.z + (Math.random() - 0.5) * 4);
        if (town.alarm) c.flee();
        game.civilians.push(c);
      }
    } else if (d > 520 && town.live) {
      town.live = false;
      for (const c of here) { c.alive = false; c.dispose(); }
    } else if (town.live && here.length < Math.min(town.civilians, town.village ? 14 : 34)) {
      // more people come out of the houses
      const node = town.nodes[Math.floor(Math.random() * town.nodes.length)];
      const c = new Civilian(game, town, node.x + (Math.random() - 0.5) * 4, node.z + (Math.random() - 0.5) * 4);
      if (town.alarm) c.flee();
      game.civilians.push(c);
    }
    // evacuation continues off-screen
    if (town.alarm && !town.live && town.civilians > 0 && Math.random() < 0.01) {
      town.civilians--; game.session.saved++;
    }
  }
  game.civilians = game.civilians.filter((c) => c.alive);
}
function addScout(x, y, z, opts) {
  const s = new Scout(game, x, y, z, opts);
  game.scouts.push(s);
  return s;
}
game.addScout = addScout;
// A squad of scouts perched near a point, ready to fight around it.
game.addSquad = (name, x, z, n, area, opts = {}) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, px = x + Math.cos(a) * 3, pz = z + Math.sin(a) * 3;
    const y = world.topSolid(Math.floor(px), Math.floor(pz), SY - 1);
    out.push(addScout(px, y, pz, { squad: name, area: area || { x, z, r: 280 }, ...opts }));
  }
  return out;
};
game.clearScouts = (filter = () => true) => {
  for (const s of game.scouts) if (filter(s)) { s.alive = false; s.dispose(); }
  game.scouts = game.scouts.filter((s) => s.alive);
};
game.addTalker = (def) => { const t = new Talker(game, def); game.talkers.push(t); return t; };
game.removeTalker = (t) => { t.dispose(); t.alive = false; game.talkers = game.talkers.filter((q) => q !== t); };

// ---------------- talking ----------------
let talk = null;
function interact() {
  if (!player.alive || player.grabbed) return;
  sfx.init();
  const p = player.pos;
  // people first
  let best = null, bd = 4.5;
  for (const t of game.talkers) { const d = t.pos.distanceTo(p); if (d < bd) { bd = d; best = t; } }
  if (best) { openTalk(best); return; }
  for (const c of game.civilians) if (c.state === 'trapped' && c.pos.distanceTo(p) < 3.5) {
    c.state = 'wander'; c.flee(); sfx.pickup(); popup('Freed a trapped civilian', 'He runs for the gate'); game.emit('freed', c); return;
  }
  for (const c of info.caches) if (!c.taken && Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z) < 3.5) {
    c.taken = true; save.caches.push(c.id); writeSave(); hideMarker(c);
    player.gas = STATS.gasMax; player.spares = STATS.spareMax;
    addMarks(60, 'Supply cache recovered'); sfx.pickup(); return;
  }
  for (const c of info.insignias) if (!c.taken && Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z) < 3.5) {
    c.taken = true; save.insignias.push(c.id); writeSave(); hideMarker(c);
    addMarks(40, `Lost insignia recovered (${save.insignias.length}/${info.insignias.length})`); sfx.pickup(); return;
  }
  for (const [i, t] of info.towers.entries()) if (!t.lit && Math.hypot(t.x - p.x, t.y - p.y, t.z - p.z) < 6) {
    lightTower(i, true); return;
  }
  const d = nearestDepot();
  if (d && d.dist < 5) { resupply(d.d); return; }
  game.emit('interact', p);
}
function lightTower(i, byPlayer) {
  const t = info.towers[i];
  if (t.lit) return;
  t.lit = true;
  if (!save.towers.includes(i)) save.towers.push(i);
  writeSave();
  if (!t.fire) {
    t.fire = beam(0xff8a2a, 1.2, 140, 0.45);
    t.fire.position.set(t.x, t.y, t.z);
    scene.add(t.fire);
  }
  if (byPlayer) { addMarks(50, `${t.name} signal lit`); sfx.bell(); game.emit('towerLit', i); }
}
function openTalk(npc) {
  const lines = typeof npc.def.lines === 'function' ? npc.def.lines(game) : npc.def.lines;
  if (!lines || !lines.length) return;
  talk = { npc, lines, i: 0 };
  game.state = 'talk';
  keys.clear();
  player.hooks.forEach((_, i) => player.releaseHook(i));
  showTalkLine();
}
function showTalkLine() {
  const l = talk.lines[talk.i];
  const who = l.who || talk.npc.def.portrait || 'townsman';
  drawPortrait($('talk-portrait'), who);
  $('talk-name').textContent = l.name || talk.npc.name;
  $('talk-text').innerHTML = l.text || l;
  $('talk').classList.remove('hidden');
}
function advanceTalk() {
  if (!talk) return;
  talk.i++;
  if (talk.i >= talk.lines.length) {
    const npc = talk.npc;
    closeTalk();
    if (npc.def.after) npc.def.after(game);
    game.emit('talked', npc);
    return;
  }
  showTalkLine();
}
function closeTalk() {
  $('talk').classList.add('hidden');
  talk = null;
  if (game.state === 'talk') game.state = 'playing';
}
game.say = (who, name, text, secs = 7) => {
  drawPortrait($('portrait'), who);
  $('dialog-name').textContent = name;
  $('dialog-text').innerHTML = text;
  $('dialog').classList.remove('hidden');
  game.sayT = secs;
};
game.hideSay = () => { $('dialog').classList.add('hidden'); game.sayT = 0; };

// ---------------- marks, upgrades & shop ----------------
const UPGRADES = [
  { key: 'gas', name: 'Gas tanks', desc: (l) => `Tank holds ${[100, 135, 170, 210][l]}% gas`, apply: (l) => { STATS.gasMax = [100, 135, 170, 210][l]; } },
  { key: 'blades', name: 'Tempered steel', desc: (l) => `Blades dull ${[0, 20, 35, 50][l]}% slower`, apply: (l) => { STATS.bladeWear = [1, 0.8, 0.65, 0.5][l]; } },
  { key: 'motor', name: 'Rig motor', desc: (l) => `Pull, reel and strike +${[0, 8, 16, 25][l]}%`, apply: (l) => { STATS.motor = [1, 1.08, 1.16, 1.25][l]; } },
  { key: 'range', name: 'Long cables', desc: (l) => `Anchor range ${95 + [0, 12, 24, 36][l]} m`, apply: (l) => { STATS.rangeBonus = [0, 12, 24, 36][l]; } },
  { key: 'armor', name: 'Padded harness', desc: (l) => `Health ${[100, 125, 150, 180][l]}`, apply: (l) => { STATS.healthMax = [100, 125, 150, 180][l]; } },
  { key: 'spares', name: 'Blade boxes', desc: (l) => `${[8, 10, 12, 15][l]} spare pairs`, apply: (l) => { STATS.spareMax = [8, 10, 12, 15][l]; } },
];
const COST = [200, 450, 900];
function applyUpgrades() { for (const u of UPGRADES) u.apply(save.upg[u.key] || 0); }
function addMarks(n, why) {
  save.marks += n;
  writeSave();
  if (why) popup(why, `+${n} marks`);
}
game.addMarks = addMarks;
function openShop(fromNpc) {
  if (!fromNpc) {
    const d = nearestDepot();
    if (!d || d.dist > 6 || d.d.zone === 'outside') { popup('No quartermaster here', 'Upgrade at a depot inside the walls (U) or talk to Quartermaster Bram'); return; }
  }
  game.state = 'shop';
  keys.clear();
  if (locked()) document.exitPointerLock();
  renderShop();
  $('shop').classList.remove('hidden');
}
game.openShop = () => openShop(true);
function renderShop() {
  $('shop-marks').textContent = save.marks;
  const list = $('shop-list');
  list.innerHTML = '';
  for (const u of UPGRADES) {
    const l = save.upg[u.key] || 0;
    const row = document.createElement('div');
    row.className = 'shop-row';
    const max = l >= 3;
    row.innerHTML = `<div><b>${u.name}</b> <span class="lvl">${'■'.repeat(l)}${'□'.repeat(3 - l)}</span><small>${u.desc(l)}${max ? '' : ` → ${u.desc(l + 1)}`}</small></div>`;
    const btn = document.createElement('button');
    btn.textContent = max ? 'MAX' : `${COST[l]} marks`;
    btn.disabled = max || save.marks < COST[l];
    btn.onclick = () => {
      if (save.marks < COST[l]) return;
      save.marks -= COST[l]; save.upg[u.key] = l + 1; applyUpgrades(); writeSave();
      player.gas = STATS.gasMax; player.health = STATS.healthMax; player.spares = STATS.spareMax;
      sfx.pickup(); renderShop();
    };
    row.appendChild(btn);
    list.appendChild(row);
  }
}
function closeOverlay() {
  $('shop').classList.add('hidden');
  $('bigmap').classList.add('hidden');
  game.state = 'playing';
  lockPointer();
}

// ---------------- big map & fast travel ----------------
function openMap() {
  game.state = 'map';
  keys.clear();
  if (locked()) document.exitPointerLock();
  $('bigmap').classList.remove('hidden');
  drawBigMap();
  const list = $('travel-list');
  list.innerHTML = '';
  const danger = game.titans.some((t) => t.alive && !t.dummy && t.pos.distanceTo(player.pos) < 70) || player.grabbed || (story.active && story.noTravel);
  $('travel-note').textContent = danger ? 'Fast travel is unavailable: titans nearby or a mission holds you here.' : 'Click a discovered depot to travel there.';
  const known = depots.filter((d) => save.depots.includes(d.name));
  for (const d of known) {
    const b = document.createElement('button');
    b.className = 'ghost small';
    b.textContent = d.name;
    b.disabled = danger;
    b.onclick = () => { player.pos.set(d.x, d.y + 0.05, d.z); player.vel.set(0, 0, 0); player.hooks.forEach((_, i) => player.releaseHook(i)); closeOverlay(); popup(d.name, 'Fast travel'); };
    list.appendChild(b);
  }
  const q = $('map-quest');
  q.innerHTML = story.logHtml();
}
function drawBigMap() {
  const c = $('bigmap-canvas'), ctx = c.getContext('2d');
  const W = c.width, s = W / SX;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(mapBase, 0, 0, W, W);
  const dot = (x, z, r, col, ring) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x * s, z * s, r, 0, Math.PI * 2); ctx.fill(); if (ring) { ctx.strokeStyle = '#000a'; ctx.stroke(); } };
  ctx.font = '11px Oswald, sans-serif';
  for (const t of info.towns) { ctx.fillStyle = '#fff'; ctx.fillText(t.name, t.ox * s + 6, t.oz * s); }
  for (const d of depots) dot(d.x, d.z, 3, save.depots.includes(d.name) ? '#5fe39a' : '#5fe39a55');
  for (const t of info.towers) dot(t.x, t.z, 4, t.lit ? '#ff8a2a' : '#7a5a3a', true);
  for (const c2 of info.caches) if (!c2.taken && save.flags.mapCaches) dot(c2.x, c2.z, 3, '#c9a54a');
  for (const b of smash.breaches) if (b.open) dot(b.x, b.z, 6, '#ff2a2a', true);
  for (const t of game.titans) if (t.alive && !t.dummy && t.pos.distanceTo(player.pos) < 400) dot(t.pos.x, t.pos.z, t.boss ? 6 : 3, '#e0453a');
  const ob = story.beaconPos();
  if (ob) dot(ob.x, ob.z, 7, '#ffd34a', true);
  // player arrow
  ctx.save(); ctx.translate(player.pos.x * s, player.pos.z * s); ctx.rotate(-player.yaw);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(-6, 6); ctx.lineTo(6, 6); ctx.closePath(); ctx.fill(); ctx.restore();
}

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
  if (button === 0) { if (hit.block !== B.WALL && hit.block !== B.GATE) world.edit(hit.x, hit.y, hit.z, B.AIR); }
  else {
    const x = hit.x + hit.normal[0], y = hit.y + hit.normal[1], z = hit.z + hit.normal[2];
    const p = player.pos, hw = P.halfW;
    const overlaps = x + 1 > p.x - hw && x < p.x + hw && z + 1 > p.z - hw && z < p.z + hw && y + 1 > p.y && y < p.y + P.height;
    if (!overlaps && world.get(x, y, z) === B.AIR) world.edit(x, y, z, game.buildBlock);
  }
  sfx.swap();
}

// ---------------- HUD ----------------
let popupTimer = 0;
function popup(title, sub = '') {
  const el = $('popup');
  el.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
  el.classList.add('show');
  popupTimer = 2.4;
}
game.popup = popup;
const radioLines = [];
game.radio = (name, text, kind = 'ally') => {
  const el = document.createElement('div');
  el.className = 'radio-line ' + kind;
  el.innerHTML = `<b>${name}</b> ${text}`;
  $('radio').appendChild(el);
  radioLines.push({ el, t: 8 });
  while (radioLines.length > 6) { const r = radioLines.shift(); r.el.remove(); }
};
function updateRadio(dt) {
  for (const r of radioLines) { r.t -= dt; if (r.t < 1) r.el.style.opacity = Math.max(0, r.t); }
  while (radioLines.length && radioLines[0].t <= 0) radioLines.shift().el.remove();
}
game.setMode = (title, sub) => { $('mode-title').textContent = title; $('mode-sub').textContent = sub; };
game.setObjective = (html) => { html = html || ''; if (domCache.get('objective') !== html) { domCache.set('objective', html); $('objective').innerHTML = html; } };
game.setCounters = (html) => { html = html || ''; if (domCache.get('counters') !== html) { domCache.set('counters', html); $('counters').innerHTML = html; $('counters').classList.toggle('hidden', !html); } };
game.titleCard = (title, sub) => {
  $('title-card').innerHTML = `<h2>${title}</h2><p>${sub}</p>`;
  $('title-card').classList.remove('hidden', 'fade');
  void $('title-card').offsetWidth;
  $('title-card').classList.add('fade');
};

let mapBase = null, topY = null, topB = null;
function scanMap() {
  topY = new Uint8Array(SX * SZ); topB = new Uint8Array(SX * SZ);
  for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
    const [b, y] = world.topBlock(x, z);
    topY[z * SX + x] = y; topB[z * SX + x] = b;
  }
  const c = document.createElement('canvas'); c.width = SX; c.height = SZ;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(SX, SZ);
  for (let i = 0; i < SX * SZ; i++) {
    const b = topB[i];
    const col = atlas.mapColor[b] || [80, 140, 60];
    const shade = 0.72 + Math.min(0.5, (topY[i] - 20) / 110);
    img.data[i * 4] = col[0] * shade; img.data[i * 4 + 1] = col[1] * shade; img.data[i * 4 + 2] = col[2] * shade; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  mapBase = c;
}
// A coarse mesh of the whole map drawn beyond the streamed chunks, so the walls and
// forests stay on the horizon.
function buildFarMesh() {
  const S = 8, N = SX / S + 1;
  const pos = new Float32Array(N * N * 3), col = new Float32Array(N * N * 3);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    // forests and towns blur into a soft canopy (the walls are drawn separately)
    let sum = 0, n = 0, r = 0, gg = 0, bb = 0;
    for (let dz = -4; dz <= 4; dz += 2) for (let dx = -4; dx <= 4; dx += 2) {
      const x = Math.max(0, Math.min(SX - 1, i * S + dx)), z = Math.max(0, Math.min(SZ - 1, j * S + dz));
      const y = topY[z * SX + x], b = topB[z * SX + x];
      const ground = world.hmap[z * SX + x];
      sum += b === B.WALL || b === B.GATE ? ground : Math.min(y, ground + 30); n++;
      const c = atlas.mapColor[b] || [80, 140, 60];
      r += c[0]; gg += c[1]; bb += c[2];
    }
    const k = (j * N + i) * 3;
    pos[k] = i * S; pos[k + 1] = sum / n - 0.6; pos[k + 2] = j * S;
    // muted toward grey and a hazy green so distant towns read as haze, not confetti
    const l = (r + gg + bb) / (3 * n);
    const mute = (c, haze) => Math.pow((c / n * 0.45 + l * 0.35 + haze * 0.2) / 255, 2.2);
    col[k] = mute(r, 96); col[k + 1] = mute(gg, 120); col[k + 2] = mute(bb, 84);
  }
  const idx = [];
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
    const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.userData.uNear = { value: 300 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNear = mat.userData.uNear;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFarW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvFarW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vFarW;\nuniform float uNear;')
      .replace('void main() {', 'void main() {\nif (distance(vFarW.xz, cameraPosition.xz) < uNear) discard;');
  };
  farMesh = new THREE.Mesh(geo, mat);
  farMesh.frustumCulled = false;
  scene.add(farMesh);
  // the great walls on the horizon: vertical bands where the voxel walls stand
  const wmat = new THREE.MeshLambertMaterial({ color: 0xb4ac98, side: THREE.DoubleSide });
  wmat.onBeforeCompile = mat.onBeforeCompile;
  wmat.userData.uNear = mat.userData.uNear;
  for (const w of WALLS) {
    const top = G + w.H + 1, bottom = G - 2;
    // keep only the arc outside the parent ring for district walls
    const SEG = Math.max(48, Math.round(w.R / 4));
    const parent = w.parent != null ? WALLS[w.parent] : null;
    const keep = (a) => !parent || Math.hypot(w.cx + Math.cos(a) * w.R - parent.cx, w.cz + Math.sin(a) * w.R - parent.cz) > parent.R;
    const pos = [], idx = [];
    for (const r of [w.R + 3.4, w.R - 3.4]) {
      for (let k = 0; k < SEG; k++) {
        const a0 = (k / SEG) * Math.PI * 2, a1 = ((k + 1) / SEG) * Math.PI * 2;
        if (!keep((a0 + a1) / 2)) continue;
        const b = pos.length / 3;
        for (const [a, y] of [[a0, bottom], [a1, bottom], [a0, top], [a1, top]]) pos.push(w.cx + Math.cos(a) * r, y, w.cz + Math.sin(a) * r);
        idx.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
      }
    }
    for (let k = 0; k < SEG; k++) {
      const a0 = (k / SEG) * Math.PI * 2, a1 = ((k + 1) / SEG) * Math.PI * 2;
      if (!keep((a0 + a1) / 2)) continue;
      const b = pos.length / 3;
      for (const [a, r] of [[a0, w.R - 3.4], [a1, w.R - 3.4], [a0, w.R + 3.4], [a1, w.R + 3.4]]) pos.push(w.cx + Math.cos(a) * r, top, w.cz + Math.sin(a) * r);
      idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g2.setIndex(idx);
    g2.computeVertexNormals();
    const m = new THREE.Mesh(g2, wmat);
    m.frustumCulled = false;
    scene.add(m);
  }
}
function drawMinimap() {
  const c = $('minimap'), ctx = c.getContext('2d');
  const W = c.width, scale = 0.9;
  ctx.save();
  ctx.fillStyle = '#4c6b3a'; ctx.fillRect(0, 0, W, W);
  ctx.translate(W / 2, W / 2);
  ctx.rotate(player.yaw);
  ctx.scale(scale, scale);
  ctx.translate(-player.pos.x, -player.pos.z);
  ctx.imageSmoothingEnabled = false;
  const half = Math.ceil(W / scale * 0.75);
  const sx = Math.max(0, Math.floor(player.pos.x - half)), sz = Math.max(0, Math.floor(player.pos.z - half));
  const sw = Math.min(SX - sx, half * 2), sh = Math.min(SZ - sz, half * 2);
  if (sw > 0 && sh > 0) ctx.drawImage(mapBase, sx, sz, sw, sh, sx, sz, sw, sh);
  const dot = (x, z, r, color) => { if (Math.abs(x - player.pos.x) > half || Math.abs(z - player.pos.z) > half) return; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, z, r / scale, 0, Math.PI * 2); ctx.fill(); };
  for (const d of depots) dot(d.x, d.z, 4, '#5fe39a');
  for (const p of pickups) if (p.active) dot(p.x, p.z, 2.5, '#7ff0ff');
  for (const t of info.towers) dot(t.x, t.z, 4, t.lit ? '#ff8a2a' : '#8a6a4a');
  for (const b of smash.breaches) if (b.open) dot(b.x, b.z, 6, '#ff2a2a');
  for (const s of game.scouts) if (s.alive) dot(s.pos.x, s.pos.z, 2.5, '#9ad0ff');
  for (const cv of game.civilians) if (cv.alive) dot(cv.pos.x, cv.pos.z, 1.8, '#f0e0b0');
  const ob = story.beaconPos();
  if (ob) dot(ob.x, ob.z, 5, '#ffd34a');
  for (const k of game.titans) if (k.alive && !k.dummy) dot(k.pos.x, k.pos.z, 3 + k.H / 6, k.boss ? '#ff2a8a' : '#e0453a');
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(W / 2, W / 2 - 8); ctx.lineTo(W / 2 - 6, W / 2 + 6); ctx.lineTo(W / 2 + 6, W / 2 + 6); ctx.closePath(); ctx.fill();
}

function toScreen(p, out) {
  const v = _v4.copy(p).project(camera);
  out.x = (v.x * 0.5 + 0.5) * window.innerWidth;
  out.y = (-v.y * 0.5 + 0.5) * window.innerHeight;
  out.on = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
  return out;
}
const scr = {};
let zoneName = '';
// Only touch the DOM when a value actually changes; repaints are what cost frames.
const domCache = new Map();
function setText(id, v) { if (domCache.get(id) !== v) { domCache.set(id, v); $(id).textContent = v; } }
function setStyle(id, prop, v) { const k = id + '.' + prop; if (domCache.get(k) !== v) { domCache.set(k, v); $(id).style[prop] = v; } }
function updateHud(dt) {
  const hp = player.health / STATS.healthMax * 100, gp = player.gas / STATS.gasMax * 100;
  setStyle('health-bar', 'width', hp.toFixed(1) + '%');
  setStyle('gas-bar', 'width', gp.toFixed(1) + '%');
  setText('gas-pct', Math.round(gp) + '%');
  $('gas-bar').classList.toggle('low', gp < 20);
  const s = Math.round(player.sharp) + '%';
  setStyle('blade-li', 'height', s); setStyle('blade-ri', 'height', s);
  setText('spares', '×' + player.spares);
  setText('speed', Math.round(player.speed() * 3.6) + ' km/h');
  setText('kill-count', String(game.session.kills));
  setText('marks', String(save.marks));
  if (popupTimer > 0) { popupTimer -= dt; if (popupTimer <= 0) $('popup').classList.remove('show'); }
  if (game.sayT > 0) { game.sayT -= dt; if (game.sayT <= 0) $('dialog').classList.add('hidden'); }
  const low = player.health < STATS.healthMax * 0.35 ? 0.4 : 0;
  const vig = Math.max(low, player.hurtT * 1.8, player.grabbed ? 0.6 : 0);
  setStyle('vignette', 'display', vig > 0.01 ? 'block' : 'none');
  setStyle('vignette', 'opacity', vig.toFixed(2));
  // crosshair state
  const ch = $('crosshair');
  ch.classList.remove('far', 'locked', 'core', 'assist');
  const range = P.hookRange + STATS.rangeBonus;
  if (lastAim && lastAim.dist <= range) {
    ch.classList.add(lastAim.core ? 'core' : 'locked');
    if (lastAim.assisted) ch.classList.add('assist');
    setText('aim-dist', Math.round(lastAim.dist) + ' m');
  } else { ch.classList.add('far'); setText('aim-dist', ''); }
  // prompts
  const pr = $('prompt');
  let text = '';
  const p = player.pos;
  const tk = game.talkers.find((t) => t.pos.distanceTo(p) < 4.5);
  const d = nearestDepot();
  if (tk) text = `E — talk to ${tk.name}`;
  else if (game.civilians.some((c) => c.state === 'trapped' && c.pos.distanceTo(p) < 3.5)) text = 'E — free the trapped civilian';
  else if (info.caches.some((c) => !c.taken && Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z) < 3.5)) text = 'E — open supply cache';
  else if (info.insignias.some((c) => !c.taken && Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z) < 3.5)) text = 'E — take the lost insignia';
  else if (info.towers.some((t) => !t.lit && Math.hypot(t.x - p.x, t.y - p.y, t.z - p.z) < 6)) text = 'E — light the signal fire';
  else if (d && d.dist < 5) text = `E — resupply at ${d.d.name}${d.d.zone !== 'outside' ? ' · U — upgrades' : ''}`;
  pr.classList.toggle('hidden', !text);
  setText('prompt', text);
  // lock marker & nape strike prompt
  const lk = $('lock');
  if (game.lock && game.lock.alive) {
    toScreen(game.lock.napeWorld(_v1), scr);
    lk.classList.toggle('hidden', !scr.on);
    setStyle('lock', 'left', Math.round(scr.x) + 'px'); setStyle('lock', 'top', Math.round(scr.y) + 'px');
  } else { lk.classList.add('hidden'); game.lock = null; }
  const sc = player.alive && !player.grabbed && !player.strike ? strikeCandidate() : null;
  const sp = $('strike');
  if (sc) {
    const front = sc.target === player && sc.behindness(player.pos) < -0.25;
    sp.classList.remove('hidden');
    sp.classList.toggle('risky', front);
    const html = `<b>X</b> NAPE STRIKE${front ? ' · it’s watching you' : sc.behindness(player.pos) > 0.3 ? ' · from behind' : ''}`;
    if (domCache.get('strike') !== html) { domCache.set('strike', html); sp.innerHTML = html; }
    lk.classList.toggle('ready', sc === game.lock);
  } else sp.classList.add('hidden');
  // struggle meter
  const st = $('struggle');
  if (player.grabbed) {
    st.classList.remove('hidden');
    const g = player.grabbed;
    setStyle('struggle-fill', 'width', (g.presses / g.need * 100).toFixed(0) + '%');
    setStyle('struggle-time', 'width', Math.max(0, 100 - g.titan.timer / g.titan.eatTime * 100).toFixed(0) + '%');
  } else st.classList.add('hidden');
  // boss bar
  const boss = game.titans.find((t) => t.alive && t.boss && t.pos.distanceTo(player.pos) < 300);
  const bb = $('boss');
  if (boss) {
    bb.classList.remove('hidden');
    setText('boss-name', boss.name + (boss.st.armor && !boss.legsOut() ? ' · armoured' : boss.st.armor ? ' · KNEELING — strike now!' : boss.steamT > 0 ? ' · venting steam' : ''));
    setStyle('boss-fill', 'width', Math.max(0, boss.hp / boss.maxHp * 100).toFixed(1) + '%');
  } else bb.classList.add('hidden');
  $('clickhint').classList.toggle('hidden', locked());
  // zone name
  const z = ZONE_NAMES[zoneOf(p.x, p.z)];
  if (z !== zoneName) { zoneName = z; $('zone').textContent = z; $('zone').classList.remove('fade'); void $('zone').offsetWidth; $('zone').classList.add('fade'); }
  // labels over named characters
  updateLabels();
}
const labelEls = new Map();
function updateLabels() {
  const live = new Set();
  for (const t of game.talkers) {
    const d = t.pos.distanceTo(player.pos);
    if (d > 40) continue;
    toScreen(_v1.copy(t.pos).setY(t.pos.y + 2.3), scr);
    if (!scr.on) continue;
    let el = labelEls.get(t);
    if (!el) { el = document.createElement('div'); el.className = 'label3d'; $('labels').appendChild(el); labelEls.set(t, el); }
    el.innerHTML = `${t.def.quest && t.def.quest(game) ? '<i>!</i>' : ''}${t.name}<small>${t.def.role || ''}</small>`;
    el.style.left = scr.x + 'px'; el.style.top = scr.y + 'px';
    el.style.opacity = d < 25 ? 1 : (40 - d) / 15;
    live.add(t);
  }
  for (const [t, el] of labelEls) if (!live.has(t)) { el.remove(); labelEls.delete(t); }
}

// ---------------- markers for collectibles & objectives ----------------
function addMarker(item, color, h = 24) {
  const group = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.4 }));
  box.position.y = 0.4;
  group.add(box, beam(color, 0.22, h, 0.28));
  group.position.set(item.x, item.y, item.z);
  scene.add(group);
  item.marker = group;
  markers.push(item);
}
function hideMarker(item) { if (item.marker) { scene.remove(item.marker); item.marker = null; } }
function setObjectiveBeam(p) {
  if (!objectiveBeam) { objectiveBeam = beam(0xffd34a, 0.8, 160, 0.38); scene.add(objectiveBeam); }
  objectiveBeam.visible = !!p;
  if (p) objectiveBeam.position.set(p.x, p.y ?? world.groundAt(p.x, p.z), p.z);
}

// ---------------- game flow ----------------
const story = createStory(game);
game.story = story;
function resetWorldPeople() {
  for (const t of game.titans) t.remove();
  game.titans = [];
  game.clearScouts();
  for (const c of game.civilians) c.dispose();
  game.civilians = [];
  for (const t of [...game.talkers]) game.removeTalker(t);
  for (const town of info.towns) { town.live = false; town.alarm = false; }
  game.lock = null;
}
game.resetWorldPeople = resetWorldPeople;
game.teleport = (sp) => { player.reset(sp); player.model.root.visible = !game.firstPerson; };
game.discoverAll = (kind) => { for (const d of depots) if (d.kind === kind && !save.depots.includes(d.name)) save.depots.push(d.name); };

function startGame(mode, opts = {}) {
  sfx.init();
  applyUpgrades();
  resetWorldPeople();
  game.mode = mode; game.session = { kills: 0, saved: 0, lost: 0 };
  $('menu').classList.add('hidden');
  $('hud').classList.remove('hidden');
  game.state = 'playing';
  if (mode === 'story') story.startStory(opts.chapter ?? save.chapter, false, !!opts.direct);
  else if (mode === 'siege') story.startSiege();
  else if (mode === 'training') story.startStory(0, true);
  lockPointer();
}
// The world remembers smashed walls and towns, so a fresh run reloads the page first.
function launch(mode, opts = {}) {
  if (game.played) {
    try { sessionStorage.setItem('tetherfall-launch', JSON.stringify({ mode, opts })); } catch (e) { /* ignore */ }
    location.reload();
    return;
  }
  game.played = true;
  startGame(mode, opts);
}
function pause() {
  if (game.state !== 'playing') return;
  game.state = 'paused';
  keys.clear();
  player.hooks.forEach((_, i) => player.releaseHook(i));
  $('pause').classList.remove('hidden');
  $('pause-log').innerHTML = story.logHtml();
  if (locked()) document.exitPointerLock();
}
function resume() {
  $('pause').classList.add('hidden');
  game.state = 'playing';
  lockPointer();
}
function toMenu() {
  game.state = 'menu';
  ['pause', 'dead', 'settings', 'complete'].forEach((id) => $(id).classList.add('hidden'));
  $('menu').classList.remove('hidden');
  $('hud').classList.add('hidden');
  refreshMenu();
  if (locked()) document.exitPointerLock();
}
const DEATH = {
  fall: 'You hit the ground too hard. Hold G to brake before landing.',
  wall: 'You slammed into a wall at speed. Release an anchor or brake earlier.',
  titan: 'A titan’s blow broke you. Stay out of reach unless you’re behind it.',
  eaten: 'You were eaten. When grabbed, hammer F to cut through the fingers — fast.',
  boulder: 'A boulder from the Beast crushed you. Keep moving and use cover.',
  steam: 'The Colossal’s steam boiled you. Wait for the venting to stop.',
  tree: 'A falling tree crushed you.',
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
  }, 1600);
}
function respawn() {
  $('dead').classList.add('hidden');
  const sp = story.respawnPoint();
  player.reset(sp);
  player.model.root.visible = !game.firstPerson;
  for (const t of game.titans) if (!t.boss && !t.dummy && t.pos.distanceTo(player.pos) < 60) t.remove();
  game.titans = game.titans.filter((t) => !t.removed);
  game.state = 'playing';
  story.onRespawn();
  lockPointer();
}
game.complete = (title, text, next) => {
  game.state = 'paused';
  keys.clear();
  if (locked()) document.exitPointerLock();
  $('complete-title').textContent = title;
  $('complete-text').innerHTML = text;
  $('complete').classList.remove('hidden');
  $('btn-next').onclick = () => { $('complete').classList.add('hidden'); game.state = 'playing'; lockPointer(); if (next) next(); };
};
function refreshMenu() {
  const ch = save.chapter;
  $('btn-continue').innerHTML = ch > 0 ? `Continue story <small>${story.chapterName(ch)} · ${save.marks} marks</small>` : 'Begin the story <small>chapter 1 · First Flight</small>';
  $('btn-new').classList.toggle('hidden', ch === 0);
  $('menu-stats').textContent = save.stats.kills ? `Titans felled ${save.stats.kills} · civilians saved ${save.stats.saved} · best siege wave ${save.best || 0}` : '';
}

$('btn-continue').onclick = () => launch('story');
$('btn-new').onclick = () => {
  if (!confirm('Start the story over? Upgrades and marks are kept.')) return;
  save.chapter = 0; save.flags = {}; writeSave(); launch('story', { chapter: 0 });
};
$('btn-siege').onclick = () => launch('siege');
$('btn-training').onclick = () => launch('training');
$('btn-resume').onclick = resume;
$('btn-quit').onclick = toMenu;
$('btn-quit2').onclick = toMenu;
$('btn-respawn').onclick = respawn;
$('btn-shop-close').onclick = closeOverlay;
$('btn-map-close').onclick = closeOverlay;
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
bindSlider('view', 'view', (v) => v + ' m');
$('s-inv').checked = settings.inv;
$('s-inv').onchange = () => { settings.inv = $('s-inv').checked; };
$('s-assist').checked = settings.assist;
$('s-assist').onchange = () => { settings.assist = $('s-assist').checked; if (player) player.assist = settings.assist; };

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
    const want = player.grabbed ? 9 : 5.5;
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
    if (Math.abs(p.x - player.pos.x) > 60 || Math.abs(p.z - player.pos.z) > 60) continue;
    p.group.children[0].rotation.y += dt * 1.5;
    if (player.alive && Math.hypot(p.x - player.pos.x, p.y - (player.pos.y + 0.9), p.z - player.pos.z) < 2.8) {
      if (player.gas >= STATS.gasMax - 0.5) continue;
      player.gas = Math.min(STATS.gasMax, player.gas + 55);
      p.active = false; p.group.visible = false; p.timer = 60;
      sfx.pickup();
      popup('Gas canister', '+55 gas');
    }
  }
  // discover depots by passing close
  for (const d of depots) {
    if (save.depots.includes(d.name)) continue;
    if (Math.hypot(d.x - player.pos.x, d.z - player.pos.z) < 40) { save.depots.push(d.name); writeSave(); game.radio('Map', `Depot discovered: ${d.name}`, 'info'); }
  }
}
function pushOutOfTitans() {
  for (const c of game.titans) {
    if (!c.alive || c.dummy) continue;
    const dx = player.pos.x - c.pos.x, dz = player.pos.z - c.pos.z;
    const d = Math.hypot(dx, dz), r = c.radius();
    if (d < r && d > 0.01 && player.pos.y < c.pos.y + c.air + c.H * 0.75 && player.pos.y > c.pos.y + c.air - 1) {
      player.pos.x = c.pos.x + (dx / d) * r; player.pos.z = c.pos.z + (dz / d) * r;
    }
  }
}

const STEP = 1 / 120;
let acc = 0;
let last = performance.now();
let frame = 0;
let fpsT = 0, fpsN = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (game.state === 'loading') return;
  frame++;
  fpsT += dt; fpsN++;
  if (fpsT > 1) { game.fps = fpsN / fpsT; fpsT = 0; fpsN = 0; }
  clouds.position.x += dt * 1.2;
  if (clouds.position.x > 200) clouds.position.x -= 480;
  const view = settings.view;
  scene.fog.near = view * 0.45; scene.fog.far = view * 2.6;
  if (farMesh) farMesh.material.userData.uNear.value = view - 28;

  const live = game.state === 'playing' || game.state === 'dead';
  if (live) {
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
    game.strikeCD = Math.max(0, game.strikeCD - dt);
    pushOutOfTitans();
    player.updateHooks(dt);
    for (const e of player.events) {
      if (e.type === 'hookFire') sfx.hookFire();
      if (e.type === 'hookHit') sfx.hookHit();
      if (e.type === 'hurt') sfx.hurt();
      if (e.type === 'impact') game.shake = Math.max(game.shake, 0.4);
      if (e.type === 'land') { dust.emit(_v1.set(player.pos.x, player.pos.y + 0.1, player.pos.z), Math.min(30, e.speed * 1.5), 0.8, 3, 0.8); if (e.speed > 12) game.shake = Math.max(game.shake, 0.15); }
      if (e.type === 'death') onDeath(e.cause);
      if (e.type === 'strikeArrive') resolveStrike(e.titan, e.speed);
      if (e.type === 'strikeAbort') player.hooks.forEach((_, i) => player.releaseHook(i));
    }
    player.events.length = 0;

    humanCache = humans();
    for (const c of game.titans) c.update(dt, game);
    for (const c of game.titans) if (c.removed) player.detachFrom(c);
    game.titans = game.titans.filter((c) => !c.removed);
    if (player.grabbed && !player.grabbed.titan.alive) game.releaseVictim(player.grabbed.titan, player);
    const cam = camera.position;
    for (const s of game.scouts) s.update(dt, s.pos.distanceTo(cam) < 220);
    game.scouts = game.scouts.filter((s) => s.alive);
    for (const c of game.civilians) c.update(dt, c.pos.distanceTo(cam) < 170);
    for (const t of game.talkers) t.update(dt, t.pos.distanceTo(cam) < 120);
    if (frame % 30 === 0) updateTownsfolk();
    smash.update(dt);
    if (game.state === 'playing') story.update(dt);
    setObjectiveBeam(story.beaconPos());

    updatePickups(dt);
    if (slashArc && slashArc.userData.t > 0) {
      slashArc.userData.t -= dt;
      slashArc.visible = slashArc.userData.t > 0;
      slashArc.material.opacity = Math.max(0, slashArc.userData.t / 0.22) * 0.75;
      slashArc.position.set(player.pos.x, player.pos.y + 1.1, player.pos.z);
      slashArc.rotation.set(-Math.PI / 2 + 0.3, 0, -player.model.root.rotation.y + (player.spin ? frame * 0.6 : 0));
    }
    player.animate(dt, game.firstPerson, scene);
    if (!player.alive && !player.grabbed && game.state === 'dead') player.model.root.visible = player.model.root.visible && !game.firstPerson;
    updateCamera(dt);
    lastAim = player.alive && !game.build && !player.grabbed ? aim() : null;
    updateRopes();
    updateHud(dt);
    updateRadio(dt);
    if (frame % 3 === 0) drawMinimap();
    sfx.update(player.speed(), player.boosting || !!player.strike);
    if (player.strike || player.boosting) player.boosting = false;
  } else if (game.state === 'menu') {
    const t = now / 1000;
    camera.position.set(info.CX + Math.cos(t * 0.03) * 260, 120, info.CZ + 480 + Math.sin(t * 0.03) * 260);
    camera.lookAt(info.CX, 40, info.CZ + 560);
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
  if (chunks) chunks.update(camera.position, view, game.state === 'menu' ? 8 : 6);
  steam.update(dt, -0.6);
  streaks.update(dt, 0);
  sparks.update(dt, 18);
  dust.update(dt, -0.3);
  blood.update(dt, 14);
  renderer.render(scene, camera);
}

// ---------------- loading ----------------
async function boot() {
  const bar = $('load-bar'), txt = $('load-text');
  const tick = () => new Promise((r) => setTimeout(r, 0));
  txt.textContent = 'Raising the walls…'; await tick();
  const gen = generate(world);
  let r = gen.next();
  let t0 = performance.now();
  while (!r.done) {
    bar.style.width = (r.value * 70).toFixed(0) + '%';
    if (performance.now() - t0 > 40) { await tick(); t0 = performance.now(); }
    r = gen.next();
  }
  info = r.value;
  txt.textContent = 'Charting the land…'; await tick();
  scanMap();
  buildFarMesh();
  bar.style.width = '78%';
  smash = new Smash(game, scene, atlas.mapColor);
  chunks = new ChunkRenderer(world, scene, worldMat);
  game.chunks = chunks;
  player = new Player(world, scene);
  player.assist = settings.assist;
  applyUpgrades();
  player.reset(info.spawns.camp);
  player.model.root.visible = false;
  // restore progress on collectibles
  for (const c of info.caches) if (save.caches.includes(c.id)) c.taken = true;
  for (const c of info.insignias) if (save.insignias.includes(c.id)) c.taken = true;
  for (const c of info.caches) if (!c.taken) addMarker(c, 0xc9a54a, 20);
  for (const c of info.insignias) if (!c.taken) addMarker(c, 0xb0e0ff, 14);
  for (const i of save.towers) if (info.towers[i]) lightTower(i, false);
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
  // stream the land around the menu fly-over and the likely start
  txt.textContent = 'Laying the stones…';
  const around = [{ x: info.CX, z: info.CZ + 560 }];
  for (const c of around) {
    const g2 = chunks.buildAround(c, 200);
    t0 = performance.now();
    for (const p of g2) {
      if (performance.now() - t0 > 40) { bar.style.width = (78 + p * 22).toFixed(0) + '%'; await tick(); t0 = performance.now(); }
    }
  }
  $('loading').classList.add('hidden');
  game.state = 'menu';
  refreshMenu();
  let auto = null;
  try { auto = JSON.parse(sessionStorage.getItem('tetherfall-launch') || 'null'); sessionStorage.removeItem('tetherfall-launch'); } catch (e) { /* ignore */ }
  if (auto) { game.played = true; $('menu').classList.add('hidden'); startGame(auto.mode, auto.opts || {}); }
}

window.__tf = { renderer, scene, game, world, get player() { return player; }, get info() { return info; }, get titans() { return game.titans; }, input, keys, startGame, spawnTitan, slash, napeStrike, aim: () => aim(), camera, story, save, settings, STATS, get chunks() { return chunks; }, get smash() { return smash; } };
requestAnimationFrame(loop);
boot().catch((e) => { console.error(e); $('load-text').textContent = 'Failed to load: ' + e.message; });
