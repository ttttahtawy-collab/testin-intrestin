// Faceted terrain renderer. Static tiles are drawn into cached chunk canvases
// (lazily built, LRU-evicted); animated tiles (liquids, crumbling blocks) are
// drawn every frame.
(function (G) {
  'use strict';
  const U = G.U;
  const CH = 12; // tiles per chunk side

  class TileRenderer {
    constructor(level, theme) {
      this.level = level;
      this.th = theme;
      this.cache = new Map();
      this.rfv = -1;
      this.frame = 0;
    }
    invalidate(tx, ty) {
      // a tile's decor/edges can bleed one tile into neighbouring chunks
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++) {
          const k = Math.floor((tx + dx) / CH) + ',' + Math.floor((ty + dy) / CH);
          this.cache.delete(k);
        }
    }
    draw(ctx, view) {
      const T = G.TILE, R = G.R;
      if (this.rfv !== R.rfVersion) { this.cache.clear(); this.rfv = R.rfVersion; }
      this.frame++;
      const cs = CH * T;
      const x0 = Math.floor(view.x / cs), x1 = Math.floor((view.x + view.w) / cs);
      const y0 = Math.floor(view.y / cs), y1 = Math.floor((view.y + view.h) / cs);
      for (let cy = Math.max(0, y0); cy <= y1; cy++) {
        for (let cx = Math.max(0, x0); cx <= x1; cx++) {
          if (cx * CH >= this.level.w || cy * CH >= this.level.h) continue;
          const key = cx + ',' + cy;
          let c = this.cache.get(key);
          if (!c) { c = { cv: this.build(cx, cy), used: 0 }; this.cache.set(key, c); }
          c.used = this.frame;
          if (c.cv) ctx.drawImage(c.cv, cx * cs, cy * cs, cs, cs);
        }
      }
      if (this.cache.size > 24) {
        const arr = [...this.cache.entries()].sort((a, b) => a[1].used - b[1].used);
        for (let i = 0; i < arr.length - 18; i++) this.cache.delete(arr[i][0]);
      }
    }
    build(cx, cy) {
      const T = G.TILE, L = this.level, rf = G.R.rf;
      const cs = CH * T;
      // skip empty chunks entirely
      let any = false;
      for (let ty = cy * CH - 1; ty <= cy * CH + CH && !any; ty++)
        for (let tx = cx * CH - 1; tx <= cx * CH + CH; tx++) {
          const t = L.get(tx, ty);
          if (t && t !== G.T.LIQUID && t !== G.T.CRUMBLE && tx >= 0 && tx < L.w) { any = true; break; }
        }
      if (!any) return null;
      const cv = U.makeCanvas(cs * rf, cs * rf);
      const ctx = cv.getContext('2d');
      ctx.scale(rf, rf);
      ctx.translate(-cx * cs, -cy * cs);
      ctx.beginPath();
      ctx.rect(cx * cs, cy * cs, cs, cs);
      ctx.clip();
      // pass 1: bodies, pass 2: caps & decor (so caps overlap neighbours)
      for (let pass = 0; pass < 2; pass++)
        for (let ty = cy * CH - 1; ty <= cy * CH + CH; ty++)
          for (let tx = cx * CH - 1; tx <= cx * CH + CH; tx++) {
            if (tx < 0 || tx >= L.w || ty < 0 || ty >= L.h) continue;
            drawTile(ctx, L, tx, ty, this.th, pass);
          }
      return cv;
    }
    drawDynamic(ctx, view, t) {
      const T = G.TILE, L = this.level;
      const tx0 = Math.max(0, Math.floor(view.x / T)), tx1 = Math.min(L.w - 1, Math.floor((view.x + view.w) / T));
      const ty0 = Math.max(0, Math.floor(view.y / T)), ty1 = Math.min(L.h - 1, Math.floor((view.y + view.h) / T));
      const liq = this.th.liquid;
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          const tile = L.get(tx, ty);
          if (tile === G.T.LIQUID) drawLiquid(ctx, L, tx, ty, liq, t);
          else if (tile === G.T.CRUMBLE) drawCrumble(ctx, L, tx, ty, this.th, t);
        }
      }
    }
  }
  G.TileRenderer = TileRenderer;

  function isGround(t) { return t === 1 || t === 8 || t === 6; }

  function drawTile(ctx, L, tx, ty, th, pass) {
    const T = G.TILE, t = L.get(tx, ty);
    const x = tx * T, y = ty * T;
    const h = U.hash2(tx, ty, 3);
    if (t === 1) {
      const g = th.ground;
      const upT = L.get(tx, ty - 1);
      const exposedTop = !isGround(upT) && ty > 0 ? true : !isGround(upT);
      if (pass === 0) {
        let depth = 0;
        for (let k = 1; k <= 4; k++) if (isGround(L.get(tx, ty - k))) depth++; else break;
        const base = U.mix(g.body, g.bodyDark, Math.min(1, depth * 0.22));
        const c1 = U.shade(base, (h - 0.5) * 0.1), c2 = U.shade(base, -0.06 - U.hash2(tx, ty, 9) * 0.06);
        ctx.fillStyle = c1;
        ctx.fillRect(x, y, T + 0.5, T + 0.5);
        ctx.fillStyle = c2;
        if (h > 0.5) U.poly(ctx, [x + T + 0.5, y, x + T + 0.5, y + T + 0.5, x, y + T + 0.5]);
        else U.poly(ctx, [x, y, x + T + 0.5, y + T + 0.5, x, y + T + 0.5]);
        ctx.fill();
        // a small embedded pebble facet
        if (U.hash2(tx, ty, 5) > 0.72) {
          const px = x + 10 + U.hash2(tx, ty, 6) * 26, py = y + 14 + U.hash2(tx, ty, 8) * 22;
          ctx.fillStyle = U.shade(base, 0.12);
          U.poly(ctx, [px, py, px + 8, py + 3, px + 5, py + 9, px - 2, py + 6]);
          ctx.fill();
        }
        ctx.fillStyle = g.edge;
        if (!isGround(L.get(tx - 1, ty)) && tx > 0) ctx.fillRect(x, y, 4, T);
        if (!isGround(L.get(tx + 1, ty)) && tx < L.w - 1) ctx.fillRect(x + T - 4, y, 4, T);
        if (!isGround(L.get(tx, ty + 1)) && ty < L.h - 1) ctx.fillRect(x, y + T - 5, T, 5);
      } else if (exposedTop) {
        const lE = !isGround(L.get(tx - 1, ty)) && tx > 0, rE = !isGround(L.get(tx + 1, ty)) && tx < L.w - 1;
        const ol = lE ? 4 : 0.5, or = rE ? 4 : 0.5;
        const j1 = U.hash2(tx, ty, 11) * 6, j2 = U.hash2(tx, ty, 12) * 6;
        ctx.fillStyle = g.topDark;
        U.poly(ctx, [x - ol, y - 4, x + T + or, y - 4, x + T + or, y + 10, x + T * 0.78, y + 14 + j1, x + T * 0.52, y + 9, x + T * 0.26, y + 15 + j2, x - ol, y + 10]);
        ctx.fill();
        ctx.fillStyle = g.top;
        U.poly(ctx, [x - ol, y - 5, x + T + or, y - 5, x + T + or, y + 4, x + T * 0.6, y + 6, x - ol, y + 3]);
        ctx.fill();
        ctx.fillStyle = U.shade(g.top, 0.22);
        U.poly(ctx, [x - ol, y - 5, x + T * (0.35 + h * 0.3), y - 5, x + T * 0.2, y]);
        ctx.fill();
        // decor
        const dh = U.hash2(tx, ty, 21);
        if (dh < 0.42 && !isGround(upT) && L.get(tx, ty - 1) === 0) {
          const kind = th.decor[Math.floor(U.hash2(tx, ty, 22) * th.decor.length)];
          drawDecor(ctx, kind, x + 8 + U.hash2(tx, ty, 23) * (T - 16), y - 4, th, U.hash2(tx, ty, 24));
        }
      }
    } else if (t === 8 || t === 6) {
      if (pass !== 0) return;
      const s = th.stone;
      const b = 6;
      const isBreak = t === 6;
      const body = isBreak ? U.mix(s.body, '#c98a4b', 0.55) : s.body;
      ctx.fillStyle = s.edge;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = U.shade(isBreak ? U.mix(s.top, '#ffd08a', 0.5) : s.top, 0);
      U.poly(ctx, [x + 1, y + 1, x + T - 1, y + 1, x + T - b, y + b, x + b, y + b]);
      ctx.fill();
      ctx.fillStyle = U.shade(body, 0.1);
      U.poly(ctx, [x + 1, y + 1, x + b, y + b, x + b, y + T - b, x + 1, y + T - 1]);
      ctx.fill();
      ctx.fillStyle = isBreak ? U.shade(body, -0.3) : s.bodyDark;
      U.poly(ctx, [x + T - 1, y + 1, x + T - 1, y + T - 1, x + T - b, y + T - b, x + T - b, y + b]);
      ctx.fill();
      ctx.fillStyle = U.shade(isBreak ? U.shade(body, -0.3) : s.bodyDark, -0.15);
      U.poly(ctx, [x + 1, y + T - 1, x + b, y + T - b, x + T - b, y + T - b, x + T - 1, y + T - 1]);
      ctx.fill();
      ctx.fillStyle = body;
      ctx.fillRect(x + b, y + b, T - 2 * b, T - 2 * b);
      ctx.fillStyle = U.shade(body, -0.08);
      U.poly(ctx, [x + T - b, y + b, x + T - b, y + T - b, x + b, y + T - b]);
      ctx.fill();
      if (isBreak) {
        ctx.strokeStyle = U.shade(body, -0.45);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 12, y + 8); ctx.lineTo(x + 22, y + 22); ctx.lineTo(x + 17, y + 32); ctx.lineTo(x + 26, y + 41);
        ctx.moveTo(x + 22, y + 22); ctx.lineTo(x + 36, y + 18);
        ctx.stroke();
        if (L.meta.get(ty * L.w + tx) === 'gems') {
          ctx.fillStyle = '#5ff0ff';
          U.poly(ctx, [x + 33, y + 28, x + 38, y + 33, x + 33, y + 39, x + 28, y + 33]);
          ctx.fill();
          ctx.fillStyle = '#fff';
          U.poly(ctx, [x + 33, y + 28, x + 35, y + 31, x + 31, y + 31]);
          ctx.fill();
        }
      }
    } else if (t === 2) {
      if (pass !== 1) return;
      const c = th.platform;
      const lN = L.get(tx - 1, ty) === 2, rN = L.get(tx + 1, ty) === 2;
      ctx.fillStyle = U.shade(c, -0.35);
      ctx.fillRect(x, y + 12, T, 6);
      ctx.fillStyle = U.shade(c, -0.15);
      ctx.fillRect(x, y + 4, T, 10);
      ctx.fillStyle = c;
      ctx.fillRect(x, y, T, 6);
      ctx.fillStyle = U.shade(c, 0.25);
      U.poly(ctx, [x, y, x + T * 0.55, y, x + T * 0.3, y + 4, x, y + 4]);
      ctx.fill();
      ctx.fillStyle = U.shade(c, -0.25);
      if (!lN) { U.poly(ctx, [x + 4, y + 18, x + 16, y + 18, x + 10, y + 30]); ctx.fill(); }
      if (!rN) { U.poly(ctx, [x + T - 16, y + 18, x + T - 4, y + 18, x + T - 10, y + 30]); ctx.fill(); }
      ctx.fillStyle = U.shade(c, -0.4);
      ctx.fillRect(x + T - 1, y + 4, 1, 10);
    } else if (t === 3 || t === 4) {
      if (pass !== 1) return;
      const up = t === 3;
      ctx.save();
      if (!up) { ctx.translate(x + T / 2, y + T / 2); ctx.scale(1, -1); ctx.translate(-x - T / 2, -y - T / 2); }
      ctx.fillStyle = '#5b5f73';
      ctx.fillRect(x, y + T - 8, T, 8);
      for (let k = 0; k < 3; k++) {
        const sx = x + k * 16, sw = 16;
        ctx.fillStyle = '#e3e7f2';
        U.poly(ctx, [sx + 1, y + T - 7, sx + sw / 2, y + 18, sx + sw / 2, y + T - 7]);
        ctx.fill();
        ctx.fillStyle = '#979db3';
        U.poly(ctx, [sx + sw / 2, y + 18, sx + sw - 1, y + T - 7, sx + sw / 2, y + T - 7]);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawDecor(ctx, kind, x, y, th, r) {
    const g = th.ground;
    if (kind === 'tuft') {
      ctx.fillStyle = U.shade(g.top, -0.1);
      U.poly(ctx, [x - 7, y + 2, x - 4, y - 10 - r * 4, x - 1, y + 2]); ctx.fill();
      ctx.fillStyle = g.top;
      U.poly(ctx, [x - 2, y + 2, x + 1, y - 14 - r * 4, x + 4, y + 2]); ctx.fill();
      U.poly(ctx, [x + 3, y + 2, x + 8, y - 8, x + 7, y + 2]); ctx.fill();
    } else if (kind === 'flower') {
      ctx.strokeStyle = U.shade(g.topDark, -0.1); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x, y - 12); ctx.stroke();
      const col = ['#ffd84a', '#ff7ab8', '#ffffff', '#9a7bff'][Math.floor(r * 4)];
      ctx.fillStyle = col;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * U.TAU;
        U.poly(ctx, [x, y - 14, x + Math.cos(a - 0.4) * 6, y - 14 + Math.sin(a - 0.4) * 6, x + Math.cos(a + 0.4) * 6, y - 14 + Math.sin(a + 0.4) * 6]);
        ctx.fill();
      }
      ctx.fillStyle = '#ff9a2a';
      ctx.beginPath(); ctx.arc(x, y - 14, 2, 0, U.TAU); ctx.fill();
    } else if (kind === 'bush') {
      ctx.fillStyle = U.shade(g.topDark, -0.1);
      U.poly(ctx, [x - 12, y + 2, x - 10, y - 8, x - 2, y - 14, x + 8, y - 10, x + 12, y + 2]); ctx.fill();
      ctx.fillStyle = g.top;
      U.poly(ctx, [x - 10, y - 8, x - 2, y - 14, x + 1, y - 4]); ctx.fill();
    } else if (kind === 'crystal') {
      const col = r > 0.5 ? '#5ff2dc' : '#b58cff';
      ctx.fillStyle = U.shade(col, -0.2);
      U.poly(ctx, [x - 5, y + 2, x - 4, y - 12 - r * 8, x, y - 18 - r * 8, x + 4, y - 12 - r * 8, x + 5, y + 2]); ctx.fill();
      ctx.fillStyle = col;
      U.poly(ctx, [x - 5, y + 2, x - 4, y - 12 - r * 8, x, y - 18 - r * 8, x, y + 2]); ctx.fill();
      ctx.fillStyle = U.shade(col, -0.1);
      U.poly(ctx, [x + 5, y + 2, x + 9, y - 6, x + 11, y - 2, x + 9, y + 2]); ctx.fill();
    } else if (kind === 'mushroom') {
      ctx.fillStyle = '#e9e0ff';
      ctx.fillRect(x - 2, y - 8, 4, 10);
      ctx.fillStyle = r > 0.5 ? '#ff6ad5' : '#3ee0c8';
      U.poly(ctx, [x - 9, y - 6, x - 5, y - 13, x + 5, y - 13, x + 9, y - 6]); ctx.fill();
    } else if (kind === 'rock') {
      ctx.fillStyle = U.shade(g.body, 0.15);
      U.poly(ctx, [x - 9, y + 2, x - 6, y - 7, x + 2, y - 10, x + 9, y - 3, x + 10, y + 2]); ctx.fill();
      ctx.fillStyle = U.shade(g.body, 0.3);
      U.poly(ctx, [x - 6, y - 7, x + 2, y - 10, x - 1, y - 2]); ctx.fill();
    } else if (kind === 'spikeplant') {
      ctx.fillStyle = '#ff6a2a';
      for (let i = -1; i <= 1; i++) { U.poly(ctx, [x + i * 5 - 3, y + 2, x + i * 7, y - 12 - (i === 0 ? 6 : 0), x + i * 5 + 3, y + 2]); ctx.fill(); }
    } else if (kind === 'icicle') {
      ctx.fillStyle = '#e9f6ff';
      U.poly(ctx, [x - 8, y + 2, x - 5, y - 6, x + 1, y - 9, x + 7, y - 4, x + 9, y + 2]); ctx.fill();
    }
  }

  function drawLiquid(ctx, L, tx, ty, liq, t) {
    const T = G.TILE, x = tx * T, y = ty * T;
    const surface = L.get(tx, ty - 1) !== G.T.LIQUID;
    ctx.fillStyle = U.rgba(liq.color, 0.88);
    if (surface) {
      ctx.beginPath();
      ctx.moveTo(x, y + T + 0.5);
      for (let k = 0; k <= 6; k++) {
        const px = x + (k / 6) * T;
        ctx.lineTo(px, y + 10 + Math.sin(px * 0.06 + t * 3) * 3);
      }
      ctx.lineTo(x + T, y + T + 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = U.rgba(liq.light, 0.9);
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) {
        const px = x + (k / 6) * T;
        const py = y + 10 + Math.sin(px * 0.06 + t * 3) * 3;
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      for (let k = 6; k >= 0; k--) {
        const px = x + (k / 6) * T;
        ctx.lineTo(px, y + 15 + Math.sin(px * 0.06 + t * 3) * 3);
      }
      ctx.fill();
      if (liq.glow && U.hash2(tx, Math.floor(t * 2), 4) > 0.97) {
        ctx.fillStyle = U.rgba(liq.light, 0.8);
        ctx.beginPath(); ctx.arc(x + T / 2, y + 8, 4, 0, U.TAU); ctx.fill();
      }
    } else {
      ctx.fillRect(x, y, T, T + 0.5);
    }
  }

  function drawCrumble(ctx, L, tx, ty, th, t) {
    const T = G.TILE;
    const st = L.crumbleT[ty * L.w + tx];
    if (st < 0) {
      // respawning: faint outline
      if (st > -0.6) {
        ctx.globalAlpha = 0.3;
      } else return;
    }
    let x = tx * T, y = ty * T;
    if (st > 0) { x += (Math.random() - 0.5) * 3; y += (Math.random() - 0.5) * 2; }
    const c = U.mix(th.stone.top, '#e8c070', 0.45);
    ctx.fillStyle = U.shade(c, -0.45);
    ctx.fillRect(x, y, T, T * 0.55);
    ctx.fillStyle = c;
    U.poly(ctx, [x + 1, y + 1, x + T - 1, y + 1, x + T - 5, y + 8, x + 5, y + 8]); ctx.fill();
    ctx.fillStyle = U.shade(c, -0.2);
    ctx.fillRect(x + 5, y + 8, T - 10, T * 0.55 - 12);
    ctx.strokeStyle = U.shade(c, -0.5);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 14, y + 8); ctx.lineTo(x + 20, y + 18); ctx.lineTo(x + 18, y + 26);
    ctx.moveTo(x + 32, y + 8); ctx.lineTo(x + 28, y + 16);
    ctx.stroke();
    // little triangular teeth under the slab
    ctx.fillStyle = U.shade(c, -0.45);
    for (let k = 0; k < 4; k++) { U.poly(ctx, [x + k * 12, y + T * 0.55 - 1, x + k * 12 + 12, y + T * 0.55 - 1, x + k * 12 + 6, y + T * 0.55 + 6]); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
})(window.G);
