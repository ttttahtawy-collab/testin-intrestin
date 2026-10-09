// Character and creature rigs with procedural animation.
import * as THREE from 'three';
import { pixelBox, boxShape, makePart, charMat, hexLin } from './voxmodel.js';
import { itemShape } from '../game/itemshapes.js';

export const PX = 0.11; // human pixel size in voxel units (32px ≈ 1.76m)

const shade = (hex, k) => {
  const r = Math.min(255, Math.max(0, Math.round(((hex >> 16) & 255) * k)));
  const g = Math.min(255, Math.max(0, Math.round(((hex >> 8) & 255) * k)));
  const b = Math.min(255, Math.max(0, Math.round((hex & 255) * k)));
  return (r << 16) | (g << 8) | b;
};

// ------------------------------------------------------------------
// Humanoids
// ------------------------------------------------------------------
export const DEFAULT_APP = {
  skin: 0xc8946c, hair: 0x4a3020, hairStyle: 'short', beard: 'none', eyes: 0x3a5a7a,
  top: 0x6a5a3a, topTrim: 0x3a2a1a, topStyle: 'tunic', belt: 0x3a2414, legs: 0x4a3e30, boots: 0x2e2218,
  cloak: null, hood: null, helmet: null, scarf: null, gloves: null, scale: 1, female: false,
};

function headFn(a) {
  const hair = a.hair, skin = a.skin, sk2 = shade(skin, 0.85);
  const scarf = a.scarf, hood = a.hood;
  const helm = a.helmet;
  const metal = 0x8a8e94, metalD = 0x5a5e64;
  return (face, u, v) => {
    // helmets
    if (helm === 'bascinet') {
      if (face === 'front') { if (v === 4 && u >= 1 && u <= 6) return 0x101010; if (v === 3 && (u === 3 || u === 4)) return 0x202020; return (u + v) % 5 === 0 ? metalD : metal; }
      return face === 'top' ? shade(metal, 1.1) : metal;
    }
    const cover = scarf || hood;
    if (cover) {
      const c2 = shade(cover, 0.85);
      if (face === 'top' || face === 'back') return (u + v) % 4 === 0 ? c2 : cover;
      if (face === 'left' || face === 'right') return v < 2 && u < 2 ? (hood ? cover : cover) : cover;
      if (face === 'front') {
        if (v >= 7 || u === 0 || u === 7) return cover;
        if (hood && v >= 6) return c2;
      }
    }
    if (helm === 'kettle' && (face !== 'bottom') && v >= 6) return v === 6 ? metalD : metal;
    if (helm === 'coif') { if (face !== 'front' || v >= 6 || u === 0 || u === 7 || v <= 1) return (u + v) % 2 ? 0x707478 : 0x5e6266; }
    if (helm === 'cap' && v >= 6 && face !== 'bottom') return v === 6 ? shade(a.capColor || 0x5a3a24, 0.8) : (a.capColor || 0x5a3a24);
    if (face === 'top') return a.hairStyle === 'bald' ? skin : hair;
    if (face === 'bottom') return sk2;
    if (face === 'back') {
      if (a.hairStyle === 'bald') return v >= 3 ? skin : sk2;
      if (a.hairStyle === 'long' || a.hairStyle === 'bun') return hair;
      return v >= 2 ? hair : skin;
    }
    if (face === 'left' || face === 'right') {
      if (a.hairStyle === 'bald') { if (v === 4 && (u === 4 || u === 3)) return sk2; return skin; }
      if (a.hairStyle === 'long') return u >= 2 || v >= 5 ? hair : skin;
      if (v >= 5 || (u >= 5 && v >= 2)) return hair;
      if (a.beard === 'full' && v <= 3 && u <= 4) return a.beardColor || hair;
      if (v === 4 && u === 4) return sk2; // ear
      return skin;
    }
    // front face (u: viewer left->right, v bottom->top)
    if (a.hairStyle !== 'bald' && !cover) {
      if (v === 7) return hair;
      if (v === 6 && (u === 0 || u === 7 || (a.hairStyle === 'long' && u <= 1) || u === 3 + (a.female ? 1 : 0))) return hair;
      if (a.hairStyle === 'long' && (u === 0 || u === 7) && v >= 2) return hair;
    }
    // eyes
    if (v === 4) {
      if (u === 1 || u === 6) return 0xe8e4dc;
      if (u === 2 || u === 5) return a.eyes;
    }
    if (v === 5 && (u === 1 || u === 2 || u === 5 || u === 6)) return shade(a.hair === 0x101010 ? 0x2a2a2a : a.hair, 0.8);
    if (v === 3 && (u === 3 || u === 4)) return sk2; // nose
    const beard = a.beard, bc = a.beardColor || hair;
    if (beard === 'full') {
      if (v <= 2 && !(v === 1 && (u === 3 || u === 4))) return bc;
      if (v === 3 && (u <= 1 || u >= 6)) return bc;
    } else if (beard === 'mustache') {
      if (v === 2 && u >= 2 && u <= 5) return bc;
    } else if (beard === 'stubble') {
      if (v <= 1) return shade(skin, 0.75);
    }
    if (v === 1 && (u === 3 || u === 4)) return a.female ? 0x9a4a4a : 0x6a3a30;
    if (v === 2 && (u === 0 || u === 7)) return sk2;
    return skin;
  };
}

