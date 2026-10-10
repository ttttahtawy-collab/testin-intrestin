// Core utilities: math, easing, colour helpers, seeded random, canvas helpers.
// Everything in the game hangs off the global namespace `G` so the game runs
// from file:// without a bundler or module loader.
window.G = window.G || {};
(function (G) {
  'use strict';
  const U = (G.U = {});

  U.TAU = Math.PI * 2;
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.invLerp = (a, b, v) => (v - a) / (b - a);
  U.approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
  U.sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  U.overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  U.damp = (a, b, lambda, dt) => U.lerp(a, b, 1 - Math.exp(-lambda * dt));

  // Deterministic PRNG (mulberry32) so procedural art is identical every run.
  U.rng = function (seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.hash2 = function (x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + (seed || 0) * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  U.strHash = function (str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  };

  // Easing
  U.ease = {
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inCubic: (t) => t * t * t,
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack: (t) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    outElastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (U.TAU / 3)) + 1),
  };

  // Colour helpers (hex strings in, hex/rgba strings out). Results are cached
  // because tile/background pre-rendering calls them thousands of times.
  const rgbCache = new Map();
  U.hexToRgb = function (hex) {
    let c = rgbCache.get(hex);
    if (c) return c;
    let h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, c);
    return c;
  };
  U.rgbToHex = (r, g, b) =>
    '#' + ((1 << 24) | (U.clamp(Math.round(r), 0, 255) << 16) | (U.clamp(Math.round(g), 0, 255) << 8) | U.clamp(Math.round(b), 0, 255)).toString(16).slice(1);
  U.mix = function (a, b, t) {
    const A = U.hexToRgb(a), B = U.hexToRgb(b);
    return U.rgbToHex(U.lerp(A[0], B[0], t), U.lerp(A[1], B[1], t), U.lerp(A[2], B[2], t));
  };
  // amt > 0 lightens toward white, amt < 0 darkens toward black.
  U.shade = (hex, amt) => (amt >= 0 ? U.mix(hex, '#ffffff', amt) : U.mix(hex, '#000000', -amt));
  U.rgba = function (hex, a) {
    const c = U.hexToRgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  };
  U.hsl = (h, s, l) => 'hsl(' + h + ',' + s + '%,' + l + '%)';

  // Canvas helpers
  U.roundRect = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  U.poly = function (ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
  };
  // Tapered limb: a capsule from (x1,y1) radius r1 to (x2,y2) radius r2.
  U.limb = function (ctx, x1, y1, r1, x2, y2, r2) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.arc(x1, y1, r1, a + Math.PI / 2, a - Math.PI / 2, false);
    ctx.arc(x2, y2, r2, a - Math.PI / 2, a + Math.PI / 2, false);
    ctx.closePath();
  };
  U.makeCanvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  };
  U.formatTime = function (t) {
    if (t == null || !isFinite(t)) return '--:--';
    const m = Math.floor(t / 60), s = Math.floor(t % 60), cs = Math.floor((t * 100) % 100);
    return m + ':' + String(s).padStart(2, '0') + '.' + String(cs).padStart(2, '0');
  };
})(window.G);
