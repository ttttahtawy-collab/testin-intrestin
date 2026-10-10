// Lightweight pooled particle system (faceted shards, sparkles, dust, text).
(function (G) {
  'use strict';
  const U = G.U;
  const MAX = 900;

  class Particles {
    constructor() {
      this.pool = [];
      for (let i = 0; i < MAX; i++) this.pool.push({ alive: false });
      this.idx = 0;
    }
    clear() { this.pool.forEach((p) => (p.alive = false)); }
    spawn(o) {
      // round-robin; overwrite oldest when full
      const p = this.pool[this.idx];
      this.idx = (this.idx + 1) % MAX;
      p.alive = true;
      p.x = o.x; p.y = o.y;
      p.vx = o.vx || 0; p.vy = o.vy || 0;
      p.g = o.g != null ? o.g : 0;
      p.drag = o.drag != null ? o.drag : 0;
      p.life = p.max = o.life || 0.6;
      p.size = o.size || 4; p.size1 = o.size1 != null ? o.size1 : 0;
      p.color = o.color || '#fff';
      p.shape = o.shape || 'tri';
      p.rot = o.rot != null ? o.rot : Math.random() * U.TAU;
      p.vr = o.vr != null ? o.vr : U.rand(-8, 8);
      p.text = o.text;
      p.glow = !!o.glow;
      p.front = !!o.front;
      p.alpha = o.alpha != null ? o.alpha : 1;
      return p;
    }
    burst(x, y, n, o) {
      for (let i = 0; i < n; i++) {
        const a = o.angle != null ? o.angle + U.rand(-(o.spread || Math.PI), o.spread || Math.PI) : Math.random() * U.TAU;
        const sp = U.rand(o.speedMin != null ? o.speedMin : 60, o.speed || 240);
        this.spawn({
          x: x + U.rand(-(o.jitter || 0), o.jitter || 0), y: y + U.rand(-(o.jitter || 0), o.jitter || 0),
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 0),
          g: o.g, drag: o.drag, life: U.rand((o.life || 0.6) * 0.6, o.life || 0.6),
          size: U.rand((o.size || 5) * 0.6, o.size || 5), size1: o.size1,
          color: Array.isArray(o.color) ? U.pick(o.color) : o.color, shape: o.shape, glow: o.glow, front: o.front,
        });
      }
    }
    update(dt) {
      for (const p of this.pool) {
        if (!p.alive) continue;
        p.life -= dt;
        if (p.life <= 0) { p.alive = false; continue; }
        p.vy += p.g * dt;
        if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += p.vr * dt;
      }
    }
    draw(ctx, front, view) {
      for (const p of this.pool) {
        if (!p.alive || p.front !== !!front) continue;
        if (view && (p.x < view.x - 60 || p.x > view.x + view.w + 60 || p.y < view.y - 60 || p.y > view.y + view.h + 60)) continue;
        const k = p.life / p.max;
        const s = U.lerp(p.size1, p.size, k);
        ctx.globalAlpha = Math.min(1, k * 2.5) * p.alpha;
        if (p.shape === 'text') {
          ctx.fillStyle = p.color;
          ctx.font = '700 ' + Math.round(p.size) + 'px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
          ctx.strokeText(p.text, p.x, p.y);
          ctx.fillText(p.text, p.x, p.y);
          continue;
        }
        ctx.fillStyle = p.color;
        if (p.glow) ctx.globalCompositeOperation = 'lighter';
        if (p.shape === 'circle') {
          ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, U.TAU); ctx.fill();
        } else if (p.shape === 'spark') {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.beginPath();
          ctx.moveTo(0, -s * 1.6); ctx.lineTo(s * 0.35, 0); ctx.lineTo(0, s * 1.6); ctx.lineTo(-s * 0.35, 0);
          ctx.moveTo(-s * 1.6, 0); ctx.lineTo(0, s * 0.35); ctx.lineTo(s * 1.6, 0); ctx.lineTo(0, -s * 0.35);
          ctx.fill(); ctx.restore();
        } else if (p.shape === 'ring') {
          ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1, 6 * k);
          ctx.beginPath(); ctx.arc(p.x, p.y, U.lerp(p.size, p.size1, k), 0, U.TAU); ctx.stroke();
        } else {
          // faceted triangle shard
          const c = Math.cos(p.rot), sn = Math.sin(p.rot);
          ctx.beginPath();
          ctx.moveTo(p.x + c * s, p.y + sn * s);
          ctx.lineTo(p.x + (-c * 0.5 - sn * 0.87) * s, p.y + (-sn * 0.5 + c * 0.87) * s);
          ctx.lineTo(p.x + (-c * 0.5 + sn * 0.87) * s, p.y + (-sn * 0.5 - c * 0.87) * s);
          ctx.closePath(); ctx.fill();
        }
        if (p.glow) ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = 1;
    }
  }
  G.Particles = Particles;
})(window.G);
