// Enemies: the "Glooms", colourless creatures created by King Monochrome.
// Defeating one bursts it back into colour. New enemy types plug in with
// G.Enemies.register(char, Class) and can then be placed in any level map.
(function (G) {
  'use strict';
  const U = G.U;
  const Phys = G.Phys;
  const TS = () => G.TILE;

  const E = (G.Enemies = { types: {} });
  E.register = function (ch, cls) { E.types[ch] = cls; G.EntityTypes[ch] = (sp, level) => new cls(sp, level); };

  class Enemy extends G.Entity {
    constructor(sp, w, h, hp) {
      super(sp.x + (TS() - w) / 2, sp.y + TS() - h, w, h);
      this.isEnemy = true;
      this.hp = this.maxHp = hp || 1;
      this.vx = 0; this.vy = 0;
      this.facing = -1;
      this.onGround = false;
      this.gravity = true;
      this.stompable = true;
      this.contactDamage = 1;
      this.flashT = 0;
      this.stunT = 0;
      this.lastHitId = -1;
      this.gems = 1;
      this.asleep = true; // only simulate once near the camera
      this.tint = '#8d8aa3';
      this.accent = '#ff5d73';
    }
    physics(dt, play) {
      if (this.gravity) this.vy = Math.min(900, this.vy + 2300 * dt);
      this.hitX = Phys.moveX(play.level, this, this.vx * dt);
      const r = Phys.moveY(play.level, this, this.vy * dt, false, play.platforms);
      this.onGround = r.hit === 1;
      if (r.hit) this.vy = 0;
      if (this.y > play.level.ph + 200) this.dead = true;
    }
    ledgeAhead(play, dir) {
      const fx = dir > 0 ? this.x + this.w + 2 : this.x - 2;
      const L = play.level;
      const tx = Math.floor(fx / TS()), ty = Math.floor((this.y + this.h + 4) / TS());
      return !(Phys.solid(L, tx, ty) || Phys.oneway(L, tx, ty)) || Phys.hazard(L, { x: fx - 1, y: this.y + this.h - 6, w: 2, h: 10 });
    }
    update(dt, play) {
      this.t += dt;
      if (this.asleep) {
        if (!this.near(play, 220)) return;
        this.asleep = false;
        this.tint = play.theme.enemyTint || this.tint;
      }
      if (!this.near(play, 900)) return; // freeze far-away enemies
      this.flashT = Math.max(0, this.flashT - dt);
      this.stunT = Math.max(0, this.stunT - dt);
      this.behave(dt, play);
      this.physics(dt, play);
      if (Phys.hazard(play.level, this) === 'liquid') this.die(play, true);
    }
    behave(dt, play) {}
    // returns true if the hit landed
    hit(dmg, kind, fromX, play) {
      if (this.dead) return false;
      this.hp -= dmg;
      this.flashT = 0.14;
      const dir = U.sign(this.cx - fromX) || 1;
      if (kind !== 'stomp') { this.vx = dir * 260; this.vy = Math.min(this.vy, -260); }
      this.onHit(kind, play);
      if (this.hp <= 0) this.die(play);
      else play.sfx('hit');
      return true;
    }
    onHit(kind, play) {}
    die(play, silent) {
      if (this.dead) return;
      this.dead = true;
      play.onEnemyDefeated(this, silent);
    }
    // shared faceted blob body used by several Glooms
    drawBlob(ctx, x, by, w, h, squash, o) {
      o = o || {};
      const f = this.flashT > 0;
      const base = f ? '#ffffff' : o.color || this.tint;
      const hw = (w / 2) * (1 + squash * 0.15), hh = h * (1 - squash * 0.15);
      const pts = [];
      const n = 9;
      for (let i = 0; i <= n; i++) {
        const a = Math.PI + (i / n) * Math.PI;
        pts.push([x + Math.cos(a) * hw, by - 4 + Math.sin(a) * hh]);
      }
      ctx.fillStyle = f ? base : U.shade(base, -0.28);
      ctx.beginPath();
      ctx.moveTo(x - hw, by);
      pts.forEach((p) => ctx.lineTo(p[0], p[1]));
      ctx.lineTo(x + hw, by);
      ctx.closePath();
      ctx.fill();
      if (!f) {
        // facets: lit on the upper-left
        for (let i = 0; i < n; i++) {
          const a = pts[i], b = pts[i + 1];
          const lit = i < n * 0.45;
          ctx.fillStyle = lit ? U.shade(base, 0.08 + (i % 2) * 0.06) : U.shade(base, -0.08 - (i % 2) * 0.06);
          U.poly(ctx, [x - hw * 0.15, by - hh * 0.45, a[0], a[1], b[0], b[1]]);
          ctx.fill();
        }
      }
    }
    drawFace(ctx, x, y, s, facing, mood) {
      if (this.flashT > 0) return;
      const ex = x + facing * 5 * s;
      // eyes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(ex - 5 * s, y, 3.2 * s, 4.4 * s, 0, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(ex + 5 * s, y, 3.2 * s, 4.4 * s, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#1b1726';
      ctx.beginPath(); ctx.arc(ex - 5 * s + facing * 1.2 * s, y + 1 * s, 1.7 * s, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(ex + 5 * s + facing * 1.2 * s, y + 1 * s, 1.7 * s, 0, U.TAU); ctx.fill();
      // angry brows
      ctx.strokeStyle = '#2a2433';
      ctx.lineWidth = 2.4 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex - 9 * s, y - 6 * s); ctx.lineTo(ex - 2 * s, y - 4 * s);
      ctx.moveTo(ex + 9 * s, y - 6 * s); ctx.lineTo(ex + 2 * s, y - 4 * s);
      ctx.stroke();
      if (mood === 'stun') {
        ctx.fillStyle = '#ffe14a';
        for (let i = 0; i < 3; i++) {
          const a = this.t * 5 + (i / 3) * U.TAU;
          G.Icons.star(ctx, x + Math.cos(a) * 14 * s, y - 14 * s + Math.sin(a) * 4 * s, 4 * s, '#ffe14a');
        }
      }
    }
  }
  G.Enemy = Enemy;

  // ---- Glumble: basic patrol walker ------------------------------------------
  class Walker extends Enemy {
    constructor(sp) { super(sp, 36, 30, 1); this.speed = 62; }
    behave(dt, play) {
      if (this.onGround) {
        if (this.hitX || this.ledgeAhead(play, this.facing)) this.facing *= -1;
        this.vx = U.approach(this.vx, this.facing * this.speed, 900 * dt);
      }
    }
    draw(ctx) {
      const sq = Math.abs(Math.sin(this.t * 7)) * 0.4;
      this.drawBlob(ctx, this.cx, this.y + this.h, this.w, this.h, sq);
      this.drawFace(ctx, this.cx, this.y + this.h * 0.45 + sq * 2, 1, this.facing);
      // little feet
      if (this.flashT <= 0) {
        ctx.fillStyle = U.shade(this.tint, -0.4);
        const ph = Math.sin(this.t * 14);
        ctx.fillRect(this.cx - 12 + ph * 3, this.y + this.h - 4, 8, 4);
        ctx.fillRect(this.cx + 4 - ph * 3, this.y + this.h - 4, 8, 4);
      }
    }
  }
  E.register('w', Walker);

  // ---- Hopsy: hops toward the player ---------------------------------------
  class Hopper extends Enemy {
    constructor(sp) { super(sp, 34, 30, 1); this.wait = 0.6 + Math.random(); this.accent = '#7cf0a0'; }
    behave(dt, play) {
      const p = play.player;
      if (this.onGround) {
        this.vx = U.approach(this.vx, 0, 1600 * dt);
        this.wait -= dt;
        if (this.wait <= 0 && Math.abs(p.cx - this.cx) < 460) {
          this.facing = U.sign(p.cx - this.cx) || this.facing;
          this.vx = this.facing * 150;
          this.vy = -640;
          this.wait = 1.1 + Math.random() * 0.5;
        }
      }
    }
    draw(ctx) {
      const air = !this.onGround;
      const crouch = this.onGround && this.wait < 0.25 ? 0.6 : 0;
      this.drawBlob(ctx, this.cx, this.y + this.h, this.w, this.h * (air ? 1.1 : 1), crouch, { color: U.mix(this.tint, '#5aa070', 0.25) });
      this.drawFace(ctx, this.cx, this.y + this.h * 0.4 + crouch * 4, 1, this.facing);
      if (this.flashT <= 0) {
        // frog legs
        ctx.fillStyle = U.shade(this.tint, -0.35);
        const ly = this.y + this.h;
        const spread = air ? 8 : 0;
        U.poly(ctx, [this.cx - 16 - spread, ly, this.cx - 8, ly - 10, this.cx - 4, ly]); ctx.fill();
        U.poly(ctx, [this.cx + 16 + spread, ly, this.cx + 8, ly - 10, this.cx + 4, ly]); ctx.fill();
      }
    }
  }
  E.register('h', Hopper);

  // ---- Spikeback: can't be stomped, punch or pound it -------------------------
  class Spiker extends Enemy {
    constructor(sp) { super(sp, 40, 30, 2); this.stompable = false; this.speed = 48; this.gems = 2; }
    behave(dt, play) {
      if (this.onGround) {
        if (this.hitX || this.ledgeAhead(play, this.facing)) this.facing *= -1;
        this.vx = U.approach(this.vx, this.facing * this.speed, 900 * dt);
      }
    }
    draw(ctx) {
      const x = this.cx, by = this.y + this.h;
      // spikes
      if (this.flashT <= 0) {
        for (let i = 0; i < 5; i++) {
          const a = Math.PI + 0.35 + (i / 4) * (Math.PI - 0.7);
          const bx = x + Math.cos(a) * 16, byy = by - 6 + Math.sin(a) * 22;
          const tx = x + Math.cos(a) * 30, ty = by - 6 + Math.sin(a) * 36;
          ctx.fillStyle = '#e6e9f5';
          U.poly(ctx, [bx - 5, byy + 2, tx, ty, bx + 5, byy + 2]);
          ctx.fill();
          ctx.fillStyle = '#9ba0b8';
          U.poly(ctx, [bx, byy + 2, tx, ty, bx + 5, byy + 2]);
          ctx.fill();
        }
      }
      this.drawBlob(ctx, x, by, this.w, this.h, Math.abs(Math.sin(this.t * 6)) * 0.3, { color: U.mix(this.tint, '#6b5a7a', 0.4) });
      this.drawFace(ctx, x, by - 15, 1, this.facing);
    }
  }
  E.register('k', Spiker);

  // ---- Buzzwing: flying patrol --------------------------------------------
  class Flyer extends Enemy {
    constructor(sp) {
      super(sp, 34, 28, 1);
      this.gravity = false;
      this.x0 = this.x; this.y0 = sp.y + 8;
      this.y = this.y0;
      this.range = 130;
      this.ph = Math.random() * U.TAU;
    }
    physics(dt, play) {
      this.x += this.vx * dt; this.y += this.vy * dt;
    }
    behave(dt, play) {
      this.ph += dt;
      if (this.knock) {
        this.knock -= dt;
        this.vx *= 0.9; this.vy *= 0.9;
        if (this.knock <= 0) this.knock = 0;
        return;
      }
      const tx = this.x0 + Math.sin(this.ph * 0.9) * this.range;
      const ty = this.y0 + Math.sin(this.ph * 2.6) * 22;
      this.vx = (tx - this.x) * 4; this.vy = (ty - this.y) * 4;
      this.facing = Math.cos(this.ph * 0.9) >= 0 ? 1 : -1;
    }
    onHit() { this.knock = 0.3; }
    draw(ctx) {
      const x = this.cx, y = this.cy;
      const flap = Math.sin(this.t * 30);
      if (this.flashT <= 0) {
        ctx.fillStyle = 'rgba(220,225,245,0.8)';
        U.poly(ctx, [x - 4, y - 6, x - 22, y - 16 - flap * 8, x - 14, y]); ctx.fill();
        U.poly(ctx, [x + 4, y - 6, x + 22, y - 16 - flap * 8, x + 14, y]); ctx.fill();
      }
      ctx.save();
      ctx.translate(0, 14);
      this.drawBlob(ctx, x, y, this.w, this.h * 0.95, 0, { color: U.mix(this.tint, '#7a6aa0', 0.3) });
      ctx.restore();
      this.drawFace(ctx, x, y - 2, 0.9, this.facing);
      if (this.flashT <= 0) {
        ctx.fillStyle = '#ffd36a';
        U.poly(ctx, [x - 3, y + 12, x + 3, y + 12, x, y + 19]); ctx.fill();
      }
    }
  }
  E.register('f', Flyer);

  // ---- Grumpkin turret: fires orbs at Ember ------------------------------------
  class Turret extends Enemy {
    constructor(sp) { super(sp, 40, 40, 2); this.cool = 1.5 + Math.random(); this.gems = 2; this.charge = 0; }
    behave(dt, play) {
      const p = play.player;
      this.vx = 0;
      this.facing = p.cx < this.cx ? -1 : 1;
      const dx = Math.abs(p.cx - this.cx), dy = Math.abs(p.cy - this.cy);
      if (dx < 560 && dy < 260 && !p.dead) {
        this.cool -= dt;
        this.charge = U.clamp(1 - this.cool / 0.5, 0, 1);
        if (this.cool <= 0) {
          this.cool = 2.3;
          const sx = this.cx + this.facing * 22, sy = this.y + 14;
          const a = Math.atan2(p.cy - sy, p.cx - sx);
          // limit the aim to a cone in front of the barrel
          const aa = this.facing > 0 ? U.clamp(a, -0.5, 0.5) : (Math.abs(a) > Math.PI - 0.5 ? a : U.sign(a || 1) * (Math.PI - 0.5));
          play.spawn(new G.Projectile(sx, sy, Math.cos(aa) * 250, Math.sin(aa) * 250, { color: '#c3b9e8', life: 4 }));
          play.sfx('shoot');
        }
      } else this.charge = 0;
    }
    draw(ctx) {
      const x = this.cx, by = this.y + this.h;
      const f = this.flashT > 0;
      const c = f ? '#fff' : U.mix(this.tint, '#5e6a8a', 0.3);
      // base
      ctx.fillStyle = f ? '#fff' : U.shade(c, -0.35);
      U.poly(ctx, [x - 20, by, x - 16, by - 14, x + 16, by - 14, x + 20, by]);
      ctx.fill();
      // head dome
      this.drawBlob(ctx, x, by - 10, 38, 28, -this.charge * 0.3, { color: c });
      // barrel
      ctx.fillStyle = f ? '#fff' : U.shade(c, -0.45);
      const bx = x + this.facing * 14;
      ctx.fillRect(Math.min(bx, bx + this.facing * 16), by - 32, 16, 12);
      ctx.fillStyle = this.charge > 0 ? U.rgba('#ffd36a', this.charge) : U.shade(c, -0.6);
      ctx.beginPath(); ctx.arc(bx + this.facing * 16, by - 26, 5, 0, U.TAU); ctx.fill();
      this.drawFace(ctx, x - this.facing * 3, by - 24, 0.8, this.facing);
    }
  }
  E.register('t', Turret);

  // ---- Rambler: charges when it sees Ember, gets dizzy on walls ---------------
  class Charger extends Enemy {
    constructor(sp) { super(sp, 50, 38, 3); this.state = 'walk'; this.st = 0; this.gems = 4; }
    behave(dt, play) {
      const p = play.player;
      this.st += dt;
      if (this.state === 'walk') {
        if (this.onGround && (this.hitX || this.ledgeAhead(play, this.facing))) this.facing *= -1;
        this.vx = U.approach(this.vx, this.facing * 40, 600 * dt);
        const dx = p.cx - this.cx;
        if (!p.dead && Math.abs(dx) < 380 && Math.abs(p.cy - this.cy) < 50 && U.sign(dx) === this.facing) { this.state = 'wind'; this.st = 0; play.sfx('warn'); }
      } else if (this.state === 'wind') {
        this.vx = U.approach(this.vx, 0, 2000 * dt);
        if (this.st > 0.45) { this.state = 'charge'; this.st = 0; }
      } else if (this.state === 'charge') {
        this.vx = this.facing * 400;
        if (this.hitX) { this.state = 'stun'; this.st = 0; this.vx = -this.facing * 120; this.vy = -300; play.shake(4, 0.2); play.sfx('stomp'); }
        else if (this.onGround && this.ledgeAhead(play, this.facing)) { this.state = 'walk'; this.vx = 0; this.facing *= -1; }
        else if (this.st > 2) { this.state = 'walk'; }
      } else if (this.state === 'stun') {
        if (this.onGround) this.vx = U.approach(this.vx, 0, 900 * dt);
        if (this.st > 1.4) { this.state = 'walk'; this.facing *= -1; }
      }
    }
    get harmless() { return this.state === 'stun'; }
    onHit(kind) { if (this.state === 'charge') { this.state = 'stun'; this.st = 0.6; } }
    draw(ctx) {
      const x = this.cx, by = this.y + this.h, f = this.facing;
      const c = U.mix(this.tint, '#8a6f6a', 0.35);
      const shake = this.state === 'wind' ? (Math.random() - 0.5) * 3 : 0;
      ctx.save();
      ctx.translate(shake, 0);
      // horn
      if (this.flashT <= 0) {
        ctx.fillStyle = '#eceff8';
        U.poly(ctx, [x + f * 18, by - 22, x + f * 36, by - 34, x + f * 22, by - 14]);
        ctx.fill();
      }
      this.drawBlob(ctx, x, by, this.w, this.h, this.state === 'charge' ? 0.2 : 0, { color: c });
      // legs
      if (this.flashT <= 0) {
        ctx.fillStyle = U.shade(c, -0.4);
        const ph = this.state === 'charge' ? Math.sin(this.t * 30) * 4 : Math.sin(this.t * 10) * 2;
        ctx.fillRect(x - 18 + ph, by - 6, 9, 6);
        ctx.fillRect(x + 9 - ph, by - 6, 9, 6);
      }
      this.drawFace(ctx, x + f * 4, by - 22, 1, f, this.state === 'stun' ? 'stun' : null);
      if (this.state === 'charge' && Math.random() < 0.5 && this.flashT <= 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(x - f * 34, by - 8 - Math.random() * 20, 14, 2);
      }
      ctx.restore();
    }
  }
  E.register('c', Charger);

  // ---- Cinderling: leaps out of liquid -------------------------------------------
  class Jumper extends Enemy {
    constructor(sp) {
      super(sp, 30, 30, 1);
      this.gravity = false;
      this.homeY = sp.y + TS() * 0.5;
      this.y = this.homeY;
      this.wait = Math.random() * 1.5 + 0.5;
      this.stompable = false;
      this.state = 'hide';
    }
    physics(dt) { this.x += this.vx * dt; this.y += this.vy * dt; }
    behave(dt, play) {
      this.vx = 0;
      if (this.state === 'hide') {
        this.vy = 0; this.y = this.homeY;
        this.wait -= dt;
        if (this.wait <= 0) { this.state = 'jump'; this.vy = -880; }
      } else {
        this.vy += 1500 * dt;
        if (this.vy > 0 && this.y >= this.homeY) { this.state = 'hide'; this.wait = 1.6; this.y = this.homeY; }
      }
    }
    update(dt, play) {
      super.update(dt, play);
      // never dies in its own liquid
    }
    die(play, silent) { if (silent) return; super.die(play, silent); }
    draw(ctx, play) {
      if (this.state === 'hide') return;
      const x = this.cx, y = this.cy;
      const liq = play.theme.liquid;
      ctx.save();
      ctx.translate(x, y);
      if (this.vy > 0) ctx.scale(1, -1);
      ctx.fillStyle = this.flashT > 0 ? '#fff' : liq.color;
      U.poly(ctx, [0, -17, 13, -2, 9, 14, -9, 14, -13, -2]);
      ctx.fill();
      ctx.fillStyle = this.flashT > 0 ? '#fff' : liq.light;
      U.poly(ctx, [0, -17, -13, -2, -4, 2]);
      ctx.fill();
      ctx.restore();
      this.drawFace(ctx, x, y + 2, 0.75, 1);
    }
  }
  E.register('j', Jumper);
})(window.G);
