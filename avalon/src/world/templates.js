// Procedural voxel templates for trees, bushes and rocks. Each template is a
// compact list of relative voxels that the world stamps into chunks on demand.
import { B } from './blocks.js';
import { rng } from '../core/noise.js';

class Tpl {
  constructor() { this.m = new Map(); }
  set(x, y, z, b, force = true) {
    const k = ((x + 512) << 20) | ((y + 64) << 10) | (z + 512);
    if (!force && this.m.has(k)) return;
    this.m.set(k, b);
  }
  has(x, y, z) { return this.m.has(((x + 512) << 20) | ((y + 64) << 10) | (z + 512)); }
  blob(cx, cy, cz, rx, ry, rz, b, r, holes = 0.0, force = false) {
    for (let x = Math.floor(-rx); x <= rx; x++)
      for (let y = Math.floor(-ry); y <= ry; y++)
        for (let z = Math.floor(-rz); z <= rz; z++) {
          const d = (x * x) / (rx * rx) + (y * y) / (ry * ry) + (z * z) / (rz * rz);
          if (d > 1 + (r() - 0.5) * 0.35) continue;
          if (holes && d > 0.55 && r() < holes) continue;
          this.set(Math.round(cx + x), Math.round(cy + y), Math.round(cz + z), b, force);
        }
  }
  line(x0, y0, z0, x1, y1, z1, b, thick = 0) {
    const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0))) + 1;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t), z = Math.round(z0 + (z1 - z0) * t);
      this.set(x, y, z, b);
      if (thick) { this.set(x + 1, y, z, b); this.set(x, y, z + 1, b); this.set(x + 1, y, z + 1, b); }
    }
  }
  finish() {
    const n = this.m.size;
    const pos = new Int16Array(n * 3);
    const blk = new Uint8Array(n);
    let i = 0, minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9, maxy = -1e9, miny = 1e9;
    for (const [k, b] of this.m) {
      const x = (k >> 20) - 512, y = ((k >> 10) & 1023) - 64, z = (k & 1023) - 512;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; blk[i] = b; i++;
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (z < minz) minz = z; if (z > maxz) maxz = z;
      if (y > maxy) maxy = y; if (y < miny) miny = y;
    }
    return { pos, blk, n, minx, maxx, minz, maxz, miny, maxy };
  }
}

function oak(seed, big = false, leaves = B.LEAVES_OAK, log = B.LOG) {
  const r = rng(seed); const t = new Tpl();
  const h = big ? r.int(11, 15) : r.int(7, 10);
  const thick = big || r() < 0.3;
  for (let y = -2; y < h; y++) {
    t.set(0, y, 0, log); if (thick) { t.set(1, y, 0, log); t.set(0, y, 1, log); t.set(1, y, 1, log); }
  }
  // roots
  if (thick) for (const [dx, dz] of [[-1, 0], [2, 1], [0, -1], [1, 2]]) { t.set(dx, 0, dz, log); if (r() < 0.5) t.set(dx, 1, dz, log); }
  const nb = r.int(3, 5);
  const crowns = [[0.5, h + 1, 0.5, big ? 5.5 : 4]];
  for (let i = 0; i < nb; i++) {
    const a = r() * Math.PI * 2, len = r.range(2.5, big ? 6 : 4.5), sy = r.int(Math.floor(h * 0.55), h - 1);
    const ex = Math.cos(a) * len, ez = Math.sin(a) * len, ey = sy + r.range(1.5, 3.5);
    t.line(0, sy, 0, ex, ey, ez, log);
    crowns.push([ex, ey + 1, ez, r.range(big ? 3.5 : 2.5, big ? 4.8 : 3.6)]);
  }
  for (const [x, y, z, rad] of crowns) t.blob(x, y, z, rad, rad * 0.75, rad, leaves, r, 0.1);
  return t.finish();
}

function pine(seed, snow = false) {
  const r = rng(seed); const t = new Tpl();
  const h = r.int(14, 22);
  for (let y = -2; y < h; y++) t.set(0, y, 0, B.PINE_LOG);
  const y0 = Math.floor(h * 0.25);
  const rad0 = r.range(4.2, 5.8);
  const layers = Math.ceil((h + 2 - y0) / 2);
  for (let L = 0; L < layers; L++) {
    const y = y0 + L * 2;
    const rad = 0.8 + rad0 * (1 - L / layers) ** 1.1;
    for (let ly = 0; ly < 2; ly++) {
      const rr = rad - ly * 1.1;
      if (rr < 0.5) { t.set(0, y + ly, 0, B.LEAVES_PINE); continue; }
      for (let x = -Math.ceil(rr); x <= rr; x++) for (let z = -Math.ceil(rr); z <= rr; z++) {
        const d = Math.sqrt(x * x + z * z);
        if (d > rr + (r() - 0.5) * 0.8) continue;
        const b = snow && ly === 1 && r() < 0.8 ? B.SNOW : B.LEAVES_PINE;
        t.set(x, y + ly, z, b);
      }
    }
  }
  t.set(0, h + 2, 0, snow ? B.SNOW : B.LEAVES_PINE);
  return t.finish();
}

function birch(seed) {
  const r = rng(seed); const t = new Tpl();
  const h = r.int(9, 13);
  for (let y = -2; y < h; y++) t.set(0, y, 0, B.BIRCH_LOG);
  t.blob(0, h, 0, 3.2, 3.8, 3.2, B.LEAVES_BIRCH, r, 0.12);
  t.blob(r.range(-2, 2), h - 3, r.range(-2, 2), 2.5, 2, 2.5, B.LEAVES_BIRCH, r, 0.12);
  return t.finish();
}

