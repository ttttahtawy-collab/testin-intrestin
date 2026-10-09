// Builds pixel-textured box parts (Minecraft-like character parts) and
// box-list shapes for items.
import * as THREE from 'three';
import { hash3 } from '../core/noise.js';

const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const cache = new Map();
export function hexLin(h) {
  let v = cache.get(h);
  if (!v) { v = [lin((h >> 16) & 255), lin((h >> 8) & 255), lin(h & 255)]; cache.set(h, v); }
  return v;
}

export const charMat = new THREE.MeshLambertMaterial({ vertexColors: true });
export const charMatEmissive = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xffaa55, emissiveIntensity: 0.0 });

const FACE_DEF = {
  // name: [normal, origin corner fn, u axis, v axis]
  front: { n: [0, 0, -1], shade: 0.92 },
  back: { n: [0, 0, 1], shade: 0.8 },
  left: { n: [-1, 0, 0], shade: 0.85 },
  right: { n: [1, 0, 0], shade: 0.85 },
  top: { n: [0, 1, 0], shade: 1.0 },
  bottom: { n: [0, -1, 0], shade: 0.6 },
};

// Box of w*h*d pixels, each surface pixel colored by fn(face,u,v) -> hex.
// offset = position of the box's min corner in pixel units relative to the pivot.
export function pixelBox(w, h, d, fn, px, offset = [0, 0, 0], seed = 1) {
  const pos = [], nrm = [], col = [], idx = [];
  let vi = 0;
  const ox = offset[0] * px, oy = offset[1] * px, oz = offset[2] * px;
  const quad = (p0, p1, p2, p3, n, c) => {
    pos.push(...p0, ...p1, ...p2, ...p3);
    for (let k = 0; k < 4; k++) { nrm.push(...n); col.push(...c); }
    idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
    vi += 4;
  };
  const colorOf = (face, u, v) => {
    const hx = fn(face, u, v);
    if (hx === null || hx === undefined) return null;
    const c = hexLin(hx);
    const m = (0.94 + hash3(u * 7 + seed, v * 13, face.length * 5, seed) * 0.12) * FACE_DEF[face].shade;
    return [c[0] * m, c[1] * m, c[2] * m];
  };
  const X = (i) => ox + i * px, Y = (j) => oy + j * px, Z = (k) => oz + k * px;
  // front (-z): u along +x, v along +y; viewer sees u=0 on their left? we define u from the model's right(-x) to left for front view
  for (let u = 0; u < w; u++) for (let v = 0; v < h; v++) {
    const c = colorOf('front', u, v); if (!c) continue;
    const x0 = X(w - 1 - u), x1 = X(w - u);
    quad([x0, Y(v), Z(0)], [x0, Y(v + 1), Z(0)], [x1, Y(v + 1), Z(0)], [x1, Y(v), Z(0)], [0, 0, -1], c);
  }
  for (let u = 0; u < w; u++) for (let v = 0; v < h; v++) {
    const c = colorOf('back', u, v); if (!c) continue;
    const x0 = X(u), x1 = X(u + 1);
    quad([x1, Y(v), Z(d)], [x1, Y(v + 1), Z(d)], [x0, Y(v + 1), Z(d)], [x0, Y(v), Z(d)], [0, 0, 1], c);
  }
  for (let u = 0; u < d; u++) for (let v = 0; v < h; v++) {
    const c = colorOf('left', u, v); if (!c) continue; // -x side, u from front to back
    quad([X(0), Y(v), Z(u + 1)], [X(0), Y(v + 1), Z(u + 1)], [X(0), Y(v + 1), Z(u)], [X(0), Y(v), Z(u)], [-1, 0, 0], c);
  }
  for (let u = 0; u < d; u++) for (let v = 0; v < h; v++) {
    const c = colorOf('right', u, v); if (!c) continue;
    quad([X(w), Y(v), Z(u)], [X(w), Y(v + 1), Z(u)], [X(w), Y(v + 1), Z(u + 1)], [X(w), Y(v), Z(u + 1)], [1, 0, 0], c);
  }
  for (let u = 0; u < w; u++) for (let v = 0; v < d; v++) {
    const c = colorOf('top', u, v); if (!c) continue; // v from front to back
    quad([X(u), Y(h), Z(v)], [X(u), Y(h), Z(v + 1)], [X(u + 1), Y(h), Z(v + 1)], [X(u + 1), Y(h), Z(v)], [0, 1, 0], c);
  }
  for (let u = 0; u < w; u++) for (let v = 0; v < d; v++) {
    const c = colorOf('bottom', u, v); if (!c) continue;
    quad([X(u), Y(0), Z(v)], [X(u + 1), Y(0), Z(v)], [X(u + 1), Y(0), Z(v + 1)], [X(u), Y(0), Z(v + 1)], [0, -1, 0], c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// Box-list shape: boxes = [[x0,y0,z0,x1,y1,z1,hex], ...] in pixel units
export function boxShape(boxes, px, center = [0, 0, 0]) {
  const pos = [], nrm = [], col = [], idx = [];
  let vi = 0;
  for (const [x0, y0, z0, x1, y1, z1, hx, emis] of boxes) {
    const c = hexLin(hx);
    const a = [(x0 - center[0]) * px, (y0 - center[1]) * px, (z0 - center[2]) * px];
    const b = [(x1 - center[0]) * px, (y1 - center[1]) * px, (z1 - center[2]) * px];
    const faces = [
      [[b[0], a[1], a[2]], [b[0], b[1], a[2]], [b[0], b[1], b[2]], [b[0], a[1], b[2]], [1, 0, 0], 0.85],
      [[a[0], a[1], b[2]], [a[0], b[1], b[2]], [a[0], b[1], a[2]], [a[0], a[1], a[2]], [-1, 0, 0], 0.85],
      [[a[0], b[1], a[2]], [a[0], b[1], b[2]], [b[0], b[1], b[2]], [b[0], b[1], a[2]], [0, 1, 0], 1.0],
      [[a[0], a[1], a[2]], [b[0], a[1], a[2]], [b[0], a[1], b[2]], [a[0], a[1], b[2]], [0, -1, 0], 0.6],
      [[b[0], a[1], b[2]], [b[0], b[1], b[2]], [a[0], b[1], b[2]], [a[0], a[1], b[2]], [0, 0, 1], 0.9],
      [[a[0], a[1], a[2]], [a[0], b[1], a[2]], [b[0], b[1], a[2]], [b[0], a[1], a[2]], [0, 0, -1], 0.9],
    ];
    for (const [p0, p1, p2, p3, n, s] of faces) {
      pos.push(...p0, ...p1, ...p2, ...p3);
      const m = emis ? 3 : s;
      for (let k = 0; k < 4; k++) { nrm.push(...n); col.push(c[0] * m, c[1] * m, c[2] * m); }
      idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
      vi += 4;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// A rig is a tree of named pivot groups.
export function makePart(geom, pivot, px, mat = charMat) {
  const g = new THREE.Group();
  g.position.set(pivot[0] * px, pivot[1] * px, pivot[2] * px);
  const m = new THREE.Mesh(geom, mat);
  m.castShadow = true;
  g.add(m);
  g.userData.mesh = m;
  return g;
}
