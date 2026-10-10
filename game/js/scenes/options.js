// Options menu (used as its own scene from the title, and as an overlay in
// the pause menu and on the world map).
(function (G) {
  'use strict';
  const U = G.U;
  const O = (G.OptionsMenu = {});

  O.build = function (x, y, onBack) {
    const S = G.Save;
    const o = S.options;
    const save = () => { S.saveOptions(); G.Audio.applyVolumes(); };
    const vol = (key, label) => ({
      label,
      valueText: () => '▮'.repeat(Math.round(o[key] * 10)) + '▯'.repeat(10 - Math.round(o[key] * 10)),
      adjust: (d) => { o[key] = U.clamp(Math.round(o[key] * 10 + d) / 10, 0, 1); save(); G.Audio.play('menuMove'); },
    });
    const toggle = (key, label) => ({
      label, valueText: () => (o[key] ? 'ON' : 'OFF'),
      adjust: () => { o[key] = !o[key]; save(); G.Audio.play('menuMove'); },
    });
    const items = [
      vol('music', 'Music'),
      vol('sfx', 'Sound FX'),
      toggle('shake', 'Screen Shake'),
      {
        label: 'Touch Controls', valueText: () => ({ auto: 'AUTO', on: 'ON', off: 'OFF' })[o.touch],
        adjust: (d) => { const v = ['auto', 'on', 'off']; o.touch = v[(v.indexOf(o.touch) + (d > 0 ? 1 : 2)) % 3]; save(); G.Audio.play('menuMove'); },
      },
      toggle('timer', 'Speedrun Timer'),
      Object.assign(toggle('assist', 'Assist Mode (+2 hearts)'), {}),
      {
        label: 'Fullscreen', valueText: () => (document.fullscreenElement ? 'ON' : 'OFF'),
        adjust: () => {
          try {
            if (document.fullscreenElement) document.exitFullscreen();
            else document.documentElement.requestFullscreen({ navigationUI: 'hide' });
          } catch (e) { /* not supported */ }
        },
      },
      { label: 'Back', onSelect: () => onBack && onBack() },
    ];
    const m = new G.UI.Menu(items, { x, y, w: Math.min(560, G.R.W - 60), itemH: 40, gap: 8, size: 22, onBack });
    m.isOptions = true;
    return m;
  };

  O.draw = function (ctx, menu) {
    const W = G.R.W, H = G.R.H;
    G.UI.panel(ctx, W / 2 - menu.o.w / 2 - 24, 70, menu.o.w + 48, H - 110, { color: '#1a1d3a', alpha: 0.95 });
    G.UI.text(ctx, 'OPTIONS', W / 2, 110, { size: 34, weight: 700, align: 'center', color: '#fff', stroke: 6, strokeColor: '#b3261e' });
    menu.draw(ctx);
    G.UI.hint(ctx, '← → to change  ·  Enter / click to toggle', W / 2, H - 54, 'center');
  };

  // Stand-alone scene version (from the title screen)
  const Scene = {
    enter(params) {
      this.back = params.back || 'title';
      this.menu = O.build(G.R.W / 2, 150, () => G.Scenes.go(this.back, {}));
      this.t = 0;
      this.bg = new G.Background(G.Themes.peaks);
    },
    update(dt) { this.t += dt; this.bg.update(dt); this.menu.update(dt); },
    render(ctx) {
      this.bg.draw(ctx, this.t * 20, 0, G.R.W, G.R.H);
      ctx.fillStyle = 'rgba(10,10,30,0.35)';
      ctx.fillRect(0, 0, G.R.W, G.R.H);
      O.draw(ctx, this.menu);
      drawControls(ctx);
    },
  };
  function drawControls(ctx) {
    // compact controls reference in the corner on wide screens
    const W = G.R.W;
    if (W < 1100) return;
    const lines = ['CONTROLS', '←/→ or A/D  Move', 'Space / Z / ↑  Jump', 'X / J  Punch', '↓ in air  Ground pound', 'C / Shift  Dash', 'Esc / P  Pause'];
    lines.forEach((l, i) => G.UI.text(ctx, l, 24, 100 + i * 24, { size: i ? 15 : 17, weight: i ? 500 : 700, color: i ? 'rgba(255,255,255,0.75)' : '#ffd38a' }));
  }
  G.Scenes.register('options', Scene);
})(window.G);
