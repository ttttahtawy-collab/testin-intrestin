// World map: four faceted islands with level nodes. Islands are drained of
// colour until their boss is beaten. Walk between unlocked nodes and enter.
(function (G) {
  'use strict';
  const U = G.U;
  const ISLAND_W = 760, START_X = 200;
  const YOFF = [40, -40, 30, -10];

  const OW = {
    enter() {
      this.t = 0;
      this.order = G.Worlds.order();
      this.nodes = this.order.map((id, k) => {
        const wi = Math.floor(k / 4), j = k % 4;
        return { id, x: START_X + wi * ISLAND_W + j * 165, y: 290 + YOFF[j] + (wi % 2 ? -10 : 10), wi, boss: G.Worlds.isBoss(id) };
      });
      this.mapW = START_X + 4 * ISLAND_W - 120;
      const sd = G.Save.data;
      let idx = this.order.indexOf(sd.node);
      if (idx < 0 || !G.Save.isUnlocked(sd.node)) idx = 0;
      this.cur = idx;
      this.target = idx;
      this.ax = this.nodes[idx].x; this.ay = this.nodes[idx].y;
      this.camX = U.clamp(this.ax - G.R.W / 2, 0, this.mapW - G.R.W);
      this.moving = false;
      this.facing = 1;
      this.menu = null;
      this.optionsMenu = null;
      this.parts = new G.Particles();
      this.islands = G.Worlds.list.map((w, i) => this.makeIsland(i));
      G.Music.play('overworld');
      this.enterT = 0;
      this.flash = this.newUnlockFlash();
    },
    newUnlockFlash() {
      // sparkle the most recently unlocked node
      const sd = G.Save.data;
      const id = sd.unlocked[sd.unlocked.length - 1];
      const rec = sd.levels[id];
      return rec && rec.done ? null : id;
    },
    makeIsland(i) {
      const rng = U.rng(1000 + i * 77);
      const cx = START_X + i * ISLAND_W + 250, cy = 300;
      const pts = [];
      const n = 18;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * U.TAU;
        const rx = 370 + rng() * 40, ry = 150 + rng() * 26;
        pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry * (Math.sin(a) > 0 ? 1.05 : 0.95)]);
      }
      const deco = [];
      for (let k = 0; k < 26; k++) {
        const a = rng() * U.TAU, r = 0.35 + rng() * 0.55;
        const x = cx + Math.cos(a) * 340 * r, y = cy + Math.sin(a) * 120 * r;
        // keep decorations off the node path
        if (Math.abs(y - 300) < 70 && x > cx - 300 && x < cx + 300) continue;
        deco.push({ x, y, s: 0.7 + rng() * 0.6, v: rng() });
      }
      deco.sort((a, b) => a.y - b.y);
      return { cx, cy, pts, deco };
    },
    restored(wi) { const r = G.Save.data.levels[wi + 1 + '-B']; return !!(r && r.done); },
    worldOpen(wi) { return G.Save.isUnlocked(wi + 1 + '-1'); },

    goTo(k) {
      if (k === this.cur && !this.moving) return;
      if (!G.Save.isUnlocked(this.order[k])) { G.Audio.play('deny'); return; }
      this.target = k;
      this.moving = true;
    },
    update(dt) {
      this.t += dt;
      this.enterT += dt;
      this.parts.update(dt);
      const I = G.Input;
      if (this.optionsMenu) { this.optionsMenu.update(dt); return; }
      if (this.menu) { this.menu.update(dt); return; }
      const W = G.R.W, H = G.R.H;
      // buttons
      const btnShop = { x: W - 250, y: 14, w: 110, h: 40 }, btnMenu = { x: W - 128, y: 14, w: 110, h: 40 };
      if (G.UI.hit(btnShop) || I.pressed.attack) { G.Audio.play('menuSelect'); G.Scenes.go('shop', {}); return; }
      if (G.UI.hit(btnMenu) || (I.pressed.pause && !I.pressed.confirm) || (I.pressed.back && !I.pressed.attack)) { this.openMenu(); return; }

      if (!this.moving) {
        if ((I.pressed.right || I.pressed.down) && this.cur < this.nodes.length - 1) this.goTo(this.cur + 1);
        else if ((I.pressed.left || I.pressed.up) && this.cur > 0) this.goTo(this.cur - 1);
        else if (I.pressed.confirm || I.pressed.jump && !I.pressed.up) { this.play(); return; }
      }
      // tap a node
      const p = I.pointer;
      if (p.clicked) {
        const mx = p.x + this.camX, my = p.y;
        const playBtn = this.playBtnRect();
        if (playBtn && p.x >= playBtn.x && p.x <= playBtn.x + playBtn.w && p.y >= playBtn.y && p.y <= playBtn.y + playBtn.h) { this.play(); return; }
        this.nodes.forEach((n, k) => {
          if (U.dist(mx, my, n.x, n.y) < 34) {
            if (k === this.cur && !this.moving) this.play();
            else this.goTo(k);
          }
        });
      }
      if (this.moving) {
        const dir = Math.sign(this.target - this.cur);
        const next = this.nodes[this.cur + dir];
        if (!next) { this.moving = false; } else {
          const dx = next.x - this.ax, dy = next.y - this.ay;
          const d = Math.hypot(dx, dy);
          const sp = 340 * dt;
          this.facing = dx >= 0 ? 1 : -1;
          if (d <= sp) {
            this.ax = next.x; this.ay = next.y;
            this.cur += dir;
            G.Audio.play('step');
            if (!G.Save.isUnlocked(this.order[this.cur]) || this.cur === this.target) { this.moving = false; this.target = this.cur; G.Save.data.node = this.order[this.cur]; G.Save.persist(); }
          } else { this.ax += (dx / d) * sp; this.ay += (dy / d) * sp; }
        }
      }
      this.camX = U.damp(this.camX, U.clamp(this.ax - W / 2, 0, this.mapW - W), 5, dt);
      if (this.flash && Math.random() < dt * 10) {
        const n = this.nodes[this.order.indexOf(this.flash)];
        if (n) this.parts.spawn({ x: n.x + U.rand(-24, 24), y: n.y + U.rand(-24, 10), vy: -50, life: 0.8, size: 3, shape: 'spark', color: U.pick(G.Icons.PRISM), glow: true });
      }
    },
    play() {
      if (this.moving) return;
      const id = this.order[this.cur];
      if (!G.Save.isUnlocked(id)) return;
      G.Audio.play('menuSelect');
      G.Save.data.node = id;
      G.Save.persist();
      G.Scenes.go('play', { id });
    },
    openMenu() {
      const W = G.R.W;
      G.Audio.play('menuBack');
      this.menu = new G.UI.Menu([
        { label: 'Resume', onSelect: () => { this.menu = null; } },
        { label: "Lumi's Shop", onSelect: () => G.Scenes.go('shop', {}) },
        { label: 'Options', onSelect: () => { this.optionsMenu = G.OptionsMenu.build(W / 2, 150, () => { this.optionsMenu = null; }); } },
        { label: 'Save & Quit to Title', onSelect: () => { G.Save.persist(); G.Scenes.go('title', {}); } },
      ], { x: W / 2, y: 200, w: 340, itemH: 52, onBack: () => { this.menu = null; } });
    },
    playBtnRect() {
      const H = G.R.H;
      return { x: 320, y: H - 92, w: 120, h: 44 };
    },

    render(ctx) {
      const W = G.R.W, H = G.R.H;
      // sea & sky
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#5a7fd6'); g.addColorStop(0.5, '#8fb6ef'); g.addColorStop(1, '#3a5fb0');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // faceted clouds
      for (let i = 0; i < 9; i++) {
        const x = ((i * 410 - this.camX * 0.3 + this.t * 8) % (W + 400) + W + 400) % (W + 400) - 200;
        const y = 40 + (i * 53) % 120;
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        U.poly(ctx, [x, y, x + 50, y - 22, x + 110, y - 16, x + 150, y + 4, x + 70, y + 14]);
        ctx.fill();
      }
      ctx.save();
      ctx.translate(-Math.round(this.camX), 0);
      // waves
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 40; i++) {
        const x = (i * 157) % this.mapW, y = 120 + ((i * 97) % 380);
        const o = Math.sin(this.t * 1.5 + i) * 6;
        ctx.beginPath(); ctx.moveTo(x + o, y); ctx.lineTo(x + 12 + o, y - 5); ctx.lineTo(x + 24 + o, y); ctx.stroke();
      }
      this.islands.forEach((isl, i) => this.drawIsland(ctx, isl, i));
      // paths
      for (let k = 0; k < this.nodes.length - 1; k++) {
        const a = this.nodes[k], b = this.nodes[k + 1];
        const open = G.Save.isUnlocked(b.id);
        const steps = Math.floor(U.dist(a.x, a.y, b.x, b.y) / 18);
        for (let s = 1; s < steps; s++) {
          const x = U.lerp(a.x, b.x, s / steps), y = U.lerp(a.y, b.y, s / steps) - Math.sin((s / steps) * Math.PI) * (a.wi !== b.wi ? 40 : 10);
          ctx.fillStyle = open ? '#fff6d8' : 'rgba(40,40,60,0.35)';
          ctx.beginPath(); ctx.arc(x, y, open ? 4 : 3, 0, U.TAU); ctx.fill();
        }
      }
      this.nodes.forEach((n, k) => this.drawNode(ctx, n, k));
      this.parts.draw(ctx, false);
      // avatar
      const walking = this.moving;
      const p = walking ? G.Hero.walkPose(this.t, 12) : G.Hero.idlePose(this.t);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(this.ax, this.ay - 6, 18, 5, 0, 0, U.TAU); ctx.fill();
      G.Hero.draw(ctx, this.ax, this.ay - 6, this.facing, p, 1.0);
      ctx.restore();

      this.drawHUD(ctx);
      if (this.menu || this.optionsMenu) {
        ctx.fillStyle = 'rgba(8,8,20,0.6)';
        ctx.fillRect(0, 0, W, H);
        if (this.optionsMenu) G.OptionsMenu.draw(ctx, this.optionsMenu);
        else {
          G.UI.text(ctx, 'MENU', W / 2, 130, { size: 44, weight: 700, align: 'center', stroke: 8, strokeColor: '#b3261e' });
          this.menu.draw(ctx);
        }
      }
      if (this.enterT < 0.5) { ctx.fillStyle = 'rgba(10,10,25,' + (1 - this.enterT * 2) + ')'; ctx.fillRect(0, 0, W, H); }
    },

    drawIsland(ctx, isl, i) {
      const w = G.Worlds.list[i];
      const th = G.Themes[w.theme];
      const pts = isl.pts;
      // cliff side
      ctx.fillStyle = th.ground.bodyDark;
      ctx.beginPath();
      pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1] + 46) : ctx.moveTo(p[0], p[1] + 46)));
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = th.ground.body;
      for (let k = 0; k < pts.length; k++) {
        const a = pts[k], b = pts[(k + 1) % pts.length];
        if (a[1] < isl.cy - 20 && b[1] < isl.cy - 20) continue;
        ctx.fillStyle = k % 2 ? th.ground.body : th.ground.bodyDark;
        U.poly(ctx, [a[0], a[1], b[0], b[1], b[0], b[1] + 46, a[0], a[1] + 46]);
        ctx.fill();
      }
      // top surface with facets
      ctx.save();
      ctx.beginPath();
      pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.fillStyle = th.ground.top;
      ctx.fill();
      ctx.clip();
      for (let k = 0; k < pts.length; k++) {
        const a = pts[k], b = pts[(k + 1) % pts.length];
        ctx.fillStyle = k % 3 === 0 ? U.shade(th.ground.top, 0.12) : k % 3 === 1 ? th.ground.topDark : th.ground.top;
        U.poly(ctx, [isl.cx + (k % 2 ? 40 : -60), isl.cy + (k % 2 ? -10 : 20), a[0], a[1], b[0], b[1]]);
        ctx.fill();
      }
      // decorations
      for (const d of isl.deco) this.drawDeco(ctx, w.theme, d, th);
      // world name banner
      ctx.restore();
      if (!this.restored(i)) {
        // drain the colour (top face + cliff) until this world's boss is beaten
        for (const yo of [0, 23, 46]) {
          ctx.save();
          ctx.beginPath();
          pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1] + yo) : ctx.moveTo(p[0], p[1] + yo)));
          ctx.closePath();
          ctx.clip();
          ctx.globalCompositeOperation = 'saturation';
          ctx.fillStyle = 'hsl(0,0%,50%)';
          ctx.globalAlpha = 0.8;
          ctx.fillRect(isl.cx - 450, isl.cy - 220, 900, 480);
          ctx.restore();
        }
      }
      if (!this.worldOpen(i)) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#101020';
        ctx.beginPath();
        pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      const open = this.worldOpen(i);
      G.UI.text(ctx, 'WORLD ' + w.id, isl.cx, isl.cy - 168, { size: 15, weight: 700, align: 'center', color: '#fff', stroke: 4, strokeColor: 'rgba(20,20,40,0.6)' });
      G.UI.text(ctx, open ? w.name : '???', isl.cx, isl.cy - 146, { size: 24, weight: 700, align: 'center', color: open ? '#fff' : '#c7c9db', stroke: 5, strokeColor: 'rgba(20,20,40,0.6)' });
      if (open) {
        const n = G.Save.shardCount(w.id);
        G.Icons.shard(ctx, isl.cx - 18, isl.cy - 120, 0.55, this.t);
        G.UI.text(ctx, n + '/9', isl.cx - 4, isl.cy - 119, { size: 16, weight: 700, color: '#fff', stroke: 4, strokeColor: 'rgba(20,20,40,0.6)' });
      }
    },
    drawDeco(ctx, theme, d, th) {
      const x = d.x, y = d.y, s = d.s;
      if (theme === 'meadow') {
        ctx.fillStyle = '#7a4f33'; ctx.fillRect(x - 2 * s, y - 10 * s, 4 * s, 10 * s);
        ctx.fillStyle = d.v > 0.5 ? '#3e9e57' : '#4fb563';
        U.poly(ctx, [x, y - 34 * s, x + 14 * s, y - 14 * s, x + 8 * s, y - 6 * s, x - 8 * s, y - 6 * s, x - 14 * s, y - 14 * s]); ctx.fill();
        ctx.fillStyle = '#6fd07a';
        U.poly(ctx, [x, y - 34 * s, x - 14 * s, y - 14 * s, x, y - 14 * s]); ctx.fill();
      } else if (theme === 'caves') {
        const c = d.v > 0.5 ? '#3ee0c8' : '#b48cff';
        ctx.fillStyle = U.shade(c, -0.25);
        U.poly(ctx, [x - 7 * s, y, x - 5 * s, y - 24 * s, x, y - 34 * s, x + 5 * s, y - 24 * s, x + 7 * s, y]); ctx.fill();
        ctx.fillStyle = c;
        U.poly(ctx, [x - 7 * s, y, x - 5 * s, y - 24 * s, x, y - 34 * s, x, y]); ctx.fill();
      } else if (theme === 'peaks') {
        ctx.fillStyle = '#8fa2dc';
        U.poly(ctx, [x - 20 * s, y, x, y - 40 * s, x + 20 * s, y]); ctx.fill();
        ctx.fillStyle = '#fff';
        U.poly(ctx, [x - 7 * s, y - 26 * s, x, y - 40 * s, x + 7 * s, y - 26 * s, x, y - 22 * s]); ctx.fill();
      } else {
        ctx.fillStyle = '#3a2a3a';
        ctx.fillRect(x - 8 * s, y - 34 * s, 16 * s, 34 * s);
        U.poly(ctx, [x - 11 * s, y - 34 * s, x, y - 52 * s, x + 11 * s, y - 34 * s]); ctx.fill();
        ctx.fillStyle = 'rgba(255,140,60,0.8)';
        ctx.fillRect(x - 2 * s, y - 26 * s, 4 * s, 6 * s);
      }
    },
    drawNode(ctx, n, k) {
      const id = n.id;
      const open = G.Save.isUnlocked(id);
      const rec = G.Save.data.levels[id];
      const done = rec && rec.done;
      const w = G.Worlds.list[n.wi];
      const r = n.boss ? 26 : 20;
      const sel = k === this.cur;
      if (sel) {
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 + Math.sin(this.t * 5) * 0.3) + ')';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(n.x, n.y, r + 8 + Math.sin(this.t * 5) * 2, 0, U.TAU); ctx.stroke();
      }
      // base disc (faceted octagon with thickness)
      const oct = (rr, yo) => { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * U.TAU + Math.PI / 8; ctx.lineTo(n.x + Math.cos(a) * rr, n.y + yo + Math.sin(a) * rr * 0.62); } ctx.closePath(); };
      oct(r, 7); ctx.fillStyle = 'rgba(20,20,40,0.5)'; ctx.fill();
      oct(r, 0);
      ctx.fillStyle = !open ? '#8a8ca0' : done ? w.color : '#ffffff';
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.moveTo(n.x - r, n.y); ctx.lineTo(n.x, n.y - r * 0.62); ctx.lineTo(n.x, n.y); ctx.closePath(); ctx.fill();
      if (!open) G.Icons.lock(ctx, n.x, n.y - 2, 0.9);
      else if (n.boss) G.Icons.crown(ctx, n.x, n.y - 2, 1.1, done ? '#fff' : '#ffb02a');
      else G.UI.text(ctx, id, n.x, n.y + 1, { size: 14, weight: 700, align: 'center', color: done ? '#fff' : '#30264a' });
      if (open && !n.boss && rec) {
        for (let i = 0; i < 3; i++) {
          const sx = n.x - 14 + i * 14, sy = n.y + 24;
          ctx.fillStyle = rec.shards[i] ? G.Icons.PRISM[i * 2] : 'rgba(30,30,50,0.45)';
          U.poly(ctx, [sx, sy - 6, sx + 4, sy, sx, sy + 6, sx - 4, sy]);
          ctx.fill();
        }
      }
    },
    drawHUD(ctx) {
      const W = G.R.W, H = G.R.H;
      const sd = G.Save.data;
      G.UI.panel(ctx, 12, 12, 250, 46, { color: '#1a1d3a', alpha: 0.85, r: 12 });
      G.Icons.gem(ctx, 34, 35, 0.9, this.t * 2);
      G.UI.text(ctx, String(sd.gems), 50, 36, { size: 20, weight: 700 });
      G.Icons.shard(ctx, 140, 35, 0.6, this.t);
      G.UI.text(ctx, G.Save.shardCount() + '/36', 154, 36, { size: 20, weight: 700 });
      // buttons
      [['SHOP', W - 250], ['MENU', W - 128]].forEach(([l, x]) => {
        G.UI.panel(ctx, x, 14, 110, 40, { color: l === 'SHOP' ? '#2b7a4b' : '#3a2f6a', alpha: 0.9, r: 10 });
        G.UI.text(ctx, l, x + 55, 35, { size: 18, weight: 700, align: 'center' });
      });
      // info panel
      const id = this.order[this.cur];
      const def = G.Worlds.levels[id];
      const rec = sd.levels[id];
      const pw = Math.min(460, W - 24);
      G.UI.panel(ctx, 12, H - 110, pw, 98, { color: '#1a1d3a', alpha: 0.9 });
      if (def) {
        const w = G.Worlds.worldOf(id);
        G.UI.text(ctx, 'World ' + w.id + ' · ' + w.name, 28, H - 90, { size: 14, color: 'rgba(255,255,255,0.65)' });
        G.UI.text(ctx, G.Worlds.label(id) + '  ' + def.name, 28, H - 66, { size: 22, weight: 700, color: '#fff' });
        if (def.boss) {
          G.UI.text(ctx, rec && rec.done ? 'Defeated!' : 'BOSS STAGE', 28, H - 38, { size: 16, weight: 700, color: '#ffb02a' });
        } else {
          for (let i = 0; i < 3; i++) G.Icons.shard(ctx, 38 + i * 26, H - 36, 0.55, this.t + i, !(rec && rec.shards[i]));
          G.UI.text(ctx, 'Best: ' + (rec && rec.done ? rec.bestGems + ' gems · ' + U.formatTime(rec.bestTime) : '—'), 120, H - 36, { size: 15, color: 'rgba(255,255,255,0.8)' });
        }
        const b = this.playBtnRect();
        if (pw >= 460) {
          G.UI.panel(ctx, b.x, b.y, b.w, b.h, { color: '#c0392b', alpha: 0.95, r: 12 });
          G.UI.text(ctx, '▶ PLAY', b.x + b.w / 2, b.y + b.h / 2 + 1, { size: 20, weight: 700, align: 'center' });
        }
      }
      G.UI.hint(ctx, '←/→ move · Enter play · X shop · Esc menu', W - 16, 72, 'right');
    },
  };
  G.Scenes.register('overworld', OW);
})(window.G);
