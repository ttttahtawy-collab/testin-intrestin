// End credits: a colourful parade, then back to the map.
(function (G) {
  'use strict';
  const U = G.U;
  const LINES = [
    ['EMBER', 'and the Shattered Prism', 1],
    ['A colourful platformer', ''],
    ['Starring', 'Ember'],
    ['Guide', 'Lumi, spirit of the Prism Heart'],
    ['Villain (reformed?)', 'King Monochrome'],
    ['Bosses', 'Glumbo · Quartzard · Galewing'],
    ['Art', 'Hand-coded faceted vector graphics'],
    ['Music & Sound', 'Procedurally synthesised with Web Audio'],
    ['Engine', 'Vanilla JavaScript + HTML5 Canvas'],
    ['', ''],
    ['Thank you for playing!', 'Colour is back in Prismara.', 1],
  ];

  const Credits = {
    enter() {
      this.t = 0;
      this.bg = new G.Background(G.Themes.meadow);
      this.parts = new G.Particles();
      G.Music.play('ending');
    },
    update(dt) {
      this.t += dt;
      this.bg.update(dt);
      this.parts.update(dt);
      if (Math.random() < dt * 10) this.parts.spawn({ x: U.rand(0, G.R.W), y: -10, vy: U.rand(60, 120), vx: U.rand(-20, 20), life: 7, size: U.rand(4, 8), color: U.pick(G.Icons.PRISM) });
      const end = LINES.length * 70 + G.R.H + 100;
      if ((this.t > 3 && (G.Input.pressed.confirm || G.Input.pointer.clicked || G.Input.pressed.pause)) || this.t * 40 > end) G.Scenes.go('overworld', {});
    },
    render(ctx) {
      const W = G.R.W, H = G.R.H;
      this.bg.draw(ctx, this.t * 40, 0, W, H);
      this.bg.drawAmbient(ctx, this.t * 40, 0, W, H);
      ctx.fillStyle = 'rgba(10,10,30,0.3)';
      ctx.fillRect(0, 0, W, H);
      this.parts.draw(ctx, false);
      const off = H - this.t * 40;
      LINES.forEach((l, i) => {
        const y = off + i * 70;
        if (y < -60 || y > H + 60) return;
        G.UI.text(ctx, l[0], W / 2, y, { size: l[2] ? 40 : 18, weight: 700, align: 'center', color: l[2] ? '#fff' : '#ffd38a', stroke: l[2] ? 7 : 4, strokeColor: '#3a0d12' });
        G.UI.text(ctx, l[1], W / 2, y + (l[2] ? 38 : 24), { size: l[2] ? 22 : 22, weight: 600, align: 'center', color: '#fff', stroke: 4, strokeColor: 'rgba(20,20,40,0.6)' });
      });
      // parade
      const gy = H - 30;
      const x0 = ((this.t * 90) % (W + 600)) - 300;
      G.Hero.draw(ctx, x0, gy, 1, G.Hero.walkPose(this.t, 12), 1.4);
      G.Icons.lumi(ctx, x0 - 70, gy - 90, 0.9, this.t);
      G.Icons.king(ctx, x0 - 170, gy - 30, 0.9, this.t, { gemColor: G.Icons.PRISM[Math.floor(this.t * 3) % 6] });
      G.UI.hint(ctx, 'Enter / tap to skip', W - 16, 20, 'right');
    },
  };
  G.Scenes.register('credits', Credits);
})(window.G);
