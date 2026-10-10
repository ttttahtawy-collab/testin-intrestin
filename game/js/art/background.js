// Faceted parallax backgrounds. Each layer is generated once into a
// horizontally tileable offscreen canvas and then scrolled cheaply.
(function (G) {
  'use strict';
  const U = G.U;
  const LW = 1280; // logical width of one tile of a layer
  const LH = 540;

  // Periodic 1D noise: sum of sines with integer frequencies over LW.
  function pnoise(rng) {
    const comps = [];
    for (let i = 0; i < 5; i++) comps.push({ f: 1 + Math.floor(rng() * (2 + i * 3)), p: rng() * U.TAU, a: 1 / (i + 1.2) });
    const norm = comps.reduce((s, c) => s + c.a, 0);
    return (x) => comps.reduce((s, c) => s + Math.sin((x / LW) * U.TAU * c.f + c.p) * c.a, 0) / norm;
  }

  function buildLayer(L, rf) {
    const cv = U.makeCanvas(LW * rf, LH * rf);
    const ctx = cv.getContext('2d');
    ctx.scale(rf, rf);
    const rng = U.rng(L.seed * 977 + 13);
    const n = pnoise(rng);
    const baseY = L.base * LH, amp = L.amp * LH;
    const [c0, c1] = L.colors;
    const fillBelow = (pts) => {
      ctx.beginPath();
      ctx.moveTo(0, LH);
      pts.forEach((p) => ctx.lineTo(p[0], p[1]));
      ctx.lineTo(LW, LH);
      ctx.closePath();
      ctx.fill();
    };

    if (L.kind === 'mountains' || L.kind === 'hills' || L.kind === 'rocks') {
      const step = L.kind === 'hills' ? 80 : L.kind === 'rocks' ? 48 : 96;
      const pts = [];
      for (let x = 0; x <= LW; x += step) {
        let y = baseY - (n(x) * 0.5 + 0.5) * amp;
        if (L.kind !== 'hills' && x % (step * 2) === step) y -= amp * 0.25 * rng(); // peaks
        if (x === LW) y = pts[0][1];
        pts.push([x, y]);
      }
      ctx.fillStyle = c0;
      fillBelow(pts);
      // facets: each ridge vertex drops a triangle to a valley point lower down
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const midX = (a[0] + b[0]) / 2, low = Math.max(a[1], b[1]) + (LH - Math.max(a[1], b[1])) * 0.35;
        const peak = a[1] < b[1] ? a : b;
        ctx.fillStyle = a[1] < b[1] ? U.shade(c1, -0.06) : c1; // slope facing light
        U.poly(ctx, [a[0], a[1], b[0], b[1], midX, low]);
        ctx.fill();
        ctx.fillStyle = U.shade(c0, -0.05 - rng() * 0.05);
        U.poly(ctx, [a[0], a[1], midX, low, a[0] - step * 0.3, LH]);
        ctx.fill();
        if (L.snow && peak[1] < baseY - amp * 0.55) {
          ctx.fillStyle = L.snow;
          const s = 0.28;
          const other = peak === a ? b : a;
          U.poly(ctx, [peak[0], peak[1], U.lerp(peak[0], other[0], s), U.lerp(peak[1], other[1], s) + 4, U.lerp(peak[0], midX, s * 0.8), U.lerp(peak[1], low, s * 0.5)]);
          ctx.fill();
          ctx.fillStyle = U.shade(L.snow, -0.1);
          U.poly(ctx, [peak[0], peak[1], U.lerp(peak[0], midX, s * 0.8), U.lerp(peak[1], low, s * 0.5), peak[0] - step * 0.12, peak[1] + 22]);
          ctx.fill();
        }
      }
    } else if (L.kind === 'trees' || L.kind === 'pines') {
      // base strip
      const pts = [];
      for (let x = 0; x <= LW; x += 64) pts.push([x, baseY - (n(x) * 0.5 + 0.5) * amp * 0.5]);
      pts[pts.length - 1][1] = pts[0][1];
      ctx.fillStyle = c0;
      fillBelow(pts);
      const count = L.kind === 'pines' ? 34 : 22;
      for (let i = 0; i < count; i++) {
        const x = (i / count) * LW + rng() * 30;
        const gy = baseY - (n(x) * 0.5 + 0.5) * amp * 0.5 + 6;
        const h = (L.kind === 'pines' ? 90 : 70) + rng() * 60;
        const w = L.kind === 'pines' ? h * 0.36 : h * 0.55;
        for (const ox of [0, -LW, LW]) drawTree(ctx, x + ox, gy, w, h, L, rng);
      }
    } else if (L.kind === 'crystals') {
      ctx.fillStyle = c0;
      const pts = [];
      for (let x = 0; x <= LW; x += 80) pts.push([x, baseY + (n(x) * 0.5 + 0.5) * amp * 0.2]);
      pts[pts.length - 1][1] = pts[0][1];
      fillBelow(pts);
      const count = 16;
      for (let i = 0; i < count; i++) {
        const x = (i / count) * LW + rng() * 50;
        const h = amp * (0.5 + rng());
        const w = 18 + rng() * 26;
        const tilt = (rng() - 0.5) * 0.5;
        for (const ox of [0, -LW, LW]) drawCrystal(ctx, x + ox, baseY + 20, w, h, tilt, c0, c1, L.glow);
      }
    } else if (L.kind === 'stalag') {
      ctx.fillStyle = c0;
      // ceiling stalactites
      for (let i = 0; i < 26; i++) {
        const x = (i / 26) * LW + rng() * 20, w = 20 + rng() * 40, h = 40 + rng() * 140;
        for (const ox of [0, -LW, LW]) {
          ctx.fillStyle = c0;
          U.poly(ctx, [x + ox - w / 2, -2, x + ox + w / 2, -2, x + ox + w * 0.1, h]);
          ctx.fill();
          ctx.fillStyle = c1;
          U.poly(ctx, [x + ox - w / 2, -2, x + ox, -2, x + ox + w * 0.1, h]);
          ctx.fill();
        }
      }
      const pts = [];
      for (let x = 0; x <= LW; x += 40) pts.push([x, baseY - Math.abs(n(x)) * amp]);
      pts[pts.length - 1][1] = pts[0][1];
      ctx.fillStyle = c0;
      fillBelow(pts);
      for (let i = 0; i < pts.length - 1; i += 2) {
        ctx.fillStyle = c1;
        U.poly(ctx, [pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], pts[i][0] + 10, LH]);
        ctx.fill();
      }
    } else if (L.kind === 'spires') {
      ctx.fillStyle = c0;
      const pts = [];
      for (let x = 0; x <= LW; x += 64) pts.push([x, baseY + 30 - (n(x) * 0.5 + 0.5) * 40]);
      pts[pts.length - 1][1] = pts[0][1];
      fillBelow(pts);
      for (let i = 0; i < 9; i++) {
        const x = (i / 9) * LW + rng() * 60;
        const w = 40 + rng() * 50, h = amp * (0.6 + rng() * 0.8);
        for (const ox of [0, -LW, LW]) drawSpire(ctx, x + ox, baseY + 40, w, h, c0, c1, rng);
      }
    }
    return cv;
  }

  function drawTree(ctx, x, gy, w, h, L, rng) {
    const [c0, c1] = L.colors;
    if (L.kind === 'pines') {
      for (let k = 0; k < 3; k++) {
        const ty = gy - h * (0.35 + k * 0.28), bw = w * (1 - k * 0.25), bh = h * 0.45;
        ctx.fillStyle = c0;
        U.poly(ctx, [x, ty - bh * 0.6, x + bw / 2, ty + bh * 0.4, x - bw / 2, ty + bh * 0.4]);
        ctx.fill();
        ctx.fillStyle = c1;
        U.poly(ctx, [x, ty - bh * 0.6, x - bw / 2, ty + bh * 0.4, x - bw * 0.05, ty + bh * 0.4]);
        ctx.fill();
        if (L.snow) {
          ctx.fillStyle = L.snow;
          U.poly(ctx, [x, ty - bh * 0.6, x - bw * 0.16, ty - bh * 0.15, x + bw * 0.16, ty - bh * 0.15]);
          ctx.fill();
        }
      }
    } else {
      ctx.fillStyle = L.trunk || '#6b4a30';
      ctx.fillRect(x - 4, gy - h * 0.35, 8, h * 0.4);
      // low-poly round canopy: hexagon split in facets
      const cy = gy - h * 0.62, r = w * 0.55;
      const pts = [];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * U.TAU - Math.PI / 2;
        pts.push([x + Math.cos(a) * r * (0.85 + rng() * 0.2), cy + Math.sin(a) * r * 0.9]);
      }
      for (let i = 0; i < 7; i++) {
        const a = pts[i], b = pts[(i + 1) % 7];
        const lit = (a[0] + b[0]) / 2 < x && (a[1] + b[1]) / 2 < cy + r * 0.2;
        ctx.fillStyle = lit ? c1 : U.shade(c0, -0.05 * (i % 2));
        U.poly(ctx, [x - r * 0.15, cy - r * 0.1, a[0], a[1], b[0], b[1]]);
        ctx.fill();
      }
    }
  }
  function drawCrystal(ctx, x, by, w, h, tilt, c0, c1, glow) {
    ctx.save();
    ctx.translate(x, by);
    ctx.rotate(tilt);
    ctx.fillStyle = c1;
    U.poly(ctx, [-w / 2, 0, -w / 2, -h, 0, -h - w * 0.8, w / 2, -h, w / 2, 0]);
    ctx.fill();
    ctx.fillStyle = U.shade(c1, 0.12);
    U.poly(ctx, [-w / 2, 0, -w / 2, -h, 0, -h - w * 0.8, 0, 0]);
    ctx.fill();
    if (glow) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = glow;
      U.poly(ctx, [-w * 0.15, -h * 0.2, -w * 0.15, -h * 0.9, 0, -h - w * 0.5, w * 0.1, -h * 0.85]);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  function drawSpire(ctx, x, by, w, h, c0, c1, rng) {
    ctx.fillStyle = c0;
    ctx.fillRect(x - w / 2, by - h, w, h);
    ctx.fillStyle = c1;
    ctx.fillRect(x - w / 2, by - h, w * 0.4, h);
    // pointed roof
    ctx.fillStyle = c0;
    U.poly(ctx, [x - w * 0.62, by - h, x, by - h - w * 1.3, x + w * 0.62, by - h]);
    ctx.fill();
    ctx.fillStyle = c1;
    U.poly(ctx, [x - w * 0.62, by - h, x, by - h - w * 1.3, x - w * 0.05, by - h]);
    ctx.fill();
    // glowing windows
    for (let k = 0; k < 3; k++) {
      if (rng() < 0.4) continue;
      ctx.fillStyle = 'rgba(255,140,60,0.75)';
      const wy = by - h + 24 + k * (h / 4);
      ctx.beginPath();
      ctx.moveTo(x - 4, wy + 14); ctx.lineTo(x - 4, wy + 4); ctx.lineTo(x, wy); ctx.lineTo(x + 4, wy + 4); ctx.lineTo(x + 4, wy + 14);
      ctx.fill();
    }
  }

  class Background {
    constructor(theme) {
      this.theme = theme;
      this.layers = null;
      this.rfv = -1;
      this.amb = [];
      const rng = U.rng(77);
      for (let i = 0; i < 46; i++) this.amb.push({ x: rng() * 2000, y: rng() * 600, z: 0.3 + rng() * 0.9, ph: rng() * 10, s: rng() });
      this.t = 0;
    }
    ensure() {
      const R = G.R;
      if (this.rfv === R.rfVersion && this.layers) return;
      this.rfv = R.rfVersion;
      this.layers = this.theme.layers.map((L) => ({ L, cv: buildLayer(L, R.rf) }));
    }
    update(dt) { this.t += dt; }
    draw(ctx, camX, camY, W, H, levelH) {
      this.ensure();
      const th = this.theme;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, th.sky[0]); g.addColorStop(0.6, th.sky[1]); g.addColorStop(1, th.sky[2]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      if (th.sun) {
        const sx = th.sun.x * W - camX * 0.02, sy = th.sun.y * H;
        const rg = ctx.createRadialGradient(sx, sy, th.sun.r * 0.3, sx, sy, th.sun.r * 3);
        rg.addColorStop(0, U.rgba(th.sun.color, 0.9));
        rg.addColorStop(0.25, U.rgba(th.sun.color, 0.35));
        rg.addColorStop(1, U.rgba(th.sun.color, 0));
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = th.sun.color;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * U.TAU;
          ctx.lineTo(sx + Math.cos(a) * th.sun.r, sy + Math.sin(a) * th.sun.r);
        }
        ctx.fill();
      }
      // vertical parallax: keep horizon stable but drift with camera
      const vy = levelH ? U.clamp((camY - (levelH - H)) * 0.12, -80, 40) : 0;
      for (const { L, cv } of this.layers) {
        const off = -((camX * L.par) % LW + LW) % LW;
        const y = -vy * (L.par * 2) ;
        for (let x = off; x < W; x += LW) ctx.drawImage(cv, x, y, LW, LH);
        // fill below the layer if camera pulled it up
        if (y < 0) {
          ctx.fillStyle = L.colors[0];
          ctx.fillRect(0, LH + y - 1, W, -y + 2);
        }
      }
    }
    drawAmbient(ctx, camX, camY, W, H) {
      const kind = this.theme.ambient;
      const t = this.t;
      ctx.save();
      for (const a of this.amb) {
        let x = (a.x - camX * a.z * 0.5) % (W + 40);
        if (x < -20) x += W + 40;
        let y = a.y;
        if (kind === 'snow') {
          y = (a.y + t * (30 + a.z * 50)) % (H + 20) - 10;
          x += Math.sin(t + a.ph) * 14;
          ctx.fillStyle = 'rgba(255,255,255,' + (0.5 + a.z * 0.4) + ')';
          ctx.beginPath(); ctx.arc(x, y, 1.5 + a.z * 2.2, 0, U.TAU); ctx.fill();
        } else if (kind === 'embers') {
          y = H - ((a.y + t * (25 + a.z * 40)) % (H + 20)) + 10;
          x += Math.sin(t * 1.5 + a.ph) * 10;
          ctx.fillStyle = U.rgba(a.s > 0.5 ? '#ff9a3a' : '#ffd36a', 0.4 + 0.5 * Math.abs(Math.sin(t * 3 + a.ph)));
          ctx.fillRect(x, y, 2 + a.z * 2, 2 + a.z * 2);
        } else if (kind === 'sparkle') {
          y = (a.y % H);
          const tw = Math.max(0, Math.sin(t * 2 + a.ph * 3));
          ctx.fillStyle = U.rgba(a.s > 0.5 ? '#7ff5e4' : '#c6a8ff', tw * 0.8);
          const s = (1 + a.z * 2.5) * tw;
          ctx.beginPath();
          ctx.moveTo(x, y - s * 2); ctx.lineTo(x + s * 0.5, y); ctx.lineTo(x, y + s * 2); ctx.lineTo(x - s * 0.5, y);
          ctx.fill();
        } else {
          y = (a.y + Math.sin(t * 0.7 + a.ph) * 20) % H;
          x += Math.cos(t * 0.5 + a.ph) * 20;
          ctx.fillStyle = U.rgba('#fffbe0', 0.35 + a.z * 0.3);
          ctx.beginPath(); ctx.arc(x, y, 1 + a.z * 1.8, 0, U.TAU); ctx.fill();
        }
      }
      ctx.restore();
    }
  }
  G.Background = Background;
})(window.G);