function torsoFn(a) {
  const t = a.top, tr = a.topTrim, bl = a.belt;
  return (face, u, v) => {
    // v: 0 bottom .. 11 top
    if (a.cloak && face === 'back') return v === 11 ? shade(a.cloak, 0.8) : (u + v * 3) % 7 === 0 ? shade(a.cloak, 0.9) : a.cloak;
    if (a.cloak && (face === 'left' || face === 'right') && u >= 2) return a.cloak;
    if (face === 'top') return v >= 1 && v <= 2 && u >= 2 && u <= 5 ? a.skin : t;
    switch (a.topStyle) {
      case 'mail': {
        if (v === 4) return bl;
        if (face === 'front' && v >= 5 && u >= 2 && u <= 5 && a.tabard) return v === 11 ? tr : a.tabard;
        return (u + v) % 2 ? 0x76797e : 0x5c5f64;
      }
      case 'plate': {
        if (v === 4) return bl;
        if (face === 'front' && a.tabard && u >= 2 && u <= 5) return v === 11 ? tr : a.tabard;
        if (face === 'front' && v >= 6 && (u === 1 || u === 6)) return 0xb0b4ba;
        return v % 3 === 0 ? 0x6a6e74 : 0x8e9298;
      }
      case 'robe': case 'dress': {
        if (v === 6) return bl;
        if (face === 'front' && v >= 7 && (u === 3 || u === 4)) return tr;
        if (face === 'front' && v === 11 && u >= 2 && u <= 5) return tr;
        return t;
      }
      case 'apron': {
        if (v === 4) return bl;
        if (face === 'front' && u >= 1 && u <= 6 && v <= 9) return a.apron || 0x5a3a22;
        return t;
      }
      case 'vest': {
        if (v === 4) return bl;
        if (face === 'front' && (u === 3 || u === 4)) return a.shirt || 0xd8d0b8;
        return t;
      }
      case 'coat': {
        if (v === 4 || v === 5) return v === 4 ? bl : shade(bl, 1.2);
        if (face === 'front' && (u === 3 || u === 4) && v > 5) return tr;
        if (v === 11) return a.fur || shade(t, 1.3);
        return t;
      }
      default: {
        if (v === 4) return u === 3 || u === 4 ? 0xb08a3a : bl;
        if (face === 'front' && v === 11 && u >= 2 && u <= 5) return tr;
        if (face === 'front' && v === 10 && (u === 3 || u === 4)) return tr;
        return (u * 3 + v) % 9 === 0 ? shade(t, 0.9) : t;
      }
    }
  };
}

function armFn(a, side) {
  return (face, u, v) => {
    if (face === 'bottom') return a.gloves || a.skin;
    if (v <= 2) return a.gloves || a.skin;
    if (a.cloak && v >= 8 && (face === 'back' || face === (side < 0 ? 'left' : 'right'))) return a.cloak;
    switch (a.topStyle) {
      case 'mail': return v === 3 ? 0x4a3a2a : (u + v) % 2 ? 0x76797e : 0x5c5f64;
      case 'plate': return v >= 9 ? 0x9a9ea4 : v === 6 ? 0xb0b4ba : 0x7e8288;
      case 'vest': return a.shirt || 0xd8d0b8;
      case 'apron': return v >= 8 ? a.top : a.skin;
      default: return v === 3 ? shade(a.top, 0.8) : a.top;
    }
  };
}

function legFn(a) {
  const long = a.topStyle === 'robe' || a.topStyle === 'dress';
  return (face, u, v) => {
    if (face === 'bottom') return a.boots;
    if (v <= (long ? 1 : 3)) return v === (long ? 1 : 3) ? shade(a.boots, 1.2) : a.boots;
    if (long) return v >= 11 ? a.top : (face === 'front' && v % 4 === 0 ? shade(a.top, 0.9) : a.top);
    if (a.topStyle === 'plate' && v >= 4) return v % 3 === 0 ? 0x6a6e74 : 0x8e9298;
    if (a.topStyle === 'mail' && v >= 9) return (u + v) % 2 ? 0x76797e : 0x5c5f64;
    if (a.topStyle === 'coat' && v >= 8) return a.top;
    return a.legs;
  };
}

