// Canvas sizing. The game uses a logical view that is always 540 units tall;
// its width adapts to the screen's aspect ratio (clamped between 4:3 and
// ~21:9) so phones in landscape and ultrawide monitors both fill nicely.
// The backing store is rendered at device-pixel resolution for crisp vectors.
(function (G) {
  'use strict';
  const U = G.U;
  const R = (G.R = {
    canvas: null, ctx: null,
    H: 540, W: 960,
    scale: 1, dpr: 1, ox: 0, oy: 0,
    rf: 1, // resolution factor for cached bitmaps (logical px -> device px)
    rfVersion: 0,
    shakeT: 0, shakeMag: 0, shakeX: 0, shakeY: 0,
  });

  R.init = function (canvas) {
    R.canvas = canvas;
    R.ctx = canvas.getContext('2d', { alpha: false });
    window.addEventListener('resize', R.resize);
    window.addEventListener('orientationchange', () => setTimeout(R.resize, 120));
    R.resize();
  };

  R.resize = function () {
    const cw = window.innerWidth, ch = window.innerHeight;
    R.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const aspect = cw / ch;
    R.W = Math.round(U.clamp(R.H * aspect, 720, 1260));
    R.scale = Math.min(cw / R.W, ch / R.H);
    R.canvas.style.width = cw + 'px';
    R.canvas.style.height = ch + 'px';
    R.canvas.width = Math.round(cw * R.dpr);
    R.canvas.height = Math.round(ch * R.dpr);
    R.ox = Math.round(((cw - R.W * R.scale) / 2) * R.dpr);
    R.oy = Math.round(((ch - R.H * R.scale) / 2) * R.dpr);
    const rf = U.clamp(Math.round(R.scale * R.dpr * 4) / 4, 1, 2);
    if (rf !== R.rf) { R.rf = rf; R.rfVersion++; }
    if (G.Input) G.Input.layoutTouch(R.W, R.H);
    if (G.Scenes && G.Scenes.current && G.Scenes.current.onResize) G.Scenes.current.onResize();
  };

  R.toLogical = function (clientX, clientY) {
    return {
      x: (clientX * R.dpr - R.ox) / (R.scale * R.dpr),
      y: (clientY * R.dpr - R.oy) / (R.scale * R.dpr),
    };
  };

  R.begin = function () {
    const ctx = R.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060c';
    ctx.fillRect(0, 0, R.canvas.width, R.canvas.height);
    const s = R.scale * R.dpr;
    ctx.setTransform(s, 0, 0, s, R.ox, R.oy);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, R.W, R.H);
    ctx.clip();
  };
  R.end = function () { R.ctx.restore(); };

  R.shake = function (mag, dur) {
    if (!G.Save.options.shake) return;
    if (mag >= R.shakeMag || R.shakeT <= 0) { R.shakeMag = mag; R.shakeT = dur || 0.25; R.shakeDur = R.shakeT; }
  };
  R.updateShake = function (dt) {
    if (R.shakeT > 0) {
      R.shakeT -= dt;
      const k = Math.max(0, R.shakeT / R.shakeDur);
      R.shakeX = (Math.random() * 2 - 1) * R.shakeMag * k;
      R.shakeY = (Math.random() * 2 - 1) * R.shakeMag * k;
    } else { R.shakeX = R.shakeY = 0; R.shakeMag = 0; }
  };
})(window.G);
