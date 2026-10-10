// Lumi's Prism Shop: spend gems on permanent upgrades.
(function (G) {
  'use strict';
  const U = G.U;

  // Upgrade catalogue. Add entries here to extend the shop.
  const ITEMS = [
    { id: 'heart1', name: 'Heart Crystal', desc: '+1 maximum heart.', cost: 60, owned: (u) => u.heart >= 1, can: () => true, buy: (u) => { u.heart = Math.max(u.heart, 1); } },
    { id: 'heart2', name: 'Heart Crystal II', desc: 'Another +1 maximum heart.', cost: 150, owned: (u) => u.heart >= 2, can: (u) => u.heart >= 1, buy: (u) => { u.heart = 2; } },
    { id: 'power', name: 'Power Fist', desc: 'Punches deal double damage.', cost: 110, owned: (u) => !!u.power, can: () => true, buy: (u) => { u.power = 1; } },
    { id: 'magnet', name: 'Gem Magnet', desc: 'Nearby gems fly to you.', cost: 80, owned: (u) => !!u.magnet, can: () => true, buy: (u) => { u.magnet = 1; } },
  ];
  G.ShopItems = ITEMS;

  const Shop = {
    enter() {
      this.t = 0;
      this.msg = 'Welcome! Gems for upgrades — a fair trade, Ember!';
      this.msgT = 0;
      this.bg = this.bg || new G.Background(G.Themes.caves);
      this.build();
      G.Music.play('overworld');
    },
    build() {
      const W = G.R.W;
      const u = G.Save.data.upgrades;
      const items = ITEMS.map((it) => ({
        label: it.name,
        valueText: () => (it.owned(u) ? 'OWNED' : !it.can(u) ? 'LOCKED' : '◆ ' + it.cost),
        onSelect: () => this.buy(it),
        item: it,
      }));
      items.push({ label: 'Back to Map', onSelect: () => G.Scenes.go('overworld', {}) });
      const sel = this.menu ? this.menu.sel : 0;
      this.menu = new G.UI.Menu(items, { x: W * 0.36, y: 140, w: Math.min(440, W * 0.55), itemH: 54, gap: 10, size: 24, onBack: () => G.Scenes.go('overworld', {}) });
      this.menu.sel = sel;
    },
    buy(it) {
      const sd = G.Save.data, u = sd.upgrades;
      if (it.owned(u)) { this.say('You already have that one!'); G.Audio.play('deny'); return; }
      if (!it.can(u)) { this.say('Buy the first Heart Crystal before this one.'); G.Audio.play('deny'); return; }
      if (sd.gems < it.cost) { this.say('Not enough gems yet. Explore and break blocks to find more!'); G.Audio.play('deny'); return; }
      sd.gems -= it.cost;
      it.buy(u);
      G.Save.persist();
      G.Audio.play('buy');
      this.say(it.name + ' acquired! ' + it.desc);
      this.build();
    },
    say(m) { this.msg = m; this.msgT = 0; },
    update(dt) { this.t += dt; this.msgT += dt; this.bg.update(dt); this.menu.update(dt); },
    render(ctx) {
      const W = G.R.W, H = G.R.H;
      this.bg.draw(ctx, this.t * 10, 0, W, H);
      ctx.fillStyle = 'rgba(12,8,30,0.45)';
      ctx.fillRect(0, 0, W, H);
      G.UI.text(ctx, "LUMI'S PRISM SHOP", W * 0.36, 80, { size: 36, weight: 700, align: 'center', stroke: 7, strokeColor: '#5a2ab0' });
      this.menu.draw(ctx);
      const it = this.menu.items[this.menu.sel];
      const right = W * 0.36 + this.menu.o.w / 2 + 30;
      const sx = right + (W - right) / 2;
      G.Icons.lumi(ctx, sx, 190, 2.2, this.t);
      G.Hero.draw(ctx, sx, H - 80, -1, G.Hero.idlePose(this.t), 2.2);
      // speech bubble
      const bw = Math.min(W - right - 30, 330);
      const lines = G.UI.wrap(ctx, it && it.item ? it.item.desc : this.msg, bw - 28, 17, 600);
      const lines2 = this.msgT < 3 ? G.UI.wrap(ctx, this.msg, bw - 28, 17, 600) : lines;
      const show = this.msgT < 3 ? lines2 : lines;
      const bh = show.length * 22 + 22;
      G.UI.panel(ctx, sx - bw / 2, 250, bw, bh, { color: '#25295a', r: 12 });
      show.forEach((l, i) => G.UI.text(ctx, l, sx - bw / 2 + 14, 272 + i * 22, { size: 17, weight: 600 }));
      // wallet
      G.UI.panel(ctx, 16, H - 62, 170, 46, { color: '#1a1d3a', r: 12 });
      G.Icons.gem(ctx, 40, H - 39, 0.9, this.t * 2);
      G.UI.text(ctx, String(G.Save.data.gems), 58, H - 38, { size: 22, weight: 700 });
    },
  };
  G.Scenes.register('shop', Shop);
})(window.G);
