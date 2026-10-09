// Chunk mesher: face culling, per-vertex ambient occlusion, sky occlusion,
// per-voxel color variation & patterns, plus small geometry for plants.
import { KIND, OPAQUE, COLORS, VARIATION, EMIT, SWAY, PATTERN, SHAPE, B } from '../world/blocks.js';
import { CS, H, WX, WZ, NCX, NCZ } from '../world/world.js';
import { hash3 } from '../core/noise.js';

const P = CS + 2; // padded width
const PP = P * P;
const PH = H + 2;
const pad = new Uint8Array(PP * PH);
const topOpaque = new Int16Array(PP);

// Face tables: dir, normal, corners
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], ci: 1 },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], ci: 1 },
  { n: [0, 1, 0], c: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], ci: 0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], ci: 2 },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], ci: 1 },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], ci: 1 },
];
const off = (x, y, z) => y * PP + z * P + x;
for (const f of FACES) {
  f.o = off(f.n[0], f.n[1], f.n[2]);
  f.ao = f.c.map((c) => {
    // tangent offsets: for each axis that isn't the normal axis, -1 if corner coord 0 else +1
    const t = [0, 0, 0].map((_, a) => (f.n[a] !== 0 ? 0 : c[a] === 0 ? -1 : 1));
    const axes = [0, 1, 2].filter((a) => f.n[a] === 0);
    const s1 = [0, 0, 0], s2 = [0, 0, 0];
    s1[axes[0]] = t[axes[0]]; s2[axes[1]] = t[axes[1]];
    return [off(...s1) + f.o, off(...s2) + f.o, off(t[0], t[1], t[2]) + f.o];
  });
}
const TRANSLUCENT = new Float32Array(256);
for (const b of [B.CLOTH_WHITE, B.CLOTH_RED, B.CLOTH_BLUE, B.CLOTH_GREEN, B.CLOTH_YELLOW, B.WOOL_GREY]) TRANSLUCENT[b] = 0.75;
for (const b of [B.LEAVES_OAK, B.LEAVES_PINE, B.LEAVES_BIRCH, B.LEAVES_DARK, B.LEAVES_PURPLE, B.BUSH, B.BERRY_BUSH, B.HEDGE]) TRANSLUCENT[b] = 0.55;
for (const b of [B.GLASS_LIT, B.GLASS_DARK, B.LANTERN]) TRANSLUCENT[b] = 0.6;
const AO_CURVE = [0.42, 0.62, 0.82, 1.0];
const FACE_SHADE = [0.9, 0.9, 1.0, 0.65, 0.85, 0.85];

class Buf {
  constructor(n = 1 << 18) {
    this.pos = new Float32Array(n * 3); this.nrm = new Int8Array(n * 3);
    this.col = new Uint8Array(n * 4); this.flg = new Uint8Array(n * 4);
    this.idx = new Uint32Array(n * 1.5); this.v = 0; this.i = 0;
  }
  reset() { this.v = 0; this.i = 0; }
  ensure(nv) {
    if (this.v + nv < this.pos.length / 3 - 4) return;
    const grow = (a, k) => { const b = new a.constructor(a.length * 2); b.set(a); return b; };
    this.pos = grow(this.pos); this.nrm = grow(this.nrm); this.col = grow(this.col); this.flg = grow(this.flg); this.idx = grow(this.idx);
  }
  vert(x, y, z, nx, ny, nz, r, g, b, emit, sway, sky) {
    const v = this.v, p = v * 3, q = v * 4;
    this.pos[p] = x; this.pos[p + 1] = y; this.pos[p + 2] = z;
    this.nrm[p] = nx * 127; this.nrm[p + 1] = ny * 127; this.nrm[p + 2] = nz * 127;
    this.col[q] = r > 1 ? 255 : r * 255; this.col[q + 1] = g > 1 ? 255 : g * 255; this.col[q + 2] = b > 1 ? 255 : b * 255; this.col[q + 3] = 255;
    this.flg[q] = emit * 100; this.flg[q + 1] = sway * 255; this.flg[q + 2] = sky * 255; this.flg[q + 3] = 0;
    this.v++;
  }
  quad(flip) {
    const v = this.v - 4, ix = this.idx;
    if (this.i + 6 > ix.length) { const b = new Uint32Array(ix.length * 2); b.set(ix); this.idx = b; }
    const I = this.idx;
    if (flip) { I[this.i++] = v + 1; I[this.i++] = v + 2; I[this.i++] = v + 3; I[this.i++] = v + 1; I[this.i++] = v + 3; I[this.i++] = v; }
    else { I[this.i++] = v; I[this.i++] = v + 1; I[this.i++] = v + 2; I[this.i++] = v; I[this.i++] = v + 2; I[this.i++] = v + 3; }
  }
  out() {
    return {
      pos: this.pos.slice(0, this.v * 3), nrm: this.nrm.slice(0, this.v * 3),
      col: this.col.slice(0, this.v * 4), flg: this.flg.slice(0, this.v * 4),
      idx: this.idx.slice(0, this.i), count: this.v,
    };
  }
}
const SOL = new Buf();
const WAT = new Buf(1 << 15);
const DEC = new Buf(1 << 16);

