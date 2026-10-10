// Ember's controller: responsive platformer movement (acceleration curves,
// coyote time, jump buffering, variable jump height, apex hang, corner
// correction) + melee combat, plus the pose generator that animates the art.
// The controller reads an abstract input object so it can be driven by the
// keyboard/touch in-game or by a scripted bot in the level validator.
(function (G) {
  'use strict';
  const U = G.U;
  const Phys = G.Phys;

  const C = {
    RUN: 300, ACC: 2400, DEC: 2900, TURN: 4400, AIR_ACC: 1900, AIR_DEC: 700,
    GRAV: 2300, CUT: 2.6, APEX: 0.55, APEX_V: 90, MAXFALL: 820,
    JUMP: 800, DJUMP: 700, COYOTE: 0.1, BUFFER: 0.12,
    WALL_SLIDE: 140, WJ_X: 330, WJ_Y: 760, WJ_LOCK: 0.13, WALL_COYOTE: 0.09,
    STOMP: 620, STOMP_HOLD: 860, POUND_V: 1150, DASH_V: 640, SPRING: 1250,
    PUNCH_T: 0.22, PUNCH_CD: 0.26,
  };

  class Player {
    constructor(level, x, y, opts) {
      opts = opts || {};
      this.C = C;
      this.level = level;
      this.w = 26; this.h = 54;
      this.abilityNames = ['wallJump', 'doubleJump', 'groundPound'].concat(opts.dash ? ['dash'] : []);
      this.abilities = G.Abilities.get(this.abilityNames);
      this.maxHp = opts.maxHp || 3;
      this.hp = this.maxHp;
      this.platforms = null;
      this.events = [];
      this.punchId = 0;
      this.spawnAt(x, y);
    }
    // (x, y) = feet position
    spawnAt(x, y) {
      this.x = x - this.w / 2; this.y = y - this.h;
      this.vx = 0; this.vy = 0;
      this.facing = 1;
      this.onGround = false; this.coyote = 0; this.jumpBuf = 0;
      this.maxAirJumps = 1; this.airJumps = 1;
      this.wallDir = 0; this.lastWallDir = 0; this.wallCoyote = 0; this.wallJumpLock = 0;
      this.wallSliding = false; this.wasWallSliding = false;
      this.dropT = 0; this.platform = null;
      this.invuln = 0; this.hurtT = 0; this.dead = false; this.deadT = 0;
      this.action = null; this.actionT = 0;
      this.punchT = 0; this.punchCd = 0; this.punchArm = 0; this.airPunches = 0;
      this.dashAvail = true; this.dashCd = 0;
      this.cutable = false; this.spinT = 0;
      this.sx = 1; this.sy = 1; this.landT = 0; this.animT = 0; this.runPhase = 0;
      this.ix = 0; this.hitWallX = 0; this.fallStartY = this.y;
      this.victory = false;
      this.pose = G.Hero ? G.Hero.pose() : {};
    }
    emit(type, data) { this.events.push({ type, data }); }
    stretch(sx, sy) { this.sx = sx; this.sy = sy; }
    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
    get bottom() { return this.y + this.h; }

    update(dt, c) {
      const timers = ['coyote', 'jumpBuf', 'wallJumpLock', 'dropT', 'invuln', 'hurtT', 'punchT', 'punchCd', 'spinT', 'landT', 'dashCd'];
      for (const k of timers) if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);
      this.animT += dt;
      if (this.dead) {
        this.deadT += dt;
        this.vy += C.GRAV * 0.6 * dt;
        this.y += this.vy * dt;
        this.updatePose(dt);
        return;
      }
      if (this.victory) { this.vx = U.approach(this.vx, 0, C.DEC * dt); c = NO_INPUT; }

      let ix = (c.right ? 1 : 0) - (c.left ? 1 : 0);
      if (this.hurtT > 0) ix = 0;
      this.ix = ix;

      // Abilities may take over control (dash, ground pound).
      if (!this.action && this.hurtT <= 0) {
        for (const ab of this.abilities) {
          if (ab.tryStart && ab.tryStart(this, c)) { this.action = ab; this.actionT = 0; this.punchT = 0; break; }
        }
      }
      if (this.action) {
        this.actionT += dt;
        if (this.action.act(this, c, dt)) this.action = null;
      } else {
        this.controlMovement(dt, c, ix);
      }

      // Combat
      if (c.attackPressed && this.punchCd <= 0 && !this.action && this.hurtT <= 0) {
        this.punchT = C.PUNCH_T;
        this.punchCd = C.PUNCH_CD;
        this.punchId++;
        this.punchArm = 1 - this.punchArm;
        if (!this.onGround && this.airPunches < 1) {
          this.airPunches++;
          if (this.vy > 0) this.vy *= 0.35;
        }
        if (ix) this.facing = ix;
        this.emit('punch');
      }

      this.integrate(dt);
      this.updatePose(dt);
    }

    controlMovement(dt, c, ix) {
      // horizontal
      const lock = this.wallJumpLock > 0;
      if (!lock) {
        const target = ix * C.RUN;
        let a;
        if (this.onGround) a = ix === 0 ? C.DEC : (U.sign(this.vx) !== ix && this.vx !== 0 ? C.TURN : C.ACC);
        else a = ix === 0 ? C.AIR_DEC : C.AIR_ACC;
        // keep momentum above run speed (from dashes/springs) decaying gently
        if (Math.abs(this.vx) > C.RUN && U.sign(this.vx) === ix) a = C.AIR_DEC;
        this.vx = U.approach(this.vx, target, a * dt);
        if (ix && this.punchT <= 0) this.facing = ix;
      }

      // gravity with variable jump height and apex hang
      let g = C.GRAV;
      if (this.vy < 0 && this.cutable && !c.jump) g *= C.CUT;
      else if (Math.abs(this.vy) < C.APEX_V && c.jump) g *= C.APEX;
      this.vy = Math.min(C.MAXFALL, this.vy + g * dt);
      if (this.vy >= 0) this.cutable = false;

      for (const ab of this.abilities) if (ab.update) ab.update(this, c, dt);

      // jumping
      if (c.jumpPressed) this.jumpBuf = C.BUFFER;
      if (this.jumpBuf > 0) {
        if (this.onGround && c.down && this.standingOnOneway) {
          this.dropT = 0.22; this.jumpBuf = 0; this.onGround = false; this.platform = null; this.coyote = 0;
        } else if (this.onGround || this.coyote > 0) {
          this.doJump();
        } else {
          for (const ab of this.abilities) {
            if (ab.airJump && ab.airJump(this, c)) { this.jumpBuf = 0; this.platform = null; break; }
          }
        }
      }
    }

    doJump() {
      this.vy = -C.JUMP;
      if (this.platform && this.platform.vy < 0) this.vy += this.platform.vy * 0.5;
      this.onGround = false; this.coyote = 0; this.jumpBuf = 0; this.platform = null;
      this.cutable = true;
      this.stretch(0.78, 1.25);
      this.emit('jump');
    }

    // Bounce off an enemy / spring. hold = jump button held for extra height
    bounce(v, cutable) {
      this.vy = -v;
      this.cutable = !!cutable;
      this.onGround = false; this.platform = null;
      this.airJumps = this.maxAirJumps; this.dashAvail = true; this.airPunches = 0;
      if (this.action && this.action.name === 'groundPound') this.action = null;
      this.stretch(0.8, 1.2);
    }

    integrate(dt) {
      const L = this.level;
      // ride moving platforms
      if (this.platform) {
        const p = this.platform;
        Phys.moveX(L, this, p.dx);
        this.y = p.y - this.h;
      }
      this.hitWallX = Phys.moveX(L, this, this.vx * dt);
      if (this.hitWallX) this.vx = 0;

      let dy = this.vy * dt;
      // corner correction: nudge around ceiling corners when jumping
      if (dy < 0 && Phys.solidRect(L, this.x, this.y + dy, this.w, this.h)) {
        for (let off = 1; off <= 12; off++) {
          let done = false;
          for (const s of [-1, 1]) {
            if (!Phys.solidRect(L, this.x + s * off, this.y + dy, this.w, this.h) && !Phys.solidRect(L, this.x + s * off, this.y, this.w, this.h)) {
              this.x += s * off; done = true; break;
            }
          }
          if (done) break;
        }
      }
      const wasGround = this.onGround;
      const r = Phys.moveY(L, this, dy, this.dropT > 0, this.platforms);
      if (r.hit === 1) {
        this.vy = 0;
        this.platform = r.platform;
        this.standingOnOneway = r.oneway || !!r.platform;
        if (r.oneway && L.get(r.tx, r.ty) === G.T.CRUMBLE) L.touchCrumble(r.tx, r.ty);
        if (!wasGround) this.land();
        this.onGround = true;
        this.coyote = C.COYOTE;
      } else {
        if (r.hit === -1) {
          if (this.vy < -200) this.emit('bonk', { tx: r.tx, ty: r.ty });
          this.vy = 0;
        }
        if (wasGround && this.vy >= 0) this.fallStartY = this.y;
        this.onGround = false;
        this.platform = null;
      }
      if (!this.onGround && this.vy < 0) this.fallStartY = this.y;
    }

    land() {
      const fall = this.y - this.fallStartY;
      this.airJumps = this.maxAirJumps;
      this.dashAvail = true;
      this.airPunches = 0;
      this.spinT = 0;
      if (this.action && this.action.onLand) this.action.onLand(this);
      const k = U.clamp(fall / 300, 0.2, 1);
      this.stretch(1 + 0.3 * k, 1 - 0.28 * k);
      this.landT = 0.12;
      this.emit('land', { hard: fall > 200 });
    }

    hurt(dmg, fromX) {
      if (this.invuln > 0 || this.dead || this.victory) return false;
      this.hp -= dmg;
      this.invuln = 1.3;
      this.hurtT = 0.32;
      this.action = null;
      const dir = fromX != null ? U.sign(this.cx - fromX) || -this.facing : -this.facing;
      this.vx = dir * 300;
      this.vy = -480;
      this.cutable = false;
      this.platform = null;
      if (this.hp <= 0) { this.hp = 0; this.die(); } else this.emit('hurt');
      return true;
    }
    die() {
      if (this.dead) return;
      this.dead = true; this.deadT = 0; this.vy = -720; this.vx = 0;
      this.action = null;
      this.emit('die');
    }

    attackBox() {
      const el = C.PUNCH_T - this.punchT;
      if (this.punchT <= 0 || el < 0.03 || el > 0.15) return null;
      const w = 42, h = 30;
      return { x: this.facing > 0 ? this.x + this.w - 6 : this.x - w + 6, y: this.y + 8, w, h, id: this.punchId };
    }
    isPounding() { return this.action && this.action.name === 'groundPound' && this.poundPhase === 'fall'; }
    isDashing() { return this.action && this.action.name === 'dash'; }

    // ---- animation ------------------------------------------------------
    updatePose(dt) {
      if (!G.Hero) return;
      const p = this.pose;
      const H = G.Hero;
      const t = this.animT;
      Object.assign(p, BASE_POSE);
      p.blink = H.blinkAt(t);
      this.sx = U.lerp(this.sx, 1, 1 - Math.exp(-14 * dt));
      this.sy = U.lerp(this.sy, 1, 1 - Math.exp(-14 * dt));
      p.sx = this.sx; p.sy = this.sy;

      if (this.dead) {
        p.squint = true; p.mouth = 'o'; p.spin = this.deadT * 7;
        p.armN = 2.6; p.armF = -2.6; p.legN = 0.4; p.legF = -0.4;
        return;
      }
      if (this.victory) {
        const k = Math.sin(t * 8);
        p.armN = 2.8 + k * 0.2; p.armF = -2.8 - k * 0.2; p.mouth = 'open'; p.brow = 1;
        p.bob = -Math.abs(k) * 3;
        return;
      }
      const a = this.action && this.action.name;
      if (a === 'groundPound') {
        if (this.poundPhase === 'wind') {
          p.spin = (this.actionT / 0.13) * U.TAU;
          p.legN = 1.2; p.legF = 0.9; p.armN = 1.6; p.armF = 1.2; p.sx = 0.9; p.sy = 0.9;
        } else if (this.poundPhase === 'fall') {
          p.armN = 2.9; p.armF = -2.9; p.legN = 0.05; p.legF = -0.05; p.sy = 1.18; p.sx = 0.88;
          p.mouth = 'grit'; p.brow = -1;
        } else {
          p.armN = 1.2; p.armF = -1.2; p.legN = 0.5; p.legF = -0.5; p.mouth = 'grit';
        }
        return;
      }
      if (a === 'dash') {
        p.lean = 0.45; p.armN = -1.2; p.armF = -1.5; p.legN = -0.6; p.legF = -0.9;
        p.sx = 1.12; p.sy = 0.9; p.mouth = 'grit'; p.brow = -1;
        return;
      }
      if (this.hurtT > 0) {
        p.squint = true; p.mouth = 'o'; p.lean = -0.3; p.armN = 2.2; p.armF = -2.2; p.legN = 0.5; p.legF = 0.2;
        return;
      }

      if (this.onGround) {
        const sp = Math.abs(this.vx);
        if (sp > 20) {
          this.runPhase += sp * dt * 0.042;
          const s = Math.sin(this.runPhase);
          const k = U.clamp(sp / C.RUN, 0, 1);
          p.legN = s * 0.75 * k; p.legF = -s * 0.75 * k;
          p.armN = 0.35 - s * 0.95 * k; p.armF = -0.2 + s * 0.95 * k;
          p.bob = -Math.abs(Math.cos(this.runPhase)) * 3.2 * k;
          p.lean = 0.16 * k;
          p.headTilt = 0.04 * k;
          p.mouth = 'open';
          // skid when reversing
          if (this.ix && U.sign(this.vx) !== this.ix) {
            p.lean = -0.25; p.legN = 0.6; p.legF = 0.4; p.armN = 1.6; p.armF = -1.4; p.mouth = 'o';
          }
          const stepPh = Math.floor(this.runPhase / Math.PI);
          if (stepPh !== this._lastStep) { this._lastStep = stepPh; this.emit('step'); }
        } else {
          const b = Math.sin(t * 2.6);
          p.bob = b * 0.9;
          p.sx *= 1 - b * 0.012; p.sy *= 1 + b * 0.012;
          p.armN = 0.5 + b * 0.06; p.armF = -0.45 - b * 0.06;
          p.legN = 0.08; p.legF = -0.1;
        }
      } else if (this.wallSliding) {
        p.armF = -2.5; p.armN = 0.9; p.legN = 0.45; p.legF = 0.15; p.lean = 0.1; p.mouth = 'grit'; p.brow = -0.6;
        p.headTilt = 0.1;
      } else if (this.spinT > 0) {
        const k = 1 - this.spinT / 0.34;
        p.spin = U.ease.outCubic(k) * U.TAU;
        p.legN = 1.0; p.legF = 0.7; p.armN = 1.8; p.armF = 1.3; p.mouth = 'open';
      } else if (this.vy < 0) {
        p.legN = 0.55; p.legF = -0.35; p.armN = 2.5; p.armF = -2.3; p.mouth = 'open'; p.brow = 0.6;
      } else {
        const f = U.clamp(this.vy / C.MAXFALL, 0, 1);
        const w = Math.sin(t * 22) * 0.25 * f;
        p.legN = 0.25 + w; p.legF = -0.2 - w; p.armN = 1.9 + f * 0.7 + w; p.armF = -1.7 - f * 0.7 - w;
        p.mouth = f > 0.75 ? 'o' : 'smile';
      }

      // punch overlay
      if (this.punchT > 0) {
        const el = C.PUNCH_T - this.punchT;
        const ext = el < 0.05 ? el / 0.05 : U.clamp(1 - (el - 0.12) / 0.1, 0, 1);
        if (this.punchArm === 0) { p.armN = U.lerp(p.armN, 1.57, ext); p.reachN = 1 + 0.65 * ext; }
        else { p.armF = U.lerp(p.armF, 1.5, ext); p.reachF = 1 + 0.75 * ext; p.armN = -0.6; }
        p.lean = Math.max(p.lean, 0.18 * ext);
        p.brow = -1; p.mouth = 'grit';
      }
    }

    draw(ctx) {
      if (this.invuln > 0 && !this.dead && Math.floor(this.invuln * 14) % 2 === 0) ctx.globalAlpha = 0.45;
      this.pose.flash = this.hurtT > 0.22 ? 1 : 0;
      G.Hero.draw(ctx, this.cx, this.y + this.h + 1, this.facing, this.pose, 0.86);
      ctx.globalAlpha = 1;
    }
  }
  Player.C = C;
  const BASE_POSE = { sx: 1, sy: 1, lean: 0, bob: 0, legN: 0.08, legF: -0.1, armN: 0.5, armF: -0.45, reachN: 1, reachF: 1, headTilt: 0, blink: 0, mouth: 'smile', brow: 0, spin: 0, flash: 0, eyesX: 0, squint: false };
  const NO_INPUT = { left: false, right: false, up: false, down: false, jump: false, jumpPressed: false, attackPressed: false, dashPressed: false, downPressed: false };
  G.Player = Player;
})(window.G);
