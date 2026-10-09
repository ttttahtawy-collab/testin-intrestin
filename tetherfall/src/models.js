// Blocky character models built from boxes with tiny pixel-art canvas textures.
import * as THREE from 'three';
import { mulberry32 } from './noise.js';

function pixTex(w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  paint(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;
function noiseFill(ctx, w, h, base, amt, seed) {
  const r = mulberry32(seed);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = (r() - 0.5) * amt;
    ctx.fillStyle = rgb(base[0] + v, base[1] + v, base[2] + v);
    ctx.fillRect(x, y, 1, 1);
  }
}
const lam = (opts) => new THREE.MeshLambertMaterial(opts);

// A box whose top edge sits at the pivot, hanging downward (for limbs).
function limb(w, h, d, mats) {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(0, -h / 2, 0);
  return new THREE.Mesh(geo, mats);
}
function box(w, h, d, mats) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
}

// ---------------- player: an original scout design ----------------
// Jointed rig: hips (tilt pivot) -> legs (hip, knee), torso -> head, arms (shoulder, elbow).
export function makePlayerModel() {
  const skin = [226, 184, 148], hair = [58, 40, 30];
  const shirt = [196, 200, 208], vest = [36, 56, 90], brass = [204, 168, 78];
  const pants = [92, 80, 64], boot = [46, 34, 28], glove = [74, 54, 40], scarfC = '#b23a30';

  const faceTex = pixTex(8, 8, (ctx) => {
    noiseFill(ctx, 8, 8, skin, 8, 3);
    ctx.fillStyle = rgb(...hair); ctx.fillRect(0, 0, 8, 2); ctx.fillRect(0, 2, 1, 1); ctx.fillRect(6, 2, 2, 1);
    ctx.fillStyle = rgb(70, 48, 36); ctx.fillRect(1, 3, 2, 1); ctx.fillRect(5, 3, 2, 1); // brows
    ctx.fillStyle = '#fff'; ctx.fillRect(1, 4, 2, 1); ctx.fillRect(5, 4, 2, 1);
    ctx.fillStyle = '#3a6b4a'; ctx.fillRect(2, 4, 1, 1); ctx.fillRect(5, 4, 1, 1);
    ctx.fillStyle = rgb(206, 160, 126); ctx.fillRect(3, 5, 2, 1);
    ctx.fillStyle = rgb(150, 92, 80); ctx.fillRect(3, 6, 2, 1);
  });
  const sideTex = pixTex(8, 8, (ctx) => { noiseFill(ctx, 8, 8, skin, 8, 5); ctx.fillStyle = rgb(...hair); ctx.fillRect(0, 0, 8, 3); ctx.fillRect(4, 3, 4, 2); ctx.fillStyle = rgb(200, 150, 120); ctx.fillRect(2, 4, 1, 2); });
  const hairTex = pixTex(8, 8, (ctx) => noiseFill(ctx, 8, 8, hair, 26, 4));
  const hm = lam({ map: hairTex });
  const head = box(0.32, 0.32, 0.3, [lam({ map: sideTex }), lam({ map: sideTex }), hm, lam({ color: rgb(...skin) }), lam({ map: faceTex }), hm]);
  head.position.y = 0.17;
  const headPivot = new THREE.Group(); headPivot.position.y = 0.52; headPivot.add(head);
  // tousled hair volume
  const cap = box(0.35, 0.09, 0.33, hm); cap.position.set(0, 0.35, -0.005); headPivot.add(cap);
  const backHair = box(0.35, 0.22, 0.06, hm); backHair.position.set(0, 0.22, -0.16); headPivot.add(backHair);
  for (const [x, w, h] of [[-0.11, 0.1, 0.07], [0.02, 0.12, 0.09], [0.12, 0.08, 0.05]]) {
    const f = box(w, h, 0.04, hm); f.position.set(x, 0.32 - h / 2, 0.15); headPivot.add(f);
  }
  // flight goggles pushed up on the forehead
  const strap = box(0.345, 0.04, 0.325, lam({ color: '#2d2a28' })); strap.position.y = 0.33; headPivot.add(strap);
  const lensM = lam({ color: '#8fd3f0', emissive: '#1d5a72', emissiveIntensity: 0.6 });
  const rimM = lam({ color: rgb(...brass) });
  for (const s of [-1, 1]) {
    const rim = box(0.11, 0.08, 0.04, rimM); rim.position.set(s * 0.07, 0.35, 0.16); rim.rotation.x = -0.35; headPivot.add(rim);
    const lens = box(0.08, 0.055, 0.02, lensM); lens.position.set(s * 0.07, 0.355, 0.18); lens.rotation.x = -0.35; headPivot.add(lens);
  }

  // torso: padded navy vest over a grey shirt, brass buckles, compass-star crest on the back
  const vestFront = pixTex(16, 16, (ctx) => {
    noiseFill(ctx, 16, 16, vest, 12, 7);
    ctx.fillStyle = rgb(...shirt); ctx.fillRect(6, 0, 4, 5);
    ctx.fillStyle = rgb(24, 38, 62); for (let y = 3; y < 16; y += 4) ctx.fillRect(0, y, 16, 1);
    ctx.fillStyle = rgb(28, 20, 14); ctx.fillRect(7, 5, 2, 11);
    ctx.fillStyle = rgb(...brass); for (let y = 6; y < 16; y += 3) ctx.fillRect(7, y, 2, 1);
    ctx.fillStyle = rgb(60, 44, 30); ctx.fillRect(2, 0, 2, 16); ctx.fillRect(12, 0, 2, 16); // harness straps
  });
  const vestBack = pixTex(16, 16, (ctx) => {
    noiseFill(ctx, 16, 16, vest, 12, 8);
    ctx.fillStyle = rgb(24, 38, 62); for (let y = 3; y < 16; y += 4) ctx.fillRect(0, y, 16, 1);
    ctx.fillStyle = '#e9edf2';
    ctx.fillRect(7, 2, 2, 9); ctx.fillRect(3, 5, 10, 2); ctx.fillRect(6, 4, 4, 4);
    ctx.fillStyle = rgb(...brass); ctx.fillRect(7, 5, 2, 2);
  });
  const vestSide = pixTex(8, 16, (ctx) => { noiseFill(ctx, 8, 16, vest, 12, 9); ctx.fillStyle = rgb(24, 38, 62); for (let y = 3; y < 16; y += 4) ctx.fillRect(0, y, 8, 1); });
  const vs = lam({ map: vestSide });
  const torso = new THREE.Group(); torso.position.y = 0.1;
  const chest = box(0.4, 0.46, 0.22, [vs, vs, lam({ color: rgb(...shirt) }), vs, lam({ map: vestFront }), lam({ map: vestBack })]);
  chest.position.y = 0.25; torso.add(chest);
  const scarfM = lam({ color: scarfC });
  const collar = box(0.3, 0.1, 0.27, scarfM); collar.position.y = 0.5; torso.add(collar);
  const knot = box(0.1, 0.1, 0.06, scarfM); knot.position.set(0.06, 0.45, 0.14); torso.add(knot);
  // backpack gas cylinders
  const metal = lam({ color: '#9aa3ad' }), dark = lam({ color: '#4b535c' });
  for (const s of [-1, 1]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.44, 8), metal);
    tank.position.set(s * 0.09, 0.24, -0.19); torso.add(tank);
    const capT = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.06, 8), rimM);
    capT.position.set(s * 0.09, 0.49, -0.19); torso.add(capT);
  }
  const frame = box(0.3, 0.06, 0.08, dark); frame.position.set(0, 0.06, -0.17); torso.add(frame);
  torso.add(headPivot);
  const scarfAnchor = new THREE.Object3D(); scarfAnchor.position.set(-0.05, 0.5, -0.14); torso.add(scarfAnchor);

  const hips = new THREE.Group(); hips.position.y = 0.92;
  const pm = lam({ color: rgb(...pants) });
  const pelvis = box(0.36, 0.16, 0.21, pm); pelvis.position.y = 0.02; hips.add(pelvis);
  const belt = box(0.38, 0.06, 0.23, lam({ color: '#3a2a1c' })); belt.position.y = 0.09; hips.add(belt);
  const buckle = box(0.07, 0.05, 0.02, rimM); buckle.position.set(0, 0.09, 0.12); hips.add(buckle);
  // hip anchor launchers and blade sheaths
  for (const s of [-1, 1]) {
    const launcher = box(0.08, 0.11, 0.16, dark); launcher.position.set(s * 0.22, 0.02, 0.02); hips.add(launcher);
    const nozzle = box(0.04, 0.04, 0.06, metal); nozzle.position.set(s * 0.22, 0.04, 0.12); hips.add(nozzle);
    const sheath = box(0.07, 0.12, 0.42, metal); sheath.position.set(s * 0.25, -0.12, -0.08); sheath.rotation.x = 0.35; hips.add(sheath);
  }
  hips.add(torso);

  const bm = lam({ color: rgb(...boot) });
  const mkLeg = (x) => {
    const hip = new THREE.Group(); hip.position.set(x, 0, 0);
    hip.add(limb(0.16, 0.44, 0.17, pm));
    const knee = new THREE.Group(); knee.position.y = -0.44; hip.add(knee);
    knee.add(limb(0.145, 0.3, 0.155, pm));
    const b = box(0.165, 0.2, 0.25, bm); b.position.set(0, -0.38, 0.035); knee.add(b);
    const cuff = box(0.175, 0.05, 0.18, lam({ color: '#5b4434' })); cuff.position.set(0, -0.27, 0); knee.add(cuff);
    hips.add(hip);
    return { hip, knee };
  };
  const legL = mkLeg(-0.1), legR = mkLeg(0.1);

  const sm = lam({ color: rgb(...shirt) }), gm = lam({ color: rgb(...glove) });
  const steel = lam({ color: '#d6dde4', emissive: '#334', emissiveIntensity: 0.4 });
  const mkArm = (x) => {
    const sh = new THREE.Group(); sh.position.set(x, 0.44, 0); torso.add(sh);
    const pad = box(0.15, 0.1, 0.16, vs); pad.position.y = -0.03; sh.add(pad);
    sh.add(limb(0.12, 0.27, 0.13, sm));
    const elbow = new THREE.Group(); elbow.position.y = -0.27; sh.add(elbow);
    elbow.add(limb(0.115, 0.17, 0.125, sm));
    const gl = limb(0.125, 0.14, 0.135, gm); gl.position.y = -0.15; elbow.add(gl);
    const blade = new THREE.Group(); blade.position.set(0, -0.27, 0.02); elbow.add(blade);
    const grip = box(0.05, 0.05, 0.16, dark); grip.position.z = 0.02; blade.add(grip);
    const plate = box(0.018, 0.075, 0.95, steel); plate.position.z = 0.56; blade.add(plate);
    const tip = box(0.018, 0.04, 0.08, steel); tip.position.set(0, 0.02, 1.06); blade.add(tip);
    blade.rotation.x = 0.4;
    return { sh, elbow, blade };
  };
  const armL = mkArm(-0.27), armR = mkArm(0.27);

  const root = new THREE.Group();
  root.add(hips);
  return { root, hips, torso, head: headPivot, legL, legR, armL, armR, scarfAnchor, scarfMat: scarfM };
}

