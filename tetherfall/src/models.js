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
export function makePlayerModel() {
  const skin = [222, 178, 140], hair = [74, 50, 34];
  const faceTex = pixTex(8, 8, (ctx) => {
    noiseFill(ctx, 8, 8, skin, 10, 3);
    ctx.fillStyle = rgb(...hair); ctx.fillRect(0, 0, 8, 2); ctx.fillRect(0, 2, 1, 2); ctx.fillRect(7, 2, 1, 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(1, 4, 2, 1); ctx.fillRect(5, 4, 2, 1);
    ctx.fillStyle = '#2b4a6b'; ctx.fillRect(2, 4, 1, 1); ctx.fillRect(5, 4, 1, 1);
    ctx.fillStyle = rgb(160, 110, 90); ctx.fillRect(3, 6, 2, 1);
  });
  const hairTex = pixTex(8, 8, (ctx) => noiseFill(ctx, 8, 8, hair, 24, 4));
  const sideTex = pixTex(8, 8, (ctx) => { noiseFill(ctx, 8, 8, skin, 10, 5); ctx.fillStyle = rgb(...hair); ctx.fillRect(0, 0, 8, 3); ctx.fillRect(5, 3, 3, 2); });
  const head = box(0.42, 0.42, 0.42, [
    lam({ map: sideTex }), lam({ map: sideTex }), lam({ map: hairTex }), lam({ color: rgb(...skin) }), lam({ map: faceTex }), lam({ map: hairTex }),
  ]);
  head.position.y = 0.21;
  const headPivot = new THREE.Group(); headPivot.position.y = 1.42; headPivot.add(head);

  // jacket with a navy tabard; the back carries a white compass-star crest
  const jacket = [150, 104, 62];
  const tabardTex = (back) => pixTex(16, 16, (ctx) => {
    noiseFill(ctx, 16, 16, jacket, 14, back ? 7 : 8);
    ctx.fillStyle = '#1f3a5c'; ctx.fillRect(3, 0, 10, 16);
    ctx.fillStyle = '#c9a54a'; ctx.fillRect(3, 11, 10, 1);
    if (back) {
      ctx.fillStyle = '#e9edf2';
      ctx.fillRect(7, 2, 2, 8); ctx.fillRect(4, 5, 8, 2);
      ctx.fillRect(6, 4, 4, 4);
      ctx.fillStyle = '#1f3a5c'; ctx.fillRect(7, 5, 2, 2);
    } else {
      ctx.fillStyle = '#e9edf2'; ctx.fillRect(4, 3, 2, 2);
    }
  });
  const jm = lam({ map: pixTex(8, 8, (ctx) => noiseFill(ctx, 8, 8, jacket, 14, 9)) });
  const body = box(0.5, 0.62, 0.28, [jm, jm, jm, jm, lam({ map: tabardTex(false) }), lam({ map: tabardTex(true) })]);
  body.position.y = 1.11;
  // belts / harness straps
  const strap = lam({ color: '#3a2a1c' });
  const belt = box(0.52, 0.07, 0.3, strap); belt.position.y = 0.86;

  const pants = lam({ color: '#d9d4c7' }), boots = lam({ color: '#4a3020' });
  const mkLeg = (x) => {
    const g = new THREE.Group(); g.position.set(x, 0.8, 0);
    const up = limb(0.22, 0.48, 0.24, pants); g.add(up);
    const boot = limb(0.23, 0.34, 0.26, boots); boot.position.y = -0.46; g.add(boot);
    return g;
  };
  const legL = mkLeg(-0.13), legR = mkLeg(0.13);

  const sleeve = lam({ color: rgb(...jacket) }), hand = lam({ color: rgb(...skin) });
  const steel = lam({ color: '#c8d0d8', emissive: '#223', emissiveIntensity: 0.3 });
  const mkArm = (x) => {
    const g = new THREE.Group(); g.position.set(x, 1.4, 0);
    g.add(limb(0.18, 0.5, 0.2, sleeve));
    const h = limb(0.17, 0.12, 0.19, hand); h.position.y = -0.5; g.add(h);
    // blade: handle in hand, long thin plate pointing forward-down
    const bladePivot = new THREE.Group(); bladePivot.position.set(0, -0.56, 0.02);
    const grip = box(0.06, 0.06, 0.18, lam({ color: '#555' })); grip.position.z = 0.02;
    const blade = box(0.02, 0.07, 0.95, steel); blade.position.z = 0.55;
    bladePivot.add(grip, blade);
    bladePivot.rotation.x = 0.5;
    g.add(bladePivot);
    g.userData.blade = blade;
    return g;
  };
  const armL = mkArm(-0.34), armR = mkArm(0.34);

  // tether rig: gas tanks and hook launchers on the hips
  const metal = lam({ color: '#8d96a0' });
  const tankL = box(0.14, 0.14, 0.5, metal); tankL.position.set(-0.32, 0.78, -0.08);
  const tankR = tankL.clone(); tankR.position.x = 0.32;
  const pack = box(0.3, 0.22, 0.12, lam({ color: '#5d6670' })); pack.position.set(0, 0.9, -0.2);

  const root = new THREE.Group();
  const spin = new THREE.Group(); // used for spin cuts
  spin.add(headPivot, body, belt, legL, legR, armL, armR, tankL, tankR, pack);
  root.add(spin);
  root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return { root, spin, head: headPivot, legL, legR, armL, armR };
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
