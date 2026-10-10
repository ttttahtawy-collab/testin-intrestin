// Scene manager with a faceted "shard" wipe transition between scenes.
(function (G) {
  'use strict';
  const U = G.U;
  const S = (G.Scenes = {
    list: {}, current: null, currentName: null,
    trans: null, // { phase:'out'|'in', t, dur, target, params }
  });

  S.register = function (name, scene) { S.list[name] = scene; scene.name = name; };

  S.go = function (name, params, opts) {
    opts = opts || {};
    if (S.trans && S.trans.phase === 'out') return; // already switching
    if (opts.instant || !S.current) { swap(name, params); return; }
    S.trans = { phase: 'out', t: 0, dur: opts.dur || 0.32, target: name, params, color: opts.color || '#0b0d18' };
  };

  function swap(name, params) {
    if (S.current && S.current.exit) S.current.exit();
    S.current = S.list[name];
    S.currentName = name;
    if (!S.current) throw new Error('Unknown scene ' + name);
    G.Input.flush();
    if (S.current.enter) S.current.enter(params || {});
  }

  S.update = function (dt) {
    if (S.trans) {
      S.trans.t += dt;
      if (S.trans.t >= S.trans.dur) {
        if (S.trans.phase === 'out') {
          swap(S.trans.target, S.trans.params);
          S.trans.phase = 'in';
          S.trans.t = 0;
        } else S.trans = null;
      }
      if (S.trans && S.trans.phase === 'out') return; // freeze input while covering
    }
    if (S.current && S.current.update) S.current.update(dt);
  };

  S.render = function (ctx) {
    if (S.current && S.current.render) S.current.render(ctx);
    if (S.trans) drawWipe(ctx, S.trans);
  };

  // Diagonal band of triangles sweeping across the screen.
  function drawWipe(ctx, tr) {
    const W = G.R.W, H = G.R.H;
    let k = U.clamp(tr.t / tr.dur, 0, 1);
    k = U.ease.inOutSine(k);
    const cover = tr.phase === 'out' ? k : 1 - k;
    if (cover <= 0) return;
    const cols = 12, rows = 7;
    const cw = W / cols, rh = H / rows;
    ctx.save();
    for (let i = 0; i <= cols; i++) {
      for (let j = 0; j <= rows; j++) {
        const order = (i + j) / (cols + rows);
        let local = tr.phase === 'out' ? U.clamp(cover * 1.6 - order * 0.6, 0, 1) : U.clamp(cover * 1.6 - (1 - order) * 0.6, 0, 1);
        if (local <= 0) continue;
        const cx = i * cw, cy = j * rh;
        const sz = local * 1.05;
        ctx.fillStyle = (i + j) % 2 ? tr.color : U.shade(tr.color, 0.06);
        ctx.beginPath();
        ctx.moveTo(cx, cy - rh * sz);
        ctx.lineTo(cx + cw * sz, cy);
        ctx.lineTo(cx, cy + rh * sz);
        ctx.lineTo(cx - cw * sz, cy);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }
})(window.G);
