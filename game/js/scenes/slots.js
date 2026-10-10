// Save-slot picker for New Game / Load Game (with overwrite confirm & delete).
(function (G) {
  'use strict';
  const U = G.U;

  const Slots = {
    enter(params) {
      this.mode = params.mode || 'load';
      this.t = 0;
      this.confirm = null;
      this.bg = this.bg || new G.Background(G.Themes.caves);
      this.build();
    },
    build() {
      const W = G.R.W;
      const items = [0, 1, 2].map((i) => {
        const s = G.Save.slots[i];
        return {
          slot: i,
          label: 'Slot ' + (i + 1),
          disabled: (this.mode === 'load' || this.mode === 'delete') && !s,
          onSelect: () => this.pick(i),
        };
      });
      if (this.mode === 'load' && G.Save.hasAnySave()) items.push({ label: 'Delete a Save…', onSelect: () => { this.mode = 'delete'; this.build(); } });
      items.push({ label: 'Back', onSelect: () => this.back() });
      this.menu = new G.UI.Menu(items, { x: W / 2, y: 150, w: Math.min(620, W - 60), itemH: 74, gap: 12, size: 22, onBack: () => this.back() });
      // custom drawing for slot rows
      this.menu.items.forEach((it) => { if (it.slot != null) it.valueText = () => ''; });
    },
    back() {
      if (this.mode === 'delete') { this.mode = 'load'; this.build(); return; }
      G.Scenes.go('title', {});
    },
    pick(i) {
      const s = G.Save.slots[i];
      if (this.mode === 'new') {
        if (s) { this.confirm = { text: 'Overwrite Slot ' + (i + 1) + '?', yes: () => this.startNew(i) }; this.mkConfirm(); return; }
        this.startNew(i);
      } else if (this.mode === 'delete') {
        this.confirm = { text: 'Delete Slot ' + (i + 1) + ' forever?', yes: () => { G.Save.deleteSlot(i); this.mode = G.Save.hasAnySave() ? 'load' : 'new'; this.build(); } };
        this.mkConfirm();
      } else {
        if (G.Save.loadSlot(i)) G.Scenes.go('overworld', {});
      }
    },
    mkConfirm() {
      const W = G.R.W;
      this.confirmMenu = new G.UI.Menu([
        { label: 'Yes', onSelect: () => { const c = this.confirm; this.confirm = null; c.yes(); } },
        { label: 'No', onSelect: () => { this.confirm = null; } },
      ], { x: W / 2, y: 280, w: 220, itemH: 48, onBack: () => { this.confirm = null; } });
      this.confirmMenu.sel = 1;
    },
    startNew(i) {
      G.Save.newGame(i);
      G.Scenes.go('cutscene', { script: 'intro', next: 'overworld', flag: 'intro' });
    },
    update(dt) {
      this.t += dt;
      this.bg.update(dt);
      if (this.confirm) { this.confirmMenu.update(dt); return; }
      this.menu.update(dt);
    },
    render(ctx) {
      const W = G.R.W, H = G.R.H;
      this.bg.draw(ctx, this.t * 15, 0, W, H);
      this.bg.drawAmbient(ctx, this.t * 15, 0, W, H);
      ctx.fillStyle = 'rgba(10,8,30,0.35)';
      ctx.fillRect(0, 0, W, H);
      const title = this.mode === 'new' ? 'NEW GAME — choose a slot' : this.mode === 'delete' ? 'DELETE — choose a slot' : 'LOAD GAME';
      G.UI.text(ctx, title, W / 2, 90, { size: 36, weight: 700, align: 'center', color: '#fff', stroke: 7, strokeColor: '#b3261e' });
      this.menu.draw(ctx);
      // slot details
      this.menu.items.forEach((it, i) => {
        if (it.slot == null) return;
        const r = this.menu.rectOf(i);
        const s = G.Save.slots[it.slot];
        const sum = G.Save.slotSummary(s);
        G.Hero.draw(ctx, r.x + 150, r.y + r.h - 8, 1, G.Hero.idlePose(this.t + i), s ? 0.85 : 0.6);
        if (!sum) {
          G.UI.text(ctx, 'Empty', r.x + 200, r.y + r.h / 2, { size: 18, color: 'rgba(255,255,255,0.55)' });
          return;
        }
        G.UI.text(ctx, (sum.complete ? '★ ' : '') + sum.done + ' levels cleared', r.x + 200, r.y + 24, { size: 18, weight: 700, color: '#fff' });
        G.Icons.shard(ctx, r.x + 210, r.y + 52, 0.55, this.t);
        G.UI.text(ctx, sum.shards + '/36', r.x + 224, r.y + 52, { size: 16, color: '#ffe9a8' });
        G.Icons.gem(ctx, r.x + 300, r.y + 52, 0.6, this.t);
        G.UI.text(ctx, String(sum.gems), r.x + 312, r.y + 52, { size: 16, color: '#bff6ff' });
        const mins = Math.floor(sum.time / 60);
        G.UI.text(ctx, Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm', r.x + r.w - 20, r.y + 52, { size: 15, color: 'rgba(255,255,255,0.7)', align: 'right' });
      });
      if (this.confirm) {
        ctx.fillStyle = 'rgba(5,5,15,0.7)';
        ctx.fillRect(0, 0, W, H);
        G.UI.panel(ctx, W / 2 - 200, 180, 400, 240, { color: '#2a1d3a' });
        G.UI.text(ctx, this.confirm.text, W / 2, 230, { size: 24, weight: 700, align: 'center' });
        this.confirmMenu.draw(ctx);
      }
      if (!G.Save.storageOk) G.UI.hint(ctx, '⚠ Browser storage is unavailable — progress will not be saved.', W / 2, H - 20, 'center');
    },
  };
  G.Scenes.register('slots', Slots);
})(window.G);
