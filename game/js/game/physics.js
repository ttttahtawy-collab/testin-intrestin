// Tile constants and axis-separated AABB collision against the tile map and
// moving platforms. Shared by the player, enemies and the headless level
// validator (tools/validate-levels.js), so it must not touch the DOM.
(function (G) {
  'use strict';
  G.TILE = 48;
  G.T = { EMPTY: 0, SOLID: 1, ONEWAY: 2, SPIKE_UP: 3, SPIKE_DOWN: 4, CRUMBLE: 5, BREAK: 6, LIQUID: 7, STONE: 8 };
  const T = G.TILE;
  const P = (G.Phys = {});

  P.solid = function (L, tx, ty) {
    const t = L.get(tx, ty);
    return t === 1 || t === 8 || t === 6;
  };
  // Surfaces you can land on from above but pass through from below.
  P.oneway = function (L, tx, ty) {
    const t = L.get(tx, ty);
    if (t === 2) return true;
    if (t === 5) return L.crumbleT[ty * L.w + tx] >= 0;
    return false;
  };

  P.moveX = function (L, b, dx) {
    if (dx === 0) return 0;
    b.x += dx;
    const top = Math.floor(b.y / T), bot = Math.floor((b.y + b.h - 0.01) / T);
    if (dx > 0) {
      const tx = Math.floor((b.x + b.w - 0.01) / T);
      for (let ty = top; ty <= bot; ty++) if (P.solid(L, tx, ty)) { b.x = tx * T - b.w; return 1; }
    } else {
      const tx = Math.floor(b.x / T);
      for (let ty = top; ty <= bot; ty++) if (P.solid(L, tx, ty)) { b.x = (tx + 1) * T; return -1; }
    }
    return 0;
  };

  // Returns {hit: -1 ceiling | 1 floor | 0, platform, tx, ty}
  const res = { hit: 0, platform: null, tx: 0, ty: 0, oneway: false };
  P.moveY = function (L, b, dy, drop, platforms) {
    res.hit = 0; res.platform = null; res.oneway = false;
    if (dy === 0) return res;
    const prevBottom = b.y + b.h;
    b.y += dy;
    const left = Math.floor(b.x / T), right = Math.floor((b.x + b.w - 0.01) / T);
    if (dy > 0) {
      const ty = Math.floor((b.y + b.h - 0.01) / T);
      for (let tx = left; tx <= right; tx++)
        if (P.solid(L, tx, ty)) { b.y = ty * T - b.h; res.hit = 1; res.tx = tx; res.ty = ty; return res; }
      if (!drop) {
        for (let tx = left; tx <= right; tx++)
          if (P.oneway(L, tx, ty) && prevBottom <= ty * T + 0.5) {
            b.y = ty * T - b.h; res.hit = 1; res.oneway = true; res.tx = tx; res.ty = ty; return res;
          }
      }
      if (platforms && !drop) {
        for (const p of platforms) {
          if (b.x + b.w <= p.x + 2 || b.x >= p.x + p.w - 2) continue;
          if (prevBottom <= p.prevY + 1 && b.y + b.h >= p.y) {
            b.y = p.y - b.h; res.hit = 1; res.platform = p; return res;
          }
        }
      }
    } else {
      const ty = Math.floor(b.y / T);
      for (let tx = left; tx <= right; tx++)
        if (P.solid(L, tx, ty)) { b.y = (ty + 1) * T; res.hit = -1; res.tx = tx; res.ty = ty; return res; }
    }
    return res;
  };

  // Is there a solid wall directly beside the body? dir = -1 left, 1 right.
  P.wallAt = function (L, b, dir) {
    const tx = dir > 0 ? Math.floor((b.x + b.w + 1) / T) : Math.floor((b.x - 1) / T);
    // sample the upper-middle of the body so you can't cling by your toes
    const y0 = Math.floor((b.y + 6) / T), y1 = Math.floor((b.y + b.h - 14) / T);
    for (let ty = y0; ty <= y1; ty++) if (P.solid(L, tx, ty)) return true;
    return false;
  };

  P.solidRect = function (L, x, y, w, h) {
    const x0 = Math.floor(x / T), x1 = Math.floor((x + w - 0.01) / T);
    const y0 = Math.floor(y / T), y1 = Math.floor((y + h - 0.01) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (P.solid(L, tx, ty)) return true;
    return false;
  };

  // Hazard test: spikes (partial tile hitboxes) and liquids.
  P.hazard = function (L, b) {
    const x0 = Math.floor(b.x / T), x1 = Math.floor((b.x + b.w - 0.01) / T);
    const y0 = Math.floor(b.y / T), y1 = Math.floor((b.y + b.h - 0.01) / T);
    let out = null;
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        const t = L.get(tx, ty);
        if (t === 3) {
          if (b.y + b.h > ty * T + 22 && b.x + b.w > tx * T + 5 && b.x < tx * T + T - 5) out = out || 'spike';
        } else if (t === 4) {
          if (b.y < ty * T + T - 22 && b.x + b.w > tx * T + 5 && b.x < tx * T + T - 5) out = out || 'spike';
        } else if (t === 7) {
          const surf = L.get(tx, ty - 1) !== 7;
          if (!surf || b.y + b.h > ty * T + 26) return 'liquid';
        }
      }
    return out;
  };
})(window.G);
