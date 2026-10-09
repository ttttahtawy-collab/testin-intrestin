// Heightmap terrain generation: island shape, regions, lakes, rivers, roads,
// settlement flattening, biome & surface materials, vegetation placement.
import { Simplex, smoothstep, clamp, lerp, hash2, rng } from '../core/noise.js';
import { WX, WZ, H, SEA, BIOME, NCX } from './world.js';
import { B } from './blocks.js';
import { REGIONS, SETTLE, LAKES, RIVERS, ROADS } from './layout.js';
import { TPL } from './templates.js';

const gauss = (x, z, cx, cz, r) => { const dx = x - cx, dz = z - cz; return Math.exp(-(dx * dx + dz * dz) / (r * r)); };

function densify(pts, step = 1, wobble = 0, seed = 1) {
  const out = [];
  const n = new Simplex(seed);
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.ceil(len / step);
    const px = -(z1 - z0) / len, pz = (x1 - x0) / len;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      // Catmull-Rom style smoothing using neighbours
      const p0 = pts[Math.max(0, i - 1)], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const t2 = t * t, t3 = t2 * t;
      const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      let x = cr(p0[0], x0, x1, p3[0]), z = cr(p0[1], z0, z1, p3[1]);
      acc += step;
      const w = wobble ? n.noise2(acc * 0.015, seed) * wobble : 0;
      out.push([x + px * w, z + pz * w]);
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}

export const NO_FLATTEN = new Set(['stillwater', 'mireHeart', 'wreck', 'lighthouse', 'mine', 'hollowCave', 'sunMeadow', 'elderBloom', 'bearDen']);

