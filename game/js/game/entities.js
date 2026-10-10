// World objects. Each spawn character in a level maps to a factory in
// G.EntityTypes; enemies register themselves via G.Enemies.register.
//
// Entities talk to the gameplay scene (`play`) through a small API:
// play.player, play.level, play.parts, play.sfx(), play.spawn(),
// play.addGems(), play.collectShard(), play.heal(), play.setCheckpoint(),
// play.complete(), play.shake(), play.hitstop(), play.popText().
(function (G) {
  'use strict';
  const U = G.U;
  const TS = () => G.TILE;

  class Entity {
    constructor(x, y, w, h) {
      this.x = x; this.y = y; this.w = w; this.h = h;
      this.dead = false;
      this.t = Math.random() * 10;
      this.layer = 0; // 0 behind player, 1 in front
    }
    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
    update(dt, play) { this.t += dt; }
    draw(ctx, play) {}
    // Entities whose box is far outside the view may skip work.
    near(play, margin) {
      const v = play.view;
      return this.x + this.w > v.x - margin && this.x < v.x + v.w + margin && this.y + this.h > v.y - margin && this.y < v.y + v.h + margin;
    }
  }
  G.Entity = Entity;

  // ---- Gem -------------------------------------------------------------
  class Gem extends Entity {
    constructor(x, y, loose) {
      super(x - 10, y - 12, 20, 24);
      this.baseY = this.y;
      this.loose = !!loose;
      this.vx = 0; this.vy = 0;
      this.age = 0;
      this.life = loose ? 9 : Infinity;
      this.color = '#3fe0ff';
    }
    update(dt, play) {
      this.t += dt; this.age += dt;
      const p = play.player;
      if (this.loose) {
        this.life -= dt;
        if (this.life <= 0) { this.dead = true; return; }
        this.vy = Math.min(700, this.vy + 1600 * dt);
        const hx = G.Phys.moveX(play.level, this, this.vx * dt);
        if (hx) this.vx = -this.vx * 0.5;
        const r = G.Phys.moveY(play.level, this, this.vy * dt, false, null);
        if (r.hit === 1) { this.vy = this.vy > 150 ? -this.vy * 0.45 : 0; this.vx *= 0.8; }
        else if (r.hit === -1) this.vy = 0;
      }
      if (p.dead || this.age < (this.loose ? 0.3 : 0)) return;
      const magnet = play.magnetRange;
      const dx = p.cx - this.cx, dy = p.cy - this.cy;
      const d = Math.hypot(dx, dy);
      if (magnet && d < magnet) {
        const sp = 520 * (1 - d / magnet) + 160;
        this.x += (dx / d) * sp * dt; this.y += (dy / d) * sp * dt;
        this.baseY = this.y;
      }
      if (U.overlap(this, p)) {
        this.dead = true;
        play.addGems(1, this.cx, this.cy);
      }
    }
    draw(ctx) {
      if (this.loose && this.life < 2 && Math.floor(this.life * 10) % 2 === 0) return;
      const bob = this.loose ? 0 : Math.sin(this.t * 3) * 3;
      G.Icons.gem(ctx, this.cx, this.cy + bob, 1, this.t * 2.4, this.color);
    }
  }
  G.Gem = Gem;

  // ---- Prism shard -------------------------------------------------------
  class Shard extends Entity {
    constructor(sp, idx) {
      super(sp.x + 6, sp.y + 2, 36, 44);
      this.idx = idx;
    }
    update(dt, play) {
      this.t += dt;
      this.ghost = play.shardOwned(this.idx);
      if (!play.player.dead && U.overlap(this, play.player)) {
        this.dead = true;
        play.collectShard(this.idx, this.cx, this.cy);
      }
      if (!this.ghost && Math.random() < dt * 8) {
        play.parts.spawn({ x: this.cx + U.rand(-16, 16), y: this.cy + U.rand(-20, 20), vy: -30, life: 0.7, size: 3, shape: 'spark', color: U.pick(G.Icons.PRISM), glow: true });
      }
    }
    draw(ctx) {
      G.Icons.shard(ctx, this.cx, this.cy + Math.sin(this.t * 2.2) * 4, 1.05, this.t, this.ghost);
    }
  }

  // ---- Heart -----------------------------------------------------------
  class Heart extends Entity {
    constructor(sp) { super(sp.x + 10, sp.y + 10, 28, 26); }
    update(dt, play) {
      this.t += dt;
      if (!play.player.dead && U.overlap(this, play.player)) { this.dead = true; play.heal(1, this.cx, this.cy); }
    }
    draw(ctx) {
      const s = 1 + Math.sin(this.t * 5) * 0.08;
      G.Icons.heart(ctx, this.cx, this.cy + Math.sin(this.t * 2.5) * 3, s, true);
    }
  }

  // ---- Checkpoint ------------------------------------------------------
  class Checkpoint extends Entity {
    constructor(sp) {
      super(sp.x + 8, sp.y - TS() * 1, 32, TS() * 2);
      this.on = false;
      this.raise = 0;
    }
    update(dt, play) {
      this.t += dt;
      if (this.on) this.raise = Math.min(1, this.raise + dt * 2.5);
      if (!this.on && !play.player.dead && U.overlap(this, play.player)) {
        this.on = true;
        play.setCheckpoint(this);
      }
    }
    draw(ctx) {
      const x = this.cx, by = this.y + this.h;
      // base
      ctx.fillStyle = '#4b4f6b';
      U.poly(ctx, [x - 14, by, x - 10, by - 8, x + 10, by - 8, x + 14, by]);
      ctx.fill();
      ctx.fillStyle = '#6c7192';
      U.poly(ctx, [x - 14, by, x - 10, by - 8, x, by - 8, x, by]);
      ctx.fill();
      // pole
      ctx.fillStyle = '#c9cde0';
      ctx.fillRect(x - 2.5, by - 88, 5, 82);
      ctx.fillStyle = '#9095b0';
      ctx.fillRect(x, by - 88, 2.5, 82);
      // flag
      const fy = by - 30 - this.raise * 52;
      const wave = Math.sin(this.t * 6);
      if (this.on) {
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = G.Icons.PRISM[(i * 2 + Math.floor(this.t * 2)) % 6];
          U.poly(ctx, [x + 2, fy + i * 7, x + 30 + wave * 3, fy + 5 + i * 7 + wave * 2, x + 2, fy + 7 + i * 7]);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#7a7d90';
        U.poly(ctx, [x + 2, fy, x + 26 + wave * 2, fy + 10, x + 2, fy + 20]);
        ctx.fill();
      }
      // crystal cap
      const glow = this.on ? 0.6 + Math.sin(this.t * 4) * 0.2 : 0;
      if (glow) {
        const g = ctx.createRadialGradient(x, by - 96, 2, x, by - 96, 30);
        g.addColorStop(0, 'rgba(255,255,255,' + glow + ')');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, by - 96, 30, 0, U.TAU); ctx.fill();
      }
      ctx.fillStyle = this.on ? '#ffffff' : '#a5a9bf';
      U.poly(ctx, [x, by - 108, x + 7, by - 96, x, by - 86, x - 7, by - 96]);
      ctx.fill();
      ctx.fillStyle = this.on ? G.Icons.PRISM[Math.floor(this.t * 3) % 6] : '#7d8199';
      U.poly(ctx, [x, by - 108, x + 7, by - 96, x, by - 96]);
      ctx.fill();
    }
  }

  // ---- Spring ----------------------------------------------------------
  class Spring extends Entity {
    constructor(sp) { super(sp.x + 6, sp.y + TS() - 22, 36, 22); this.squish = 0; }
    update(dt, play) {
      this.t += dt;
      this.squish = Math.max(0, this.squish - dt * 4);
      const p = play.player;
      if (!p.dead && p.vy >= 0 && U.overlap(this, p) && (p.bottom - p.vy * dt <= this.y + 10 || p.onGround)) {
        p.y = this.y - p.h;
        p.bounce(G.Player.C.SPRING, false);
        p.spinT = 0.34;
        this.squish = 1;
        play.sfx('spring');
        play.parts.burst(this.cx, this.y, 8, { color: ['#ffe14a', '#fff'], speed: 200, angle: -Math.PI / 2, spread: 1, life: 0.4, size: 4 });
      }
    }
    draw(ctx) {
      const x = this.x, by = this.y + this.h;
      const top = by - 22 + this.squish * 10;
      ctx.fillStyle = '#5d6178';
      ctx.fillRect(x + 2, by - 6, this.w - 4, 6);
      ctx.strokeStyle = '#c9cde0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const segs = 3;
      for (let i = 0; i <= segs * 2; i++) {
        const yy = by - 6 - ((by - 6 - top - 6) * i) / (segs * 2);
        ctx.lineTo(this.cx + (i % 2 ? 9 : -9), yy);
      }
      ctx.stroke();
      ctx.fillStyle = '#ff3b4f';
      U.poly(ctx, [x, top + 6, x + 4, top, x + this.w - 4, top, x + this.w, top + 6]);
      ctx.fill();
      ctx.fillStyle = '#ff8a95';
      U.poly(ctx, [x + 4, top, x + this.w / 2, top, x + this.w / 2 - 4, top + 3, x + 2, top + 4]);
      ctx.fill();
    }
  }

  // ---- Moving platform -------------------------------------------------
  class Platform extends Entity {
    constructor(sp) {
      super(sp.x, sp.y + (sp.axis === 'y' ? 0 : 0), TS() * 2, 18);
      this.x0 = this.x; this.y0 = this.y;
      this.axis = sp.axis; this.travel = sp.travel;
      this.phase = 0;
      this.period = (this.travel * 2) / 140 + 0.6;
      this.prevX = this.x; this.prevY = this.y; this.dx = 0; this.dy = 0; this.vy = 0;
      this.isPlatform = true;
    }
    update(dt, play) {
      this.t += dt;
      this.phase += dt / this.period;
      const k = 0.5 - 0.5 * Math.cos(this.phase * U.TAU);
      this.prevX = this.x; this.prevY = this.y;
      if (this.axis === 'x') this.x = this.x0 + this.travel * k;
      else this.y = this.y0 + this.travel * k;
      this.dx = this.x - this.prevX; this.dy = this.y - this.prevY;
      this.vy = this.dy / dt;
    }
    draw(ctx, play) {
      const c = play.theme.platform;
      const x = this.x, y = this.y, w = this.w;
      ctx.fillStyle = U.shade(c, -0.4);
      U.poly(ctx, [x, y + 8, x + w, y + 8, x + w - 10, y + 22, x + 10, y + 22]);
      ctx.fill();
      ctx.fillStyle = c;
      ctx.fillRect(x, y, w, 9);
      ctx.fillStyle = U.shade(c, 0.3);
      U.poly(ctx, [x, y, x + w * 0.6, y, x + w * 0.5, y + 4, x, y + 4]);
      ctx.fill();
      // glowing gem core
      const gc = G.Icons.PRISM[Math.floor(this.t * 2) % 6];
      ctx.fillStyle = gc;
      U.poly(ctx, [x + w / 2, y + 10, x + w / 2 + 7, y + 15, x + w / 2, y + 21, x + w / 2 - 7, y + 15]);
      ctx.fill();
    }
  }

  // ---- Goal: Prism Gate ------------------------------------------------
  class Goal extends Entity {
    constructor(sp, locked) {
      super(sp.x - 12, sp.y - TS() * 2, 72, TS() * 3);
      this.locked = !!locked;
      this.appear = locked ? 0 : 1;
    }
    unlock() { this.locked = false; }
    update(dt, play) {
      this.t += dt;
      if (!this.locked) this.appear = Math.min(1, this.appear + dt * 1.5);
      const p = play.player;
      if (!this.locked && this.appear > 0.8 && !p.dead && U.overlap({ x: this.x + 16, y: this.y + 20, w: this.w - 32, h: this.h - 20 }, p)) play.complete();
      if (!this.locked && Math.random() < dt * 10) {
        play.parts.spawn({ x: this.cx + U.rand(-20, 20), y: this.y + this.h - 10, vy: U.rand(-90, -40), vx: U.rand(-10, 10), life: 1.2, size: 3, shape: 'spark', color: U.pick(G.Icons.PRISM), glow: true });
      }
    }
    draw(ctx) {
      const x = this.cx, by = this.y + this.h;
      const a = this.appear;
      if (a <= 0) {
        // faint outline when locked
        ctx.globalAlpha = 0.25;
      }
      // pillars
      const pc = '#e9ecff', pd = '#a9aecb';
      [-1, 1].forEach((s) => {
        ctx.fillStyle = pd;
        U.poly(ctx, [x + s * 34, by, x + s * 26, by, x + s * 24, by - 118, x + s * 36, by - 112]);
        ctx.fill();
        ctx.fillStyle = pc;
        U.poly(ctx, [x + s * 30, by, x + s * 26, by, x + s * 24, by - 118, x + s * 30, by - 115]);
        ctx.fill();
      });
      // arch crystal
      ctx.fillStyle = pc;
      U.poly(ctx, [x - 38, by - 112, x, by - 146, x + 38, by - 112, x + 24, by - 118, x, by - 132, x - 24, by - 118]);
      ctx.fill();
      ctx.fillStyle = G.Icons.PRISM[Math.floor(this.t * 2) % 6];
      U.poly(ctx, [x, by - 158, x + 9, by - 144, x, by - 130, x - 9, by - 144]);
      ctx.fill();
      // swirling portal
      if (a > 0) {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.ellipse(x, by - 58, 22 * a, 56 * a, 0, 0, U.TAU);
        ctx.clip();
        for (let i = 0; i < 6; i++) {
          const ang = this.t * 1.8 + (i / 6) * U.TAU;
          ctx.fillStyle = G.Icons.PRISM[i];
          U.poly(ctx, [x, by - 58, x + Math.cos(ang) * 80, by - 58 + Math.sin(ang) * 80, x + Math.cos(ang + 1.05) * 80, by - 58 + Math.sin(ang + 1.05) * 80]);
          ctx.fill();
        }
        const g = ctx.createRadialGradient(x, by - 58, 2, x, by - 58, 40);
        g.addColorStop(0, 'rgba(255,255,255,0.95)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 40, by - 120, 80, 120);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  }

  // ---- Lumi hint ("?") --------------------------------------------------
  class Hint extends Entity {
    constructor(sp) {
      super(sp.x, sp.y, TS(), TS());
      this.text = sp.text;
      this.show = 0;
      this.layer = 1;
    }
    update(dt, play) {
      this.t += dt;
      const p = play.player;
      const near = Math.abs(p.cx - this.cx) < 90 && Math.abs(p.cy - this.cy) < 110;
      this.show = U.clamp(this.show + (near ? dt * 6 : -dt * 6), 0, 1);
    }
    draw(ctx, play) {
      G.Icons.lumi(ctx, this.cx, this.cy - 4, 0.75, this.t);
      if (this.show <= 0) return;
      const lines = G.UI.wrap(ctx, this.text, 300, 16, 600);
      const bw = Math.min(330, Math.max(...lines.map((l) => G.UI.measure(ctx, l, 16, 600))) + 28);
      const bh = lines.length * 21 + 18;
      let bx = this.cx - bw / 2;
      bx = U.clamp(bx, play.view.x + 8, play.view.x + play.view.w - bw - 8);
      const by = this.y - bh - 18 - (1 - this.show) * 10;
      ctx.globalAlpha = this.show;
      G.UI.panel(ctx, bx, by, bw, bh, { color: '#20244a', alpha: 0.93, r: 12 });
      ctx.fillStyle = 'rgba(32,36,74,0.93)';
      U.poly(ctx, [this.cx - 8, by + bh - 1, this.cx + 8, by + bh - 1, this.cx, by + bh + 9]);
      ctx.fill();
      lines.forEach((l, i) => G.UI.text(ctx, l, bx + 14, by + 19 + i * 21, { size: 16, color: '#f3f1ff', weight: 600 }));
      ctx.globalAlpha = 1;
    }
  }

  // ---- Projectile ------------------------------------------------------
  class Projectile extends Entity {
    constructor(x, y, vx, vy, o) {
      o = o || {};
      const r = o.r || 9;
      super(x - r, y - r, r * 2, r * 2);
      this.r = r;
      this.vx = vx; this.vy = vy;
      this.g = o.g || 0;
      this.life = o.life || 5;
      this.color = o.color || '#b9b6c9';
      this.reflectable = o.reflectable !== false;
      this.friendly = false;
      this.dmg = o.dmg || 1;
      this.homing = o.homing || 0;
      this.ignoreTiles = !!o.ignoreTiles;
      this.layer = 1;
      this.isProjectile = true;
      this.kind = o.kind || 'orb';
    }
    update(dt, play) {
      this.t += dt;
      this.life -= dt;
      if (this.life <= 0) { this.pop(play); return; }
      if (this.homing && !this.friendly) {
        const p = play.player;
        const a = Math.atan2(p.cy - this.cy, p.cx - this.cx);
        const sp = Math.hypot(this.vx, this.vy);
        const cur = Math.atan2(this.vy, this.vx);
        let d = a - cur;
        while (d > Math.PI) d -= U.TAU;
        while (d < -Math.PI) d += U.TAU;
        const n = cur + U.clamp(d, -this.homing * dt, this.homing * dt);
        this.vx = Math.cos(n) * sp; this.vy = Math.sin(n) * sp;
      }
      this.vy += this.g * dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (!this.ignoreTiles && G.Phys.solidRect(play.level, this.x + 3, this.y + 3, this.w - 6, this.h - 6)) { this.pop(play); return; }
      if (this.y > play.level.ph + 100) this.dead = true;
      if (Math.random() < dt * 30) play.parts.spawn({ x: this.cx, y: this.cy, life: 0.3, size: this.r * 0.5, color: this.friendly ? '#ffd36a' : this.color, shape: 'circle', alpha: 0.6 });
    }
    reflect(play, dir) {
      this.friendly = true;
      this.homing = 0;
      const sp = Math.max(420, Math.hypot(this.vx, this.vy) * 1.4);
      // aim at the nearest enemy/boss in the direction punched, else straight
      let target = null, best = 1e9;
      for (const e of play.entities) {
        if (!(e.isEnemy || e.isBoss) || e.dead) continue;
        if (U.sign(e.cx - this.cx) !== dir) continue;
        const d = U.dist(e.cx, e.cy, this.cx, this.cy);
        if (d < best && d < 900) { best = d; target = e; }
      }
      if (target) {
        const a = Math.atan2(target.cy - this.cy, target.cx - this.cx);
        this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp;
      } else { this.vx = dir * sp; this.vy = -60; }
      this.g = 0;
      this.life = 3;
      play.sfx('punch');
      play.parts.burst(this.cx, this.cy, 10, { color: ['#ffd36a', '#fff'], speed: 260, life: 0.35, size: 4, shape: 'spark', glow: true });
    }
    pop(play) {
      this.dead = true;
      play.parts.burst(this.cx, this.cy, 8, { color: [this.color, '#fff'], speed: 160, life: 0.35, size: 4 });
    }
    draw(ctx) {
      const c = this.friendly ? '#ffd36a' : this.color;
      ctx.save();
      ctx.translate(this.cx, this.cy);
      ctx.rotate(this.t * 6);
      const r = this.r;
      ctx.fillStyle = U.shade(c, -0.3);
      U.poly(ctx, [0, -r, r, 0, 0, r, -r, 0]);
      ctx.fill();
      ctx.fillStyle = c;
      U.poly(ctx, [0, -r, r, 0, 0, 0]);
      ctx.fill();
      U.poly(ctx, [0, r, -r, 0, 0, 0]);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      U.poly(ctx, [0, -r * 0.6, r * 0.35, -r * 0.1, 0, -r * 0.1]);
      ctx.fill();
      ctx.restore();
    }
  }
  G.Projectile = Projectile;

  // ---- Ground shockwave (boss attack) --------------------------------------
  class Shockwave extends Entity {
    constructor(x, groundY, dir, o) {
      o = o || {};
      super(x - 14, groundY - (o.h || 34), 28, o.h || 34);
      this.dir = dir;
      this.speed = o.speed || 360;
      this.life = o.life || 2.2;
      this.color = o.color || '#c9c3e6';
      this.layer = 1;
      this.isHazard = true;
    }
    update(dt, play) {
      this.t += dt;
      this.life -= dt;
      this.x += this.dir * this.speed * dt;
      const L = play.level;
      // stop at walls or ledges
      const fx = this.dir > 0 ? this.x + this.w : this.x;
      if (G.Phys.solidRect(L, fx, this.y + 4, 2, this.h - 8) || !G.Phys.solidRect(L, fx, this.y + this.h + 2, 2, 4)) this.life = Math.min(this.life, 0.08);
      if (this.life <= 0) { this.dead = true; return; }
      const p = play.player;
      if (!p.dead && U.overlap({ x: this.x + 4, y: this.y + 8, w: this.w - 8, h: this.h - 8 }, p)) p.hurt(1, this.cx - this.dir * 40) && play.onPlayerHurt();
      if (Math.random() < dt * 30) play.parts.spawn({ x: this.cx, y: this.y + this.h, vy: -U.rand(60, 160), vx: -this.dir * 40, life: 0.4, size: 4, color: this.color, g: 400 });
    }
    draw(ctx) {
      const x = this.cx, by = this.y + this.h, h = this.h * (0.8 + Math.sin(this.t * 30) * 0.15);
      ctx.fillStyle = U.shade(this.color, -0.25);
      U.poly(ctx, [x - 18, by, x - 4 * this.dir, by - h, x + 18, by]);
      ctx.fill();
      ctx.fillStyle = this.color;
      U.poly(ctx, [x - 18, by, x - 4 * this.dir, by - h, x, by]);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      U.poly(ctx, [x - 12 * this.dir, by, x - 4 * this.dir, by - h * 0.7, x - 2 * this.dir, by]);
      ctx.fill();
    }
  }
  G.Shockwave = Shockwave;

  // ---- spawn table -----------------------------------------------------
  G.EntityTypes = {
    o: (sp) => new Gem(sp.x + TS() / 2, sp.y + TS() / 2),
    '1': (sp) => new Shard(sp, 0),
    '2': (sp) => new Shard(sp, 1),
    '3': (sp) => new Shard(sp, 2),
    H: (sp) => new Heart(sp),
    C: (sp) => new Checkpoint(sp),
    J: (sp) => new Spring(sp),
    M: (sp) => new Platform(sp),
    N: (sp) => new Platform(sp),
    G: (sp, level) => new Goal(sp, !!level.def.boss),
    '?': (sp) => new Hint(sp),
  };
})(window.G);
