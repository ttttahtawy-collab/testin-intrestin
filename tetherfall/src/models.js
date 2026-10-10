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


// ---------------- titans ----------------
// A titan is a jointed giant: legs and arms hang from pivots, the torso and head ride on a
// "fall" pivot at the hips (used to stoop, crawl and topple). The nape core is the only kill spot.
const SKINS = [[206, 160, 132], [190, 146, 120], [214, 176, 146], [170, 128, 100], [198, 150, 118], [222, 184, 160], [150, 112, 88]];
const HAIRS = [[40, 30, 24], [70, 50, 34], [120, 96, 60], [26, 24, 24], [140, 120, 100]];
const texCache = new Map();
function cachedTex(key, w, h, paint) {
  if (!texCache.has(key)) texCache.set(key, pixTex(w, h, paint));
  return texCache.get(key);
}

export const TITAN_TYPES = {
  pure: { name: 'Titan' },
  abnormal: { name: 'Abnormal' },
  crawler: { name: 'Crawler' },
  jaw: { name: 'The Jaw', boss: true },
  armored: { name: 'The Armored', boss: true },
  beast: { name: 'The Beast', boss: true },
  colossal: { name: 'The Colossal', boss: true },
};

export function makeTitanModel(type = 'pure', seed = 1, dummy = false) {
  const r = mulberry32(seed * 7919 + 17);
  const pick = (a) => a[Math.floor(r() * a.length)];
  let skin = pick(SKINS), hair = pick(HAIRS);
  let legLen = 3.3 + r() * 0.7, armLen = 3.5 + r() * 0.8, bodyW = 2.6 + r() * 0.9, torsoH = 3.0 + r() * 0.5, headS = 1.8 + r() * 0.7;
  let belly = r() < 0.35, hairStyle = Math.floor(r() * 4), face = Math.floor(r() * 4);
  if (type === 'abnormal') { legLen += 0.8; armLen += 0.6; headS += 0.4; face = 4; }
  if (type === 'crawler') { armLen += 0.9; legLen -= 0.3; face = 5; }
  if (type === 'jaw') { skin = [176, 132, 104]; hair = [36, 26, 20]; hairStyle = 3; armLen = 3.6; legLen = 3.2; bodyW = 2.5; headS = 2.0; face = 6; belly = false; }
  if (type === 'armored') { skin = [196, 150, 126]; hair = [214, 196, 150]; hairStyle = 1; legLen = 3.8; armLen = 4.0; bodyW = 3.4; torsoH = 3.5; headS = 2.0; face = 7; belly = false; }
  if (type === 'beast') { skin = [150, 112, 82]; hair = [120, 92, 60]; hairStyle = 3; legLen = 3.2; armLen = 5.8; bodyW = 3.3; torsoH = 3.6; headS = 2.1; face = 8; belly = false; }
  if (type === 'colossal') { skin = [168, 54, 46]; hairStyle = -1; legLen = 3.8; armLen = 4.2; bodyW = 3.2; torsoH = 3.6; headS = 2.3; face = 9; belly = false; }
  if (dummy) { skin = [168, 124, 76]; hairStyle = -1; face = -1; belly = false; legLen = 3.6; armLen = 3.9; bodyW = 3.0; torsoH = 3.2; headS = 2.1; }

  const key = `${type}:${skin}:${dummy}`;
  const crack = [skin[0] * 0.8, skin[1] * 0.78, skin[2] * 0.78];
  const skinTex = cachedTex('skin' + key, 16, 16, (ctx) => {
    noiseFill(ctx, 16, 16, skin, 14, seed);
    const rr = mulberry32(seed + 1);
    if (type === 'colossal') {
      // exposed muscle: pale tendon stripes
      ctx.fillStyle = rgb(222, 150, 130);
      for (let x = 1; x < 16; x += 3) for (let y = 0; y < 16; y++) if (rr() < 0.7) ctx.fillRect(x + (y % 5 === 0 ? 1 : 0), y, 1, 1);
      return;
    }
    if (type === 'beast') {
      ctx.fillStyle = rgb(96, 70, 48);
      for (let k = 0; k < 60; k++) ctx.fillRect(Math.floor(rr() * 16), Math.floor(rr() * 16), 1, 2);
      return;
    }
    ctx.fillStyle = rgb(...crack);
    if (dummy) { for (let y = 3; y < 16; y += 4) ctx.fillRect(0, y, 16, 1); return; }
    for (let k = 0; k < 3; k++) ctx.fillRect(Math.floor(rr() * 16), Math.floor(rr() * 16), 2, 1);
  });
  const sm = lam({ map: skinTex });
  const faceTex = cachedTex('face' + key + face + hairStyle + hair, 16, 16, (ctx) => {
    noiseFill(ctx, 16, 16, skin, 12, seed + 2);
    if (face < 0) { ctx.fillStyle = rgb(...crack); ctx.fillRect(3, 6, 3, 1); ctx.fillRect(10, 6, 3, 1); ctx.fillRect(5, 11, 6, 1); return; }
    const dark = rgb(skin[0] * 0.6, skin[1] * 0.55, skin[2] * 0.55);
    if (hairStyle >= 0) { ctx.fillStyle = rgb(...hair); ctx.fillRect(0, 0, 16, 3); if (hairStyle >= 2) { ctx.fillRect(0, 3, 2, 6); ctx.fillRect(14, 3, 2, 6); } }
    ctx.fillStyle = dark; ctx.fillRect(2, 5, 12, 1); // brow
    const eye = (x, y, w, h, pupil) => { ctx.fillStyle = '#f2ead8'; ctx.fillRect(x, y, w, h); ctx.fillStyle = pupil; ctx.fillRect(x + (w >> 1), y + (h >> 1), 1, 1); };
    if (face === 4 || face === 5) { eye(2, 5, 4, 3, '#111'); eye(10, 5, 4, 3, '#111'); }
    else if (face === 7) { ctx.fillStyle = '#e8eef4'; ctx.fillRect(1, 1, 14, 14); ctx.fillStyle = '#ff9a3a'; ctx.fillRect(3, 6, 3, 1); ctx.fillRect(10, 6, 3, 1); ctx.fillStyle = '#9aa4ae'; ctx.fillRect(7, 2, 2, 12); return; }
    else if (face === 9) { ctx.fillStyle = '#f4f0e6'; ctx.fillRect(3, 5, 3, 2); ctx.fillRect(10, 5, 3, 2); ctx.fillStyle = '#222'; ctx.fillRect(4, 6, 1, 1); ctx.fillRect(11, 6, 1, 1); }
    else { eye(3, 6, 3, 2, '#2a1a10'); eye(10, 6, 3, 2, '#2a1a10'); }
    ctx.fillStyle = dark; ctx.fillRect(7, 8, 2, 2); // nose
    if (face === 4 || face === 6 || face === 9) {
      // wide grin full of teeth
      ctx.fillStyle = '#5a1e1a'; ctx.fillRect(2, 11, 12, 3);
      ctx.fillStyle = '#efe6d2'; for (let x = 2; x < 14; x += 2) { ctx.fillRect(x, 11, 1, 1); ctx.fillRect(x + 1, 13, 1, 1); }
    } else if (face === 8) {
      ctx.fillStyle = '#2a1a10'; ctx.fillRect(4, 12, 8, 1);
      ctx.fillStyle = rgb(...hair); ctx.fillRect(0, 9, 16, 7); ctx.fillStyle = '#2a1a10'; ctx.fillRect(5, 12, 6, 1);
    } else if (face === 1) { ctx.fillStyle = '#3a1a14'; ctx.fillRect(5, 12, 6, 2); }
    else if (face === 2) { ctx.fillStyle = '#3a1a14'; ctx.fillRect(4, 12, 8, 1); ctx.fillRect(3, 11, 1, 1); ctx.fillRect(12, 11, 1, 1); }
    else { ctx.fillStyle = '#3a1a14'; ctx.fillRect(5, 12, 6, 1); }
  });
  const hairTex = cachedTex('hair' + hair, 8, 8, (ctx) => noiseFill(ctx, 8, 8, hair, 24, 9));
  const hm = lam({ map: hairTex });
  const coreColor = type === 'armored' ? '#c86a3a' : dummy ? '#c0392b' : '#ff6a2a';
  const glow = new THREE.MeshLambertMaterial({ color: coreColor, emissive: dummy ? '#7a1010' : '#ff4a10', emissiveIntensity: dummy ? 0.6 : 1.2 });

  const root = new THREE.Group();
  const fall = new THREE.Group();
  root.add(fall);
  const hipY = legLen;
  const mkLeg = (x) => {
    const g = new THREE.Group(); g.position.set(x, hipY, 0);
    g.add(limb(1.25, legLen, 1.25, sm));
    const foot = box(1.3, 0.4, 1.8, sm); foot.position.set(0, -legLen + 0.2, 0.3); g.add(foot);
    fall.add(g); return g;
  };
  const legL = mkLeg(-0.72), legR = mkLeg(0.72);
  const body = new THREE.Group(); body.position.y = hipY; fall.add(body);
  const torso = box(bodyW, torsoH, 1.8, sm); torso.position.y = torsoH / 2; body.add(torso);
  if (belly) { const b = box(bodyW * 0.8, torsoH * 0.45, 0.6, sm); b.position.set(0, torsoH * 0.28, 1.1); body.add(b); }
  const shoulderY = torsoH - 0.3;
  const mkArm = (x) => {
    const g = new THREE.Group(); g.position.set(x, shoulderY, 0);
    g.add(limb(type === 'beast' ? 1.25 : 0.95, armLen, type === 'beast' ? 1.25 : 0.95, sm));
    const hand = box(1.15, 1.0, 1.15, sm); hand.position.y = -armLen - 0.35; g.add(hand);
    const tip = new THREE.Object3D(); tip.position.y = -armLen - 0.4; g.add(tip);
    g.userData.tip = tip;
    body.add(g); return g;
  };
  const armL = mkArm(-(bodyW / 2 + 0.5)), armR = mkArm(bodyW / 2 + 0.5);
  const headPivot = new THREE.Group(); headPivot.position.y = torsoH; body.add(headPivot);
  const neck = box(1.0, 0.5, 1.0, sm); neck.position.y = 0.2; headPivot.add(neck);
  const faceM = lam({ map: faceTex });
  const top = hairStyle >= 0 ? hm : sm;
  const head = box(headS, headS, headS, [sm, sm, top, sm, faceM, hairStyle >= 2 ? hm : sm]);
  head.position.y = headS / 2 + 0.35; headPivot.add(head);
  if (hairStyle >= 1) { const c = box(headS + 0.12, 0.3, headS + 0.12, hm); c.position.y = headS + 0.4; headPivot.add(c); }
  if (hairStyle === 3) { const back = box(headS + 0.1, headS * 1.1, 0.3, hm); back.position.set(0, headS * 0.45, -headS / 2 - 0.1); headPivot.add(back); }
  if (type !== 'colossal' && !dummy) for (const s of [-1, 1]) { const ear = box(0.2, 0.5, 0.35, sm); ear.position.set(s * (headS / 2 + 0.08), headS * 0.55, 0); headPivot.add(ear); }
  // nape core sits at the back of the neck
  const core = box(1.0, 0.8, 0.35, glow);
  core.position.set(0, 0.45, -0.62);
  headPivot.add(core);

  const plates = [];
  if (type === 'armored') {
    const pm = lam({ color: '#e6ebf0', emissive: '#30363c', emissiveIntensity: 0.3 });
    const add = (parent, w, h, d, x, y, z) => { const p = box(w, h, d, pm); p.position.set(x, y, z); parent.add(p); plates.push(p); return p; };
    add(body, bodyW + 0.2, torsoH * 0.6, 0.3, 0, torsoH * 0.6, 0.95);
    add(body, bodyW + 0.2, torsoH * 0.5, 0.3, 0, torsoH * 0.55, -0.95);
    for (const a of [armL, armR]) { add(a, 1.1, armLen * 0.5, 1.1, 0, -armLen * 0.3, 0); add(a, 1.3, 0.5, 1.3, 0, -0.1, 0); }
    for (const l of [legL, legR]) add(l, 1.35, legLen * 0.45, 1.35, 0, -legLen * 0.75, 0);
    const shield = add(headPivot, 1.3, 1.0, 0.25, 0, 0.45, -0.85); // nape guard
    shield.userData.napeGuard = true;
  }
  if (type === 'jaw') {
    const jm = lam({ color: '#efe9da' });
    const jaw = box(headS * 0.9, headS * 0.4, 0.4, jm); jaw.position.set(0, headS * 0.3, headS / 2 + 0.25); headPivot.add(jaw);
    for (const a of [armL, armR]) for (let k = -1; k <= 1; k++) { const c = box(0.18, 0.9, 0.18, jm); c.position.set(k * 0.35, -armLen - 1.1, 0.3); a.add(c); }
  }
  if (type === 'colossal') {
    const ribM = lam({ color: '#e8b8a6' });
    for (let k = 0; k < 4; k++) { const rb = box(bodyW + 0.05, 0.18, 1.85, ribM); rb.position.y = torsoH * (0.45 + k * 0.13); body.add(rb); }
  }
  const height = legLen + torsoH + headS + 0.35;
  return { root, fall, body, legL, legR, armL, armR, head: headPivot, core, torso, glow, plates, height, armLen, legLen, torsoH, headS };
}

