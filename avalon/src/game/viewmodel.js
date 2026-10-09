// First-person arms, weapons, shield, lantern and bow with procedural animation.
import * as THREE from 'three';
import { pixelBox, charMat } from '../entities/voxmodel.js';
import { itemShape } from './itemshapes.js';
import { ITEMS } from './items.js';

const VPX = 0.02; // arm pixel size (meters in view space)
const IPX = 0.021; // item pixel size

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
function mixPose(a, b, t) { return { p: [lerp(a.p[0], b.p[0], t), lerp(a.p[1], b.p[1], t), lerp(a.p[2], b.p[2], t)], r: [lerp(a.r[0], b.r[0], t), lerp(a.r[1], b.r[1], t), lerp(a.r[2], b.r[2], t)] }; }
const pose = (p, r) => ({ p, r });

const R_REST = pose([0.32, -0.36, -0.56], [0.25, 0.12, 0.12]);
const R_SHEATH = pose([0.36, -0.85, -0.45], [-0.4, 0, 0]);
const SWINGS = [
  [pose([0.42, -0.15, -0.45], [0.5, 0.5, -0.8]), pose([-0.22, -0.3, -0.6], [-0.15, -0.5, 1.1])],
  [pose([-0.18, -0.12, -0.5], [0.4, -0.5, 0.9]), pose([0.42, -0.32, -0.6], [-0.15, 0.45, -1.1])],
  [pose([0.12, 0.02, -0.38], [1.2, 0, 0.05]), pose([0.04, -0.36, -0.7], [-0.6, 0, 0])],
];
const R_CHARGE = pose([0.5, -0.02, -0.22], [1.05, 0.55, -0.65]);
const R_BLOCK = pose([0.08, -0.22, -0.5], [0.15, 0.05, 1.45]);
const R_DRINK = pose([0.08, -0.2, -0.28], [0.95, 0, 0.2]);
const L_REST_EMPTY = pose([-0.36, -0.8, -0.45], [-0.3, 0, 0]);
const L_SHIELD = pose([-0.36, -0.42, -0.5], [0.1, 0.35, 0]);
const L_SHIELD_UP = pose([-0.1, -0.22, -0.42], [0.05, 0.0, 0]);
const L_LANTERN = pose([-0.34, -0.38, -0.52], [0.15, -0.1, 0]);
const L_BOW = pose([-0.06, -0.14, -0.55], [0.05, 0.08, 0]);

function armGeom(app, left) {
  const sleeve = app.sleeve, skin = app.skin;
  return pixelBox(4, 4, 12, (f, u, v) => {
    if (f === 'front') return skin; // hand faces forward (-z)
    if (f === 'back') return sleeve;
    // u runs front->back on side faces, v front->back on top
    const along = (f === 'top' || f === 'bottom') ? v : u;
    if (along <= 2) return f === 'bottom' ? 0x9a6a4c : skin;
    if (along === 3) return app.cuff;
    return (along * 3 + (f.length)) % 7 === 0 ? app.sleeveDark : sleeve;
  }, VPX, [-2, -2, -12], left ? 3 : 4);
}

export class ViewModel {
  constructor(game) {
    this.game = game;
    this.scene = game.renderer.viewScene;
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.right = new THREE.Group(); this.left = new THREE.Group();
    this.root.add(this.right, this.left);
    this.rHand = new THREE.Group(); this.rHand.position.set(0, 0, -11 * VPX); this.right.add(this.rHand);
    this.lHand = new THREE.Group(); this.lHand.position.set(0, 0, -11 * VPX); this.left.add(this.lHand);
    this.rPose = { ...R_REST }; this.lPose = { ...L_REST_EMPTY };
    this.sig = '';
    this.arrow = null;
    this.t = 0;
  }

  rebuild() {
    const P = this.game.player;
    const body = ITEMS[P.equip.body];
    const top = body && body.app ? body.app : { top: 0x7a6a4a };
    const sleeveCol = top.topStyle === 'mail' ? 0x6e7278 : top.topStyle === 'plate' ? 0x8e9298 : top.topStyle === 'vest' ? (top.shirt || 0xc8b898) : (top.top || 0x7a6a4a);
    const app = { sleeve: sleeveCol, sleeveDark: (sleeveCol & 0xfefefe) >> 1, cuff: 0x3a2a1a, skin: 0xc8946c };
    const sig = [P.equip.main, P.equip.off, P.equip.back, P.equip.body, P.mode].join('|');
    if (sig === this.sig) return;
    this.sig = sig;
    for (const g of [this.right, this.left]) { for (const c of [...g.children]) if (c.isMesh) g.remove(c); }
    for (const h of [this.rHand, this.lHand]) for (const c of [...h.children]) h.remove(c);
    const rm = new THREE.Mesh(armGeom(app, false), charMat); this.right.add(rm);
    const lm = new THREE.Mesh(armGeom(app, true), charMat); this.left.add(lm);
    this.arrow = null; this.bowMesh = null;
    const add = (hand, id, setup) => {
      const s = itemShape(id); if (!s) return null;
      const m = new THREE.Mesh(s.geom(IPX), charMat);
      const g = new THREE.Group(); g.add(m); setup && setup(g, m, s); hand.add(g); return g;
    };
    if (P.mode === 'bow' && P.bow) {
      this.bowMesh = add(this.lHand, P.equip.back, (g) => { g.rotation.set(0, 0, 0.12); });
      this.arrow = add(this.rHand, 'arrow1', (g) => { g.rotation.set(-Math.PI / 2, 0, 0); g.position.set(-0.03, 0.01, 0.02); });
    } else {
      if (P.equip.main) add(this.rHand, P.equip.main, (g) => { g.rotation.set(-0.2, 0, 0); });
      const off = P.equip.off && ITEMS[P.equip.off];
      if (off && off.type === 'shield') add(this.lHand, P.equip.off, (g) => { g.rotation.set(0, 0, 0); g.position.set(0.02, 0.05, 0.05); });
      if (off && off.type === 'light') this.lanternG = add(this.lHand, P.equip.off, (g) => { g.position.set(0, -0.11, 0); });
    }
  }