import { GRASSY } from '../world/world.js';
function patch(x, z) {
  const fx = x / 7, fz = z / 7, ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
  const a = hash3(ix, 0, iz, 21), b = hash3(ix + 1, 0, iz, 21), c = hash3(ix, 0, iz + 1, 21), d = hash3(ix + 1, 0, iz + 1, 21);
  const sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
  return 0.84 + ((a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz) * 0.3;
}
function patternMul(pat, x, y, z, b) {
  switch (pat) {
    case 'brick': {
      const ox = (y & 1) ? 1 : 0;
      return 0.86 + hash3((x + ox) >> 1, y, (z + ox) >> 1, 7) * 0.26;
    }
    case 'cobble': return 0.75 + hash3(x, y, z, 3) * 0.4;
    case 'plank': return 0.85 + hash3(y, (x + z) >> 2, 0, 5) * 0.22;
    case 'shingle': return (y & 1) ? 0.82 : 1.05;
    case 'crate': return ((x + y + z) & 1) ? 0.9 : 1.05;
    case 'barrel': return (y % 3 === 0) ? 0.55 : 1.0;
    default: return 1;
  }
}

function hueBook(x, y, z) {
  const h = hash3(x, y, z, 11);
  if (h < 0.25) return [0.35, 0.05, 0.04];
  if (h < 0.5) return [0.06, 0.12, 0.25];
  if (h < 0.7) return [0.08, 0.2, 0.07];
  if (h < 0.85) return [0.4, 0.3, 0.12];
  return [0.18, 0.1, 0.06];
}

function emitBox(buf, x0, y0, z0, x1, y1, z1, r, g, b, emit, swayTop, sky) {
  buf.ensure(24);
  // +x
  const s = [0.85, 0.85, 1.0, 0.85, 0.85];
  const fc = (shade, nx, ny, nz, pts, top) => {
    for (let k = 0; k < 4; k++) {
      const p = pts[k];
      buf.vert(p[0], p[1], p[2], nx, ny, nz, r * shade, g * shade, b * shade, emit, p[1] > y0 + 0.01 ? swayTop * Math.min(1, (p[1] - y0) * 1.2) : 0, sky);
    }
    buf.quad(false);
  };
  fc(s[0], 1, 0, 0, [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]);
  fc(s[1], -1, 0, 0, [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]]);
  fc(s[2], 0, 1, 0, [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]]);
  fc(s[3], 0, 0, 1, [[x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1]]);
  fc(s[4], 0, 0, -1, [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]]);
}