// ---------------- people: scouts, garrison soldiers and townsfolk (all men) ----------------
const matCache = new Map();
function mat(color) {
  if (!matCache.has(color)) matCache.set(color, lam({ color }));
  return matCache.get(color);
}
const PSKIN = [[226, 184, 148], [206, 160, 120], [176, 128, 92], [236, 200, 170], [150, 104, 72]];
const PHAIR = [[58, 40, 30], [30, 26, 24], [120, 84, 50], [170, 140, 90], [90, 90, 92], [200, 196, 188]];
const faceCache = new Map();
function humanFace(si, hi, beard) {
  const k = si + ':' + hi + ':' + beard;
  if (!faceCache.has(k)) {
    faceCache.set(k, pixTex(8, 8, (ctx) => {
      const skin = PSKIN[si], hair = PHAIR[hi];
      noiseFill(ctx, 8, 8, skin, 8, 3 + si);
      ctx.fillStyle = rgb(...hair); ctx.fillRect(0, 0, 8, 2);
      ctx.fillStyle = '#fff'; ctx.fillRect(1, 3, 2, 1); ctx.fillRect(5, 3, 2, 1);
      ctx.fillStyle = '#2a2420'; ctx.fillRect(2, 3, 1, 1); ctx.fillRect(5, 3, 1, 1);
      ctx.fillStyle = rgb(skin[0] * 0.85, skin[1] * 0.8, skin[2] * 0.8); ctx.fillRect(3, 4, 2, 1);
      if (beard === 1) { ctx.fillStyle = rgb(...hair); ctx.fillRect(1, 5, 6, 3); ctx.fillStyle = '#5a2e26'; ctx.fillRect(3, 6, 2, 1); }
      else if (beard === 2) { ctx.fillStyle = rgb(...hair); ctx.fillRect(2, 5, 4, 1); ctx.fillStyle = '#7a3e30'; ctx.fillRect(3, 6, 2, 1); }
      else { ctx.fillStyle = '#8a4a3a'; ctx.fillRect(3, 6, 2, 1); }
    }));
  }
  return faceCache.get(k);
}
const OUTFITS = {
  scout: { shirt: '#c8ccd2', jacket: '#7a5a3a', pants: '#e4e0d4', boots: '#3a2a20', cloak: '#3e5a36' },
  garrison: { shirt: '#c8ccd2', jacket: '#7a5a3a', pants: '#e4e0d4', boots: '#3a2a20', cloak: '#8a2e26' },
  officer: { shirt: '#e8e8ea', jacket: '#2e3646', pants: '#d8d4c8', boots: '#1e1a18', cloak: '#3e5a36' },
  engineer: { shirt: '#b8a888', jacket: '#5a5040', pants: '#6a5a44', boots: '#3a2a20', cloak: null },
};
const CIVVY = ['#8a6a4a', '#5a6a7a', '#7a4a3a', '#5a7a4a', '#9a8a6a', '#4a4a5a', '#a07850', '#6a5a7a'];

