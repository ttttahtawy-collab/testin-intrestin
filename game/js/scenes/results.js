// Level results: gems, shards, time, falls; then on to the map or a story scene.
(function (G) {
  'use strict';
  const U = G.U;

  const Results = {
    enter(r) {
      this.r = r;
      this.t = 0;
      this.parts = new G.Particles();
      this.gemCount = 0;
      this.theme = G.Themes[G.Worlds.levels[r.id].theme];
      this.bg = new G.Background(this.theme);
      G.Music.play('overworld');
      const W = G.R.W;
      this.menu = new G.UI.Menu([
        { label: 'Continue', onSelect: () => this.next() },
        { label: 'Replay Level', onSelect: () => G.Scenes.go('play', { id: r.id }) },
      ], { x: W / 2, y: 410, w: 300, itemH: 46, gap: 10, size: 22 });
    },
    next() {
      const r = this.r;
      if (r.story) {
        const next = r.story === 'ending' ? 'credits' : 'overworld';
        G.Scenes.go('cutscene', { script: r.story, next, flag: r.story });
      } else G.Scenes.go('overworld', {});
    },
    update(dt) {
      this.t += dt;
      this.bg.update(dt);
      this.parts.update(dt);
      if (this.t > 0.6 && this.gemCount < this.r.gems) {
        this.gemCount = Math.min(this.r.gems, this.gemCount + dt * Math.max(20, this.r.gems * 1.5));
        if (Math.random() < 0.5) G.Audio.play('gem');
      }
      if (this.t > 0.5) this.menu.update(dt);
      if (Math.random() < dt * 6) {
        this.parts.spawn({ x: U.rand(0, G.R.W), y: -10, vy: U.rand(60, 140), vx: U.rand(-30, 30), life: 5, size: U.rand(4, 8), color: U.pick(G.Icons.PRISM) });
      }
    },
    render(ctx) {
      const W = G.R.W, H = G.R.H, r = this.r;
      this.bg.draw(ctx, this.t * 30, 0, W, H);
      ctx.fillStyle = 'rgba(10,10,30,0.4)';
      ctx.fillRect(0, 0, W, H);
      this.parts.draw(ctx, false);
      const pw = Math.min(560, W - 40), px = (W - pw) / 2;
      G.UI.panel(ctx, px, 40, pw, H - 80, { color: '#1c1f40' });
      const k = U.ease.outBack(U.clamp(this.t / 0.5, 0, 1));
      ctx.save();
      ctx.translate(W / 2, 92);
      ctx.scale(k, k);
      G.UI.text(ctx, r.boss ? 'BOSS DEFEATED!' : 'LEVEL CLEAR!', 0, 0, { size: 44, weight: 700, align: 'center', stroke: 8, strokeColor: '#b3261e' });
      ctx.restore();
      G.UI.text(ctx, G.Worlds.label(r.id) + '  ' + r.name, W / 2, 140, { size: 20, align: 'center', color: 'rgba(255,255,255,0.8)' });
      // hero celebrating
      const p = G.Hero.pose();
      const jump = Math.abs(Math.sin(this.t * 4));
      Object.assign(p, { armN: 2.7, armF: -2.7, mouth: 'open', brow: 1, legN: 0.3 * jump, legF: -0.3 * jump });
      G.Hero.draw(ctx, px + 70, 380 - jump * 24, 1, p, 1.5);
      const lx = px + 150;
      G.Icons.gem(ctx, lx, 200, 1.1, this.t * 2);
      G.UI.text(ctx, 'Gems: ' + Math.floor(this.gemCount) + (r.gemsTotal ? '  (' + r.gemsTotal + ' placed)' : ''), lx + 24, 201, { size: 22, weight: 600 });
      if (!r.boss) {
        for (let i = 0; i < 3; i++) {
          const have = r.shards[i] || r.oldShards[i];
          const show = this.t > 0.9 + i * 0.25;
          if (show) {
            G.Icons.shard(ctx, lx + i * 46, 260, 1, this.t + i, !have);
            if (r.newShards[i]) G.UI.text(ctx, 'NEW', lx + i * 46, 292, { size: 13, weight: 700, align: 'center', color: '#ffe14a' });
          }
        }
        G.UI.text(ctx, 'Prism Shards', lx + 150, 261, { size: 20, weight: 600 });
      }
      G.UI.text(ctx, 'Time: ' + U.formatTime(r.time) + (r.best != null && r.best >= r.time - 0.001 ? '  ★ best!' : '  (best ' + U.formatTime(r.best) + ')'), lx, 320, { size: 20 });
      G.UI.text(ctx, 'Falls: ' + r.deaths, lx, 352, { size: 20 });
      if (r.unlocked) G.UI.text(ctx, 'Unlocked: ' + G.Worlds.label(r.unlocked) + ' ' + G.Worlds.levels[r.unlocked].name + '!', W / 2, 386, { size: 17, weight: 700, align: 'center', color: '#9dffb0' });
      if (this.t > 0.5) this.menu.draw(ctx);
    },
  };
  G.Scenes.register('results', Results);
})(window.G);