function emitPlant(buf, b, below, wx, y, wz, lx, lz, sky) {
  const shape = SHAPE[b];
  const h = (k) => hash3(wx, y, wz, k);
  const base = COLORS[b][0];
  const X = lx, Z = lz;
  switch (shape) {
    case 'tuft': {
      const bc = KIND[below] === 1 ? COLORS[below][0] : base;
      const n = 2 + ((h(1) * 3) | 0);
      for (let i = 0; i < n; i++) {
        const px = X + 0.15 + h(10 + i) * 0.7, pz = Z + 0.15 + h(20 + i) * 0.7;
        const hh = 0.25 + h(30 + i) * 0.5, w = 0.05;
        const m = 0.9 + h(40 + i) * 0.3;
        emitBox(buf, px - w, y, pz - w, px + w, y + hh, pz + w, bc[0] * m, bc[1] * m, bc[2] * m, 0, 1, sky);
      }
      break;
    }
    case 'flower': {
      const px = X + 0.3 + h(1) * 0.4, pz = Z + 0.3 + h(2) * 0.4, hh = 0.45 + h(3) * 0.3;
      emitBox(buf, px - 0.05, y, pz - 0.05, px + 0.05, y + hh, pz + 0.05, 0.08, 0.2, 0.04, 0, 1, sky);
      emitBox(buf, px - 0.14, y + hh, pz - 0.14, px + 0.14, y + hh + 0.2, pz + 0.14, base[0], base[1], base[2], EMIT[b], 1, sky);
      if (h(4) < 0.5) {
        const qx = X + 0.2 + h(5) * 0.6, qz = Z + 0.2 + h(6) * 0.6;
        emitBox(buf, qx - 0.06, y, qz - 0.06, qx + 0.06, y + 0.25, qz + 0.06, 0.06, 0.18, 0.04, 0, 1, sky);
      }
      break;
    }
    case 'crop': {
      for (let i = 0; i < 4; i++) {
        const px = X + 0.2 + (i & 1) * 0.5 + h(i) * 0.1, pz = Z + 0.2 + (i >> 1) * 0.5 + h(i + 5) * 0.1;
        const hh = 0.8 + h(i + 9) * 0.4;
        emitBox(buf, px - 0.05, y, pz - 0.05, px + 0.05, y + hh, pz + 0.05, base[0] * 0.8, base[1] * 0.8, base[2] * 0.6, 0, 1, sky);
        emitBox(buf, px - 0.08, y + hh, pz - 0.08, px + 0.08, y + hh + 0.25, pz + 0.08, base[0], base[1], base[2], 0, 1, sky);
      }
      break;
    }
    case 'reed': {
      for (let i = 0; i < 3; i++) {
        const px = X + 0.2 + h(i) * 0.6, pz = Z + 0.2 + h(i + 3) * 0.6, hh = 1.0 + h(i + 6) * 0.9;
        emitBox(buf, px - 0.05, y, pz - 0.05, px + 0.05, y + hh, pz + 0.05, base[0], base[1], base[2], 0, 1, sky);
        if (i === 0) emitBox(buf, px - 0.08, y + hh - 0.35, pz - 0.08, px + 0.08, y + hh, pz + 0.08, 0.18, 0.09, 0.03, 0, 1, sky);
      }
      break;
    }
    case 'fern': {
      const cx = X + 0.5, cz = Z + 0.5, hh = 0.35 + h(1) * 0.2;
      emitBox(buf, cx - 0.45, y + hh * 0.5, cz - 0.08, cx + 0.45, y + hh, cz + 0.08, base[0], base[1], base[2], 0, 1, sky);
      emitBox(buf, cx - 0.08, y + hh * 0.5, cz - 0.45, cx + 0.08, y + hh, cz + 0.45, base[0] * 0.9, base[1] * 0.9, base[2] * 0.9, 0, 1, sky);
      emitBox(buf, cx - 0.06, y, cz - 0.06, cx + 0.06, y + hh, cz + 0.06, base[0] * 0.7, base[1] * 0.7, base[2] * 0.7, 0, 1, sky);
      break;
    }
    case 'mushroom': {
      const px = X + 0.3 + h(1) * 0.4, pz = Z + 0.3 + h(2) * 0.4, hh = 0.18 + h(3) * 0.15;
      emitBox(buf, px - 0.06, y, pz - 0.06, px + 0.06, y + hh, pz + 0.06, 0.7, 0.65, 0.55, 0, 0, sky);
      emitBox(buf, px - 0.18, y + hh, pz - 0.18, px + 0.18, y + hh + 0.12, pz + 0.18, base[0], base[1], base[2], EMIT[b], 0, sky);
      break;
    }
    default: break;
  }
}