function deadTree(seed) {
  const r = rng(seed); const t = new Tpl();
  const h = r.int(8, 14);
  let x = 0, z = 0;
  for (let y = -2; y < h; y++) { t.set(Math.round(x), y, Math.round(z), B.PINE_LOG); x += r.range(-0.3, 0.3); z += r.range(-0.3, 0.3); }
  const nb = r.int(3, 6);
  for (let i = 0; i < nb; i++) {
    const a = r() * Math.PI * 2, len = r.range(2, 5), sy = r.int(Math.floor(h * 0.4), h - 1);
    t.line(0, sy, 0, Math.cos(a) * len, sy + r.range(1, 4), Math.sin(a) * len, B.PINE_LOG);
  }
  return t.finish();
}

function willow(seed) {
  const r = rng(seed); const t = new Tpl();
  const h = r.int(8, 11);
  for (let y = -2; y < h; y++) { t.set(0, y, 0, B.LOG); t.set(1, y, 0, B.LOG); }
  t.blob(0.5, h + 1, 0, 5, 2.5, 5, B.LEAVES_DARK, r, 0.2);
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2, d = r.range(3, 5.5);
    const x = Math.round(Math.cos(a) * d), z = Math.round(Math.sin(a) * d);
    const len = r.int(3, 7);
    for (let y = 0; y < len; y++) t.set(x, h - y, z, B.LEAVES_DARK, false);
  }
  return t.finish();
}

function bush(seed, b = B.BUSH) {
  const r = rng(seed); const t = new Tpl();
  const rad = r.range(1.2, 2.2);
  t.blob(0, rad * 0.6, 0, rad, rad * 0.8, rad, b, r, 0.1, true);
  return t.finish();
}

function rock(seed, big = false, mossy = false) {
  const r = rng(seed); const t = new Tpl();
  const rad = big ? r.range(3, 5) : r.range(1.2, 2.5);
  const n = big ? 3 : 2;
  for (let i = 0; i < n; i++) {
    const ox = r.range(-rad * 0.5, rad * 0.5), oz = r.range(-rad * 0.5, rad * 0.5);
    t.blob(ox, rad * 0.3, oz, rad * r.range(0.7, 1.1), rad * r.range(0.6, 0.9), rad * r.range(0.7, 1.1), r() < 0.5 ? B.STONE : B.GRANITE, r, 0, true);
  }
  if (mossy) {
    // moss on top surfaces
    const top = new Map();
    for (const [k] of t.m) {
      const x = (k >> 20) - 512, y = ((k >> 10) & 1023) - 64, z = (k & 1023) - 512;
      const kk = x + ',' + z;
      if (!top.has(kk) || top.get(kk) < y) top.set(kk, y);
    }
    for (const [kk, y] of top) {
      const [x, z] = kk.split(',').map(Number);
      if (r() < 0.75) t.set(x, y, z, B.ROCK_MOSSY);
    }
  }
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if (t.has(x, 0, z)) { t.set(x, -1, z, B.STONE); t.set(x, -2, z, B.STONE); }
  return t.finish();
}

function giantBlossom(seed) {
  const r = rng(seed); const t = new Tpl();
  const h = 18;
  for (let y = -3; y < h; y++) {
    const tw = Math.sin(y * 0.25) * 1.5;
    for (let dx = 0; dx < 3; dx++) for (let dz = 0; dz < 3; dz++) t.set(Math.round(dx + tw), y, dz, B.LOG);
  }
  for (const [dx, dz] of [[-3, 1], [5, 1], [1, -3], [1, 5], [-2, -2], [4, 4]]) t.line(1, 4, 1, dx, -1, dz, B.LOG, 1);
  const branches = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r() * 0.5, len = r.range(7, 11), sy = r.int(10, 16);
    const ex = Math.cos(a) * len + 1, ez = Math.sin(a) * len + 1, ey = sy + r.range(3, 6);
    t.line(1, sy, 1, ex, ey, ez, B.LOG, 1);
    branches.push([ex, ey + 1, ez]);
  }
  t.blob(1, h + 3, 1, 8, 5, 8, B.LEAVES_PURPLE, r, 0.2);
  for (const [x, y, z] of branches) t.blob(x, y, z, r.range(4, 6), r.range(2.5, 3.5), r.range(4, 6), B.LEAVES_PURPLE, r, 0.25);
  return t.finish();
}

export const TPL = {};
export function buildTemplates() {
  const mk = (name, n, fn) => { TPL[name] = []; for (let i = 0; i < n; i++) TPL[name].push(fn(1000 + i * 7919 + name.length * 31)); };
  mk('oak', 10, (s) => oak(s));
  mk('oakBig', 6, (s) => oak(s, true));
  mk('darkOak', 8, (s) => oak(s, true, B.LEAVES_DARK, B.LOG));
  mk('pine', 10, (s) => pine(s));
  mk('pineSnow', 8, (s) => pine(s, true));
  mk('birch', 8, (s) => birch(s));
  mk('dead', 8, (s) => deadTree(s));
  mk('willow', 5, (s) => willow(s));
  mk('bush', 8, (s) => bush(s));
  mk('berry', 4, (s) => bush(s, B.BERRY_BUSH));
  mk('rock', 10, (s) => rock(s));
  mk('rockMossy', 8, (s) => rock(s, false, true));
  mk('boulder', 6, (s) => rock(s, true, true));
  mk('blossom', 1, (s) => giantBlossom(s));
  return TPL;
}