// ---------------- colossus: stone-skinned giant with a glowing nape core ----------------
const SKINS = [[150, 140, 122], [124, 118, 110], [162, 132, 104], [112, 122, 104], [140, 120, 128]];

export function makeColossusModel(variant = 0, dummy = false) {
  const seed = 100 + variant * 31;
  const skin = dummy ? [168, 124, 76] : SKINS[variant % SKINS.length];
  const crack = dummy ? [110, 78, 44] : [skin[0] * 0.55, skin[1] * 0.55, skin[2] * 0.55];
  const skinTex = pixTex(16, 16, (ctx) => {
    noiseFill(ctx, 16, 16, skin, 22, seed);
    const r = mulberry32(seed + 1);
    ctx.fillStyle = rgb(...crack);
    if (dummy) {
      for (let y = 3; y < 16; y += 4) ctx.fillRect(0, y, 16, 1);
    } else {
      for (let k = 0; k < 4; k++) {
        let x = Math.floor(r() * 16), y = Math.floor(r() * 16);
        for (let s = 0; s < 7; s++) { ctx.fillRect(x, y, 1, 1); x += Math.round(r() * 2 - 1); y += 1; }
      }
    }
  });
  const sm = lam({ map: skinTex });
  const faceTex = pixTex(16, 16, (ctx) => {
    noiseFill(ctx, 16, 16, skin, 22, seed + 2);
    if (dummy) {
      ctx.fillStyle = rgb(...crack); ctx.fillRect(3, 6, 3, 1); ctx.fillRect(10, 6, 3, 1); ctx.fillRect(5, 11, 6, 1);
      return;
    }
    ctx.fillStyle = rgb(skin[0] * 0.7, skin[1] * 0.7, skin[2] * 0.7);
    ctx.fillRect(1, 4, 14, 2); // heavy brow
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(3, 6, 4, 2); ctx.fillRect(9, 6, 4, 2);
    ctx.fillStyle = '#ffb347'; ctx.fillRect(4, 6, 2, 1); ctx.fillRect(10, 6, 2, 1);
    ctx.fillStyle = rgb(...crack); ctx.fillRect(7, 8, 2, 3);
    ctx.fillStyle = '#1b120c'; ctx.fillRect(4, 12, 8, 1); ctx.fillRect(5, 13, 6, 1);
  });
  const mossTex = pixTex(16, 16, (ctx) => {
    if (dummy) { noiseFill(ctx, 16, 16, [200, 170, 90], 30, seed + 3); return; }
    noiseFill(ctx, 16, 16, [70, 108, 52], 30, seed + 3);
  });
  const glow = new THREE.MeshLambertMaterial({ color: dummy ? '#c0392b' : '#ff6a2a', emissive: dummy ? '#7a1010' : '#ff4a10', emissiveIntensity: dummy ? 0.6 : 1.2 });

  const root = new THREE.Group();
  const fall = new THREE.Group(); // pivot for toppling over
  root.add(fall);

  const mkLeg = (x) => {
    const g = new THREE.Group(); g.position.set(x, 3.6, 0);
    g.add(limb(1.3, 3.6, 1.3, sm));
    fall.add(g); return g;
  };
  const legL = mkLeg(-0.75), legR = mkLeg(0.75);
  const torso = box(3.0, 3.2, 1.8, sm); torso.position.y = 5.2; fall.add(torso);
  const mkArm = (x) => {
    const g = new THREE.Group(); g.position.set(x, 6.5, 0);
    g.add(limb(1.0, 3.9, 1.0, sm));
    fall.add(g); return g;
  };
  const armL = mkArm(-2.0), armR = mkArm(2.0);
  const headPivot = new THREE.Group(); headPivot.position.y = 6.8; fall.add(headPivot);
  const head = box(2.1, 2.1, 2.1, [sm, sm, lam({ map: mossTex }), sm, lam({ map: faceTex }), sm]);
  head.position.y = 1.05; headPivot.add(head);
  // nape core sits at the back of the neck
  const core = box(1.0, 0.8, 0.35, glow);
  core.position.set(0, 0.3, -1.0);
  headPivot.add(core);
  return { root, fall, legL, legR, armL, armR, head: headPivot, core, torso, glow, height: 8.9 };
}

// ---------------- portrait for the drill sergeant (original character) ----------------
export function drawPortrait(canvas) {
  const ctx = canvas.getContext('2d');
  const P = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  P(0, 0, 16, 16, '#2b3240');
  P(0, 0, 16, 2, '#353d4d');
  P(4, 3, 8, 8, '#d9a982'); // face
  P(3, 2, 10, 2, '#b8bcc4'); P(3, 4, 1, 4, '#b8bcc4'); P(12, 4, 1, 3, '#b8bcc4'); // silver hair
  P(5, 6, 2, 1, '#fff'); P(9, 6, 2, 1, '#fff');
  P(6, 6, 1, 1, '#24343f'); P(9, 6, 1, 1, '#24343f');
  P(10, 4, 1, 4, '#a5544a'); // scar
  P(6, 9, 4, 1, '#8c5a48');
  P(3, 11, 10, 5, '#1f5b5b'); // teal scarf
  P(2, 13, 12, 3, '#3a3f4a');
  P(7, 12, 2, 2, '#c9a54a');
}