// Build mesh data for chunk (cx, cz). Returns {solid, water}
export function meshChunk(world, cx, cz) {
  // gather 3x3 neighbourhood
  const chunks = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const nx = cx + dx, nz = cz + dz;
    chunks.push(nx >= 0 && nz >= 0 && nx < NCX && nz < NCZ ? world.getChunk(nx, nz) : null);
  }
  // fill padded array
  pad.fill(0);
  let ymax = 0;
  for (let z = -1; z <= CS; z++) {
    const czi = z < 0 ? 0 : z >= CS ? 2 : 1, lz = (z + CS) & 31;
    for (let x = -1; x <= CS; x++) {
      const cxi = x < 0 ? 0 : x >= CS ? 2 : 1, lx = (x + CS) & 31;
      const src = chunks[czi * 3 + cxi];
      const pcol = (z + 1) * P + (x + 1);
      if (!src) { for (let y = 0; y < H; y++) pad[(y + 1) * PP + pcol] = y < 30 ? B.WATER : 0; topOpaque[pcol] = -1; continue; }
      const scol = (lz << 5) | lx;
      let top = -1;
      for (let y = 0; y < H; y++) {
        const v = src[(y << 10) | scol];
        if (v) { pad[(y + 1) * PP + pcol] = v; if (OPAQUE[v]) top = y; if (y > ymax && cxi === 1 && czi === 1) ymax = y; }
      }
      pad[pcol] = B.STONE; // below world
      topOpaque[pcol] = top;
    }
  }
  // lowest y with any non-opaque voxel in padded area
  let ymin = H;
  for (let pc = 0; pc < PP; pc++) {
    for (let y = 0; y < H; y++) { if (!OPAQUE[pad[(y + 1) * PP + pc]]) { if (y < ymin) ymin = y; break; } }
  }
  ymin = Math.max(0, ymin - 1);

  SOL.reset(); WAT.reset(); DEC.reset();
  const ox = cx * CS, oz = cz * CS;
  for (let y = ymin; y <= ymax; y++) {
    for (let z = 0; z < CS; z++) {
      for (let x = 0; x < CS; x++) {
        const i = (y + 1) * PP + (z + 1) * P + (x + 1);
        const b = pad[i];
        if (!b) continue;
        const kind = KIND[b];
        const wx = ox + x, wz = oz + z;
        if (kind === 1) {
          const cols = COLORS[b];
          const vr = VARIATION[b];
          let m = 1 + (hash3(wx, y, wz) - 0.5) * 2 * vr;
          const pat = PATTERN[b];
          if (pat) m *= patternMul(pat, wx, y, wz, b);
          if (GRASSY[b]) m *= patch(wx, wz);
          let tint = null;
          if (pat === 'books') tint = hueBook(wx, y, wz);
          else if (pat === 'ore' && hash3(wx, y, wz, 9) < 0.25) tint = [0.7, 0.45, 0.12];
          else if (pat === 'berries' && hash3(wx, y, wz, 9) < 0.2) tint = [0.5, 0.03, 0.05];
          const emit = EMIT[b], sway = SWAY[b];
          for (let f = 0; f < 6; f++) {
            const F = FACES[f];
            const nb = pad[i + F.o];
            if (OPAQUE[nb]) continue;
            if (f === 3 && y === 0) continue;
            // sky: fraction of 3x3 columns around neighbour open above
            const ny = y + F.n[1];
            const pcx = x + 1 + F.n[0], pcz = z + 1 + F.n[2];
            let open = 0;
            for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
              const qx = pcx + dx, qz = pcz + dz;
              if (qx < 0 || qz < 0 || qx >= P || qz >= P) { open++; continue; }
              if (topOpaque[qz * P + qx] < ny) open++;
            }
            let sky = 0.18 + 0.82 * (open / 9);
            if (TRANSLUCENT[b] && sky < TRANSLUCENT[b]) sky = TRANSLUCENT[b];
            const c = tint || cols[F.ci];
            const shade = FACE_SHADE[f] * m;
            const ao0 = aoAt(i, F.ao[0]), ao1 = aoAt(i, F.ao[1]), ao2 = aoAt(i, F.ao[2]), ao3 = aoAt(i, F.ao[3]);
            const aos = [ao0, ao1, ao2, ao3];
            SOL.ensure(4);
            for (let k = 0; k < 4; k++) {
              const cc = F.c[k];
              const a = AO_CURVE[aos[k]] * shade;
              SOL.vert(wx + cc[0], y + cc[1], wz + cc[2], F.n[0], F.n[1], F.n[2], c[0] * a, c[1] * a, c[2] * a, emit, sway * (cc[1] ? 1 : 0.6), sky);
            }
            SOL.quad(ao0 + ao2 < ao1 + ao3);
          }
        } else if (kind === 3) {
          const below = pad[i - PP];
          let open = topOpaque[(z + 1) * P + (x + 1)] < y ? 1 : 0.3;
          emitPlant(DEC, b, below, wx, y, wz, wx, wz, open);
        } else if (kind === 2) {
          const above = pad[i + PP];
          // depth for color
          let depth = 0;
          for (let k = 1; k < 8; k++) { if (pad[i - k * PP] === B.WATER) depth++; else break; }
          const dcol = Math.min(1, depth / 6);
          if (above !== B.WATER && !OPAQUE[above]) {
            const yy = y + 0.85;
            WAT.ensure(4);
            WAT.vert(wx, yy, wz, 0, 1, 0, dcol, 0, 0, 0, 0, 1);
            WAT.vert(wx, yy, wz + 1, 0, 1, 0, dcol, 0, 0, 0, 0, 1);
            WAT.vert(wx + 1, yy, wz + 1, 0, 1, 0, dcol, 0, 0, 0, 0, 1);
            WAT.vert(wx + 1, yy, wz, 0, 1, 0, dcol, 0, 0, 0, 0, 1);
            WAT.quad(false);
          }
          // sides where neighbour is air (waterfalls, edges)
          for (let f = 0; f < 6; f++) {
            if (f === 2 || f === 3) continue;
            const F = FACES[f];
            const nb = pad[i + F.o];
            if (nb !== B.AIR && KIND[nb] !== 3) continue;
            const top = above === B.WATER ? 1 : 0.85;
            WAT.ensure(4);
            for (let k = 0; k < 4; k++) {
              const cc = F.c[k];
              WAT.vert(wx + cc[0], y + (cc[1] ? top : 0), wz + cc[2], F.n[0], F.n[1], F.n[2], 0.3, 1, 0, 0, 0, 1);
            }
            WAT.quad(false);
          }
        }
      }
    }
  }
  return { solid: SOL.out(), water: WAT.out(), deco: DEC.out(), ymin, ymax };
}

