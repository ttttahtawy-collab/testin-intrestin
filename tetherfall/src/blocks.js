// Block registry and the procedurally painted 16x16 texture atlas.
import * as THREE from 'three';
import { mulberry32 } from './noise.js';

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, BRICK: 4, MOSSY: 5, LOG: 6, LEAVES: 7,
  PLANKS: 8, ROOF_RED: 9, ROOF_BLUE: 10, PLASTER: 11, COBBLE: 12, SAND: 13,
  WATER: 14, GRAVEL: 15, TIMBER: 16, WINDOW: 17, TALLGRASS: 18, FLOWER_R: 19,
  FLOWER_Y: 20, DARKSTONE: 21, HEDGE: 22,
};

const TILE = 16, COLS = 8, ROWS = 4;
export const ATLAS_W = TILE * COLS, ATLAS_H = TILE * ROWS;

const T = {
  grass_top: 0, grass_side: 1, dirt: 2, stone: 3, brick: 4, mossy: 5, bark: 6, log_top: 7,
  leaves: 8, planks: 9, roof_red: 10, roof_blue: 11, plaster: 12, cobble: 13, sand: 14, water: 15,
  gravel: 16, timber: 17, window: 18, tallgrass: 19, flower_r: 20, flower_y: 21, darkstone: 22, hedge: 23,
};

// solid: blocks movement/hooks. cross: drawn as an X of quads. see: neighbours still render faces.
function def(tiles, opts = {}) {
  const [top, bottom = top, side = top] = tiles;
  return { tiles: { top, bottom, side }, solid: true, cross: false, see: false, ...opts };
}

export const BLOCKS = [];
BLOCKS[B.AIR] = { solid: false, cross: false, see: true, air: true };
BLOCKS[B.GRASS] = def([T.grass_top, T.dirt, T.grass_side]);
BLOCKS[B.DIRT] = def([T.dirt]);
BLOCKS[B.STONE] = def([T.stone]);
BLOCKS[B.BRICK] = def([T.brick]);
BLOCKS[B.MOSSY] = def([T.mossy]);
BLOCKS[B.LOG] = def([T.log_top, T.log_top, T.bark]);
BLOCKS[B.LEAVES] = def([T.leaves], { see: true });
BLOCKS[B.PLANKS] = def([T.planks]);
BLOCKS[B.ROOF_RED] = def([T.roof_red]);
BLOCKS[B.ROOF_BLUE] = def([T.roof_blue]);
BLOCKS[B.PLASTER] = def([T.plaster]);
BLOCKS[B.COBBLE] = def([T.cobble]);
BLOCKS[B.SAND] = def([T.sand]);
BLOCKS[B.WATER] = def([T.water], { solid: false, see: true, water: true });
BLOCKS[B.GRAVEL] = def([T.gravel]);
BLOCKS[B.TIMBER] = def([T.timber]);
BLOCKS[B.WINDOW] = def([T.timber, T.timber, T.window]);
BLOCKS[B.TALLGRASS] = def([T.tallgrass], { solid: false, cross: true, see: true });
BLOCKS[B.FLOWER_R] = def([T.flower_r], { solid: false, cross: true, see: true });
BLOCKS[B.FLOWER_Y] = def([T.flower_y], { solid: false, cross: true, see: true });
BLOCKS[B.DARKSTONE] = def([T.darkstone]);
BLOCKS[B.HEDGE] = def([T.hedge], { see: true });

export const SOLID = new Uint8Array(256);
BLOCKS.forEach((b, i) => { if (b) SOLID[i] = b.solid ? 1 : 0; });

// UV rectangle of a tile, inset half a texel to avoid bleeding.
export function tileUV(t) {
  const c = t % COLS, r = Math.floor(t / COLS);
  const e = 0.5;
  return [
    (c * TILE + e) / ATLAS_W, 1 - ((r + 1) * TILE - e) / ATLAS_H,
    ((c + 1) * TILE - e) / ATLAS_W, 1 - (r * TILE + e) / ATLAS_H,
  ];
}

// ---------- painting ----------
const clamp = (v) => Math.max(0, Math.min(255, v | 0));

function brickPattern(x, y, w = 8, h = 4) {
  const row = Math.floor(y / h);
  const off = row % 2 ? w / 2 : 0;
  return { mortar: y % h === h - 1 || (x + off) % w === w - 1, row, col: Math.floor((x + off) / w) };
}