export function generateTerrain(world, seed = 7) {
  const N = new Simplex(seed), N2 = new Simplex(seed + 1), N3 = new Simplex(seed + 2), N4 = new Simplex(seed + 3);
  const Hf = new Float32Array(WX * WZ);
  const R = REGIONS;
  // coarse pass for low-frequency terms (bilinearly upsampled)
  const G = 4, CW = WX / G + 1, CH = WZ / G + 1;
  const cBase = new Float32Array(CW * CH), cMz = new Float32Array(CW * CH), cMw = new Float32Array(CW * CH), cShape = new Float32Array(CW * CH);
  for (let gz = 0; gz < CH; gz++) for (let gx = 0; gx < CW; gx++) {
    const x = gx * G, z = gz * G, k = gz * CW + gx;
    const dx = (x - 1024) / 1000, dz = (z - 1040) / 980;
    const d = Math.sqrt(dx * dx + dz * dz) + N.fbm(x * 0.0016, z * 0.0016, 3) * 0.2;
    const land = smoothstep(0.98, 0.8, d);
    let h = 41 + N.fbm(x * 0.0035, z * 0.0035, 4) * 8;
    const mz = smoothstep(620, 260, z + N2.noise2(x * 0.004, 3) * 60);
    if (mz > 0) { const rd = N3.ridged(x * 0.0055, z * 0.0055, 5); h += mz * (18 + rd * rd * 75); }
    h += 26 * gauss(x, z, 1000, 735, 105) + 8 * gauss(x, z, 960, 820, 140);
    const ww = gauss(x, z, R.weald.x, R.weald.z, R.weald.r);
    if (ww > 0.01) h += ww * (N2.fbm(x * 0.009, z * 0.009, 3) * 9 + 5);
    const mo = gauss(x, z, R.moor.x, R.moor.z, R.moor.r);
    if (mo > 0.01) h += mo * (N4.fbm(x * 0.006, z * 0.006, 3) * 7 + 3);
    h += 14 * gauss(x, z, 1490, 640, 230);
    cBase[k] = h; cMz[k] = mz;
    cMw[k] = smoothstep(330, 160, Math.hypot(x - R.mirefen.x, z - R.mirefen.z) + N.noise2(x * 0.006, z * 0.006) * 60);
    const south = smoothstep(1500, 1800, z) * (1 - smoothstep(1400, 1700, Math.abs(x - 1000) + 900));
    cShape[k] = lerp(smoothstep(0, 0.55, land), smoothstep(0, 0.12, land), south * 0.85);
  }
  const bil = (A, x, z) => {
    const fx = x / G, fz = z / G, ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
    const k = iz * CW + ix;
    const a = A[k], b = A[k + 1], c = A[k + CW], d = A[k + CW + 1];
    return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
  };
  for (let z = 0; z < WZ; z++) {
    for (let x = 0; x < WX; x++) {
      let h = bil(cBase, x, z) + N2.fbm(x * 0.013, z * 0.013, 2) * 2.2;
      const mz = bil(cMz, x, z);
      if (mz > 0.01) h += mz * N.fbm(x * 0.02, z * 0.02, 2) * 4;
      const mw = bil(cMw, x, z);
      if (mw > 0.001) h = lerp(h, 31.2 + N4.fbm(x * 0.02, z * 0.02, 3) * 2.6, mw);
      const shape = bil(cShape, x, z);
      if (shape < 0.999) h = lerp(SEA - 10 + N.noise2(x * 0.01, z * 0.01) * 3, h, shape);
      Hf[z * WX + x] = h;
    }
  }

  // ---- lakes ----
  for (const L of LAKES) {
    const ext = 1.4;
    for (let z = Math.floor(L.z - L.rz * ext); z <= L.z + L.rz * ext; z++) for (let x = Math.floor(L.x - L.rx * ext); x <= L.x + L.rx * ext; x++) {
      if (x < 0 || z < 0 || x >= WX || z >= WZ) continue;
      const nx = (x - L.x) / L.rx, nz = (z - L.z) / L.rz;
      const e = Math.sqrt(nx * nx + nz * nz) + N.noise2(x * 0.03, z * 0.03) * 0.12;
      const i = z * WX + x;
      if (e < 0.92) {
        Hf[i] = L.level - 1.5 - 5 * (1 - (e / 0.92) ** 2);
        world.water[i] = L.level;
      } else if (e < ext) {
        const t = smoothstep(0.92, ext, e);
        Hf[i] = lerp(L.level + 0.4, Hf[i], t);
      }
    }
  }

  // ---- rivers ----
  for (let ri = 0; ri < RIVERS.length; ri++) {
    const Rv = RIVERS[ri];
    const path = densify(Rv.pts, 1, 14, 100 + ri);
    // smoothed terrain along path
    const raw = path.map(([x, z]) => Hf[clamp(Math.round(z), 0, WZ - 1) * WX + clamp(Math.round(x), 0, WX - 1)]);
    let wl = 1e9;
    const levels = raw.map((h, k) => {
      let s = 0, c = 0;
      for (let j = -6; j <= 6; j++) { const v = raw[clamp(k + j, 0, raw.length - 1)]; s += v; c++; }
      wl = Math.min(wl, s / c - 2.2);
      return Math.max(SEA, wl);
    });
    for (let k = 0; k < path.length; k++) {
      const [px, pz] = path[k];
      const lv = levels[k];
      const w = Rv.w * (0.75 + 0.25 * Math.min(1, k / 200));
      const rr = w + 6;
      for (let z = Math.floor(pz - rr); z <= pz + rr; z++) for (let x = Math.floor(px - rr); x <= px + rr; x++) {
        if (x < 0 || z < 0 || x >= WX || z >= WZ) continue;
        const dd = Math.hypot(x - px, z - pz);
        if (dd > rr) continue;
        const i = z * WX + x;
        if (dd < w) {
          const bed = lv - 1.2 - 2.5 * (1 - (dd / w) ** 2);
          if (Hf[i] > bed) Hf[i] = bed;
          const wi = Math.floor(lv);
          if (world.water[i] < wi) world.water[i] = wi;
        } else {
          const bank = lv + 0.6 + (dd - w) * 0.9;
          if (Hf[i] > bank) Hf[i] = lerp(bank, Hf[i], smoothstep(w, rr, dd) * 0.5);
        }
      }
    }
  }

  // ---- settlements ----
  for (const [id, S] of Object.entries(SETTLE)) {
    if (NO_FLATTEN.has(id)) continue;
    let ty = S.y;
    if (!ty) {
      let s = 0, c = 0;
      for (let a = 0; a < 16; a++) { const x = Math.round(S.x + Math.cos(a) * S.r * 0.5), z = Math.round(S.z + Math.sin(a) * S.r * 0.5); s += Hf[z * WX + x]; c++; }
      s += Hf[S.z * WX + S.x] * 4; c += 4;
      ty = Math.round(s / c);
    }
    S.ty = ty;
    const rr = S.r + 30;
    for (let z = S.z - rr; z <= S.z + rr; z++) for (let x = S.x - rr; x <= S.x + rr; x++) {
      if (x < 0 || z < 0 || x >= WX || z >= WZ) continue;
      const dd = Math.hypot(x - S.x, z - S.z);
      if (dd > rr) continue;
      const i = z * WX + x;
      if (world.water[i] > 0 && id !== 'saltby') continue;
      const t = smoothstep(S.r, rr, dd);
      Hf[i] = lerp(ty + 0.01, Hf[i], t);
    }
  }

  // ---- roads ----
  const roadMat = new Uint8Array(WX * WZ);
  world.crossings = [];
  for (let ri = 0; ri < ROADS.length; ri++) {
    const path = densify(ROADS[ri].pts, 1, 5, 300 + ri);
    const raw = path.map(([x, z]) => Hf[clamp(Math.round(z), 0, WZ - 1) * WX + clamp(Math.round(x), 0, WX - 1)]);
    const sm = raw.map((_, k) => { let s = 0, c = 0; for (let j = -14; j <= 14; j++) { s += raw[clamp(k + j, 0, raw.length - 1)]; c++; } return s / c; });
    let inWater = false, wStart = 0;
    for (let k = 0; k < path.length; k++) {
      const [px, pz] = path[k];
      const ci = clamp(Math.round(pz), 0, WZ - 1) * WX + clamp(Math.round(px), 0, WX - 1);
      const wet = world.water[ci] > 0;
      if (wet && !inWater) { inWater = true; wStart = k; }
      if (!wet && inWater) {
        inWater = false;
        const a = path[Math.max(0, wStart - 4)], b = path[Math.min(path.length - 1, k + 3)];
        world.crossings.push({ x0: a[0], z0: a[1], x1: b[0], z1: b[1], y: Math.round(Math.max(sm[Math.max(0, wStart - 4)], sm[Math.min(path.length - 1, k + 3)])) });
      }
      if (wet) continue;
      const ph = sm[k];
      for (let z = Math.floor(pz - 5); z <= pz + 5; z++) for (let x = Math.floor(px - 5); x <= px + 5; x++) {
        if (x < 0 || z < 0 || x >= WX || z >= WZ) continue;
        const dd = Math.hypot(x - px, z - pz);
        if (dd > 5) continue;
        const i = z * WX + x;
        if (world.water[i] > 0) continue;
        if (dd < 2.3) { Hf[i] = ph; roadMat[i] = hash2(x, z, 5) < 0.12 ? 2 : 1; }
        else { Hf[i] = lerp(ph, Hf[i], smoothstep(2.3, 5, dd)); if (dd < 3.2 && hash2(x, z, 6) < 0.35 && !roadMat[i]) roadMat[i] = 3; }
        if (dd < 3.6) world.mask[i] = 1;
      }
    }
  }

  // ---- quantize, biome, surface ----
  const Rg = REGIONS;
  for (let z = 0; z < WZ; z++) for (let x = 0; x < WX; x++) {
    const i = z * WX + x;
    const hf = Hf[i];
    const h = clamp(Math.floor(hf), 2, H - 12);
    world.height[i] = h;
  }
  for (let z = 0; z < WZ; z++) for (let x = 0; x < WX; x++) {
    const i = z * WX + x;
    const h = world.height[i];
    const hx0 = world.height[z * WX + Math.max(0, x - 1)], hx1 = world.height[z * WX + Math.min(WX - 1, x + 1)];
    const hz0 = world.height[Math.max(0, z - 1) * WX + x], hz1 = world.height[Math.min(WZ - 1, z + 1) * WX + x];
    const slope = Math.max(Math.abs(h - hx0), Math.abs(h - hx1), Math.abs(h - hz0), Math.abs(h - hz1));
    // sea water
    if (h < SEA && world.water[i] < SEA) world.water[i] = SEA;
    const wet = world.water[i] > h;
    const nB = N.noise2(x * 0.01, z * 0.01) * 50;
    const dm = Math.hypot(x - Rg.mirefen.x, z - Rg.mirefen.z) + nB;
    const dwe = Math.hypot(x - Rg.weald.x, z - Rg.weald.z) + nB;
    const dmo = Math.hypot(x - Rg.moor.x, z - Rg.moor.z) + nB;
    const mountain = z + N2.noise2(x * 0.004, 3) * 60 < 560;
    let biome = BIOME.MEADOW;
    if (h > 92 + N.noise2(x * 0.02, z * 0.02) * 6) biome = BIOME.SNOW;
    else if (mountain) biome = BIOME.HIGHLAND;
    else if (dm < 300) biome = BIOME.MIRE;
    else if (dwe < 340) biome = BIOME.WEALD;
    else if (dmo < 230 || Math.hypot(x - 1000, z - 760) + nB < 200) biome = BIOME.MOOR;
    else if (h <= SEA + 3 || z > 1700) biome = BIOME.COAST;
    let s;
    const rm = roadMat[i];
    if (rm && !wet) {
      s = rm === 1 ? B.DIRT_PATH : rm === 2 ? B.GRAVEL : (biome === BIOME.WEALD ? B.GRASS_DARK : B.DIRT_PATH);
      if (rm === 3) s = hash2(x, z, 9) < 0.5 ? B.GRAVEL : B.DIRT_PATH;
    } else if (wet) {
      s = biome === BIOME.MIRE ? B.MUD : (h < SEA - 2 ? B.SAND : B.GRAVEL);
      if (world.water[i] === SEA) s = B.SAND;
    } else if (biome === BIOME.SNOW) s = slope > 3 ? B.GRANITE : B.SNOW;
    else if (slope >= 3) s = biome === BIOME.WEALD ? B.MOSS_STONE : biome === BIOME.HIGHLAND ? B.GRANITE : B.STONE;
    else switch (biome) {
      case BIOME.HIGHLAND: s = N3.noise2(x * 0.05, z * 0.05) > 0.35 ? B.GRAVEL : B.GRASS_DRY; break;
      case BIOME.MIRE: {
        const dh = Math.hypot(x - SETTLE.mireHeart.x, z - SETTLE.mireHeart.z);
        s = dh < 150 + N.noise2(x * 0.03, z * 0.03) * 40 ? (hash2(x, z, 3) < 0.6 ? B.BLIGHT : B.MUD) : (N4.noise2(x * 0.04, z * 0.04) > 0.3 ? B.MUD : B.GRASS_MARSH);
        break;
      }
      case BIOME.WEALD: s = N3.noise2(x * 0.06, z * 0.06) > 0.55 ? B.DIRT : B.GRASS_DARK; break;
      case BIOME.MOOR: s = B.GRASS_DRY; break;
      case BIOME.COAST: s = h <= SEA + 2 ? B.SAND : B.GRASS; break;
      default: s = B.GRASS;
    }
    world.surf[i] = s;
    world.biome[i] = biome;
    if (world.water[i] <= h) world.water[i] = 0;
  }
  world.Hf = null;
  return { roadMat };
}

