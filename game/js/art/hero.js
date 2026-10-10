// EMBER — the hero. Drawn procedurally every frame from a pose description so
// all animation (squash/stretch, run cycle, flips, punches) stays perfectly
// crisp at any resolution. Design follows the reference model: glossy red,
// big round head with subtle low-poly facets, two tall white oval eyes,
// raised brow bars, a wide open smile, stubby arms and tapered pointed legs.
//
// Local space: origin at the feet (bottom centre), +x = facing direction,
// total height ≈ 68 units at scale 1.
(function (G) {
  'use strict';
  const U = G.U;
  const H = (G.Hero = {});

  const C = (H.COLORS = {
    base: '#e8251d',
    light: '#ff4a3a',
    hi: '#ff7563',
    mid: '#cf1f18',
    dark: '#a8130f',
    deep: '#7c0b09',
    brow: '#c2160f',
    browHi: '#ff4a3a',
    mouth: '#5f0809',
    tongue: '#e0454b',
    eye: '#ffffff',
    eyeShade: '#dfe5f2',
    rim: '#ffd2c8',
  });

  // ---- precomputed low-poly head geometry (unit circle) ----------------
  const OUT_N = 16, IN_N = 8;
  const outer = [], inner = [];
  for (let i = 0; i < OUT_N; i++) {
    const a = (i / OUT_N) * U.TAU - Math.PI / 2 + 0.11;
    outer.push([Math.cos(a), Math.sin(a)]);
  }
  for (let i = 0; i < IN_N; i++) {
    const a = (i / IN_N) * U.TAU - Math.PI / 2 + 0.3;
    inner.push([Math.cos(a) * 0.56, Math.sin(a) * 0.56]);
  }
  const center = [-0.12, -0.14];
  const tris = [];
  // outer band: each inner vertex connects to two outer vertices
  for (let i = 0; i < OUT_N; i++) {
    const o0 = outer[i], o1 = outer[(i + 1) % OUT_N];
    const ii = Math.floor(((i + 0.5) / OUT_N) * IN_N) % IN_N;
    tris.push([o0, o1, inner[ii]]);
  }
  for (let j = 0; j < IN_N; j++) {
    const i0 = inner[j], i1 = inner[(j + 1) % IN_N];
    // stitch triangle between inner edge and the outer vertex between them
    const oi = Math.round(((j + 1) / IN_N) * OUT_N) % OUT_N;
    tris.push([i0, i1, outer[oi]]);
    tris.push([i0, i1, center]);
  }
  function facetColors(ls) {
    // light direction in local space (ls = which local x side is lit)
    let L = [ls * 0.5, -0.62, 0.6];
    const ln = Math.hypot(L[0], L[1], L[2]);
    L = L.map((v) => v / ln);
    return tris.map((t) => {
      const cx = (t[0][0] + t[1][0] + t[2][0]) / 3, cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
      const nz = Math.sqrt(Math.max(0.05, 1 - cx * cx - cy * cy));
      const nl = Math.hypot(cx, cy, nz);
      let b = (cx * L[0] + cy * L[1] + nz * L[2]) / nl;
      b = U.clamp(b, 0, 1);
      // slight per-facet variation for the low-poly sparkle
      b = U.clamp(b + (U.hash2(Math.round(cx * 100), Math.round(cy * 100), 7) - 0.5) * 0.06, 0, 1);
      if (b > 0.82) return U.mix(C.light, C.hi, (b - 0.82) / 0.18);
      if (b > 0.5) return U.mix(C.base, C.light, (b - 0.5) / 0.32);
      return U.mix(C.dark, C.base, b / 0.5);
    });
  }
  const FACETS = { '1': facetColors(1), '-1': facetColors(-1) };

  H.pose = function () {
    return {
      sx: 1, sy: 1, lean: 0, bob: 0,
      legN: 0.08, legF: -0.1, // near/far leg angles from vertical (+ = forward)
      armN: 0.55, armF: -0.5, // arm angles from hanging-down (+ = forward)
      reachN: 1, reachF: 1,
      headTilt: 0, blink: 0, mouth: 'smile', brow: 0, spin: 0, flash: 0,
      eyesX: 0, squint: false,
    };
  };

  function limb(ctx, x0, y0, a, len, r0, r1, colLight, colDark, ls) {
    const x1 = x0 + Math.sin(a) * len, y1 = y0 + Math.cos(a) * len;
    // perpendicular for the two-tone facet split
    const nx = Math.cos(a), ny = -Math.sin(a);
    const g = ctx.createLinearGradient(x0 - nx * r0 * ls, y0 - ny * r0 * ls, x0 + nx * r0 * ls, y0 + ny * r0 * ls);
    g.addColorStop(0, colLight); g.addColorStop(0.52, colLight);
    g.addColorStop(0.52, colDark); g.addColorStop(1, colDark);
    ctx.fillStyle = g;
    U.limb(ctx, x0, y0, r0, x1, y1, r1);
    ctx.fill();
    return [x1, y1];
  }

  // Draw the hero. f = facing (1 right, -1 left).
  H.draw = function (ctx, x, y, f, p, sc) {
    sc = sc || 1;
    const ls = -f; // light from world top-left
    const white = p.flash > 0.5;
    const col = (c) => (white ? '#ffffff' : c);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sc * f, sc);
    if (p.spin) { ctx.translate(0, -32); ctx.rotate(p.spin); ctx.translate(0, 32); }
    ctx.scale(p.sx, p.sy);

    const hipY = -18;
    // ---- legs (far first) ----
    limb(ctx, -4, hipY, p.legF, 19, 5.8, 2.1, col(C.mid), col(C.deep), ls);
    limb(ctx, 3.5, hipY, p.legN, 19, 6.2, 2.2, col(C.light), col(C.mid), ls);

    // ---- upper body (leans around the hips) ----
    ctx.save();
    ctx.translate(0, hipY);
    ctx.rotate(p.lean);
    ctx.translate(0, -hipY + p.bob);

    // far arm (behind torso)
    limb(ctx, -6, -35, p.armF, 14.5 * p.reachF, 4.6, 2.9, col(C.mid), col(C.deep), ls);

    // torso: bean shape with three facet bands
    ctx.beginPath();
    ctx.moveTo(-9, -37);
    ctx.bezierCurveTo(-12.5, -30, -12.5, -19, -10, -15);
    ctx.quadraticCurveTo(0, -9.5, 10.5, -15);
    ctx.bezierCurveTo(13, -20, 12.5, -31, 8.5, -38);
    ctx.quadraticCurveTo(0, -41, -9, -37);
    ctx.closePath();
    const tg = ctx.createLinearGradient(-12 * ls, 0, 12 * ls, 0);
    tg.addColorStop(0, col(C.light)); tg.addColorStop(0.36, col(C.light));
    tg.addColorStop(0.36, col(C.base)); tg.addColorStop(0.7, col(C.base));
    tg.addColorStop(0.7, col(C.dark)); tg.addColorStop(1, col(C.dark));
    ctx.fillStyle = tg;
    ctx.fill();
    if (!white) {
      // belly facet
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = '#fff';
      U.poly(ctx, [-6 * ls, -34, 1 * ls, -36, 3 * ls, -24, -5 * ls, -18]);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // near arm (in front of torso)
    limb(ctx, 6, -35, p.armN, 14.5 * p.reachN, 4.8, 3.0, col(C.light), col(C.mid), ls);

    // ---- head ----
    ctx.save();
    ctx.translate(2, -52);
    ctx.rotate(p.headTilt);
    drawHead(ctx, p, ls, white);
    ctx.restore();

    ctx.restore(); // upper body
    ctx.restore();
  };

  function drawHead(ctx, p, ls, white) {
    const rx = 16.5, ry = 15.5;
    const fc = FACETS[String(ls)];
    // silhouette (slightly faceted outline)
    ctx.beginPath();
    outer.forEach((o, i) => (i ? ctx.lineTo(o[0] * rx, o[1] * ry) : ctx.moveTo(o[0] * rx, o[1] * ry)));
    ctx.closePath();
    ctx.fillStyle = white ? '#fff' : C.base;
    ctx.fill();
    if (!white) {
      for (let i = 0; i < tris.length; i++) {
        const t = tris[i];
        ctx.beginPath();
        ctx.moveTo(t[0][0] * rx, t[0][1] * ry);
        ctx.lineTo(t[1][0] * rx, t[1][1] * ry);
        ctx.lineTo(t[2][0] * rx, t[2][1] * ry);
        ctx.closePath();
        ctx.fillStyle = fc[i];
        ctx.fill();
        ctx.strokeStyle = fc[i];
        ctx.lineWidth = 0.6; // hide hairline seams between facets
        ctx.stroke();
      }
      // rim light on the shadow side
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, rx - 0.6, ry - 0.6, 0, ls > 0 ? 0.15 : Math.PI - 1.35, ls > 0 ? 1.35 : Math.PI - 0.15);
      ctx.strokeStyle = U.rgba(C.rim, 0.55);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
      // specular glint
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(-7 * ls, -8.5, 4.2, 2.2, -0.6 * ls, 0, U.TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // ---- face (shifted toward facing side, 3/4 view) ----
    const ex = p.eyesX || 0;
    const eyes = [[3.2 + ex, -1.8, 3.3, 5.9], [11.4 + ex * 0.8, -1.8, 2.7, 5.6]];
    // brows
    eyes.forEach((e, i) => {
      const bx = e[0], by = -10.2 - (p.brow > 0 ? p.brow * 1.5 : 0);
      const tilt = p.brow < 0 ? (i === 0 ? 0.35 : -0.35) * -p.brow : 0;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(tilt);
      U.roundRect(ctx, -e[2] - 1.2, -1.6, e[2] * 2 + 2.4, 3.4, 1.7);
      ctx.fillStyle = white ? '#ffffff' : C.brow;
      ctx.fill();
      if (!white) {
        U.roundRect(ctx, -e[2] - 0.6, -1.5, e[2] * 2 + 1.2, 1.3, 0.7);
        ctx.fillStyle = C.browHi;
        ctx.fill();
      }
      ctx.restore();
    });
    // eyes
    eyes.forEach((e) => {
      if (p.squint) {
        ctx.strokeStyle = white ? '#fff' : '#ffffff';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(e[0] - e[2], e[1] - 2.5);
        ctx.lineTo(e[0] + e[2] * 0.6, e[1]);
        ctx.lineTo(e[0] - e[2], e[1] + 2.5);
        ctx.stroke();
        return;
      }
      const ry = Math.max(0.6, e[3] * (1 - p.blink));
      ctx.beginPath();
      ctx.ellipse(e[0], e[1], e[2], ry, 0, 0, U.TAU);
      if (white) { ctx.fillStyle = '#fff'; ctx.fill(); return; }
      const eg = ctx.createLinearGradient(0, e[1] - ry, 0, e[1] + ry);
      eg.addColorStop(0, C.eye); eg.addColorStop(0.65, C.eye); eg.addColorStop(1, C.eyeShade);
      ctx.fillStyle = eg;
      ctx.fill();
    });
    // mouth
    const mx = 7.6 + ex * 0.8, my = 5.6;
    if (white) return;
    ctx.fillStyle = C.mouth;
    if (p.mouth === 'o') {
      ctx.beginPath();
      ctx.ellipse(mx, my + 1, 2.6, 3.2, 0, 0, U.TAU);
      ctx.fill();
    } else if (p.mouth === 'grit') {
      U.roundRect(ctx, mx - 5.5, my - 0.5, 11, 4, 1.8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      U.roundRect(ctx, mx - 4.5, my + 0.2, 9, 1.6, 0.8);
      ctx.fill();
    } else if (p.mouth === 'sad') {
      ctx.beginPath();
      ctx.moveTo(mx - 4.5, my + 3.5);
      ctx.quadraticCurveTo(mx, my - 1.5, mx + 4.5, my + 3.5);
      ctx.quadraticCurveTo(mx, my + 1.5, mx - 4.5, my + 3.5);
      ctx.fill();
    } else {
      const big = p.mouth === 'open' ? 1.3 : 1;
      ctx.beginPath();
      ctx.moveTo(mx - 6.4, my - 1.2);
      ctx.quadraticCurveTo(mx, my + 0.4, mx + 6.0, my - 1.6);
      ctx.quadraticCurveTo(mx + 4.6, my + 6.4 * big, mx - 0.4, my + 6.4 * big);
      ctx.quadraticCurveTo(mx - 5.6, my + 6.0 * big, mx - 6.4, my - 1.2);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = C.tongue;
      ctx.beginPath();
      ctx.ellipse(mx - 0.4, my + 6.6 * big, 4.2, 2.8, 0, 0, U.TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  // Animated pose generator shared by menus/cutscenes (not the player).
  H.idlePose = function (t, extra) {
    const p = H.pose();
    const b = Math.sin(t * 2.6);
    p.bob = b * 0.9;
    p.sy = 1 + b * 0.012; p.sx = 1 - b * 0.012;
    p.armN = 0.5 + b * 0.06; p.armF = -0.45 - b * 0.06;
    p.blink = blinkAt(t);
    return Object.assign(p, extra || {});
  };
  H.walkPose = function (t, speed) {
    const p = H.pose();
    const ph = t * (speed || 10);
    const s = Math.sin(ph);
    p.legN = s * 0.55; p.legF = -s * 0.55;
    p.armN = 0.45 - s * 0.7; p.armF = -0.3 + s * 0.7;
    p.bob = -Math.abs(Math.cos(ph)) * 2.4;
    p.lean = 0.12;
    p.blink = blinkAt(t);
    return p;
  };
  function blinkAt(t) {
    const c = t % 3.7;
    return c < 0.12 ? Math.sin((c / 0.12) * Math.PI) : 0;
  }
  H.blinkAt = blinkAt;
})(window.G);