const painters = {
  grass_top: (x, y, r) => { const v = (r() - 0.5) * 36; const s = r() < 0.08 ? 25 : 0; return [80 + v + s, 146 + v + s, 46 + v * 0.5]; },
  grass_side: (x, y, r, col) => {
    const depth = col[x];
    if (y < depth) { const v = (r() - 0.5) * 30; return [80 + v, 146 + v, 46 + v * 0.5]; }
    return painters.dirt(x, y, r);
  },
  dirt: (x, y, r) => { const v = (r() - 0.5) * 30; const d = r() < 0.1 ? -25 : 0; return [122 + v + d, 86 + v + d, 58 + v * 0.6 + d]; },
  stone: (x, y, r) => { const v = (r() - 0.5) * 30 + (r() < 0.12 ? -22 : 0); return [126 + v, 126 + v, 128 + v]; },
  brick: (x, y, r) => {
    const p = brickPattern(x, y);
    if (p.mortar) return [86, 86, 88];
    const base = 136 + ((p.row * 7 + p.col * 13) % 5) * 4;
    const v = (r() - 0.5) * 18;
    return [base + v, base + v, base + 2 + v];
  },
  mossy: (x, y, r, col, seedR) => {
    const c = painters.brick(x, y, r);
    if (seedR[(y * 16 + x)] > 0.55) { const v = (r() - 0.5) * 25; return [70 + v, 110 + v, 50 + v]; }
    return c;
  },
  bark: (x, y, r, col) => {
    const v = col[x] + (r() - 0.5) * 16;
    const groove = (x + (y >> 2)) % 5 === 0 ? -18 : 0;
    return [66 + v + groove, 44 + v * 0.8 + groove, 30 + v * 0.5 + groove];
  },
  log_top: (x, y, r) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d > 7) return [66, 44, 30];
    const ring = Math.floor(d * 1.3) % 2 ? 14 : 0;
    const v = (r() - 0.5) * 10;
    return [160 + v - ring, 120 + v - ring, 74 + v - ring];
  },
  leaves: (x, y, r) => {
    const k = r();
    if (k < 0.12) return [26, 64, 22];
    const v = (r() - 0.5) * 40;
    return [48 + v * 0.6, 112 + v, 38 + v * 0.5];
  },
  hedge: (x, y, r) => {
    const k = r();
    if (k < 0.1) return [34, 80, 28];
    const v = (r() - 0.5) * 40;
    return [62 + v * 0.6, 134 + v, 46 + v * 0.5];
  },
  planks: (x, y, r, col) => {
    const board = Math.floor(y / 4);
    if (y % 4 === 3) return [104, 74, 44];
    const seam = ((x + board * 5) % 16) === 0 ? -30 : 0;
    const v = col[(x + board * 3) % 16] * 0.5 + (r() - 0.5) * 12 + seam;
    return [162 + v, 124 + v, 78 + v * 0.6];
  },
  roof_red: (x, y, r) => {
    const row = Math.floor(y / 4), off = row % 2 ? 2 : 0;
    const edge = y % 4 === 3 || (x + off) % 4 === 0;
    const v = (r() - 0.5) * 18 + (edge ? -35 : 0);
    return [170 + v, 58 + v * 0.5, 42 + v * 0.4];
  },
  roof_blue: (x, y, r) => {
    const row = Math.floor(y / 4), off = row % 2 ? 2 : 0;
    const edge = y % 4 === 3 || (x + off) % 4 === 0;
    const v = (r() - 0.5) * 16 + (edge ? -28 : 0);
    return [58 + v * 0.5, 74 + v * 0.6, 116 + v];
  },
  plaster: (x, y, r) => { const v = (r() - 0.5) * 14; return [226 + v, 216 + v, 196 + v]; },
  cobble: (x, y, r, col, seedR, pts) => {
    let best = 1e9, second = 1e9, bi = 0;
    for (let i = 0; i < pts.length; i++) {
      const [px, py] = pts[i];
      let dx = Math.abs(x - px); dx = Math.min(dx, 16 - dx);
      let dy = Math.abs(y - py); dy = Math.min(dy, 16 - dy);
      const d = dx * dx + dy * dy;
      if (d < best) { second = best; best = d; bi = i; } else if (d < second) second = d;
    }
    if (Math.sqrt(second) - Math.sqrt(best) < 0.9) return [78, 78, 80];
    const base = 112 + (bi * 37 % 40);
    const v = (r() - 0.5) * 12;
    return [base + v, base + v, base + 3 + v];
  },
  sand: (x, y, r) => { const v = (r() - 0.5) * 18; return [218 + v, 206 + v, 158 + v]; },
  water: (x, y, r) => { const w = Math.sin((x + y * 0.5) * 0.8) * 10; const v = (r() - 0.5) * 8 + w; return [52 + v, 96 + v, 176 + v]; },
  gravel: (x, y, r) => { const k = r(); const v = (r() - 0.5) * 20; const b = k < 0.3 ? 150 : k < 0.6 ? 120 : 95; return [b + v + 6, b + v, b + v - 6]; },
  timber: (x, y, r, col) => { const v = col[x] * 0.5 + (r() - 0.5) * 10; return [82 + v, 56 + v, 36 + v]; },
  window: (x, y, r) => {
    if (x < 2 || x > 13 || y < 2 || y > 13) return [82, 56, 36];
    if (x === 7 || x === 8 || y === 7 || y === 8) return [70, 48, 30];
    const shine = (x - y > 2 && x - y < 6) ? 50 : 0;
    return [38 + shine, 52 + shine, 78 + shine];
  },
  darkstone: (x, y, r) => {
    const p = brickPattern(x, y);
    if (p.mortar) return [34, 34, 38];
    const v = (r() - 0.5) * 14 + ((p.row + p.col) % 3) * 4;
    return [60 + v, 60 + v, 66 + v];
  },
};