// Light rig: ~10 boxes so dozens of people stay cheap to draw.
export function makeHumanModel(kind = 'civilian', seed = 1) {
  const r = mulberry32(seed * 31 + 7);
  const si = Math.floor(r() * PSKIN.length), hi = Math.floor(r() * PHAIR.length);
  const beard = kind === 'scout' || kind === 'garrison' ? (r() < 0.25 ? 2 : 0) : Math.floor(r() * 3);
  let o = OUTFITS[kind];
  if (!o) {
    const c = CIVVY[Math.floor(r() * CIVVY.length)];
    o = { shirt: CIVVY[Math.floor(r() * CIVVY.length)], jacket: c, pants: r() < 0.5 ? '#5a4a3a' : '#4a4e56', boots: '#2e2420', cloak: null };
  }
  const skinM = mat(rgb(...PSKIN[si])), hairM = mat(rgb(...PHAIR[hi]));
  const faceM = lam({ map: humanFace(si, hi, beard) });
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.9; root.add(hips);
  const pm = mat(o.pants), jm = mat(o.jacket), bm = mat(o.boots);
  const mkLeg = (x) => {
    const hip = new THREE.Group(); hip.position.set(x, 0, 0); hips.add(hip);
    hip.add(limb(0.17, 0.72, 0.18, pm));
    const boot = box(0.18, 0.2, 0.26, bm); boot.position.set(0, -0.8, 0.03); hip.add(boot);
    return hip;
  };
  const legL = mkLeg(-0.1), legR = mkLeg(0.1);
  const torso = new THREE.Group(); hips.add(torso);
  const chest = box(0.44, 0.56, 0.24, jm); chest.position.y = 0.3; torso.add(chest);
  const headP = new THREE.Group(); headP.position.y = 0.6; torso.add(headP);
  const head = box(0.3, 0.32, 0.3, [skinM, skinM, hairM, skinM, faceM, hairM]); head.position.y = 0.17; headP.add(head);
  if (kind === 'civilian' && r() < 0.4) { const hat = box(0.38, 0.1, 0.38, mat(r() < 0.5 ? '#4a3a2a' : '#6a6a5a')); hat.position.y = 0.36; headP.add(hat); }
  const sm = mat(kind === 'civilian' ? o.jacket : o.jacket);
  const mkArm = (x) => {
    const sh = new THREE.Group(); sh.position.set(x, 0.52, 0); torso.add(sh);
    sh.add(limb(0.12, 0.6, 0.13, sm));
    const hand = box(0.11, 0.1, 0.11, skinM); hand.position.y = -0.64; sh.add(hand);
    return sh;
  };
  const armL = mkArm(-0.29), armR = mkArm(0.29);
  if (o.cloak) {
    const cl = box(0.46, 0.62, 0.05, mat(o.cloak)); cl.position.set(0, 0.24, -0.15); cl.rotation.x = 0.12; torso.add(cl);
    for (const s of [-1, 1]) { const gear = box(0.09, 0.14, 0.32, mat('#7e8892')); gear.position.set(s * 0.26, -0.02, 0); hips.add(gear); }
  }
  return { root, hips, torso, head: headP, legL, legR, armL, armR };
}

