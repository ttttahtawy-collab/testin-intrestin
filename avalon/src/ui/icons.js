// Renders voxel item icons, NPC portraits and the inventory paper-doll using
// a small offscreen WebGL renderer.
import * as THREE from 'three';
import { itemShape, SHAPES } from '../game/itemshapes.js';
import { charMat } from '../entities/voxmodel.js';
import { buildHumanoid, setHeld } from '../entities/models.js';

let R = null, scene, cam, holder;
const cache = new Map();

function init() {
  if (R) return;
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  R = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  R.setSize(128, 128, false);
  R.outputColorSpace = THREE.SRGBColorSpace;
  R.toneMapping = THREE.ACESFilmicToneMapping;
  R.toneMappingExposure = 1.15;
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const key = new THREE.DirectionalLight(0xfff2dc, 2.4); key.position.set(3, 5, 4);
  const rim = new THREE.DirectionalLight(0xa0b8ff, 0.9); rim.position.set(-4, 2, -3);
  scene.add(key, rim, new THREE.HemisphereLight(0xfff4e0, 0x403020, 1.3));
  holder = new THREE.Group();
  scene.add(holder);
}

function fit(obj, pad = 1.25, yaw = 0.6, pitch = 0.35) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  obj.position.sub(c);
  const r = Math.max(size.x, size.y, size.z) * pad;
  const d = r / (2 * Math.tan((cam.fov * Math.PI) / 360));
  cam.position.set(Math.sin(yaw) * Math.cos(pitch) * d, Math.sin(pitch) * d, Math.cos(yaw) * Math.cos(pitch) * d);
  cam.lookAt(0, 0, 0);
}

export function iconURL(id) {
  if (cache.has(id)) return cache.get(id);
  init();
  const s = itemShape(id) || (SHAPES[id] && itemShape(id));
  if (!s) return '';
  holder.clear();
  const m = new THREE.Mesh(s.geom(0.1), charMat);
  const g = new THREE.Group(); g.add(m);
  if (s.kind === 'blade' || s.kind === 'blunt' || s.kind === 'axe' || s.kind === 'tool') g.rotation.z = -0.78;
  if (s.kind === 'bow') g.rotation.z = -0.5;
  holder.add(g);
  holder.updateMatrixWorld(true);
  g.position.set(0, 0, 0);
  const wrap = new THREE.Group(); holder.remove(g); wrap.add(g); holder.add(wrap);
  fit(wrap, 1.15, s.kind === 'armor' || s.kind === 'helm' ? 0.35 : 0.5, 0.3);
  R.setClearColor(0x000000, 0);
  R.render(scene, cam);
  const url = R.domElement.toDataURL();
  cache.set(id, url);
  return url;
}

// Portrait of an actor's head
export function portraitURL(actor) {
  const key = 'portrait:' + (actor.npcId || actor.type) + ':' + (actor.rig.app ? JSON.stringify(actor.rig.app).length : '');
  if (cache.has(key)) return cache.get(key);
  init();
  holder.clear();
  if (actor.rig.kind !== 'human') return '';
  const rig = buildHumanoid({ ...actor.rig.app, scale: 1 });
  holder.add(rig.root);
  rig.root.updateMatrixWorld(true);
  const head = rig.parts.head;
  const hp = new THREE.Vector3(); head.getWorldPosition(hp);
  cam.position.set(hp.x + 0.25, hp.y + 0.5, hp.z - 2.2);
  cam.lookAt(hp.x, hp.y + 0.42, hp.z);
  R.setClearColor(0x000000, 0);
  R.render(scene, cam);
  const url = R.domElement.toDataURL();
  cache.set(key, url);
  return url;
}

// Paper-doll renderer for the inventory (separate canvas, live rotation)
export class PaperDoll {
  constructor(canvas) {
    this.canvas = canvas;
    this.r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.r.outputColorSpace = THREE.SRGBColorSpace;
    this.r.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    const key = new THREE.DirectionalLight(0xfff0d8, 2.2); key.position.set(2, 4, 4);
    const rim = new THREE.DirectionalLight(0xffc890, 1.0); rim.position.set(-3, 3, -4);
    this.scene.add(key, rim, new THREE.HemisphereLight(0xfff4e0, 0x403020, 1.2));
    this.yaw = 0.4; this.sig = '';
    this.holder = new THREE.Group(); this.scene.add(this.holder);
    let drag = false, lx = 0;
    canvas.addEventListener('pointerdown', (e) => { drag = true; lx = e.clientX; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => { if (drag) { this.yaw += (e.clientX - lx) * 0.01; lx = e.clientX; } });
    canvas.addEventListener('pointerup', () => { drag = false; });
  }
  setPlayer(app, equip, ITEMS) {
    const sig = JSON.stringify([app, equip]);
    if (sig === this.sig) return;
    this.sig = sig;
    this.holder.clear();
    const full = { ...app };
    for (const k of ['body', 'head']) { const it = equip[k] && ITEMS[equip[k]]; if (it && it.app) Object.assign(full, it.app); }
    this.rig = buildHumanoid(full);
    if (equip.main) setHeld(this.rig, equip.main, 'R');
    if (equip.off) setHeld(this.rig, equip.off, 'L');
    this.rig.parts.armR.rotation.x = -0.3;
    this.holder.add(this.rig.root);
  }
  render(t) {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    if (this.canvas.width !== w * 2 || this.canvas.height !== h * 2) { this.r.setPixelRatio(2); this.r.setSize(w, h, false); }
    this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
    this.cam.position.set(0, 2.1, 8.6); this.cam.lookAt(0, 1.75, 0);
    if (this.rig) {
      this.rig.root.rotation.y = this.yaw + Math.PI;
      this.rig.parts.head.rotation.y = Math.sin(t * 0.7) * 0.15;
      this.rig.parts.armL.rotation.x = Math.sin(t * 1.5) * 0.04;
      this.rig.body.position.y = Math.sin(t * 2) * 0.02;
    }
    this.r.setClearColor(0x000000, 0);
    this.r.render(this.scene, this.cam);
  }
}