  update(dt) {
    const g = this.game, P = g.player;
    this.rebuild();
    this.t += dt;
    const bob = P.bob, ba = P.bobAmt;
    const swayX = Math.sin(bob) * 0.022 * ba + Math.sin(this.t * 1.1) * 0.004;
    const swayY = -Math.abs(Math.cos(bob)) * 0.028 * ba + Math.sin(this.t * 1.7) * 0.004;
    // right arm target pose
    let r = R_REST;
    const off = P.equip.off && ITEMS[P.equip.off];
    let l = off ? (off.type === 'shield' ? L_SHIELD : off.type === 'light' ? L_LANTERN : L_REST_EMPTY) : L_REST_EMPTY;
    let follow = 14;
    if (P.dead) { r = R_SHEATH; l = L_REST_EMPTY; }
    else if (P.mode === 'bow' && P.bow) {
      l = L_BOW;
      const d = P.draw;
      r = pose([lerp(0.02, 0.06, d), lerp(-0.16, -0.13, d), lerp(-0.55, -0.22, d)], [0.0, 0.0, 0.0]);
      follow = 20;
      if (this.arrow) this.arrow.visible = g.inventory.count('arrow') > 0;
    } else if (P.sheathed) r = R_SHEATH;
    else if (P.atk) {
      const a = P.atk;
      const sw = SWINGS[a.idx];
      if (a.phase === 'charge') { r = R_CHARGE; r = { p: [r.p[0] + (Math.random() - 0.5) * 0.006 * a.charge, r.p[1], r.p[2]], r: r.r }; follow = 10; }
      else if (a.phase === 'windup') { r = a.heavy ? R_CHARGE : sw[0]; follow = 22; }
      else if (a.phase === 'active') { r = a.heavy ? SWINGS[2][1] : sw[1]; follow = 40; }
      else { r = mixPose(a.heavy ? SWINGS[2][1] : sw[1], R_REST, ease(Math.min(1, a.t / 0.3))); follow = 12; }
    } else if (P.blocking) {
      if (off && off.type === 'shield') { l = L_SHIELD_UP; r = pose([0.36, -0.42, -0.5], [0.2, 0.1, 0.2]); }
      else r = R_BLOCK;
      follow = 24;
    }
    if (P.useAnim > 0) { r = R_DRINK; follow = 10; }
    if (P.throwAnim > 0) { const k = P.throwAnim / 0.45; r = k > 0.5 ? pose([0.42, 0.02, -0.12], [1.2, 0.2, 0]) : pose([0.15, -0.2, -0.85], [-0.6, 0, 0]); follow = 25; }
    if (P.bashAnim > 0) { l = pose([-0.05, -0.25, -0.75], [0.05, 0, 0]); follow = 30; }
    if (P.cryAnim > 0) { r = pose([0.3, -0.1 + Math.sin(this.t * 30) * 0.01, -0.45], [0.8, 0.2, 0]); }
    if (P.staggerT > 0) { r = pose([0.4, -0.5, -0.4], [-0.3, 0.3, -0.4]); }
    const k = Math.min(1, dt * follow);
    const kl = Math.min(1, dt * 14);
    this.rPose = mixPose(this.rPose, r, k);
    this.lPose = mixPose(this.lPose, l, kl);
    const shake = P.camShake * 0.02;
    this.right.position.set(this.rPose.p[0] + swayX + (Math.random() - 0.5) * shake, this.rPose.p[1] + swayY, this.rPose.p[2]);
    this.right.rotation.set(this.rPose.r[0], this.rPose.r[1], this.rPose.r[2]);
    this.left.position.set(this.lPose.p[0] + swayX * 0.8, this.lPose.p[1] + swayY, this.lPose.p[2]);
    this.left.rotation.set(this.lPose.r[0], this.lPose.r[1], this.lPose.r[2]);
    if (this.lanternG) this.lanternG.rotation.z = Math.sin(this.t * 2 + bob) * 0.12;
    // lantern glow on hands
    const lit = P.lantern && !P.lanternOff;
    const R = g.renderer;
    R.vPoint.intensity = lit ? 3.2 + Math.sin(this.t * 13) * 0.2 : 0;
    R.vPoint.position.set(this.lPose.p[0], this.lPose.p[1] - 0.05, this.lPose.p[2]);
    this.root.visible = !g.ui.hideViewModel;
  }
}