const GEO_CACHE = new Map();
function cachedBox(key, make) { let g = GEO_CACHE.get(key); if (!g) { g = make(); GEO_CACHE.set(key, g); } return g; }

export function buildHumanoid(appIn = {}) {
  const a = { ...DEFAULT_APP, ...appIn };
  const ck = JSON.stringify(a);
  const px = PX * (a.scale || 1);
  const root = new THREE.Group();
  const body = new THREE.Group(); // for death tilt
  root.add(body);
  const seed = Math.floor((a.skin + a.top) % 997);
  const parts = {};
  parts.legL = makePart(cachedBox(ck + 'legL', () => pixelBox(4, 12, 4, legFn(a), px, [-2, -12, -2], seed)), [-2, 12, 0], px);
  parts.legR = makePart(cachedBox(ck + 'legR', () => pixelBox(4, 12, 4, legFn(a), px, [-2, -12, -2], seed + 1)), [2, 12, 0], px);
  parts.torso = makePart(cachedBox(ck + 'torso', () => pixelBox(8, 12, 4, torsoFn(a), px, [-4, 0, -2], seed + 2)), [0, 12, 0], px);
  parts.head = makePart(cachedBox(ck + 'head', () => pixelBox(8, 8, 8, headFn(a), px, [-4, 0, -4], seed + 3)), [0, 12, 0], px);
  parts.armL = makePart(cachedBox(ck + 'armL', () => pixelBox(4, 12, 4, armFn(a, 1), px, [-2, -12, -2], seed + 4)), [-6, 12, 0], px);
  parts.armR = makePart(cachedBox(ck + 'armR', () => pixelBox(4, 12, 4, armFn(a, -1), px, [-2, -12, -2], seed + 5)), [6, 12, 0], px);
  body.add(parts.legL, parts.legR, parts.torso);
  parts.torso.add(parts.head, parts.armL, parts.armR);
  // long hair / bun / cloak tail extras
  if (a.hairStyle === 'bun' && !a.scarf && !a.hood && !a.helmet) {
    const bun = new THREE.Mesh(pixelBox(4, 3, 3, () => a.hair, px, [-2, 6, 4]), charMat);
    parts.head.add(bun);
  }
  if (a.helmet === 'kettle') {
    const brim = new THREE.Mesh(pixelBox(12, 1, 12, () => 0x6a6e74, px, [-6, 6, -6]), charMat);
    parts.head.add(brim);
  }
  if (a.cloak) {
    const cape = new THREE.Mesh(pixelBox(8, 14, 1, (f, u, v) => (v === 13 ? shade(a.cloak, 0.8) : a.cloak), px, [-4, -14, 0]), charMat);
    const capeG = new THREE.Group();
    capeG.position.set(0, 12 * px, 2 * px);
    capeG.add(cape);
    parts.torso.add(capeG);
    parts.cape = capeG;
  }
  if (a.quiver) {
    const q = new THREE.Mesh(boxShape([[-1, 0, 0, 2, 10, 2, 0x5a3a22], [-1, 10, 0, 0, 13, 1, 0xd0c8b0], [1, 10, 1, 2, 12, 2, 0xd0c8b0]], px), charMat);
    q.position.set(-1 * px, 2 * px, 2.2 * px); q.rotation.z = 0.4;
    parts.torso.add(q);
  }
  // hands: attachment points
  parts.handR = new THREE.Group(); parts.handR.position.set(0, -11 * px, 0); parts.armR.add(parts.handR);
  parts.handL = new THREE.Group(); parts.handL.position.set(0, -11 * px, 0); parts.armL.add(parts.handL);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  const rig = { kind: 'human', root, body, parts, px, height: 32 * px, app: a, held: null, off: null };
  return rig;
}

export function setHeld(rig, itemId, hand = 'R') {
  const slot = hand === 'R' ? 'held' : 'off';
  const parent = hand === 'R' ? rig.parts.handR : rig.parts.handL;
  if (rig[slot]) { parent.remove(rig[slot]); rig[slot] = null; }
  if (!itemId) return;
  const shape = itemShape(itemId);
  if (!shape) return;
  const m = new THREE.Mesh(shape.geom(rig.px * 0.75), charMat);
  m.castShadow = true;
  const g = new THREE.Group();
  g.add(m);
  // weapons point forward from the fist
  if (shape.kind === 'blade' || shape.kind === 'blunt' || shape.kind === 'axe') { m.rotation.x = -Math.PI / 2; }
  else if (shape.kind === 'shield') { m.rotation.y = Math.PI / 2; m.position.set(hand === 'R' ? -2 * rig.px : 2.5 * rig.px, 0, 0); }
  else if (shape.kind === 'bow') { m.rotation.y = 0; m.position.set(0, 0, -1 * rig.px); }
  else if (shape.kind === 'lantern') { m.position.set(0, -6 * rig.px, 0); }
  else if (shape.kind === 'tool') { m.rotation.x = -Math.PI / 2; }
  parent.add(g);
  rig[slot] = g;
}