function paintCross(t, data, r, kind) {
  const W = ATLAS_W;
  const c = t % COLS, rr = Math.floor(t / COLS);
  const put = (x, y, col) => {
    const i = ((rr * TILE + y) * W + c * TILE + x) * 4;
    data[i] = col[0]; data[i + 1] = col[1]; data[i + 2] = col[2]; data[i + 3] = 255;
  };
  if (kind === 'grass') {
    for (let x = 1; x < 15; x += 1) {
      if (r() < 0.35) continue;
      const h = 5 + Math.floor(r() * 10);
      const g = 110 + r() * 60;
      for (let y = 15; y > 15 - h; y--) put(x, y, [g * 0.5, g, g * 0.35]);
    }
  } else {
    const head = kind === 'red' ? [200, 40, 40] : [235, 205, 50];
    for (let y = 15; y > 6; y--) put(7, y, [60, 120, 40]);
    put(6, 11, [60, 120, 40]); put(8, 12, [60, 120, 40]);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > 3) continue;
      put(7 + dx, 5 + dy, dx === 0 && dy === 0 ? [250, 220, 90] : head);
    }
  }
}

export function buildAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_W; canvas.height = ATLAS_H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(ATLAS_W, ATLAS_H);
  const data = img.data;
  const avg = {};
  for (const [name, t] of Object.entries(T)) {
    const r = mulberry32(1000 + t * 77);
    if (name === 'tallgrass') { paintCross(t, data, r, 'grass'); continue; }
    if (name === 'flower_r') { paintCross(t, data, r, 'red'); continue; }
    if (name === 'flower_y') { paintCross(t, data, r, 'yellow'); continue; }
    const col = [];
    for (let i = 0; i < 16; i++) col.push(name === 'grass_side' ? 3 + Math.floor(r() * 3) : (r() - 0.5) * 30);
    const seedR = [];
    for (let i = 0; i < 256; i++) seedR.push(0);
    // blotchy mask for mossy
    for (let k = 0; k < 6; k++) {
      const cx = r() * 16, cy = r() * 16, rad = 2 + r() * 3;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (Math.hypot(x - cx, y - cy) < rad) seedR[y * 16 + x] = Math.max(seedR[y * 16 + x], 0.4 + r() * 0.6);
      }
    }
    const pts = [];
    for (let i = 0; i < 9; i++) pts.push([r() * 16, r() * 16]);
    const c = t % COLS, rr = Math.floor(t / COLS);
    let sr = 0, sg = 0, sb = 0;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const p = painters[name](x, y, r, col, seedR, pts);
      const i = ((rr * TILE + y) * ATLAS_W + c * TILE + x) * 4;
      data[i] = clamp(p[0]); data[i + 1] = clamp(p[1]); data[i + 2] = clamp(p[2]); data[i + 3] = 255;
      sr += data[i]; sg += data[i + 1]; sb += data[i + 2];
    }
    avg[t] = [sr / 256, sg / 256, sb / 256];
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;

  // Minimap colours per block id.
  const mapColor = [];
  BLOCKS.forEach((b, id) => {
    if (!b || b.air) return;
    const t = b.tiles.top;
    mapColor[id] = avg[t] || [90, 150, 60];
  });
  mapColor[B.WATER] = [52, 96, 176];
  mapColor[B.TALLGRASS] = mapColor[B.GRASS];
  mapColor[B.FLOWER_R] = mapColor[B.GRASS];
  mapColor[B.FLOWER_Y] = mapColor[B.GRASS];
  return { texture: tex, mapColor, canvas };
}
