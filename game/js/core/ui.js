// UI toolkit: text, faceted panels, keyboard/mouse/touch menus and the
// typewriter dialogue box used by cutscenes and boss intros.
(function (G) {
  'use strict';
  const U = G.U;
  const UI = (G.UI = {});
  UI.FONT = 'Fredoka, "Trebuchet MS", "Segoe UI", sans-serif';

  UI.text = function (ctx, str, x, y, o) {
    o = o || {};
    ctx.font = (o.weight || 600) + ' ' + (o.size || 20) + 'px ' + UI.FONT;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.baseline || 'middle';
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    if (o.shadow) {
      ctx.fillStyle = o.shadow;
      ctx.fillText(str, x, y + (o.shadowOff || 3));
    }
    if (o.stroke) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = o.stroke;
      ctx.strokeStyle = o.strokeColor || '#1a0f1e';
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = o.color || '#fff';
    ctx.fillText(str, x, y);
    if (o.alpha != null) ctx.globalAlpha = 1;
  };
  UI.measure = function (ctx, str, size, weight) {
    ctx.font = (weight || 600) + ' ' + size + 'px ' + UI.FONT;
    return ctx.measureText(str).width;
  };
  UI.wrap = function (ctx, str, maxW, size, weight) {
    ctx.font = (weight || 600) + ' ' + size + 'px ' + UI.FONT;
    const out = [];
    str.split('\n').forEach((para) => {
      const words = para.split(' ');
      let line = '';
      words.forEach((w) => {
        const t = line ? line + ' ' + w : w;
        if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
      });
      out.push(line);
    });
    return out;
  };

  // Faceted glassy panel.
  UI.panel = function (ctx, x, y, w, h, o) {
    o = o || {};
    const base = o.color || '#1d2140';
    ctx.save();
    ctx.globalAlpha = o.alpha != null ? o.alpha : 0.92;
    U.roundRect(ctx, x, y, w, h, o.r != null ? o.r : 16);
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, U.shade(base, 0.12));
    g.addColorStop(1, U.shade(base, -0.2));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();
    // facets
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#ffffff';
    U.poly(ctx, [x, y, x + w * 0.45, y, x, y + h * 0.7]);
    ctx.fill();
    ctx.globalAlpha = 0.05;
    U.poly(ctx, [x + w, y + h, x + w * 0.6, y + h, x + w, y + h * 0.2]);
    ctx.fill();
    ctx.restore();
    ctx.save();
    U.roundRect(ctx, x + 1, y + 1, w - 2, h - 2, o.r != null ? o.r : 16);
    ctx.lineWidth = o.borderW || 2;
    ctx.strokeStyle = o.border || U.rgba('#ffffff', 0.18);
    ctx.stroke();
    ctx.restore();
  };

  // Generic vertical menu. items: {label, onSelect, disabled, adjust(dir), valueText()}
  class Menu {
    constructor(items, o) {
      this.items = items;
      this.sel = 0;
      this.o = Object.assign({ x: 0, y: 0, w: 320, itemH: 52, gap: 10, size: 24, align: 'center' }, o || {});
      this.t = 0;
      this.flash = 0;
      this.onBack = this.o.onBack || null;
      while (this.items[this.sel] && this.items[this.sel].disabled) this.sel++;
      if (this.sel >= this.items.length) this.sel = 0;
    }
    rectOf(i) {
      const o = this.o;
      return { x: o.x - o.w / 2, y: o.y + i * (o.itemH + o.gap), w: o.w, h: o.itemH };
    }
    move(d) {
      const n = this.items.length;
      let s = this.sel;
      for (let k = 0; k < n; k++) {
        s = (s + d + n) % n;
        if (!this.items[s].disabled) break;
      }
      if (s !== this.sel) { this.sel = s; G.Audio.play('menuMove'); }
    }
    update(dt) {
      const I = G.Input;
      this.t += dt;
      this.flash = Math.max(0, this.flash - dt);
      if (I.pressed.up) this.move(-1);
      if (I.pressed.down) this.move(1);
      const it = this.items[this.sel];
      if (it && it.adjust) {
        if (I.pressed.left) it.adjust(-1);
        if (I.pressed.right) it.adjust(1);
      }
      // pointer hover/click
      const p = I.pointer;
      if (p.moved || p.clicked) {
        for (let i = 0; i < this.items.length; i++) {
          const r = this.rectOf(i);
          if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h && !this.items[i].disabled) {
            if (this.sel !== i && p.moved) { this.sel = i; }
            if (p.clicked) {
              this.sel = i;
              const item = this.items[i];
              if (item.adjust) {
                // click left/right halves to adjust sliders
                item.adjust(p.x < r.x + r.w * 0.35 ? -1 : 1);
              } else return this.activate();
            }
          }
        }
        p.moved = false;
      }
      if (I.pressed.confirm && it && !it.disabled) {
        if (it.adjust && !it.onSelect) it.adjust(1);
        else return this.activate();
      }
      if (I.pressed.back && this.onBack) { G.Audio.play('menuBack'); this.onBack(); }
      return null;
    }
    activate() {
      const it = this.items[this.sel];
      if (!it || it.disabled) { G.Audio.play('deny'); return null; }
      G.Audio.play('menuSelect');
      this.flash = 0.25;
      if (it.onSelect) it.onSelect();
      return it;
    }
    draw(ctx) {
      const o = this.o;
      this.items.forEach((it, i) => {
        const r = this.rectOf(i);
        const sel = i === this.sel;
        const pulse = sel ? Math.sin(this.t * 6) * 0.5 + 0.5 : 0;
        ctx.save();
        if (sel) {
          const grow = 6 + pulse * 3;
          U.roundRect(ctx, r.x - grow / 2, r.y - grow / 4, r.w + grow, r.h + grow / 2, 14);
          const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
          g.addColorStop(0, o.selA || '#ff4b3e');
          g.addColorStop(1, o.selB || '#ff8a3d');
          ctx.fillStyle = g;
          ctx.fill();
          ctx.globalAlpha = 0.18;
          ctx.fillStyle = '#fff';
          U.poly(ctx, [r.x, r.y, r.x + r.w * 0.5, r.y, r.x + r.w * 0.38, r.y + r.h * 0.5, r.x, r.y + r.h * 0.5]);
          ctx.fill();
          ctx.globalAlpha = 1;
        } else {
          U.roundRect(ctx, r.x, r.y, r.w, r.h, 14);
          ctx.fillStyle = U.rgba(o.idle || '#1a1d36', 0.82);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.12)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.restore();
        const col = it.disabled ? 'rgba(255,255,255,0.32)' : '#fff';
        if (it.valueText) {
          UI.text(ctx, it.label, r.x + 22, r.y + r.h / 2, { size: o.size * 0.85, color: col, weight: 600 });
          const v = it.valueText();
          UI.text(ctx, (sel && it.adjust ? '◀  ' : '') + v + (sel && it.adjust ? '  ▶' : ''), r.x + r.w - 22, r.y + r.h / 2, { size: o.size * 0.85, color: sel ? '#fff7d6' : '#ffd38a', align: 'right', weight: 700 });
        } else {
          UI.text(ctx, it.label, o.x, r.y + r.h / 2 + 1, { size: o.size, color: col, align: 'center', weight: 700, shadow: sel ? 'rgba(80,0,0,0.35)' : null, shadowOff: 2 });
          if (it.sub) UI.text(ctx, it.sub, o.x, r.y + r.h - 9, { size: 12, color: 'rgba(255,255,255,0.6)', align: 'center' });
        }
      });
    }
  }
  UI.Menu = Menu;

  // Typewriter dialogue: lines = [{who, text}]
  class Dialogue {
    constructor(lines, o) {
      this.lines = lines;
      this.i = 0;
      this.chars = 0;
      this.done = false;
      this.o = o || {};
      this.t = 0;
    }
    get cur() { return this.lines[this.i]; }
    update(dt) {
      if (this.done) return;
      this.t += dt;
      const I = G.Input;
      const line = this.cur;
      const before = Math.floor(this.chars);
      this.chars = Math.min(line.text.length, this.chars + dt * 55);
      if (Math.floor(this.chars) !== before && Math.floor(this.chars) % 3 === 0 && line.text[Math.floor(this.chars)] !== ' ') G.Audio.play('text');
      const adv = I.pressed.confirm || I.pressed.jump || I.pressed.attack || I.pointer.clicked;
      if (adv) {
        if (this.chars < line.text.length) this.chars = line.text.length;
        else {
          this.i++;
          this.chars = 0;
          if (this.i >= this.lines.length) { this.done = true; this.i = this.lines.length - 1; }
        }
      }
    }
    draw(ctx) {
      const W = G.R.W, H = G.R.H;
      const line = this.cur;
      if (!line) return;
      const bw = Math.min(W - 60, 860), bh = 132;
      const bx = (W - bw) / 2, by = H - bh - 22;
      UI.panel(ctx, bx, by, bw, bh, { color: '#191c35', alpha: 0.94 });
      let tx = bx + 26;
      if (line.who) {
        const sp = G.Story && G.Story.speakers[line.who];
        if (sp && G.Icons) {
          ctx.save();
          U.roundRect(ctx, bx + 16, by + 16, 100, 100, 14);
          ctx.fillStyle = sp.bg || '#2b2f55';
          ctx.fill();
          ctx.clip();
          G.Icons.portrait(ctx, line.who, bx + 66, by + 66, this.t);
          ctx.restore();
          tx = bx + 134;
        }
        UI.text(ctx, sp ? sp.name : line.who, tx, by + 26, { size: 20, color: sp ? sp.color : '#ffd38a', weight: 700 });
      }
      const lines = UI.wrap(ctx, line.text, bx + bw - tx - 26, 19, 500);
      let shown = Math.floor(this.chars);
      lines.forEach((l, k) => {
        if (shown <= 0) return;
        const part = l.slice(0, shown);
        shown -= l.length + 1;
        UI.text(ctx, part, tx, by + (line.who ? 56 : 34) + k * 26, { size: 19, color: '#eef0ff', weight: 500 });
      });
      if (this.chars >= line.text.length) {
        const bob = Math.sin(this.t * 6) * 3;
        UI.text(ctx, '▼', bx + bw - 28, by + bh - 20 + bob, { size: 16, color: '#ff8a7a', align: 'center' });
      }
    }
  }
  UI.Dialogue = Dialogue;

  // Small helper to draw the button-prompt hint row in the corner.
  UI.hint = function (ctx, str, x, y, align) {
    UI.text(ctx, str, x, y, { size: 15, color: 'rgba(255,255,255,0.65)', align: align || 'left', weight: 500 });
  };

  // Clickable rectangular button (for screens that don't use Menu).
  UI.hit = function (r) {
    const p = G.Input.pointer;
    return p.clicked && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  };
})(window.G);