// ------------------------------------------------------------------
// Quadrupeds & birds (part specs in pixel units)
// ------------------------------------------------------------------
function solidFn(base, belly = null, eyes = null, extra = null) {
  return (face, u, v) => {
    if (extra) { const e = extra(face, u, v); if (e !== undefined) return e; }
    if (belly && face === 'bottom') return belly;
    return base;
  };
}
function headSolid(base, eyeCol = 0x111111, eyeRow = 2, w = 6, nose = null, snout = false) {
  return (face, u, v) => {
    if ((face === 'left' || face === 'right') && v === eyeRow && u === 1) return eyeCol;
    if (face === 'front' && nose && v <= 1 && u >= 2 && u <= w - 3) return nose;
    return base;
  };
}

const ANIMALS = {
  wolf: { px: 0.12, col: 0x6a6660, belly: 0x9a958a, h: 10, parts: (c) => [
    ['body', 6, 6, 14, [-3, 0, -7], [0, 9, 0], solidFn(c.col, c.belly, null, (f, u, v) => (f === 'top' && u >= 2 && u <= 3 ? 0x4a4642 : undefined))],
    ['head', 6, 6, 6, [-3, -1, -6], [0, 12, -7], headSolid(c.col, c.eye || 0xc8a020, 3, 6)],
    ['snout', 4, 3, 4, [-2, 0, -4], [0, 11, -13], headSolid(c.belly, 0x111111, 9, 4, 0x111111)],
    ['earL', 2, 2, 1, [-1, 0, 0], [2, 17, -9], solidFn(c.col)], ['earR', 2, 2, 1, [-1, 0, 0], [-2, 17, -9], solidFn(c.col)],
    ['legFL', 2, 9, 2, [-1, -9, -1], [2, 9, -5], solidFn(c.col)], ['legFR', 2, 9, 2, [-1, -9, -1], [-2, 9, -5], solidFn(c.col)],
    ['legBL', 2, 9, 2, [-1, -9, -1], [2, 9, 5], solidFn(c.col)], ['legBR', 2, 9, 2, [-1, -9, -1], [-2, 9, 5], solidFn(c.col)],
    ['tail', 2, 2, 7, [-1, -1, 0], [0, 13, 7], solidFn(c.col)],
  ] },
  boar: { px: 0.12, col: 0x4a3a2c, belly: 0x5a4a3a, parts: (c) => [
    ['body', 8, 7, 13, [-4, 0, -6], [0, 6, 0], solidFn(c.col, c.belly, null, (f, u, v) => (f === 'top' && (u === 3 || u === 4) ? 0x2a1e16 : undefined))],
    ['head', 6, 6, 5, [-3, -2, -5], [0, 10, -6], headSolid(c.col, 0x111111, 3, 6)],
    ['snout', 4, 3, 3, [-2, 0, -3], [0, 8, -11], headSolid(0x8a6a5a, 0x111111, 9, 4, 0x3a2a2a)],
    ['tuskL', 1, 3, 1, [0, 0, 0], [2, 9, -13], solidFn(0xe8e0c8)], ['tuskR', 1, 3, 1, [-1, 0, 0], [-2, 9, -13], solidFn(0xe8e0c8)],
    ['legFL', 2, 6, 2, [-1, -6, -1], [2, 6, -4], solidFn(c.col)], ['legFR', 2, 6, 2, [-1, -6, -1], [-2, 6, -4], solidFn(c.col)],
    ['legBL', 2, 6, 2, [-1, -6, -1], [2, 6, 4], solidFn(c.col)], ['legBR', 2, 6, 2, [-1, -6, -1], [-2, 6, 4], solidFn(c.col)],
  ] },
  bear: { px: 0.16, col: 0x4a3626, belly: 0x5a4434, parts: (c) => [
    ['body', 10, 9, 16, [-5, 0, -8], [0, 9, 0], solidFn(c.col, c.belly)],
    ['head', 8, 7, 7, [-4, -2, -7], [0, 15, -8], headSolid(c.col, 0x111111, 4, 8)],
    ['snout', 4, 3, 3, [-2, 0, -3], [0, 13, -15], headSolid(0x6a5040, 0x111111, 9, 4, 0x111111)],
    ['earL', 2, 2, 1, [-1, 0, 0], [3, 20, -10], solidFn(c.col)], ['earR', 2, 2, 1, [-1, 0, 0], [-3, 20, -10], solidFn(c.col)],
    ['legFL', 3, 9, 3, [-1.5, -9, -1.5], [3, 9, -5], solidFn(c.col)], ['legFR', 3, 9, 3, [-1.5, -9, -1.5], [-3, 9, -5], solidFn(c.col)],
    ['legBL', 3, 9, 3, [-1.5, -9, -1.5], [3, 9, 5], solidFn(c.col)], ['legBR', 3, 9, 3, [-1.5, -9, -1.5], [-3, 9, 5], solidFn(c.col)],
  ] },
  deer: { px: 0.12, col: 0x8a5a34, belly: 0xd8c8a8, parts: (c) => [
    ['body', 6, 7, 13, [-3, 0, -6], [0, 13, 0], solidFn(c.col, c.belly, null, (f, u, v) => (f === 'back' ? 0xe8e0d0 : undefined))],
    ['neck', 3, 7, 3, [-1.5, 0, -1.5], [0, 18, -6], solidFn(c.col)],
    ['head', 4, 4, 6, [-2, 0, -6], [0, 24, -5], headSolid(c.col, 0x111111, 2, 4, 0x222222)],
    ['antL', 1, 6, 1, [0, 0, 0], [1, 28, -6], solidFn(0xb8a888)], ['antR', 1, 6, 1, [-1, 0, 0], [-1, 28, -6], solidFn(0xb8a888)],
    ['legFL', 2, 13, 2, [-1, -13, -1], [2, 13, -5], solidFn(c.col)], ['legFR', 2, 13, 2, [-1, -13, -1], [-2, 13, -5], solidFn(c.col)],
    ['legBL', 2, 13, 2, [-1, -13, -1], [2, 13, 5], solidFn(c.col)], ['legBR', 2, 13, 2, [-1, -13, -1], [-2, 13, 5], solidFn(c.col)],
  ] },
  goat: { px: 0.11, col: 0xd8d0c0, belly: 0xc8c0b0, parts: (c) => [
    ['body', 6, 6, 11, [-3, 0, -5], [0, 9, 0], solidFn(c.col, c.belly)],
    ['head', 4, 5, 5, [-2, 0, -5], [0, 14, -5], headSolid(c.col, 0x3a2a10, 3, 4, 0x8a7a6a)],
    ['hornL', 1, 4, 1, [0, 0, 0], [1, 19, -3], solidFn(0x5a5040)], ['hornR', 1, 4, 1, [-1, 0, 0], [-1, 19, -3], solidFn(0x5a5040)],
    ['legFL', 2, 9, 2, [-1, -9, -1], [2, 9, -4], solidFn(c.col)], ['legFR', 2, 9, 2, [-1, -9, -1], [-2, 9, -4], solidFn(c.col)],
    ['legBL', 2, 9, 2, [-1, -9, -1], [2, 9, 4], solidFn(c.col)], ['legBR', 2, 9, 2, [-1, -9, -1], [-2, 9, 4], solidFn(c.col)],
  ] },
  sheep: { px: 0.11, col: 0xe8e4d8, belly: 0xd0ccc0, parts: (c) => [
    ['body', 8, 7, 11, [-4, 0, -5], [0, 6, 0], solidFn(c.col, c.belly)],
    ['head', 4, 5, 4, [-2, -1, -4], [0, 11, -5], headSolid(0x3a3430, 0xd8c060, 3, 4)],
    ['legFL', 2, 6, 2, [-1, -6, -1], [2, 6, -3], solidFn(0x3a3430)], ['legFR', 2, 6, 2, [-1, -6, -1], [-2, 6, -3], solidFn(0x3a3430)],
    ['legBL', 2, 6, 2, [-1, -6, -1], [2, 6, 3], solidFn(0x3a3430)], ['legBR', 2, 6, 2, [-1, -6, -1], [-2, 6, 3], solidFn(0x3a3430)],
  ] },
  cow: { px: 0.15, col: 0x6a4a34, belly: 0xe8e0d0, parts: (c) => [
    ['body', 8, 8, 14, [-4, 0, -7], [0, 9, 0], solidFn(c.col, c.belly, null, (f, u, v) => ((u * 7 + v * 3) % 11 < 3 ? 0xe8e0d0 : undefined))],
    ['head', 5, 5, 5, [-2.5, -1, -5], [0, 14, -7], headSolid(c.col, 0x111111, 3, 5, 0xc8a090)],
    ['hornL', 1, 2, 1, [0, 0, 0], [2, 18, -9], solidFn(0xe8e0c8)], ['hornR', 1, 2, 1, [-1, 0, 0], [-2, 18, -9], solidFn(0xe8e0c8)],
    ['legFL', 2, 9, 2, [-1, -9, -1], [3, 9, -5], solidFn(c.col)], ['legFR', 2, 9, 2, [-1, -9, -1], [-3, 9, -5], solidFn(c.col)],
    ['legBL', 2, 9, 2, [-1, -9, -1], [3, 9, 5], solidFn(c.col)], ['legBR', 2, 9, 2, [-1, -9, -1], [-3, 9, 5], solidFn(c.col)],
  ] },
  rabbit: { px: 0.07, col: 0x8a7a64, belly: 0xd8d0c0, parts: (c) => [
    ['body', 5, 5, 7, [-2.5, 0, -3.5], [0, 2, 0], solidFn(c.col, c.belly, null, (f) => (f === 'back' ? 0xf0f0f0 : undefined))],
    ['head', 4, 4, 4, [-2, 0, -4], [0, 5, -3], headSolid(c.col, 0x111111, 2, 4, 0xc08080)],
    ['earL', 1, 5, 1, [0, 0, 0], [1, 9, -1], solidFn(c.col)], ['earR', 1, 5, 1, [-1, 0, 0], [-1, 9, -1], solidFn(c.col)],
    ['legFL', 1, 2, 1, [0, -2, 0], [1, 2, -2], solidFn(c.col)], ['legFR', 1, 2, 1, [-1, -2, 0], [-1, 2, -2], solidFn(c.col)],
    ['legBL', 2, 2, 3, [-1, -2, -1], [2, 2, 2], solidFn(c.col)], ['legBR', 2, 2, 3, [-1, -2, -1], [-2, 2, 2], solidFn(c.col)],
  ] },
  rat: { px: 0.07, col: 0x4a4440, belly: 0x6a6460, parts: (c) => [
    ['body', 5, 4, 9, [-2.5, 0, -4.5], [0, 2, 0], solidFn(c.col, c.belly)],
    ['head', 3, 3, 4, [-1.5, 0, -4], [0, 3, -4], headSolid(c.col, 0xaa2222, 2, 3, 0xc08080)],
    ['tail', 1, 1, 9, [-0.5, 0, 0], [0, 3, 4], solidFn(0xb08a80)],
    ['legFL', 1, 2, 1, [0, -2, 0], [1, 2, -3], solidFn(c.col)], ['legFR', 1, 2, 1, [-1, -2, 0], [-1, 2, -3], solidFn(c.col)],
    ['legBL', 1, 2, 1, [0, -2, 0], [1, 2, 3], solidFn(c.col)], ['legBR', 1, 2, 1, [-1, -2, 0], [-1, 2, 3], solidFn(c.col)],
  ] },
  chicken: { px: 0.06, col: 0xf0ece0, belly: 0xe0dcd0, parts: (c) => [
    ['body', 5, 5, 7, [-2.5, 0, -3.5], [0, 4, 0], solidFn(c.col, c.belly)],
    ['head', 3, 4, 3, [-1.5, 0, -3], [0, 8, -2], headSolid(c.col, 0x111111, 2, 3, 0xe0a020)],
    ['comb', 1, 2, 2, [-0.5, 0, 0], [0, 12, -4], solidFn(0xc02020)],
    ['beak', 2, 1, 2, [-1, 0, -2], [0, 9, -5], solidFn(0xe0a020)],
    ['wingL', 1, 3, 5, [0, -3, -2.5], [2.5, 8, 0], solidFn(shade(c.col, 0.9))], ['wingR', 1, 3, 5, [-1, -3, -2.5], [-2.5, 8, 0], solidFn(shade(c.col, 0.9))],
    ['legFL', 1, 4, 1, [0, -4, 0], [1, 4, 0], solidFn(0xe0a020)], ['legFR', 1, 4, 1, [-1, -4, 0], [-1, 4, 0], solidFn(0xe0a020)],
  ] },
  duck: { px: 0.06, col: 0x6a5a40, belly: 0x8a7a60, parts: (c) => [
    ['body', 5, 4, 8, [-2.5, 0, -4], [0, 1, 0], solidFn(c.col, c.belly)],
    ['head', 3, 3, 3, [-1.5, 0, -3], [0, 5, -3], headSolid(0x2a5a3a, 0x111111, 2, 3)],
    ['beak', 2, 1, 2, [-1, 0, -2], [0, 5, -6], solidFn(0xd0a020)],
    ['wingL', 1, 3, 5, [0, -3, -2.5], [2.5, 5, 0], solidFn(shade(c.col, 0.85))], ['wingR', 1, 3, 5, [-1, -3, -2.5], [-2.5, 5, 0], solidFn(shade(c.col, 0.85))],
  ] },
  crow: { px: 0.06, col: 0x18181c, belly: 0x222228, parts: (c) => [
    ['body', 4, 4, 7, [-2, 0, -3.5], [0, 3, 0], solidFn(c.col, c.belly)],
    ['head', 3, 3, 3, [-1.5, 0, -3], [0, 6, -3], headSolid(c.col, 0x8a7a20, 1, 3)],
    ['beak', 1, 1, 2, [-0.5, 0, -2], [0, 6.5, -6], solidFn(0x2a2a2a)],
    ['tail', 3, 1, 3, [-1.5, 0, 0], [0, 4, 3.5], solidFn(c.col)],
    ['wingL', 6, 1, 4, [0, 0, -2], [2, 6, 0], solidFn(shade(c.col, 1.2))], ['wingR', 6, 1, 4, [-6, 0, -2], [-2, 6, 0], solidFn(shade(c.col, 1.2))],
    ['legFL', 1, 3, 1, [0, -3, 0], [1, 3, 0], solidFn(0x2a2a2a)], ['legFR', 1, 3, 1, [-1, -3, 0], [-1, 3, 0], solidFn(0x2a2a2a)],
  ] },
  cat: { px: 0.06, col: 0x8a6a4a, belly: 0xd0b890, parts: (c) => [
    ['body', 5, 5, 10, [-2.5, 0, -5], [0, 5, 0], solidFn(c.col, c.belly, null, (f, u, v) => (f === 'top' && v % 3 === 0 ? 0x5a4a3a : undefined))],
    ['head', 5, 5, 4, [-2.5, 0, -4], [0, 8, -5], headSolid(c.col, 0x60a040, 2, 5, 0xd09090)],
    ['earL', 1, 2, 1, [0, 0, 0], [2, 13, -7], solidFn(c.col)], ['earR', 1, 2, 1, [-1, 0, 0], [-2, 13, -7], solidFn(c.col)],
    ['tail', 1, 1, 8, [-0.5, 0, 0], [0, 9, 5], solidFn(c.col)],
    ['legFL', 1, 5, 1, [0, -5, 0], [1, 5, -4], solidFn(c.col)], ['legFR', 1, 5, 1, [-1, -5, 0], [-1, 5, -4], solidFn(c.col)],
    ['legBL', 1, 5, 1, [0, -5, 0], [1, 5, 4], solidFn(c.col)], ['legBR', 1, 5, 1, [-1, -5, 0], [-1, 5, 4], solidFn(c.col)],
  ] },
};
ANIMALS.dog = { ...ANIMALS.wolf, col: 0x8a6a3a, belly: 0xc8a878, px: 0.09 };
ANIMALS.plaguehound = { ...ANIMALS.wolf, col: 0x6a6070, belly: 0x8a7a8a, eye: 0xd0d040, px: 0.13 };
ANIMALS.grimtooth = { ...ANIMALS.bear, col: 0x3a2a20, belly: 0x2a201a, px: 0.22 };

