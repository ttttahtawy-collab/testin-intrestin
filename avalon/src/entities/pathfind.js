// A* over the voxel surface (2.5D): nodes are (x,z,y-feet) standable cells.
import { SOLID, B } from '../world/blocks.js';

function standable(world, x, y, z, clear = 4) {
  if (!SOLID[world.get(x, y - 1, z)] && world.get(x, y - 1, z) !== B.WATER) return false;
  for (let k = 0; k < clear; k++) if (SOLID[world.get(x, y + k, z)]) return false;
  return true;
}

function findY(world, x, z, y, clear) {
  // prefer same level, then step up 1, then drop up to 3
  if (standable(world, x, y, z, clear)) return y;
  if (standable(world, x, y + 1, z, clear)) return y + 1;
  for (let d = 1; d <= 3; d++) if (standable(world, x, y - d, z, clear)) return y - d;
  return null;
}

class Heap {
  constructor() { this.a = []; }
  push(n) { const a = this.a; a.push(n); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= n.f) break; a[i] = a[p]; i = p; } a[i] = n; }
  pop() {
    const a = this.a; const top = a[0]; const last = a.pop();
    if (a.length) { let i = 0; const n = a.length; while (true) { let l = 2 * i + 1, r = l + 1, m = i; if (l < n && a[l].f < (m === i ? last.f : a[m].f)) m = l; if (r < n && a[r].f < (m === i ? last.f : a[m].f)) m = r; if (m === i) break; a[i] = a[m]; i = m; } a[i] = last; }
    return top;
  }
  get size() { return this.a.length; }
}

const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];

export function findPath(world, sx, sy, sz, tx, ty, tz, maxNodes = 3000, clear = 4) {
  sx = Math.floor(sx); sz = Math.floor(sz); sy = Math.round(sy); tx = Math.floor(tx); tz = Math.floor(tz); ty = Math.round(ty);
  const sy0 = findY(world, sx, sz, sy, clear);
  if (sy0 === null) return null;
  const key = (x, z, y) => (x * 4096 + z) * 256 + y;
  const open = new Heap();
  const g = new Map(); const came = new Map();
  const h = (x, z, y) => { const dx = Math.abs(x - tx), dz = Math.abs(z - tz); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz) + Math.abs(y - ty) * 0.5; };
  const start = { x: sx, z: sz, y: sy0, f: h(sx, sz, sy0) };
  g.set(key(sx, sz, sy0), 0);
  open.push(start);
  let best = start, bestH = start.f, n = 0;
  while (open.size && n < maxNodes) {
    const c = open.pop(); n++;
    const ck = key(c.x, c.z, c.y);
    const cg = g.get(ck);
    const hh = h(c.x, c.z, c.y);
    if (hh < bestH) { bestH = hh; best = c; }
    if (c.x === tx && c.z === tz && Math.abs(c.y - ty) <= 2) { best = c; break; }
    for (const [dx, dz, cost] of DIRS) {
      const nx = c.x + dx, nz = c.z + dz;
      const ny = findY(world, nx, nz, c.y, clear);
      if (ny === null) continue;
      if (dx && dz) { if (findY(world, c.x + dx, c.z, c.y, clear) === null || findY(world, c.x, c.z + dz, c.y, clear) === null) continue; }
      const wet = world.get(nx, ny, nz) === B.WATER ? 4 : 0;
      const ng = cg + cost + (ny !== c.y ? 0.4 : 0) + wet;
      const nk = key(nx, nz, ny);
      if (g.has(nk) && g.get(nk) <= ng) continue;
      g.set(nk, ng); came.set(nk, c);
      open.push({ x: nx, z: nz, y: ny, f: ng + h(nx, nz, ny) });
    }
  }
  // reconstruct to best
  const path = [];
  let c = best;
  while (c) { path.push({ x: c.x + 0.5, y: c.y, z: c.z + 0.5 }); c = came.get(key(c.x, c.z, c.y)); }
  path.reverse();
  // simplify collinear points
  const out = [];
  for (let i = 0; i < path.length; i++) {
    if (i > 0 && i < path.length - 1) {
      const a = path[i - 1], b = path[i], d = path[i + 1];
      if (b.y === a.y && b.y === d.y && (b.x - a.x) === (d.x - b.x) && (b.z - a.z) === (d.z - b.z)) continue;
    }
    out.push(path[i]);
  }
  return { path: out, complete: best.x === tx && best.z === tz };
}