// ---------------- portraits for the cast (all original characters) ----------------
const CAST = {
  holt: { skin: '#d9a982', hair: '#b8bcc4', eyes: '#24343f', scarf: '#1f5b5b', scar: true, beard: false },
  varn: { skin: '#c8946e', hair: '#2a2420', eyes: '#3a2a1a', scarf: '#3e5a36', scar: false, beard: 'stubble' },
  dorne: { skin: '#e2b896', hair: '#d8c070', eyes: '#2a4a6a', scarf: '#2e3646', scar: false, beard: false },
  bram: { skin: '#b07a56', hair: '#6a5a4a', eyes: '#2a2018', scarf: '#7a5a3a', scar: false, beard: 'full', bald: true },
  osric: { skin: '#e6c2a0', hair: '#7a5030', eyes: '#2a2a2a', scarf: '#5a4a6a', scar: false, beard: false, glasses: true },
  tobin: { skin: '#e0b088', hair: '#9a6a3a', eyes: '#3a5a2a', scarf: '#3e5a36', scar: false, beard: false },
  kael: { skin: '#a8744e', hair: '#1a1816', eyes: '#2a1a10', scarf: '#3e5a36', scar: true, beard: 'stubble' },
  mattis: { skin: '#d0a07a', hair: '#8a8a8c', eyes: '#2a2a2a', scarf: '#5a5040', scar: false, beard: 'full' },
  elder: { skin: '#d8b090', hair: '#e8e4dc', eyes: '#3a3a3a', scarf: '#6a5a40', scar: false, beard: 'full' },
  townsman: { skin: '#c89070', hair: '#4a3020', eyes: '#2a2018', scarf: '#8a6a4a', scar: false, beard: 'stubble' },
};
export function drawPortrait(canvas, who = 'holt') {
  const c = CAST[who] || CAST.holt;
  const ctx = canvas.getContext('2d');
  const P = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  P(0, 0, 16, 16, '#2b3240');
  P(0, 0, 16, 2, '#353d4d');
  P(4, 3, 8, 8, c.skin);
  if (!c.bald) { P(3, 2, 10, 2, c.hair); P(3, 4, 1, 4, c.hair); P(12, 4, 1, 3, c.hair); } else P(4, 3, 8, 1, c.skin);
  P(5, 6, 2, 1, '#fff'); P(9, 6, 2, 1, '#fff');
  P(6, 6, 1, 1, c.eyes); P(9, 6, 1, 1, c.eyes);
  if (c.glasses) { P(4, 5, 4, 1, '#333'); P(8, 5, 4, 1, '#333'); }
  if (c.scar) P(10, 4, 1, 4, '#a5544a');
  if (c.beard === 'full') { P(4, 8, 8, 3, c.hair); P(6, 9, 4, 1, '#6a3a30'); }
  else if (c.beard === 'stubble') { P(4, 9, 8, 2, 'rgba(40,30,24,0.45)'); P(6, 9, 4, 1, '#8c5a48'); }
  else P(6, 9, 4, 1, '#8c5a48');
  P(3, 11, 10, 5, c.scarf);
  P(2, 13, 12, 3, '#3a3f4a');
  P(7, 12, 2, 2, '#c9a54a');
}