// Place vegetation & rocks as features (call after structures masked areas)
export function placeVegetation(world, seed = 7) {
  const N = new Simplex(seed + 11);
  const r = rng(seed + 99);
  const T = TPL;
  const ok = (x, z) => {
    if (x < 4 || z < 4 || x >= WX - 4 || z >= WZ - 4) return false;
    const i = z * WX + x;
    if (world.mask[i] || world.water[i]) return false;
    const h = world.height[i];
    if (h <= SEA) return false;
    for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) { const j = (z + dz) * WX + x + dx; if (world.mask[j] || world.water[j] || Math.abs(world.height[j] - h) > 2) return false; }
    return true;
  };
  const G = 4;
  for (let gz = 0; gz < WZ; gz += G) for (let gx = 0; gx < WX; gx += G) {
    const x = gx + Math.floor(r() * G), z = gz + Math.floor(r() * G);
    if (!ok(x, z)) continue;
    const i = z * WX + x;
    const biome = world.biome[i], h = world.height[i];
    const forest = N.fbm(x * 0.007, z * 0.007, 3);
    const p = r();
    let t = null;
    switch (biome) {
      case BIOME.WEALD:
        if (p < 0.32 + forest * 0.25) { const q = r(); t = q < 0.35 ? r.pick(T.darkOak) : q < 0.65 ? r.pick(T.oak) : q < 0.85 ? r.pick(T.pine) : r.pick(T.birch); }
        else if (p < 0.5) t = r() < 0.7 ? r.pick(T.bush) : r.pick(T.berry);
        else if (p < 0.515) t = r.pick(T.rockMossy);
        break;
      case BIOME.MEADOW:
        if (forest > 0.22 && p < 0.35) t = r() < 0.6 ? r.pick(T.oak) : r.pick(T.birch);
        else if (p < 0.012) t = r.pick(T.oakBig);
        else if (p < 0.035) t = r() < 0.8 ? r.pick(T.bush) : r.pick(T.berry);
        else if (p < 0.045) t = r.pick(T.rock);
        break;
      case BIOME.MOOR:
        if (forest > 0.3 && p < 0.25) t = r.pick(T.birch);
        else if (p < 0.02) t = r.pick(T.birch);
        else if (p < 0.045) t = r.pick(T.rockMossy);
        else if (p < 0.052) t = r.pick(T.boulder);
        else if (p < 0.07) t = r.pick(T.bush);
        break;
      case BIOME.MIRE:
        if (p < 0.035) t = r.pick(T.dead);
        else if (p < 0.06) t = r.pick(T.willow);
        else if (p < 0.08) t = r.pick(T.bush);
        break;
      case BIOME.HIGHLAND:
        if (forest > 0.05 && p < 0.3) t = r.pick(T.pine);
        else if (p < 0.03) t = r.pick(T.pine);
        else if (p < 0.07) t = r.pick(T.rock);
        else if (p < 0.08) t = r.pick(T.boulder);
        break;
      case BIOME.SNOW:
        if (p < 0.06) t = r.pick(T.pineSnow);
        else if (p < 0.08) t = r.pick(T.rock);
        break;
      case BIOME.COAST:
        if (p < 0.02) t = r.pick(T.rock);
        else if (p < 0.03 && h > SEA + 3) t = r.pick(T.oak);
        break;
      case BIOME.TOWN:
        break;
    }
    if (t) world.addFeature(x, h + 1, z, t);
  }
}
