// Shared faceted icon/character art: gems, prism shards, hearts, the story
// characters (Lumi the prism sprite, King Monochrome) and dialogue portraits.
(function (G) {
  'use strict';
  const U = G.U;
  const I = (G.Icons = {});

  I.gem = function (ctx, x, y, s, t, color) {
    color = color || '#3fe0ff';
    const sq = Math.cos(t || 0); // spin by squashing horizontally
    const w = 9 * s * (0.35 + 0.65 * Math.abs(sq)), h = 12 * s;
    const lit = sq > 0;
    ctx.fillStyle = U.shade(color, -0.35);
    U.poly(ctx, [x, y - h, x + w, y - h * 0.25, x, y + h, x - w, y - h * 0.25]);
    ctx.fill();
    ctx.fillStyle = lit ? U.shade(color, 0.15) : color;
    U.poly(ctx, [x, y - h, x - w, y - h * 0.25, x, y + h * 0.1]);
    ctx.fill();
    ctx.fillStyle = color;
    U.poly(ctx, [x, y - h, x + w, y - h * 0.25, x, y + h * 0.1]);
    ctx.fill();
    ctx.fillStyle = U.shade(color, -0.15);
    U.poly(ctx, [x - w, y - h * 0.25, x, y + h * 0.1, x, y + h]);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    U.poly(ctx, [x - w * 0.15, y - h * 0.82, x - w * 0.55, y - h * 0.3, x - w * 0.15, y - h * 0.3]);
    ctx.fill();
  };

  const PRISM = ['#ff4b6e', '#ffa53a', '#ffe14a', '#5be37a', '#3fc8ff', '#8a6bff'];
  I.PRISM = PRISM;
  I.shard = function (ctx, x, y, s, t, ghost) {
    ctx.save();
    ctx.translate(x, y);
    const k = Math.cos(t * 1.6);
    if (!ghost) {
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 30 * s);
      g.addColorStop(0, 'rgba(255,255,255,0.65)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 30 * s, 0, U.TAU); ctx.fill();
    }
    ctx.globalAlpha = ghost ? 0.4 : 1;
    ctx.scale(0.4 + 0.6 * Math.abs(k), 1);
    const h = 18 * s, w = 9 * s;
    const pts = [[0, -h], [w, -h * 0.35], [w * 0.8, h * 0.6], [0, h], [-w * 0.8, h * 0.6], [-w, -h * 0.35]];
    const off = Math.floor(t * 3);
    for (let i = 0; i < 6; i++) {
      const a = pts[i], b = pts[(i + 1) % 6];
      ctx.fillStyle = ghost ? (i % 2 ? '#9aa3c0' : '#c7cde0') : PRISM[(i + off) % 6];
      U.poly(ctx, [0, -h * 0.05, a[0], a[1], b[0], b[1]]);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    U.poly(ctx, [0, -h, -w * 0.5, -h * 0.4, 0, -h * 0.05]);
    ctx.fill();
    ctx.restore();
  };

  I.heart = function (ctx, x, y, s, full, flash) {
    const col = full ? '#ff3b4f' : '#3a2b45';
    const pts = [[0, 10], [-12, -1], [-12, -7], [-7, -12], [0, -7], [7, -12], [12, -7], [12, -1]];
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = full ? '#8c0f22' : '#1b1424';
    U.poly(ctx, [0, 13, -14, 0, -14, -8, -8, -14, 0, -9, 8, -14, 14, -8, 14, 0]);
    ctx.fill();
    ctx.fillStyle = col;
    U.poly(ctx, pts.flat());
    ctx.fill();
    if (full) {
      ctx.fillStyle = '#ff7d8a';
      U.poly(ctx, [-12, -7, -7, -12, 0, -7, -6, -2]);
      ctx.fill();
      ctx.fillStyle = '#d61f39';
      U.poly(ctx, [0, 10, 12, -1, 4, -2]);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      U.poly(ctx, [-9, -7, -7, -10, -5, -7]);
      ctx.fill();
    }
    if (flash) {
      ctx.globalAlpha = flash;
      ctx.fillStyle = '#fff';
      U.poly(ctx, pts.flat());
      ctx.fill();
    }
    ctx.restore();
  };

  // Lumi: a little prism sprite who guides Ember.
  I.lumi = function (ctx, x, y, s, t) {
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 3) * 3 * s);
    ctx.scale(s, s);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 34);
    g.addColorStop(0, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(160,220,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, U.TAU); ctx.fill();
    // wings
    const flap = Math.sin(t * 18) * 0.35;
    ctx.fillStyle = 'rgba(200,240,255,0.75)';
    ctx.save(); ctx.rotate(-0.5 + flap); U.poly(ctx, [-4, -2, -24, -12, -18, 4]); ctx.fill(); ctx.restore();
    ctx.save(); ctx.rotate(0.5 - flap); U.poly(ctx, [4, -2, 24, -12, 18, 4]); ctx.fill(); ctx.restore();
    const pts = [[0, -16], [11, -4], [7, 13], [-7, 13], [-11, -4]];
    for (let i = 0; i < 5; i++) {
      const a = pts[i], b = pts[(i + 1) % 5];
      ctx.fillStyle = PRISM[(i + Math.floor(t * 2)) % 6];
      U.poly(ctx, [0, 0, a[0], a[1], b[0], b[1]]);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    U.poly(ctx, [-11, -4, 0, -16, 0, 0]);
    ctx.fill();
    // face
    const bl = G.Hero.blinkAt(t + 1.3);
    ctx.fillStyle = '#1d1a3a';
    ctx.beginPath(); ctx.ellipse(-3.5, 1, 1.7, 2.6 * (1 - bl) + 0.3, 0, 0, U.TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(3.5, 1, 1.7, 2.6 * (1 - bl) + 0.3, 0, 0, U.TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 5.5, 2, 0, Math.PI); ctx.fill();
    ctx.restore();
  };

  // King Monochrome: angular grey tyrant who drained the world's colour.
  I.king = function (ctx, x, y, s, t, o) {
    o = o || {};
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 1.8) * 4 * s);
    ctx.scale(s * (o.facing || 1), s);
    const flash = o.flash > 0;
    const c = (hex) => (flash ? '#ffffff' : hex);
    // cape
    const sway = Math.sin(t * 2) * 4;
    ctx.fillStyle = c('#2b2933');
    U.poly(ctx, [-16, -46, 16, -46, 34 + sway, 30, 10, 22, 0, 34, -12, 22, -34 + sway, 30]);
    ctx.fill();
    ctx.fillStyle = c('#3b3845');
    U.poly(ctx, [-16, -46, 0, -40, 0, 34, -12, 22, -34 + sway, 30]);
    ctx.fill();
    // body
    ctx.fillStyle = c('#8d8a98');
    U.poly(ctx, [-13, -44, 13, -44, 9, 6, -9, 6]);
    ctx.fill();
    ctx.fillStyle = c('#b9b6c4');
    U.poly(ctx, [-13, -44, 0, -44, 0, 6, -9, 6]);
    ctx.fill();
    ctx.fillStyle = c('#5e5b69');
    U.poly(ctx, [-4, -30, 4, -30, 0, -18]);
    ctx.fill();
    // floating hands
    const hy = Math.sin(t * 2.4) * 3;
    const cast = o.cast || 0;
    [[-28 - cast * 6, -20 + hy - cast * 14], [28 + cast * 6, -20 - hy - cast * 14]].forEach(([hx, hhy]) => {
      ctx.fillStyle = c('#c9c6d4');
      U.poly(ctx, [hx - 6, hhy - 6, hx + 6, hhy - 6, hx + 7, hhy + 4, hx, hhy + 9, hx - 7, hhy + 4]);
      ctx.fill();
      if (cast > 0) {
        ctx.fillStyle = 'rgba(240,240,255,' + 0.5 * cast + ')';
        ctx.beginPath(); ctx.arc(hx, hhy, 10 + cast * 6, 0, U.TAU); ctx.fill();
      }
    });
    // head
    ctx.fillStyle = c('#d9d6e2');
    U.poly(ctx, [-14, -60, 14, -60, 16, -48, 10, -38, -10, -38, -16, -48]);
    ctx.fill();
    ctx.fillStyle = c('#f0eef6');
    U.poly(ctx, [-14, -60, 0, -60, 0, -38, -10, -38, -16, -48]);
    ctx.fill();
    // mask band & eyes
    ctx.fillStyle = c('#1d1b24');
    U.poly(ctx, [-15, -54, 15, -54, 13, -45, -13, -45]);
    ctx.fill();
    const eg = o.angry ? '#ff4a4a' : '#ffffff';
    ctx.fillStyle = flash ? '#fff' : eg;
    U.poly(ctx, [-10, -51, -3, -50, -4, -47, -10, -48]); ctx.fill();
    U.poly(ctx, [10, -51, 3, -50, 4, -47, 10, -48]); ctx.fill();
    // crown
    ctx.fillStyle = c('#4a4757');
    U.poly(ctx, [-15, -60, -17, -78, -9, -67, -4, -84, 0, -68, 4, -84, 9, -67, 17, -78, 15, -60]);
    ctx.fill();
    ctx.fillStyle = c('#77748a');
    U.poly(ctx, [-15, -60, -17, -78, -9, -67, -4, -84, 0, -68, 0, -60]);
    ctx.fill();
    ctx.fillStyle = flash ? '#fff' : (o.gemColor || '#1a1820');
    U.poly(ctx, [0, -72, 3, -66, 0, -62, -3, -66]);
    ctx.fill();
    ctx.restore();
  };

  // Portraits for the dialogue box (centered at cx, cy inside a 100px frame).
  I.portrait = function (ctx, who, cx, cy, t) {
    if (who === 'ember') {
      const p = G.Hero.idlePose(t);
      G.Hero.draw(ctx, cx - 6, cy + 108, 1, p, 2.4);
    } else if (who === 'lumi') {
      I.lumi(ctx, cx, cy, 2.2, t);
    } else if (who === 'king') {
      I.king(ctx, cx, cy + 92, 1.6, t, {});
    } else if (G.BossArt && G.BossArt[who]) {
      G.BossArt[who](ctx, cx, cy, t);
    }
  };

  I.lock = function (ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.strokeStyle = '#c9cbe0'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, -4, 6, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = '#c9cbe0';
    U.poly(ctx, [-9, -4, 9, -4, 9, 9, -9, 9]); ctx.fill();
    ctx.fillStyle = '#6a6d86';
    ctx.fillRect(-1.5, 0, 3, 5);
    ctx.restore();
  };
  I.crown = function (ctx, x, y, s, col) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = col || '#ffd34a';
    U.poly(ctx, [-11, 6, -12, -7, -5, -1, 0, -10, 5, -1, 12, -7, 11, 6]); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    U.poly(ctx, [-11, 6, -12, -7, -5, -1, 0, -10, 0, 6]); ctx.fill();
    ctx.restore();
  };
  I.star = function (ctx, x, y, r, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * U.TAU - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.fill();
  };
})(window.G);
