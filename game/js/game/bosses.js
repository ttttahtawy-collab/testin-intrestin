// Bosses. Each boss is a state machine with telegraphed attacks and a
// "vulnerable" window; reflected projectiles always hurt a boss.
// Register new bosses in G.Bosses and reference them from a level's `boss`.
(function (G) {
  'use strict';
  const U = G.U;
  const Phys = G.Phys;
  const TS = () => G.TILE;
  G.Bosses = {};
  G.BossArt = {};

  class Boss extends G.Entity {
    constructor(sp, w, h, hp) {
      super(sp.x + TS() / 2 - w / 2, sp.y + TS() - h, w, h);
      this.isBoss = true;
      this.hp = this.maxHp = hp;
      this.vx = 0; this.vy = 0;
      this.state = 'intro'; this.st = 0;
      this.active = false;
      this.vulnerable = false;
      this.flashT = 0;
      this.facing = -1;
      this.lastHitId = -1;
      this.dying = 0;
      this.layer = 0;
      this.contact = true;
      this.phase = 1;
    }
    set(state) { this.state = state; this.st = 0; }
    get phase2() { return this.hp <= this.maxHp / 2; }
    physics(dt, play, grav) {
      if (grav !== false) this.vy = Math.min(1200, this.vy + 2300 * dt);
      this.hitX = Phys.moveX(play.level, this, this.vx * dt);
      const r = Phys.moveY(play.level, this, this.vy * dt, false, null);
      const was = this.onGround;
      this.onGround = r.hit === 1;
      if (r.hit) this.vy = 0;
      this.justLanded = this.onGround && !was;
    }
    update(dt, play) {
      this.t += dt;
      this.flashT = Math.max(0, this.flashT - dt);
      if (this.dying > 0) {
        this.dying += dt;
        this.vx = 0;
        if (Math.random() < dt * 14) {
          play.parts.burst(this.x + Math.random() * this.w, this.y + Math.random() * this.h, 10, { color: G.Icons.PRISM, speed: 260, life: 0.6, size: 7 });
          play.sfx('hit');
        }
        if (this.dying > 2.4) { this.dead = true; play.onBossDefeated(this); }
        return;
      }
      if (!this.active) { this.idleIntro(dt, play); return; }
      this.st += dt;
      this.behave(dt, play);
    }
    idleIntro(dt, play) { if (this.gravityOn !== false) this.physics(dt, play); }
    behave(dt, play) {}
    // Called by the play scene. kind: punch|stomp|pound|dash|reflect
    hit(dmg, kind, fromX, play) {
      if (this.dying || !this.active) return false;
      if (!this.vulnerable && kind !== 'reflect') {
        play.sfx('deny');
        return false;
      }
      this.hp -= dmg;
      this.flashT = 0.18;
      play.sfx('bossHit');
      play.shake(6, 0.2);
      play.hitstop(0.07);
      play.parts.burst(this.cx, this.cy, 14, { color: G.Icons.PRISM, speed: 300, life: 0.5, size: 6 });
      this.onHurt(kind, play);
      if (this.hp <= 0) {
        this.hp = 0;
        this.dying = 0.001;
        this.vulnerable = false;
        play.onBossDying(this);
      }
      return true;
    }
    onHurt(kind, play) {}
    stompResult() { return this.vulnerable ? 'hit' : 'bounce'; }
    hurtBox() { return { x: this.x + 10, y: this.y + 10, w: this.w - 20, h: this.h - 14 }; }
  }
  G.Boss = Boss;

  // =====================================================================
  // 1) GLUMBO — King of the Glumbles (Sunny Meadows)
  // =====================================================================
  function drawGlumbo(ctx, x, by, w, h, t, o) {
    o = o || {};
    const f = o.flash;
    const base = f ? '#ffffff' : '#8f8ca6';
    const sq = o.squash || 0;
    const hw = (w / 2) * (1 + sq * 0.2), hh = h * (1 - sq * 0.2);
    const n = 12, pts = [];
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (i / n) * Math.PI;
      pts.push([x + Math.cos(a) * hw, by - 6 + Math.sin(a) * hh]);
    }
    ctx.fillStyle = f ? base : U.shade(base, -0.3);
    ctx.beginPath(); ctx.moveTo(x - hw, by);
    pts.forEach((p) => ctx.lineTo(p[0], p[1]));
    ctx.lineTo(x + hw, by); ctx.closePath(); ctx.fill();
    if (!f) {
      for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[i + 1];
        ctx.fillStyle = i < n * 0.45 ? U.shade(base, 0.06 + (i % 2) * 0.07) : U.shade(base, -0.06 - (i % 2) * 0.07);
        U.poly(ctx, [x - hw * 0.2, by - hh * 0.5, a[0], a[1], b[0], b[1]]);
        ctx.fill();
      }
    }
    // crown
    const cy = by - 6 - hh - 6;
    G.Icons.crown(ctx, x - 6, cy, 1.9, f ? '#fff' : '#c9b25a');
    if (f) return;
    // face
    const fx = x + (o.facing || -1) * 10;
    const ey = by - hh * 0.55;
    const tired = o.tired;
    ctx.fillStyle = '#fff';
    if (tired) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(fx - 22, ey); ctx.lineTo(fx - 8, ey + 3); ctx.moveTo(fx + 22, ey); ctx.lineTo(fx + 8, ey + 3); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.ellipse(fx - 15, ey, 8, 11, 0, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(fx + 15, ey, 8, 11, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#1b1726';
      ctx.beginPath(); ctx.arc(fx - 15 + (o.facing || -1) * 3, ey + 2, 4, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(fx + 15 + (o.facing || -1) * 3, ey + 2, 4, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = '#2a2433'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(fx - 28, ey - 16); ctx.lineTo(fx - 6, ey - 10); ctx.moveTo(fx + 28, ey - 16); ctx.lineTo(fx + 6, ey - 10); ctx.stroke();
    }
    // mouth
    ctx.fillStyle = '#3a2033';
    ctx.beginPath();
    if (tired) ctx.ellipse(fx, ey + 26, 9, 7 + Math.sin(t * 8) * 2, 0, 0, U.TAU);
    else { ctx.moveTo(fx - 20, ey + 22); ctx.quadraticCurveTo(fx, ey + 14, fx + 20, ey + 22); ctx.quadraticCurveTo(fx, ey + 34, fx - 20, ey + 22); }
    ctx.fill();
    if (!tired) {
      ctx.fillStyle = '#fff';
      U.poly(ctx, [fx - 12, ey + 19, fx - 8, ey + 26, fx - 4, ey + 18]); ctx.fill();
      U.poly(ctx, [fx + 12, ey + 19, fx + 8, ey + 26, fx + 4, ey + 18]); ctx.fill();
    }
    if (tired) for (let i = 0; i < 3; i++) {
      const a = t * 4 + (i / 3) * U.TAU;
      G.Icons.star(ctx, x + Math.cos(a) * 40, by - hh - 30 + Math.sin(a) * 8, 7, '#ffe14a');
    }
  }
  G.BossArt.glumbo = (ctx, cx, cy, t) => drawGlumbo(ctx, cx + 8, cy + 70, 130, 100, t, { facing: -1 });

  class Glumbo extends Boss {
    constructor(sp) {
      super(sp, 130, 100, 8);
      this.name = 'GLUMBO';
      this.title = 'King of the Glumbles';
      this.hops = 0;
    }
    behave(dt, play) {
      const p = play.player;
      const s = this.state;
      const fast = this.phase2 ? 1.3 : 1;
      if (s === 'intro') this.set('idle');
      if (s === 'idle') {
        this.vulnerable = false;
        this.vx = U.approach(this.vx, 0, 2000 * dt);
        this.facing = p.cx < this.cx ? -1 : 1;
        if (this.st > 0.7 / fast) { this.set('crouch'); }
      } else if (s === 'crouch') {
        this.vx = 0;
        if (this.st > 0.35 / fast) {
          const tt = 0.8;
          this.vx = U.clamp((p.cx - this.cx) / tt, -440, 440);
          this.vy = -920;
          this.set('air');
          play.sfx('jump');
        }
      } else if (s === 'air') {
        if (this.justLanded) {
          this.vx = 0;
          play.shake(10, 0.35);
          play.sfx('pound');
          const gy = this.y + this.h;
          const spd = this.phase2 ? 420 : 330;
          play.spawn(new G.Shockwave(this.x + 10, gy, -1, { speed: spd, color: '#c9c3e6' }));
          play.spawn(new G.Shockwave(this.x + this.w - 10, gy, 1, { speed: spd, color: '#c9c3e6' }));
          play.parts.burst(this.cx, gy, 20, { color: ['#c9c3e6', '#8f8ca6'], speed: 260, angle: -Math.PI / 2, spread: 1.4, life: 0.5, g: 800 });
          this.hops++;
          if (this.hops >= 3) { this.hops = 0; this.set('tired'); this.hitsTaken = 0; play.sfx('roar'); if (this.phase2) this.summon(play); }
          else this.set('crouch');
        }
      } else if (s === 'tired') {
        this.vulnerable = true;
        if (this.st > 2.8 || this.hitsTaken >= 3) { this.vulnerable = false; this.set('idle'); this.vy = -300; }
      }
      this.physics(dt, play);
    }
    summon(play) {
      const live = play.entities.filter((e) => e.isEnemy && !e.dead).length;
      if (live >= 2) return;
      for (const d of [-1, 1]) {
        const w = new G.Enemies.types.w({ x: this.cx + d * 100 - 24, y: this.y - 40 });
        w.facing = d; w.asleep = false; w.vy = -400; w.gems = 0;
        play.spawn(w);
      }
    }
    onHurt() { this.hitsTaken = (this.hitsTaken || 0) + 1; }
    draw(ctx, play) {
      const sq = this.state === 'crouch' ? 0.6 : this.state === 'air' ? -0.25 : this.state === 'tired' ? 0.25 + Math.sin(this.t * 6) * 0.06 : Math.sin(this.t * 4) * 0.06;
      drawGlumbo(ctx, this.cx, this.y + this.h, this.w, this.h, this.t, { flash: this.flashT > 0, squash: sq, tired: this.state === 'tired', facing: this.facing });
    }
  }
  G.Bosses.glumbo = Glumbo;

  // =====================================================================
  // 2) QUARTZARD — the Crystal Golem (Crystal Caverns)
  // =====================================================================
  function drawGolem(ctx, x, by, t, o) {
    o = o || {};
    const f = o.flash;
    const body = f ? '#fff' : '#6d6a88', lite = f ? '#fff' : '#8e8bab', dark = f ? '#fff' : '#4a4762';
    const lift = o.armLift || 0, slam = o.slam || 0;
    // legs
    ctx.fillStyle = dark;
    U.poly(ctx, [x - 40, by, x - 34, by - 40, x - 12, by - 40, x - 14, by]); ctx.fill();
    U.poly(ctx, [x + 40, by, x + 34, by - 40, x + 12, by - 40, x + 14, by]); ctx.fill();
    // torso
    ctx.fillStyle = body;
    U.poly(ctx, [x - 52, by - 110, x + 52, by - 110, x + 40, by - 36, x - 40, by - 36]); ctx.fill();
    ctx.fillStyle = lite;
    U.poly(ctx, [x - 52, by - 110, x, by - 110, x - 6, by - 36, x - 40, by - 36]); ctx.fill();
    // crystal spikes on back
    const cc = f ? '#fff' : '#b48cff';
    for (let i = 0; i < 4; i++) {
      const sx = x - 42 + i * 26;
      ctx.fillStyle = i % 2 ? cc : U.shade(cc, -0.2);
      U.poly(ctx, [sx - 10, by - 108, sx, by - 140 - (i % 2) * 14, sx + 10, by - 108]); ctx.fill();
    }
    // core
    const glow = o.core || 0;
    ctx.fillStyle = f ? '#fff' : U.mix('#3ee6d0', '#ffffff', glow * 0.5);
    U.poly(ctx, [x, by - 92, x + 13, by - 75, x, by - 58, x - 13, by - 75]); ctx.fill();
    if (glow > 0 && !f) {
      const g = ctx.createRadialGradient(x, by - 75, 2, x, by - 75, 46);
      g.addColorStop(0, U.rgba('#9dfff0', 0.8 * glow)); g.addColorStop(1, 'rgba(157,255,240,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, by - 75, 46, 0, U.TAU); ctx.fill();
    }
    // head
    ctx.fillStyle = body;
    U.poly(ctx, [x - 22, by - 108, x - 18, by - 132, x + 18, by - 132, x + 22, by - 108]); ctx.fill();
    ctx.fillStyle = f ? '#fff' : '#ffffff';
    if (o.dazed) {
      ctx.fillRect(x - 13, by - 121, 9, 3); ctx.fillRect(x + 4, by - 121, 9, 3);
    } else {
      U.poly(ctx, [x - 14, by - 124, x - 4, by - 121, x - 5, by - 116, x - 14, by - 118]); ctx.fill();
      U.poly(ctx, [x + 14, by - 124, x + 4, by - 121, x + 5, by - 116, x + 14, by - 118]); ctx.fill();
    }
    // arms
    [-1, 1].forEach((s) => {
      const sx = x + s * 56, sy = by - 100;
      const ex = sx + s * 14, ey = sy + 46 - lift * 80 + slam * 30;
      ctx.fillStyle = dark;
      U.limb(ctx, sx, sy, 14, ex, ey, 12); ctx.fill();
      ctx.fillStyle = f ? '#fff' : U.shade(cc, -0.1);
      U.poly(ctx, [ex - 18, ey, ex, ey - 16, ex + 18, ey, ex, ey + 22]); ctx.fill();
      ctx.fillStyle = f ? '#fff' : cc;
      U.poly(ctx, [ex - 18, ey, ex, ey - 16, ex, ey + 22]); ctx.fill();
    });
  }
  G.BossArt.golem = (ctx, cx, cy, t) => { ctx.save(); ctx.translate(cx, cy + 55); ctx.scale(0.62, 0.62); drawGolem(ctx, 0, 0, t, {}); ctx.restore(); };

  class Stalactite extends G.Entity {
    constructor(x, topY, floorY) {
      super(x - 14, topY, 28, 44);
      this.floorY = floorY;
      this.warn = 0.75;
      this.vy = 0;
      this.layer = 1;
    }
    update(dt, play) {
      this.t += dt;
      if (this.warn > 0) { this.warn -= dt; return; }
      this.vy += 2000 * dt;
      this.y += this.vy * dt;
      const p = play.player;
      if (!p.dead && U.overlap({ x: this.x + 6, y: this.y + 10, w: this.w - 12, h: this.h - 10 }, p)) { p.hurt(1, this.cx) && play.onPlayerHurt(); }
      if (Phys.solidRect(play.level, this.x + 8, this.y + this.h - 4, this.w - 16, 4) || this.y > play.level.ph) {
        this.dead = true;
        play.sfx('break');
        play.parts.burst(this.cx, this.y + this.h, 12, { color: ['#b48cff', '#e6d9ff', '#7a5cd6'], speed: 240, angle: -Math.PI / 2, spread: 1.3, life: 0.5, g: 900 });
      }
    }
    draw(ctx) {
      if (this.warn > 0) {
        ctx.fillStyle = 'rgba(255,80,120,' + (0.25 + 0.25 * Math.sin(this.t * 30)) + ')';
        ctx.fillRect(this.cx - 16, this.floorY - 6, 32, 6);
        ctx.globalAlpha = 0.6;
      }
      ctx.fillStyle = '#7a5cd6';
      U.poly(ctx, [this.x, this.y, this.x + this.w, this.y, this.cx, this.y + this.h]); ctx.fill();
      ctx.fillStyle = '#c8b0ff';
      U.poly(ctx, [this.x, this.y, this.cx, this.y, this.cx, this.y + this.h]); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  G.Stalactite = Stalactite;

  class Golem extends Boss {
    constructor(sp) {
      super(sp, 110, 132, 10);
      this.name = 'QUARTZARD';
      this.title = 'the Crystal Golem';
      this.attackIdx = 0;
    }
    behave(dt, play) {
      const p = play.player;
      const s = this.state;
      const k = this.phase2 ? 1.25 : 1;
      if (s === 'intro') this.set('walk');
      if (s === 'walk') {
        this.vulnerable = false;
        this.facing = p.cx < this.cx ? -1 : 1;
        this.vx = this.facing * 70 * k;
        if (this.st > 1.4 / k) {
          this.vx = 0;
          this.attackIdx++;
          this.set(this.attackIdx % 2 ? 'throwWind' : 'slamWind');
          play.sfx('warn');
        }
      } else if (s === 'throwWind') {
        this.vx = 0;
        if (this.st > 0.5) {
          const n = this.phase2 ? 5 : 3;
          for (let i = 0; i < n; i++) {
            const tx = p.cx + (i - (n - 1) / 2) * 110;
            const tt = 1.0 + i * 0.08;
            const sx = this.cx, sy = this.y + 10;
            const vx = (tx - sx) / tt;
            const vy = (p.y + p.h - sy - 0.5 * 1200 * tt * tt) / tt;
            play.spawn(new G.Projectile(sx, sy, vx, vy, { g: 1200, color: '#b48cff', r: 11, life: 4 }));
          }
          play.sfx('shoot');
          this.set('throwRecover');
        }
      } else if (s === 'throwRecover') {
        if (this.st > 0.8) this.set('walk');
      } else if (s === 'slamWind') {
        this.vx = 0;
        if (this.st > 0.7) {
          this.set('stuck');
          play.shake(12, 0.4);
          play.sfx('pound');
          const L = play.level;
          const n = this.phase2 ? 6 : 4;
          const floorY = this.y + this.h;
          for (let i = 0; i < n; i++) {
            let x;
            if (i === 0) x = p.cx; else x = U.rand(TS() * 2, L.pw - TS() * 2);
            play.spawn(new Stalactite(x, TS() * 1, floorY));
          }
          play.spawn(new G.Shockwave(this.x, floorY, -1, { speed: 300, color: '#b48cff', h: 26 }));
          play.spawn(new G.Shockwave(this.x + this.w, floorY, 1, { speed: 300, color: '#b48cff', h: 26 }));
        }
      } else if (s === 'stuck') {
        this.vulnerable = this.st > 0.3;
        if (this.st > 2.6) { this.vulnerable = false; this.set('walk'); }
      }
      this.physics(dt, play);
    }
    draw(ctx) {
      const s = this.state;
      const armLift = s === 'throwWind' ? this.st / 0.5 : s === 'slamWind' ? U.clamp(this.st / 0.5, 0, 1) : 0;
      const slam = s === 'stuck' ? 1 : 0;
      const core = this.vulnerable ? 0.7 + Math.sin(this.t * 10) * 0.3 : 0;
      ctx.save();
      if (s === 'slamWind') ctx.translate((Math.random() - 0.5) * 3, 0);
      drawGolem(ctx, this.cx, this.y + this.h, this.t, { flash: this.flashT > 0, armLift, slam, core, dazed: s === 'stuck' });
      ctx.restore();
    }
  }
  G.Bosses.golem = Golem;

  // =====================================================================
  // 3) GALEWING — the Storm Hawk (Frosty Peaks)
  // =====================================================================
  function drawHawk(ctx, x, y, t, o) {
    o = o || {};
    const f = o.flash;
    const fc = o.facing || -1;
    const body = f ? '#fff' : '#8a90b0', lite = f ? '#fff' : '#b7bdd9', dark = f ? '#fff' : '#5a6080';
    const flap = o.dazed ? 0.2 : Math.sin(t * (o.fast ? 22 : 12));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(fc, 1);
    ctx.rotate(o.tilt || 0);
    // wings
    ctx.fillStyle = dark;
    U.poly(ctx, [-10, -10, -70, -40 - flap * 30, -96, -10 - flap * 20, -40, 6]); ctx.fill();
    ctx.fillStyle = lite;
    U.poly(ctx, [-10, -10, -70, -40 - flap * 30, -50, -8]); ctx.fill();
    // tail
    ctx.fillStyle = dark;
    U.poly(ctx, [-40, 8, -78, 22, -72, 6, -84, -4, -44, -4]); ctx.fill();
    // body
    ctx.fillStyle = body;
    U.poly(ctx, [-46, 0, -10, -26, 34, -18, 44, 6, 10, 26, -30, 18]); ctx.fill();
    ctx.fillStyle = lite;
    U.poly(ctx, [-10, -26, 34, -18, 6, 0, -46, 0]); ctx.fill();
    // head
    ctx.fillStyle = body;
    U.poly(ctx, [22, -20, 44, -36, 62, -28, 58, -10, 36, -6]); ctx.fill();
    ctx.fillStyle = f ? '#fff' : '#ffcf4a';
    U.poly(ctx, [58, -28, 80, -20, 58, -14]); ctx.fill();
    ctx.fillStyle = f ? '#fff' : '#d99a1a';
    U.poly(ctx, [58, -20, 80, -20, 58, -14]); ctx.fill();
    // eye
    if (!f) {
      ctx.fillStyle = '#fff';
      if (o.dazed) { ctx.fillRect(44, -26, 9, 3); }
      else { U.poly(ctx, [42, -28, 54, -27, 52, -22, 43, -23]); ctx.fill(); ctx.fillStyle = '#1b1726'; ctx.fillRect(49, -27, 3, 4); }
      ctx.strokeStyle = '#2a2433'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(40, -33); ctx.lineTo(56, -29); ctx.stroke();
    }
    // near wing
    ctx.fillStyle = lite;
    U.poly(ctx, [-6, -12, -40, -64 - flap * 40, -70, -48 - flap * 34, -30, 2]); ctx.fill();
    ctx.fillStyle = body;
    U.poly(ctx, [-6, -12, -40, -64 - flap * 40, -34, -20]); ctx.fill();
    // talons
    ctx.fillStyle = f ? '#fff' : '#ffcf4a';
    U.poly(ctx, [0, 22, 6, 36, 12, 22]); ctx.fill();
    U.poly(ctx, [-14, 20, -10, 34, -4, 20]); ctx.fill();
    ctx.restore();
    if (o.dazed) for (let i = 0; i < 3; i++) {
      const a = t * 5 + (i / 3) * U.TAU;
      G.Icons.star(ctx, x + fc * 40 + Math.cos(a) * 26, y - 50 + Math.sin(a) * 6, 6, '#ffe14a');
    }
  }
  G.BossArt.hawk = (ctx, cx, cy, t) => { ctx.save(); ctx.translate(cx - 10, cy + 14); ctx.scale(0.7, 0.7); drawHawk(ctx, 0, 0, t, { facing: 1 }); ctx.restore(); };

  class Hawk extends Boss {
    constructor(sp) {
      super(sp, 110, 70, 10);
      this.name = 'GALEWING';
      this.title = 'the Storm Hawk';
      this.gravityOn = false;
      this.homeY = sp.y - TS() * 1;
      this.y = this.homeY;
      this.cycle = 0;
    }
    idleIntro(dt) { this.y = this.homeY + Math.sin(this.t * 2) * 8; }
    behave(dt, play) {
      const p = play.player;
      const L = play.level;
      const s = this.state;
      const k = this.phase2 ? 1.25 : 1;
      const floorY = this.floorY || (this.floorY = this.findFloor(L));
      if (s === 'intro') this.set('hover');
      if (s === 'hover') {
        this.vulnerable = false;
        const tx = U.clamp(p.cx + (this.cx < p.cx ? -220 : 220), TS() * 3, L.pw - TS() * 3);
        this.x = U.damp(this.x, tx - this.w / 2, 2.2 * k, dt);
        this.y = U.damp(this.y, this.homeY + Math.sin(this.t * 2) * 20, 3, dt);
        this.facing = p.cx < this.cx ? -1 : 1;
        this.shotT = (this.shotT || 0) - dt;
        if (this.shotT <= 0) {
          this.shotT = 0.9 / k;
          const n = this.phase2 ? 5 : 3;
          const base = Math.atan2(p.cy - this.cy, p.cx - this.cx);
          for (let i = 0; i < n; i++) {
            const a = base + (i - (n - 1) / 2) * 0.22;
            play.spawn(new G.Projectile(this.cx, this.cy + 10, Math.cos(a) * 280, Math.sin(a) * 280, { color: '#dfe6ff', r: 9, life: 4, kind: 'feather' }));
          }
          play.sfx('shoot');
        }
        if (this.st > 3.2 / k) {
          this.cycle++;
          if (this.phase2 && this.cycle % 3 === 0) { this.set('gust'); play.sfx('wind'); }
          else { this.set('screech'); play.sfx('roar'); }
        }
      } else if (s === 'screech') {
        this.y = U.damp(this.y, this.homeY - 20, 4, dt);
        if (this.st > 0.6) {
          this.set('swoop');
          this.dir = p.cx < this.cx ? -1 : 1;
          this.facing = this.dir;
          this.vy = 0;
        }
      } else if (s === 'swoop') {
        // dive to the floor then skid along it
        const gy = floorY - this.h;
        if (this.y < gy) {
          this.vy = Math.min(900, this.vy + 3000 * dt);
          this.y = Math.min(gy, this.y + this.vy * dt);
        }
        this.x += this.dir * 520 * k * dt;
        const hitWall = this.x < TS() * 1 || this.x + this.w > L.pw - TS() * 1;
        if (hitWall) {
          this.x = U.clamp(this.x, TS() * 1, L.pw - TS() * 1 - this.w);
          this.y = gy;
          this.set('dazed');
          play.shake(10, 0.3);
          play.sfx('pound');
        }
      } else if (s === 'dazed') {
        this.vulnerable = true;
        this.y = floorY - this.h;
        if (this.st > 2.6) { this.vulnerable = false; this.set('rise'); }
      } else if (s === 'rise') {
        this.y = U.damp(this.y, this.homeY, 3, dt);
        if (this.st > 0.9) this.set('hover');
      } else if (s === 'gust') {
        this.y = U.damp(this.y, this.homeY, 3, dt);
        this.facing = p.cx < this.cx ? -1 : 1;
        const push = -this.facing * -1; // push away from hawk
        play.wind = U.sign(p.cx - this.cx) * 260;
        void push;
        if (Math.random() < dt * 4) {
          play.spawn(new G.Projectile(U.rand(TS() * 2, L.pw - TS() * 2), TS() * 0.5, U.rand(-30, 30), 120, { g: 300, color: '#dfe6ff', r: 8, life: 5, kind: 'feather' }));
        }
        if (Math.random() < dt * 30) play.parts.spawn({ x: this.cx < p.cx ? play.view.x : play.view.x + play.view.w, y: U.rand(play.view.y, play.view.y + play.view.h), vx: U.sign(p.cx - this.cx) * 700, life: 1.2, size: 2, shape: 'circle', color: 'rgba(255,255,255,0.6)' });
        if (this.st > 2.8) { play.wind = 0; this.set('screech'); play.sfx('roar'); }
      }
    }
    findFloor(L) {
      const tx = Math.floor(this.cx / TS());
      for (let ty = Math.floor(this.y / TS()); ty < L.h; ty++) if (Phys.solid(L, tx, ty)) return ty * TS();
      return L.ph - TS();
    }
    draw(ctx) {
      const s = this.state;
      drawHawk(ctx, this.cx, this.cy, this.t, {
        flash: this.flashT > 0, facing: this.facing, dazed: s === 'dazed',
        fast: s === 'gust' || s === 'screech', tilt: s === 'swoop' ? 0.25 : 0,
      });
      if (s === 'screech') {
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.6 - this.st) + ')';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(this.cx + this.facing * 50, this.cy - 20, 20 + this.st * 80, 0, U.TAU); ctx.stroke();
      }
    }
  }
  G.Bosses.hawk = Hawk;

  // =====================================================================
  // 4) KING MONOCHROME (Grey Citadel) — final boss
  // =====================================================================
  class Laser extends G.Entity {
    constructor(play, y, h) {
      super(0, y, play.level.pw, h);
      this.warn = 0.9; this.on = 0.55;
      this.layer = 1;
    }
    update(dt, play) {
      this.t += dt;
      if (this.warn > 0) { this.warn -= dt; if (this.warn <= 0) { play.sfx('laser'); play.shake(6, 0.4); } return; }
      this.on -= dt;
      if (this.on <= 0) { this.dead = true; return; }
      const p = play.player;
      if (!p.dead && U.overlap({ x: this.x, y: this.y + 6, w: this.w, h: this.h - 12 }, p)) p.hurt(1, p.cx - 10) && play.onPlayerHurt();
    }
    draw(ctx, play) {
      const v = play.view;
      if (this.warn > 0) {
        ctx.fillStyle = 'rgba(255,255,255,' + (0.12 + 0.12 * Math.sin(this.t * 30)) + ')';
        ctx.fillRect(v.x, this.y, v.w, this.h);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.setLineDash([12, 10]);
        ctx.strokeRect(v.x - 2, this.y, v.w + 4, this.h);
        ctx.setLineDash([]);
        return;
      }
      const g = ctx.createLinearGradient(0, this.y, 0, this.y + this.h);
      g.addColorStop(0, 'rgba(200,200,220,0)');
      g.addColorStop(0.3, 'rgba(240,240,255,0.95)');
      g.addColorStop(0.5, '#ffffff');
      g.addColorStop(0.7, 'rgba(240,240,255,0.95)');
      g.addColorStop(1, 'rgba(200,200,220,0)');
      ctx.fillStyle = g;
      ctx.fillRect(v.x, this.y, v.w, this.h);
    }
  }

  class King extends Boss {
    constructor(sp) {
      super(sp, 70, 120, 16);
      this.name = 'KING MONOCHROME';
      this.title = 'Lord of the Grey';
      this.gravityOn = false;
      this.homeY = sp.y - TS() * 2.2;
      this.y = this.homeY;
      this.cycle = 0;
      this.cast = 0;
      this.angry = false;
    }
    idleIntro(dt) { this.y = this.homeY + Math.sin(this.t * 1.8) * 6; }
    hurtBox() { return { x: this.x + 8, y: this.y + 20, w: this.w - 16, h: this.h - 20 }; }
    stompResult() { return this.vulnerable ? 'hit' : 'hurt'; }
    behave(dt, play) {
      const p = play.player;
      const L = play.level;
      const s = this.state;
      const p2 = this.phase2;
      this.floorY = this.floorY || this.findFloor(L);
      if (p2 && !this.angry) {
        this.angry = true;
        this.set('rage');
        play.sfx('roar');
        play.shake(14, 1.2);
        play.say([{ who: 'king', text: 'ENOUGH! If I cannot have colour, NO ONE WILL!' }]);
        return;
      }
      this.cast = Math.max(0, this.cast - dt * 2);
      if (s === 'intro') this.set('float');
      if (s === 'rage') {
        this.y = U.damp(this.y, this.homeY - 30, 3, dt);
        if (this.st > 1.2) this.set('float');
      } else if (s === 'float') {
        this.vulnerable = false;
        if (!this.target || this.st === 0 || Math.abs(this.cx - this.target) < 8) {
          const opts = [TS() * 4, L.pw / 2, L.pw - TS() * 4];
          this.target = U.pick(opts.filter((o) => Math.abs(o - this.cx) > 60)) || opts[1];
        }
        this.x = U.damp(this.x, this.target - this.w / 2, 2.5, dt);
        this.y = U.damp(this.y, this.homeY + Math.sin(this.t * 2) * 12, 3, dt);
        this.facing = p.cx < this.cx ? -1 : 1;
        if (this.st > (p2 ? 1.4 : 1.9)) {
          this.cycle++;
          const c = this.cycle % (p2 ? 4 : 3);
          if (c === 1) this.set('volley');
          else if (c === 2) this.set(p2 ? 'laser' : 'summon');
          else if (c === 3 && p2) this.set('volley');
          else this.set('slamUp');
        }
      } else if (s === 'volley') {
        this.cast = 1;
        const n = p2 ? 5 : 3;
        this.shotT = (this.shotT || 0) - dt;
        if (this.st > 0.4 && this.shotT <= 0 && (this.shots || 0) < n) {
          this.shotT = p2 ? 0.28 : 0.4;
          this.shots = (this.shots || 0) + 1;
          const a = Math.atan2(p.cy - this.cy, p.cx - this.cx) + U.rand(-0.3, 0.3);
          play.spawn(new G.Projectile(this.cx, this.cy - 20, Math.cos(a) * 200, Math.sin(a) * 200, { color: '#d9d6e2', r: 12, life: 5, homing: 1.4, ignoreTiles: true }));
          play.sfx('shoot');
        }
        if (this.st > 0.4 + n * 0.45 + 0.6) { this.shots = 0; this.set('float'); }
      } else if (s === 'summon') {
        this.cast = 1;
        if (this.st > 0.6 && !this.summoned) {
          this.summoned = true;
          const live = play.entities.filter((e) => e.isEnemy && !e.dead).length;
          if (live < 3) for (const d of [-1, 1]) {
            const kind = U.pick(['w', 'h', 'f']);
            const e = new G.Enemies.types[kind]({ x: U.clamp(p.cx + d * 220, TS() * 2, L.pw - TS() * 3), y: this.floorY - TS() * (kind === 'f' ? 3 : 1.5) });
            e.asleep = false; e.gems = 1; e.facing = -d;
            play.spawn(e);
            play.parts.burst(e.cx, e.cy, 16, { color: ['#d9d6e2', '#77748a'], speed: 200, life: 0.5 });
          }
          play.sfx('roar');
        }
        if (this.st > 1.3) { this.summoned = false; this.set('float'); }
      } else if (s === 'slamUp') {
        this.y = U.damp(this.y, this.homeY - 40, 5, dt);
        this.x = U.damp(this.x, p.cx - this.w / 2, 4, dt);
        if (this.st > 0.7) { this.set('slamDown'); this.vy = 0; play.sfx('warn'); }
      } else if (s === 'slamDown') {
        this.vy = Math.min(1500, this.vy + 4000 * dt);
        this.y += this.vy * dt;
        if (this.y + this.h >= this.floorY) {
          this.y = this.floorY - this.h;
          play.shake(14, 0.4);
          play.sfx('pound');
          play.spawn(new G.Shockwave(this.x, this.floorY, -1, { speed: p2 ? 420 : 340, color: '#d9d6e2' }));
          play.spawn(new G.Shockwave(this.x + this.w, this.floorY, 1, { speed: p2 ? 420 : 340, color: '#d9d6e2' }));
          this.set('tired');
        }
      } else if (s === 'tired') {
        this.vulnerable = this.st > 0.25;
        if (this.st > (p2 ? 2.0 : 2.6)) { this.vulnerable = false; this.set('float'); }
      } else if (s === 'laser') {
        this.cast = 1;
        this.y = U.damp(this.y, this.homeY - 20, 3, dt);
        if (!this.lasered) {
          this.lasered = true;
          const low = Math.random() < 0.5;
          const fy = this.floorY;
          // low beam: jump over it; high beam: stay on the ground
          if (low) play.spawn(new Laser(play, fy - 40, 40));
          else play.spawn(new Laser(play, fy - 200, 130));
          play.sfx('warn');
        }
        if (this.st > 1.8) { this.lasered = false; this.set('float'); }
      }
    }
    findFloor(L) {
      const tx = Math.floor(this.cx / TS());
      for (let ty = Math.floor(this.y / TS()) + 1; ty < L.h; ty++) if (Phys.solid(L, tx, ty)) return ty * TS();
      return L.ph - TS();
    }
    draw(ctx) {
      const s = this.state;
      const tired = s === 'tired';
      G.Icons.king(ctx, this.cx, this.y + this.h - 26, 1.45, this.t, {
        flash: this.flashT > 0, facing: this.facing, cast: this.cast, angry: this.angry,
        gemColor: tired ? G.Icons.PRISM[Math.floor(this.t * 6) % 6] : null,
      });
      if (tired) for (let i = 0; i < 3; i++) {
        const a = this.t * 5 + (i / 3) * U.TAU;
        G.Icons.star(ctx, this.cx + Math.cos(a) * 30, this.y - 6 + Math.sin(a) * 6, 6, '#ffe14a');
      }
    }
  }
  G.Bosses.king = King;
  G.BossArt.king = (ctx, cx, cy, t) => G.Icons.king(ctx, cx, cy + 92, 1.6, t, {});
})(window.G);
