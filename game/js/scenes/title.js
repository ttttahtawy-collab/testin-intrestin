// Title screen: animated faceted meadow, the hero, the logo and main menu.
(function (G) {
  'use strict';
  const U = G.U;

  const Title = {
    enter() {
      this.t = 0;
      this.bg = this.bg || new G.Background(G.Themes.meadow);
      this.parts = new G.Particles();
      this.quit = false;
      const W = G.R.W;
      const has = G.Save.hasAnySave();
      this.menu = new G.UI.Menu([
        { label: 'New Game', onSelect: () => G.Scenes.go('slots', { mode: 'new' }) },
        { label: 'Load Game', disabled: !has, onSelect: () => G.Scenes.go('slots', { mode: 'load' }) },
        { label: 'Options', onSelect: () => G.Scenes.go('options', { back: 'title' }) },
        { label: 'Quit', onSelect: () => this.doQuit() },
      ], { x: W * 0.3, y: 270, w: 300, itemH: 50, gap: 12, size: 24 });
      if (has) this.menu.sel = 1;
      G.Music.play('title');
      this.jumpT = 0;
    },
    onResize() { this.menu.o.x = G.R.W * 0.3; },
    doQuit() {
      this.quit = true;
      G.Music.stop();
      // Browsers only allow closing windows opened by script; try anyway.
      try { window.close(); } catch (e) { /* ignore */ }
    },
    update(dt) {
      this.t += dt;
      this.bg.update(dt);
      this.parts.update(dt);
      if (this.quit) {
        if (G.Input.anyPressed) { this.quit = false; G.Music.play('title'); G.Input.flush(); }
        return;
      }
      this.menu.update(dt);
      // the hero hops now and then
      this.jumpT += dt;
      if (Math.random() < dt * 3) {
        const W = G.R.W;
        this.parts.spawn({ x: U.rand(0, W), y: G.R.H + 10, vy: U.rand(-90, -40), vx: U.rand(-10, 10), life: 6, size: U.rand(3, 7), color: U.pick(G.Icons.PRISM), alpha: 0.6 });
      }
    },
    render(ctx) {
      const W = G.R.W, H = G.R.H;
      this.bg.draw(ctx, this.t * 26, 0, W, H);
      this.bg.drawAmbient(ctx, this.t * 26, 0, W, H);
      // ground strip
      const gy = H - 70;
      const th = G.Themes.meadow.ground;
      ctx.fillStyle = th.body;
      ctx.fillRect(0, gy, W, 70);
      ctx.fillStyle = th.topDark;
      for (let x = -((this.t * 60) % 48); x < W + 48; x += 48) U.poly(ctx, [x, gy - 4, x + 48, gy - 4, x + 48, gy + 10, x + 36, gy + 14, x + 24, gy + 9, x + 12, gy + 15, x, gy + 10]), ctx.fill();
      ctx.fillStyle = th.top;
      ctx.fillRect(0, gy - 5, W, 9);
      this.parts.draw(ctx, false);

      // hero
      const hx = W * 0.72, hop = Math.max(0, Math.sin((this.t % 3.2) / 3.2 * Math.PI * 6)) * ((this.t % 3.2) < 0.55 ? 1 : 0);
      const p = hop > 0.05 ? Object.assign(G.Hero.pose(), { armN: 2.5, armF: -2.3, legN: 0.5, legF: -0.3, mouth: 'open', brow: 0.6 }) : G.Hero.walkPose(this.t, 9);
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(hx, gy, 46 - hop * 14, 10, 0, 0, U.TAU); ctx.fill();
      G.Hero.draw(ctx, hx, gy - hop * 70, 1, p, 3.0);
      G.Icons.lumi(ctx, hx + 130, gy - 230 + Math.sin(this.t * 1.7) * 14, 1.3, this.t);

      // logo
      this.drawLogo(ctx, W * 0.3, 120);
      if (this.quit) {
        ctx.fillStyle = 'rgba(8,8,20,0.82)';
        ctx.fillRect(0, 0, W, H);
        G.UI.text(ctx, 'Thanks for playing!', W / 2, H / 2 - 20, { size: 44, weight: 700, align: 'center', color: '#fff', stroke: 8, strokeColor: '#b3261e' });
        G.UI.text(ctx, 'You can close this tab now. Press any key to return.', W / 2, H / 2 + 30, { size: 18, align: 'center', color: 'rgba(255,255,255,0.75)' });
        return;
      }
      this.menu.draw(ctx);
      G.UI.hint(ctx, '↑↓ / mouse / tap to choose  ·  Enter to select', 18, H - 18);
      G.UI.hint(ctx, 'v1.0', W - 18, H - 18, 'right');
    },
    drawLogo(ctx, x, y) {
      const t = this.t;
      ctx.save();
      ctx.translate(x, y + Math.sin(t * 1.5) * 4);
      const letters = 'EMBER';
      ctx.font = '700 96px ' + G.UI.FONT;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      const widths = letters.split('').map((l) => ctx.measureText(l).width);
      const total = widths.reduce((a, b) => a + b, 0) + 6 * (letters.length - 1);
      let lx = -total / 2;
      letters.split('').forEach((l, i) => {
        const wob = Math.sin(t * 3 + i * 0.7) * 4;
        ctx.save();
        ctx.translate(lx + widths[i] / 2, wob);
        ctx.rotate(Math.sin(t * 2 + i) * 0.03);
        ctx.lineJoin = 'round';
        ctx.lineWidth = 16;
        ctx.strokeStyle = '#3a0d12';
        ctx.strokeText(l, -widths[i] / 2, 6);
        ctx.strokeText(l, -widths[i] / 2, 0);
        const g = ctx.createLinearGradient(0, -40, 0, 40);
        g.addColorStop(0, '#ff8a6a'); g.addColorStop(0.48, '#ff3b2a'); g.addColorStop(0.52, '#e01f17'); g.addColorStop(1, '#a3120d');
        ctx.fillStyle = g;
        ctx.fillText(l, -widths[i] / 2, 0);
        ctx.restore();
        lx += widths[i] + 6;
      });
      ctx.restore();
      G.UI.text(ctx, 'and the Shattered Prism', x, y + 66, { size: 26, weight: 600, align: 'center', color: '#ffffff', stroke: 6, strokeColor: '#2b1a4a' });
      // little prism sparkle
      G.Icons.shard(ctx, x + 200, y - 48, 0.9, t);
    },
  };
  G.Scenes.register('title', Title);
})(window.G);
