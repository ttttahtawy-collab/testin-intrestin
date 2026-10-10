// Story cutscenes: themed backdrop (optionally drained of colour), animated
// actors and typewriter dialogue. Skip with Esc / the SKIP button.
(function (G) {
  'use strict';
  const U = G.U;

  const Cut = {
    enter(params) {
      this.script = G.Story.scripts[params.script];
      this.params = params;
      this.shotIdx = -1;
      this.t = 0;
      this.bgs = {};
      G.Music.play(this.script.music || 'story');
      this.nextShot();
    },
    lineFilter(l) {
      if (!l.key) return true;
      const all = G.Save.data && G.Save.shardCount() >= 36;
      return l.key === 'allShards' ? all : !all;
    },
    nextShot() {
      this.shotIdx++;
      if (this.shotIdx >= this.script.shots.length) return this.finish();
      const shot = (this.shot = this.script.shots[this.shotIdx]);
      if (!this.bgs[shot.bg]) this.bgs[shot.bg] = new G.Background(G.Themes[shot.bg]);
      this.dialogue = new G.UI.Dialogue(shot.lines.filter((l) => this.lineFilter(l)));
      this.shotT = 0;
    },
    finish() {
      if (this.done) return;
      this.done = true;
      if (this.params.flag && G.Save.data) { G.Save.data.story[this.params.flag] = true; G.Save.persist(); }
      G.Scenes.go(this.params.next || 'overworld', this.params.nextParams || {});
    },
    update(dt) {
      this.t += dt;
      this.shotT += dt;
      if (this.done) return;
      const I = G.Input;
      const skip = { x: G.R.W - 110, y: 16, w: 94, h: 36 };
      if ((I.pressed.pause && !I.pressed.confirm) || (I.pressed.back && !I.pressed.attack) || G.UI.hit(skip)) { this.finish(); return; }
      this.bgs[this.shot.bg].update(dt);
      if (this.shotT > 0.4) this.dialogue.update(dt);
      if (this.dialogue.done) this.nextShot();
    },
    render(ctx) {
      const W = G.R.W, H = G.R.H;
      const shot = this.shot;
      const bg = this.bgs[shot.bg];
      bg.draw(ctx, this.t * 18, 0, W, H);
      bg.drawAmbient(ctx, this.t * 18, 0, W, H);
      const th = G.Themes[shot.bg];
      const gy = H - 170;
      ctx.fillStyle = th.ground.body;
      ctx.fillRect(0, gy, W, H - gy);
      ctx.fillStyle = th.ground.top;
      ctx.fillRect(0, gy - 6, W, 12);
      for (const a of shot.actors) {
        const x = a.x * W;
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.ellipse(x, gy, 40, 8, 0, 0, U.TAU); ctx.fill();
        const speaking = this.dialogue.cur && this.dialogue.cur.who === a.id;
        if (a.id === 'ember') {
          const p = G.Hero.idlePose(this.t, speaking ? { mouth: Math.floor(this.t * 8) % 2 ? 'open' : 'smile' } : {});
          if (shot.grey && this.shotIdx === 2 && this.dialogue.i <= 1) { p.mouth = 'o'; p.brow = 1; }
          G.Hero.draw(ctx, x, gy, a.facing, p, 2.6);
        } else if (a.id === 'lumi') {
          G.Icons.lumi(ctx, x, gy - 120, 1.6, this.t);
        } else if (a.id === 'king') {
          G.Icons.king(ctx, x, gy - 40, 2.0, this.t, { facing: a.facing, cast: speaking ? 0.5 + Math.sin(this.t * 6) * 0.5 : 0 });
        }
      }
      if (shot.grey) {
        // drain colour from everything drawn so far, except the hero
        ctx.save();
        ctx.globalCompositeOperation = 'saturation';
        ctx.fillStyle = 'hsl(0,0%,50%)';
        ctx.globalAlpha = 0.92;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
        for (const a of shot.actors) if (a.id === 'ember') {
          const p = G.Hero.idlePose(this.t);
          if (this.shotIdx === 2 && this.dialogue.i <= 1) { p.mouth = 'o'; p.brow = 1; }
          G.Hero.draw(ctx, a.x * W, gy, a.facing, p, 2.6);
        }
      }
      // letterbox
      ctx.fillStyle = '#05060c';
      ctx.fillRect(0, 0, W, 6);
      const k = U.clamp(this.shotT / 0.4, 0, 1);
      ctx.fillStyle = 'rgba(5,6,12,' + (1 - k) + ')';
      ctx.fillRect(0, 0, W, H);
      this.dialogue.draw(ctx);
      U.roundRect(ctx, W - 110, 16, 94, 36, 10);
      ctx.fillStyle = 'rgba(10,10,30,0.55)'; ctx.fill();
      G.UI.text(ctx, 'SKIP ▸▸', W - 63, 34, { size: 16, weight: 700, align: 'center', color: 'rgba(255,255,255,0.85)' });
    },
  };
  G.Scenes.register('cutscene', Cut);
})(window.G);