function aoAt(i, o) {
  const s1 = OPAQUE[pad[i + o[0]]], s2 = OPAQUE[pad[i + o[1]]], c = OPAQUE[pad[i + o[2]]];
  if (s1 && s2) return 0;
  return 3 - (s1 + s2 + c);
}

// ---------- coarse LOD meshing for distant terrain ----------
// Builds a downsampled mesh of a 64x64 super-chunk at scale S using heightmap,
// vegetation templates and override structures (sampled).
export function meshLOD(world, sx, sz, S = 4, BS = 64) {
  const N = BS / S; // cells per side
  const X0 = sx * BS, Z0 = sz * BS;
  const buf = SOL; buf.reset();
  const hgt = new Int16Array((N + 2) * (N + 2));
  const top = new Uint8Array((N + 2) * (N + 2));
  const wat = new Int16Array((N + 2) * (N + 2));
  for (let cz = -1; cz <= N; cz++) for (let cx = -1; cx <= N; cx++) {
    const x = Math.min(WX - 1, Math.max(0, X0 + cx * S + (S >> 1))), z = Math.min(WZ - 1, Math.max(0, Z0 + cz * S + (S >> 1)));
    const k = (cz + 1) * (N + 2) + (cx + 1);
    let hmax = 0, bsurf = 0, wl = 0;
    for (let dz = 0; dz < S; dz += 2) for (let dx = 0; dx < S; dx += 2) {
      const xx = Math.min(WX - 1, Math.max(0, X0 + cx * S + dx)), zz = Math.min(WZ - 1, Math.max(0, Z0 + cz * S + dz));
      const i = zz * WX + xx;
      if (world.height[i] >= hmax) { hmax = world.height[i]; bsurf = world.surf[i]; }
      if (world.water[i] > wl) wl = world.water[i];
    }
    hgt[k] = hmax; top[k] = bsurf; wat[k] = wl;
  }
  const C = (b, f) => COLORS[b][f];
  for (let cz = 0; cz < N; cz++) for (let cx = 0; cx < N; cx++) {
    const k = (cz + 1) * (N + 2) + (cx + 1);
    const h0 = hgt[k] + 1, x0 = X0 + cx * S, z0 = Z0 + cz * S;
    const c = C(top[k], 0), cs = C(top[k], 1);
    const m = 0.9 + hash3(x0, 0, z0) * 0.2;
    const sky = 1;
    buf.ensure(24);
    buf.vert(x0, h0, z0, 0, 1, 0, c[0] * m, c[1] * m, c[2] * m, 0, 0, sky);
    buf.vert(x0, h0, z0 + S, 0, 1, 0, c[0] * m, c[1] * m, c[2] * m, 0, 0, sky);
    buf.vert(x0 + S, h0, z0 + S, 0, 1, 0, c[0] * m, c[1] * m, c[2] * m, 0, 0, sky);
    buf.vert(x0 + S, h0, z0, 0, 1, 0, c[0] * m, c[1] * m, c[2] * m, 0, 0, sky);
    buf.quad(false);
    const nbs = [[1, 0, 0], [-1, 0, 1], [0, 1, 4], [0, -1, 5]];
    for (const [dx, dz, f] of nbs) {
      const nh = hgt[k + dz * (N + 2) + dx] + 1;
      if (nh >= h0) continue;
      const F = FACES[f];
      for (let q = 0; q < 4; q++) {
        const cc = F.c[q];
        buf.vert(x0 + cc[0] * S, cc[1] ? h0 : nh, z0 + cc[2] * S, F.n[0], 0, F.n[2], cs[0] * 0.8 * m, cs[1] * 0.8 * m, cs[2] * 0.8 * m, 0, 0, sky);
      }
      buf.quad(false);
    }
  }
  // vegetation + structures: sample 3D occupancy at S resolution from features and overrides
  const occ = new Map();
  const put = (x, y, z, b) => {
    const gx = Math.floor((x - X0) / S), gz = Math.floor((z - Z0) / S), gy = Math.floor(y / S);
    if (gx < 0 || gz < 0 || gx >= N || gz >= N || gy < 0) return;
    const key = (gy * N + gz) * N + gx;
    const cur = occ.get(key);
    if (cur === undefined || (KIND[b] === 1 && cur !== b && hash3(x, y, z) < 0.3)) occ.set(key, b);
  };
  const C0x = X0 / CS - 1, C1x = (X0 + BS) / CS, C0z = Z0 / CS - 1, C1z = (Z0 + BS) / CS;
  for (let cz = C0z; cz <= C1z; cz++) for (let cx = C0x; cx <= C1x; cx++) {
    if (cx < 0 || cz < 0 || cx >= NCX || cz >= NCZ) continue;
    for (const [fx, fy, fz, t] of world.features[cz * NCX + cx]) {
      const step = S > 4 ? 3 : 2;
      for (let k = 0; k < t.n; k += step) {
        const b = t.blk[k];
        if (KIND[b] !== 1) continue;
        put(fx + t.pos[k * 3], fy + t.pos[k * 3 + 1], fz + t.pos[k * 3 + 2], b);
      }
    }
  }
  for (let oy = 0; oy < H / 16; oy++) for (let ozz = Z0 / 16; ozz < (Z0 + BS) / 16; ozz++) for (let oxx = X0 / 16; oxx < (X0 + BS) / 16; oxx++) {
    const c = world.over.get((oy * 128 + ozz) * 128 + oxx);
    if (!c) continue;
    for (let j = 0; j < 4096; j += 1) {
      const v = c[j];
      if (v === 255 || KIND[v] !== 1) continue;
      const ly = (oy << 4) | (j >> 8), lz = (ozz << 4) | ((j >> 4) & 15), lx = (oxx << 4) | (j & 15);
      if ((lx % S) | (lz % S) | (ly % S)) { if (hash3(lx, ly, lz, 5) > 0.08) continue; }
      put(lx, ly, lz, v);
    }
  }
  for (const [key, b] of occ) {
    const gx = key % N, gz = Math.floor(key / N) % N, gy = Math.floor(key / (N * N));
    const x0 = X0 + gx * S, z0 = Z0 + gz * S, y0 = gy * S;
    if (y0 + S <= hgt[(gz + 1) * (N + 2) + gx + 1] + 1) continue;
    const c = COLORS[b];
    const m = 0.85 + hash3(x0, y0, z0, 2) * 0.25;
    for (let f = 0; f < 6; f++) {
      const F = FACES[f];
      const nk = ((gy + F.n[1]) * N + (gz + F.n[2])) * N + gx + F.n[0];
      const inside = gx + F.n[0] >= 0 && gx + F.n[0] < N && gz + F.n[2] >= 0 && gz + F.n[2] < N;
      if (inside && occ.has(nk) && KIND[occ.get(nk)] === 1) continue;
      const cc = c[F.ci], sh = FACE_SHADE[f] * m;
      buf.ensure(4);
      for (let q = 0; q < 4; q++) {
        const p = F.c[q];
        buf.vert(x0 + p[0] * S, y0 + p[1] * S, z0 + p[2] * S, F.n[0], F.n[1], F.n[2], cc[0] * sh, cc[1] * sh, cc[2] * sh, EMIT[b], 0, 1);
      }
      buf.quad(false);
    }
  }
  const solid = buf.out();
  // water as flat quads per cell
  WAT.reset();
  for (let cz = 0; cz < N; cz++) for (let cx = 0; cx < N; cx++) {
    const k = (cz + 1) * (N + 2) + (cx + 1);
    if (wat[k] <= hgt[k]) continue;
    const x0 = X0 + cx * S, z0 = Z0 + cz * S, yy = wat[k] + 0.85;
    WAT.ensure(4);
    WAT.vert(x0, yy, z0, 0, 1, 0, 1, 0, 0, 0, 0, 1);
    WAT.vert(x0, yy, z0 + S, 0, 1, 0, 1, 0, 0, 0, 0, 1);
    WAT.vert(x0 + S, yy, z0 + S, 0, 1, 0, 1, 0, 0, 0, 0, 1);
    WAT.vert(x0 + S, yy, z0, 0, 1, 0, 1, 0, 0, 0, 0, 1);
    WAT.quad(false);
  }
  return { solid, water: WAT.out() };
}