export function buildAnimal(type) {
  const spec = ANIMALS[type];
  const c = { col: spec.col, belly: spec.belly, eye: spec.eye };
  const px = spec.px;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const parts = {};
  for (const [name, w, h, d, off, pivot, fn] of spec.parts(c)) {
    parts[name] = makePart(cachedBox(type + ':' + name, () => pixelBox(w, h, d, fn, px, off, name.length)), pivot, px);
    body.add(parts[name]);
  }
  // attach head extras to head so they move with it
  for (const n of ['snout', 'earL', 'earR', 'comb', 'beak', 'antL', 'antR', 'hornL', 'hornR', 'tuskL', 'tuskR']) {
    if (parts[n] && parts.head && n !== 'head') {
      const p = parts[n];
      body.remove(p);
      p.position.sub(parts.head.position);
      parts.head.add(p);
    }
  }
  if (parts.neck && parts.head) { body.remove(parts.head); parts.head.position.sub(parts.neck.position); parts.neck.add(parts.head); }
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { kind: type === 'crow' || type === 'chicken' || type === 'duck' ? 'bird' : 'quad', type, root, body, parts, px };
}

// ------------------------------------------------------------------
// Animation
// ------------------------------------------------------------------
// st: {speed, phase, attack (0..1 or -1), attackType, block, hurt, dead, deadT, swim, sit, talk, look}
export function animate(rig, st, dt) {
  const P = rig.parts;
  if (rig.kind === 'human') {
    const sp = Math.min(1.4, st.speed / 6);
    const sw = Math.sin(st.phase) * 0.75 * sp;
    P.legL.rotation.x = sw; P.legR.rotation.x = -sw;
    const breathe = Math.sin(st.time * 2) * 0.02;
    P.armL.rotation.x = -sw * 0.8 + breathe; P.armR.rotation.x = sw * 0.8 - breathe;
    P.armL.rotation.z = 0.06; P.armR.rotation.z = -0.06;
    P.torso.rotation.set(0, 0, 0);
    P.head.rotation.set(st.look || 0, st.headYaw || 0, 0);
    rig.body.position.y = Math.abs(Math.cos(st.phase)) * 0.06 * sp;
    if (P.cape) P.cape.rotation.x = 0.1 + sp * 0.35 + Math.sin(st.time * 3) * 0.04;
    if (st.sit) { P.legL.rotation.x = -1.5; P.legR.rotation.x = -1.5; rig.body.position.y = -0.75; }
    if (st.work) { const w = Math.sin(st.time * 5); P.armR.rotation.x = -1.2 + w * 0.6; P.armL.rotation.x = -0.6; }
    if (st.talk) { P.armR.rotation.x = -0.3 + Math.sin(st.time * 2.3) * 0.25; P.head.rotation.x += Math.sin(st.time * 4) * 0.03; }
    if (st.block) { P.armL.rotation.x = -1.3; P.armL.rotation.z = -0.5; P.armR.rotation.x = -0.9; P.armR.rotation.z = 0.3; }
    if (st.aim) { P.armL.rotation.x = -1.55; P.armR.rotation.x = -1.4; P.armR.rotation.z = 0.5; }
    if (st.attack >= 0) {
      const t = st.attack;
      if (st.attackType === 'overhead' || st.attackType === 'heavy') {
        const raise = t < 0.45 ? t / 0.45 : 1 - (t - 0.45) / 0.55;
        P.armR.rotation.x = -2.9 * raise + (t > 0.45 ? 0.6 * (1 - raise) : 0) - 0.2;
        P.torso.rotation.x = t > 0.45 ? 0.25 * (1 - raise) : -0.1 * raise;
      } else {
        const wind = t < 0.4 ? t / 0.4 : 1;
        const strike = t < 0.4 ? 0 : (t - 0.4) / 0.6;
        P.armR.rotation.x = -1.4 * wind;
        P.armR.rotation.z = -0.9 * wind + 1.8 * strike;
        P.torso.rotation.y = 0.5 * wind - 1.0 * strike;
      }
    }
    if (st.hurt > 0) { P.torso.rotation.x -= st.hurt * 0.4; P.head.rotation.x -= st.hurt * 0.3; }
  } else if (rig.kind === 'quad') {
    const sp = Math.min(1.5, st.speed / 5);
    const sw = Math.sin(st.phase) * 0.7 * sp;
    if (P.legFL) { P.legFL.rotation.x = sw; P.legBR.rotation.x = sw; P.legFR.rotation.x = -sw; P.legBL.rotation.x = -sw; }
    rig.body.position.y = Math.abs(Math.sin(st.phase)) * 0.05 * sp;
    if (P.head) { P.head.rotation.x = (st.graze ? 0.9 : 0) + (st.look || 0); P.head.rotation.y = st.headYaw || 0; }
    if (P.tail) P.tail.rotation.y = Math.sin(st.time * (st.speed > 1 ? 10 : 3)) * 0.4;
    if (P.tail) P.tail.rotation.x = 0.3;
    if (st.attack >= 0 && P.head) {
      const t = st.attack;
      const lunge = t < 0.5 ? t / 0.5 : 1 - (t - 0.5) / 0.5;
      P.head.rotation.x = -0.5 * lunge + (rig.type === 'bear' || rig.type === 'grimtooth' ? 0 : 0.2);
      rig.body.position.z = -lunge * 0.4;
      if (rig.type === 'bear' || rig.type === 'grimtooth') { rig.body.rotation.x = -lunge * 0.6; P.legFL.rotation.x = -lunge * 1.6; P.legFR.rotation.x = -lunge * 1.2; }
    } else { rig.body.position.z = 0; if (!st.dead) rig.body.rotation.x = st.rear ? -0.7 : 0; }
    if (st.hurt > 0) rig.body.rotation.z = Math.sin(st.time * 40) * 0.05 * st.hurt;
  } else if (rig.kind === 'bird') {
    const fly = st.fly ? 1 : 0;
    const flap = Math.sin(st.time * (fly ? 22 : 4)) * (fly ? 0.9 : 0.05);
    if (P.wingL) { P.wingL.rotation.z = flap + (fly ? 0 : 0.05); P.wingR.rotation.z = -flap - (fly ? 0 : 0.05); }
    if (P.legFL) { const s = Math.sin(st.phase) * 0.6 * Math.min(1, st.speed / 2); P.legFL.rotation.x = s; P.legFR.rotation.x = -s; }
    if (P.head) P.head.rotation.x = st.peck ? Math.max(0, Math.sin(st.time * 6)) * 0.8 : 0;
    rig.body.position.y = fly ? 0 : Math.abs(Math.sin(st.phase)) * 0.03;
  }
  if (st.dead) {
    const k = Math.min(1, st.deadT * 2.5);
    rig.body.rotation.z = (k * k) * Math.PI / 2 * (rig.kind === 'human' ? 1 : 1);
    rig.body.position.y = rig.kind === 'human' ? k * 0.35 : 0;
  }
}
