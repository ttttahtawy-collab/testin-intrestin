// Level data: parses an ASCII map into a tile grid and a list of entity spawns.
//
// Legend
//   terrain   #  ground       B  stone block    =  one-way platform
//             ^  floor spikes v  ceiling spikes X  crumbling slab
//             %  breakable    $  breakable w/ gems   ~  liquid hazard
//   objects   P  player start G  goal gate      C  checkpoint
//             o  gem          1 2 3  prism shards  H  heart
//             J  spring       ?  sign (text from def.signs, in reading order)
//             M  moving platform (horizontal, '-' after it = travel tiles)
//             N  moving platform (vertical,   '|' below it = travel tiles)
//   enemies   any key registered in G.Enemies (w walker, h hopper, k spiker,
//             f flyer, t turret, c charger, j lava-jumper, ...)
//   boss      K  boss spawn (type from def.boss)
(function (G) {
  'use strict';
  const T = () => G.TILE;
  const ENTITY_TILE = { j: 7 };
  const TILE_CHARS = { '#': 1, '=': 2, '^': 3, v: 4, X: 5, '%': 6, $: 6, '~': 7, B: 8 };

  class Level {
    constructor(def) {
      this.def = def;
      const rows = def.map.slice();
      this.h = rows.length;
      this.w = Math.max.apply(null, rows.map((r) => r.length));
      this.tiles = new Uint8Array(this.w * this.h);
      this.crumbleT = new Float32Array(this.w * this.h);
      this.meta = new Map();
      this.spawns = [];
      let signIdx = 0;
      const t = G.TILE;
      for (let y = 0; y < this.h; y++) {
        const row = rows[y];
        for (let x = 0; x < this.w; x++) {
          const ch = row[x] || '.';
          const tile = TILE_CHARS[ch];
          if (tile) {
            this.tiles[y * this.w + x] = tile;
            if (ch === '$') this.meta.set(y * this.w + x, 'gems');
            continue;
          }
          if (ch === '.' || ch === ' ' || ch === '-' || ch === '|') continue;
          // some entities live inside terrain (e.g. lava jumpers sit in lava)
          if (ENTITY_TILE[ch]) this.tiles[y * this.w + x] = ENTITY_TILE[ch];
          const sp = { ch, tx: x, ty: y, x: x * t, y: y * t };
          if (ch === 'M') {
            let n = 0;
            while (row[x + 1 + n] === '-') n++;
            sp.travel = Math.max(1, n) * t; sp.axis = 'x';
          } else if (ch === 'N') {
            let n = 0;
            while (rows[y + 1 + n] && rows[y + 1 + n][x] === '|') n++;
            sp.travel = Math.max(1, n) * t; sp.axis = 'y';
          } else if (ch === '?') {
            sp.text = (def.signs && def.signs[signIdx++]) || '...';
          }
          this.spawns.push(sp);
        }
      }
      this.pw = this.w * t;
      this.ph = this.h * t;
      const ps = this.spawns.find((s) => s.ch === 'P');
      this.start = ps ? { x: ps.x + t / 2, y: ps.y + t } : { x: t * 2, y: t * 2 };
    }
    // Outside the map horizontally is solid wall; above is open air; below is a pit.
    get(tx, ty) {
      if (tx < 0 || tx >= this.w) return 1;
      if (ty < 0 || ty >= this.h) return 0;
      return this.tiles[ty * this.w + tx];
    }
    set(tx, ty, v) {
      if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return;
      this.tiles[ty * this.w + tx] = v;
    }
    // Crumble slabs: >0 shaking (seconds), 0 idle, <0 gone (counting up to 0).
    touchCrumble(tx, ty) {
      const i = ty * this.w + tx;
      if (this.get(tx, ty) === 5 && this.crumbleT[i] === 0) { this.crumbleT[i] = 0.0001; return true; }
      return false;
    }
    update(dt, onEvent) {
      const ct = this.crumbleT;
      for (let i = 0; i < ct.length; i++) {
        const v = ct[i];
        if (v === 0) continue;
        if (v > 0) {
          ct[i] = v + dt;
          if (ct[i] > 0.5) { ct[i] = -3.2; if (onEvent) onEvent('crumble', i % this.w, Math.floor(i / this.w)); }
        } else {
          ct[i] = Math.min(0, v + dt);
        }
      }
    }
  }
  G.Level = Level;
})(window.G);
