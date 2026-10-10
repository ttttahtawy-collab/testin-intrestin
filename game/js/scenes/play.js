// Gameplay scene: runs one level. Owns the camera, combat resolution,
// hazards/respawn, boss flow, HUD, pause menu and on-screen touch controls.
(function (G) {
  'use strict';
  const U = G.U;
  const TS = () => G.TILE;

  const Play = {
    enter(params) {
      const def = G.Worlds.levels[params.id];
      this.id = params.id;
      this.def = def;
      this.world = G.Worlds.worldOf(params.id);
      this.theme = G.Themes[def.theme];
      this.level = new G.Level(def);
      this.bg = new G.Background(this.theme);
      this.tiles = new G.TileRenderer(this.level, this.theme);
      this.parts = new G.Particles();
      this.entities = [];
      this.platforms = [];
      this.boss = null;
      this.goal = null;
      const sd = G.Save.data;
      const up = sd.upgrades;
      const maxHp = G.Save.maxHp() + (G.Save.options.assist ? 2 : 0);
      this.player = new G.Player(this.level, this.level.start.x, this.level.start.y, { maxHp, dash: up.dash });
      this.punchDmg = up.power ? 2 : 1;
      this.magnetRange = up.magnet ? 160 : 0;
      this.rec = G.Save.levelRec(this.id);
      for (const sp of this.level.spawns) {
        if (sp.ch === 'P') continue;
        if (sp.ch === 'K') {
          const B = G.Bosses[def.boss];
          if (B) { this.boss = new B(sp); this.entities.push(this.boss); }
          continue;
        }
        const f = G.EntityTypes[sp.ch];
        if (!f) { console.warn('Unknown spawn', sp.ch, 'in', this.id); continue; }
        const e = f(sp, this.level);
        if (e.isPlatform) this.platforms.push(e);
        if (e instanceof Object && sp.ch === 'G') this.goal = e;
        this.entities.push(e);
      }
      this.player.platforms = this.platforms;
      this.checkpoint = { x: this.level.start.x, y: this.level.start.y };
      this.gems = 0;
      this.gemsTotal = this.level.spawns.filter((s) => s.ch === 'o').length;
      this.shards = [false, false, false];
      this.time = 0;
      this.deaths = 0;
      this.hitstopT = 0;
      this.wind = 0;
      this.state = 'play'; // play | dialogue | paused | complete | respawn
      this.dialogue = null;
      this.afterDialogue = null;
      this.introT = 0;
      this.completeT = 0;
      this.respawnT = 0;
      this.fade = 1;
      this.hpFlash = 0;
      this.t = 0;
      this.cam = { x: 0, y: 0, look: 0 };
      this.view = { x: 0, y: 0, w: G.R.W, h: G.R.H };
      this.snapCamera();
      this.bossBarShow = 0;
      this.ctrl = { left: false, right: false, up: false, down: false, jump: false, jumpPressed: false, attackPressed: false, dashPressed: false, downPressed: false };
      if (this.boss) {
        G.Music.stop();
        this.state = 'bossIntro';
      } else G.Music.play(def.music || this.world.music);
      this.pauseMenu = null;
      this.optionsMenu = null;
    },
    exit() { G.Music.stop(); },

    // ---- API used by entities ------------------------------------------
    sfx(n) { G.Audio.play(n); },
    spawn(e) { this.entities.push(e); if (e.isPlatform) this.platforms.push(e); return e; },
    shake(m, d) { G.R.shake(m, d); },
    hitstop(t) { this.hitstopT = Math.max(this.hitstopT, t); },
    popText(x, y, text, color, size) {
      this.parts.spawn({ x, y, vy: -60, life: 0.9, size: size || 18, shape: 'text', text, color: color || '#fff', front: true, vr: 0 });
    },
    addGems(n, x, y) {
      this.gems += n;
      this.sfx('gem');
      this.parts.burst(x, y, 6, { color: ['#3fe0ff', '#bff6ff', '#ffffff'], speed: 140, life: 0.4, size: 4, shape: 'spark', glow: true });
    },
    shardOwned(i) { return this.rec.shards[i] || this.shards[i]; },
    collectShard(i, x, y) {
      const fresh = !this.rec.shards[i] && !this.shards[i];
      this.shards[i] = true;
      this.sfx('shard');
      this.hitstop(0.12);
      this.shake(4, 0.3);
      this.parts.burst(x, y, 30, { color: G.Icons.PRISM, speed: 360, life: 0.9, size: 7, drag: 2 });
      this.parts.spawn({ x, y, life: 0.6, size: 10, size1: 90, shape: 'ring', color: '#ffffff' });
      this.popText(x, y - 30, fresh ? 'PRISM SHARD!' : 'Shard (already found)', fresh ? '#ffe14a' : '#c7cde0', 22);
    },
    heal(n, x, y) {
      const p = this.player;
      if (p.hp >= p.maxHp) { this.gems += 5; this.popText(x, y - 20, '+5 gems', '#8ff', 18); this.sfx('gem'); return; }
      p.hp = Math.min(p.maxHp, p.hp + n);
      this.hpFlash = 0.6;
      this.sfx('heart');
      this.parts.burst(x, y, 12, { color: ['#ff3b4f', '#ff8a95', '#fff'], speed: 160, life: 0.5, size: 5 });
    },
    setCheckpoint(cp) {
      this.checkpoint = { x: cp.cx, y: cp.y + cp.h };
      this.sfx('checkpoint');
      this.popText(cp.cx, cp.y - 20, 'Checkpoint!', '#fff', 20);
      this.parts.burst(cp.cx, cp.y, 24, { color: G.Icons.PRISM, speed: 260, life: 0.8, size: 6, g: 300 });
      // refill a heart at checkpoints to keep momentum friendly
      if (this.player.hp < this.player.maxHp) { this.player.hp++; this.hpFlash = 0.6; }
    },
    onPlayerHurt() {
      this.sfx('hurt');
      this.shake(8, 0.3);
      this.hitstop(0.08);
      this.hpFlash = 0.6;
      this.parts.burst(this.player.cx, this.player.cy, 12, { color: ['#ff3b30', '#ff8a7a', '#fff'], speed: 220, life: 0.45, size: 5 });
    },
    onEnemyDefeated(e, silent) {
      if (silent) return;
      this.sfx('pop');
      this.hitstop(0.05);
      // the Gloom bursts back into colour
      this.parts.burst(e.cx, e.cy, 22, { color: G.Icons.PRISM, speed: 320, life: 0.7, size: 7, g: 500, drag: 1 });
      this.parts.spawn({ x: e.cx, y: e.cy, life: 0.35, size: 8, size1: 50, shape: 'ring', color: '#ffffff' });
      for (let i = 0; i < (e.gems || 0); i++) {
        const g = new G.Gem(e.cx, e.cy, true);
        g.vx = U.rand(-140, 140); g.vy = U.rand(-520, -320);
        this.spawn(g);
      }
    },
    onBossDying(b) {
      G.Music.stop();
      this.sfx('roar');
      this.shake(12, 2.2);
      this.entities.forEach((e) => { if ((e.isProjectile || e.isHazard || e.isEnemy) && e !== b) { e.dead = true; } });
      this.wind = 0;
    },
    onBossDefeated(b) {
      this.sfx('boom');
      this.shake(16, 0.8);
      this.parts.burst(b.cx, b.cy, 80, { color: G.Icons.PRISM, speed: 520, life: 1.4, size: 9, drag: 1.2 });
      this.parts.spawn({ x: b.cx, y: b.cy, life: 0.8, size: 20, size1: 260, shape: 'ring', color: '#ffffff' });
      for (let i = 0; i < 12; i++) {
        const g = new G.Gem(b.cx, b.cy, true);
        g.vx = U.rand(-260, 260); g.vy = U.rand(-700, -350);
        this.spawn(g);
      }
      if (this.goal) { this.goal.unlock(); setTimeout(() => this.sfx('unlock'), 600); }
      this.bossDefeated = true;
      G.Music.play(this.world.music);
      const lines = this.def.bossOutro;
      if (lines) this.say(lines);
    },
    say(lines, after) {
      this.dialogue = new G.UI.Dialogue(lines);
      this.state = 'dialogue';
      this.afterDialogue = after || null;
    },
    complete() {
      if (this.state === 'complete') return;
      this.state = 'complete';
      this.completeT = 0;
      this.player.victory = true;
      G.Music.stop();
      this.sfx('victory');
      this.parts.burst(this.player.cx, this.player.cy, 40, { color: G.Icons.PRISM, speed: 380, life: 1.2, size: 7, drag: 1 });
    },

    // ---- main loop -------------------------------------------------------
    update(dt) {
      this.t += dt;
      const I = G.Input;
      this.hpFlash = Math.max(0, this.hpFlash - dt);
      this.fade = Math.max(0, this.fade - dt * 3);
      G.R.updateShake(dt);
      this.bg.update(dt);

      if (this.state === 'paused') { this.updatePause(dt); return; }
      if (I.pressed.pause && this.state !== 'complete' && this.state !== 'dialogue') {
        this.openPause();
        return;
      }
      if (this.state === 'bossIntro') {
        this.introT += dt;
        this.stepWorld(dt, true);
        if (this.introT > 1.0) {
          this.say(this.def.bossIntro || [], () => {
            this.boss.active = true;
            this.bossActiveT = 0;
            this.bossBanner = 2.6;
            this.sfx('roar');
            this.shake(10, 0.6);
            G.Music.play(this.def.boss === 'king' ? 'final' : 'boss');
          });
        }
        return;
      }
      if (this.state === 'dialogue') {
        this.dialogue.update(dt);
        this.parts.update(dt);
        if (this.dialogue.done) {
          this.state = 'play';
          this.dialogue = null;
          G.Input.flush();
          const a = this.afterDialogue;
          this.afterDialogue = null;
          if (a) a();
        }
        return;
      }
      if (this.state === 'complete') {
        this.completeT += dt;
        this.stepWorld(dt, true);
        if (this.completeT > 2.2 && !this.leaving) { this.leaving = true; this.finish(); }
        return;
      }
      this.introT += dt;
      if (this.bossBanner > 0) this.bossBanner -= dt;
      if (this.hitstopT > 0) { this.hitstopT -= dt; return; }
      this.time += dt;
      this.stepWorld(dt, false);
    },

    readCtrl() {
      const I = G.Input, c = this.ctrl;
      c.left = I.down.left; c.right = I.down.right; c.up = I.down.up; c.down = I.down.down;
      c.jump = I.down.jump; c.jumpPressed = I.pressed.jump;
      c.attackPressed = I.pressed.attack; c.dashPressed = I.pressed.dash; c.downPressed = I.pressed.down;
      return c;
    },

    stepWorld(dt, frozenInput) {
      const p = this.player;
      const L = this.level;
      L.update(dt, (type, tx, ty) => {
        if (type === 'crumble') {
          this.sfx('crumble');
          this.parts.burst(tx * TS() + TS() / 2, ty * TS() + 12, 10, { color: [this.theme.stone.top, this.theme.stone.body], speed: 120, angle: Math.PI / 2, spread: 1, g: 900, life: 0.6, size: 6 });
        }
      });
      // platforms move first so riders are carried consistently
      for (const pl of this.platforms) pl.update(dt, this);

      const c = frozenInput ? NO_INPUT : this.readCtrl();
      if (this.respawnT > 0) {
        this.respawnT -= dt;
        if (this.respawnT <= 0) this.doRespawn();
      } else {
        p.update(dt, c);
        if (this.wind && !p.dead) G.Phys.moveX(L, p, this.wind * dt);
        this.handlePlayerEvents();
        if (!p.dead) {
          this.checkHazards(dt);
          this.resolveCombat(dt);
        } else if (p.deadT > 1.3 && this.respawnT <= 0) {
          this.deaths++;
          G.Save.data.deaths++;
          this.respawnT = 0.35;
          this.fullHeal = true;
        }
      }
      for (const e of this.entities) if (!e.isPlatform && !e.dead) e.update(dt, this);
      if (this.entities.some((e) => e.dead)) this.entities = this.entities.filter((e) => !e.dead);
      this.parts.update(dt);
      this.updateCamera(dt);
    },

    handlePlayerEvents() {
      const p = this.player;
      for (const ev of p.events) {
        const fx = p.cx, fy = p.bottom;
        switch (ev.type) {
          case 'jump':
            this.sfx('jump');
            this.dust(fx, fy, 6);
            break;
          case 'djump':
            this.sfx('djump');
            this.parts.spawn({ x: fx, y: fy, life: 0.35, size: 6, size1: 34, shape: 'ring', color: '#ffd2c8' });
            this.parts.burst(fx, fy, 8, { color: ['#ff7563', '#ffd2c8', '#fff'], speed: 160, angle: Math.PI / 2, spread: 1.2, life: 0.4, size: 5 });
            break;
          case 'walljump': {
            this.sfx('walljump');
            const wx = ev.data.dir > 0 ? p.x + p.w + 2 : p.x - 2;
            this.parts.burst(wx, p.cy, 8, { color: ['#fff', '#ffd2c8'], speed: 150, angle: ev.data.dir > 0 ? Math.PI : 0, spread: 0.9, life: 0.35, size: 4, shape: 'spark' });
            break;
          }
          case 'land':
            this.sfx(ev.data.hard ? 'land' : 'step');
            this.dust(fx, fy, ev.data.hard ? 10 : 4);
            break;
          case 'step':
            if (Math.random() < 0.5) this.dust(fx, fy, 1);
            break;
          case 'punch':
            this.sfx('whiff');
            break;
          case 'poundStart':
            this.sfx('poundStart');
            break;
          case 'pound':
            this.onPound(ev.data.x, ev.data.y);
            break;
          case 'dash':
            this.sfx('dash');
            this.parts.burst(fx, p.cy, 10, { color: ['#ff7563', '#fff'], speed: 120, angle: p.facing > 0 ? Math.PI : 0, spread: 0.5, life: 0.3, size: 5 });
            break;
          case 'bonk':
            this.breakTile(ev.data.tx, ev.data.ty);
            break;
          case 'hurt':
            this.onPlayerHurt();
            break;
          case 'die':
            this.sfx('die');
            this.shake(10, 0.4);
            G.Music.stop();
            break;
        }
      }
      p.events.length = 0;
      if (p.wallSliding && Math.random() < 0.3) {
        this.parts.spawn({ x: p.wallDir > 0 ? p.x + p.w : p.x, y: p.y + 10, vy: -20, life: 0.3, size: 3, color: 'rgba(255,255,255,0.7)', shape: 'circle' });
        if (Math.random() < 0.08) this.sfx('slide');
      }
      if (p.isDashing() && Math.random() < 0.7) {
        this.parts.spawn({ x: p.cx, y: p.cy + U.rand(-16, 16), vx: -p.facing * 60, life: 0.25, size: 6, color: '#ff4a3a', shape: 'tri', alpha: 0.6 });
      }
    },

    dust(x, y, n) {
      this.parts.burst(x, y - 2, n, { color: ['rgba(255,255,255,0.75)', U.rgba(this.theme.ground.top, 0.8)], speed: 90, angle: -Math.PI / 2, spread: 1.3, life: 0.35, size: 5, g: 200, shape: 'circle', size1: 0 });
    },

    onPound(x, y) {
      this.sfx('pound');
      this.shake(8, 0.25);
      this.parts.burst(x, y, 16, { color: ['#fff', U.rgba(this.theme.ground.top, 0.9)], speed: 260, angle: -Math.PI / 2, spread: 1.5, life: 0.4, size: 6, g: 600 });
      this.parts.spawn({ x, y: y - 4, life: 0.3, size: 10, size1: 80, shape: 'ring', color: '#ffffff' });
      // break blocks under the player
      const ty = Math.floor((y + 2) / TS());
      for (let tx = Math.floor((x - 22) / TS()); tx <= Math.floor((x + 22) / TS()); tx++) this.breakTile(tx, ty);
      for (const e of this.entities) {
        if (e.dead) continue;
        if (e.isEnemy && !e.asleep && Math.abs(e.cx - x) < 96 && Math.abs(e.y + e.h - y) < 56) e.hit(3, 'pound', x, this);
        if (e.isBoss && e.active) {
          const hb = e.hurtBox();
          if (Math.abs(hb.x + hb.w / 2 - x) < hb.w / 2 + 50 && Math.abs(hb.y + hb.h - y) < 60) e.hit(2, 'pound', x, this);
        }
      }
    },

    breakTile(tx, ty) {
      const L = this.level;
      if (L.get(tx, ty) !== G.T.BREAK) return false;
      const gems = L.meta.get(ty * L.w + tx) === 'gems';
      L.set(tx, ty, 0);
      this.tiles.invalidate(tx, ty);
      const cx = tx * TS() + TS() / 2, cy = ty * TS() + TS() / 2;
      this.sfx('break');
      this.shake(3, 0.12);
      this.parts.burst(cx, cy, 14, { color: [U.mix(this.theme.stone.body, '#c98a4b', 0.55), this.theme.stone.top, '#5e4a33'], speed: 280, g: 1100, life: 0.8, size: 8 });
      if (gems) {
        for (let i = 0; i < 3; i++) {
          const g = new G.Gem(cx, cy, true);
          g.vx = U.rand(-160, 160); g.vy = U.rand(-560, -380);
          this.spawn(g);
        }
      }
      return true;
    },

    checkHazards() {
      const p = this.player;
      const hz = G.Phys.hazard(this.level, p);
      if (hz === 'spike') {
        if (p.hurt(1, p.cx - p.facing * 10)) { p.vy = -620; this.onPlayerHurt(); }
      } else if (hz === 'liquid' || p.y > this.level.ph + 60) {
        if (hz === 'liquid') {
          this.parts.burst(p.cx, p.bottom - 10, 18, { color: [this.theme.liquid.color, this.theme.liquid.light], speed: 300, angle: -Math.PI / 2, spread: 0.8, g: 900, life: 0.7, size: 6 });
          this.sfx('land');
        }
        this.fallOut();
      }
    },
    fallOut() {
      const p = this.player;
      p.hp -= 1;
      this.hpFlash = 0.6;
      this.sfx('hurt');
      if (p.hp <= 0) { p.hp = 0; p.die(); p.y = this.level.ph + 200; p.events.length = 0; this.sfx('die'); G.Music.stop(); return; }
      this.respawnT = 0.45;
      this.fullHeal = false;
      p.x = -9999; // hide while respawning
    },
    doRespawn() {
      const p = this.player;
      const hp = this.fullHeal ? p.maxHp : p.hp;
      p.spawnAt(this.checkpoint.x, this.checkpoint.y);
      p.hp = hp;
      p.invuln = 1.2;
      this.fade = 0.8;
      this.sfx('respawn');
      this.parts.burst(p.cx, p.cy, 20, { color: G.Icons.PRISM, speed: 200, life: 0.6, size: 5 });
      if (this.fullHeal && !G.Music.currentName) G.Music.play(this.boss && this.boss.active ? (this.def.boss === 'king' ? 'final' : 'boss') : this.def.music || this.world.music);
      this.snapCamera();
      // reset a stuck boss fight's hazards
      this.entities.forEach((e) => { if (e.isProjectile || e.isHazard) e.dead = true; });
      this.wind = 0;
    },

    resolveCombat(dt) {
      const p = this.player;
      if (p.dead || p.x < -1000) return;
      const atk = p.attackBox();
      const pounding = p.isPounding(), dashing = p.isDashing();
      const c = this.ctrl;
      const C = G.Player.C;
      const body = { x: p.x + 3, y: p.y + 4, w: p.w - 6, h: p.h - 6 };
      if (atk) {
        const ty0 = Math.floor(atk.y / TS()), ty1 = Math.floor((atk.y + atk.h) / TS());
        const tx0 = Math.floor(atk.x / TS()), tx1 = Math.floor((atk.x + atk.w) / TS());
        if (!this._brokeFor || this._brokeFor !== atk.id) {
          let broke = false;
          for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (this.breakTile(tx, ty)) broke = true;
          if (broke) { this._brokeFor = atk.id; this.hitstop(0.04); }
        }
      }
      for (const e of this.entities) {
        if (e.dead) continue;
        if (e.isProjectile) {
          if (!e.friendly) {
            if (atk && e.reflectable && U.overlap(atk, e)) { e.reflect(this, p.facing); this.hitstop(0.05); continue; }
            if (U.overlap(body, e)) { if (p.hurt(e.dmg, e.cx)) this.onPlayerHurt(); e.pop(this); }
          } else {
            for (const t of this.entities) {
              if (t.dead || !(t.isEnemy || t.isBoss)) continue;
              const hb = t.isBoss ? t.hurtBox() : t;
              if (U.overlap(hb, e)) { t.hit(t.isBoss ? 1 : 2, 'reflect', e.cx, this); e.pop(this); break; }
            }
          }
          continue;
        }
        if (e.isEnemy) {
          if (e.asleep) continue;
          if (atk && e.lastHitId !== atk.id && U.overlap(atk, e)) {
            e.lastHitId = atk.id;
            e.hit(this.punchDmg, 'punch', p.cx, this);
            this.punchImpact(atk, e);
            continue;
          }
          if (!U.overlap(body, e)) continue;
          if (pounding) { e.hit(3, 'pound', p.cx, this); p.bounce(C.STOMP, false); this.sfx('stomp'); continue; }
          if (dashing) {
            if (e.lastDash !== p.actionT && (e.dashHitAt || 0) < this.t - 0.3) { e.dashHitAt = this.t; e.hit(1, 'dash', p.cx, this); this.sfx('hit'); }
            continue;
          }
          const fromAbove = p.vy > 0 && p.bottom - p.vy * dt <= e.y + Math.max(12, e.h * 0.45);
          if (fromAbove) {
            if (e.stompable) {
              e.hit(1, 'stomp', p.cx, this);
              p.bounce(c.jump ? C.STOMP_HOLD : C.STOMP, false);
              this.sfx('stomp');
              this.parts.burst(p.cx, p.bottom, 8, { color: ['#fff', '#ffe14a'], speed: 180, angle: Math.PI / 2, spread: 1.2, life: 0.3, size: 4, shape: 'spark' });
              continue;
            }
            if (p.hurt(1, e.cx)) { p.vy = -560; this.onPlayerHurt(); }
            continue;
          }
          if (e.contactDamage && !e.harmless) { if (p.hurt(e.contactDamage, e.cx)) this.onPlayerHurt(); }
        } else if (e.isBoss && e.active && !e.dying) {
          const hb = e.hurtBox();
          if (atk && e.lastHitId !== atk.id && U.overlap(atk, hb)) {
            e.lastHitId = atk.id;
            if (e.hit(this.punchDmg, 'punch', p.cx, this)) this.punchImpact(atk, e);
            else { p.vx = -p.facing * 260; this.parts.burst(atk.x + atk.w / 2, atk.y + atk.h / 2, 6, { color: ['#fff'], speed: 200, life: 0.25, size: 3, shape: 'spark' }); }
            continue;
          }
          if (!U.overlap(body, hb)) continue;
          if (pounding) { e.hit(2, 'pound', p.cx, this); p.bounce(C.STOMP_HOLD, false); continue; }
          const fromAbove = p.vy > 0 && p.bottom - p.vy * dt <= hb.y + 24;
          if (fromAbove) {
            const r = e.stompResult();
            if (r === 'hit') { e.hit(1, 'stomp', p.cx, this); p.bounce(C.STOMP_HOLD, false); this.sfx('stomp'); continue; }
            if (r === 'bounce') { p.bounce(C.STOMP, false); this.sfx('spring'); continue; }
          }
          if (!e.vulnerable && e.contact) { if (p.hurt(1, e.cx)) this.onPlayerHurt(); }
          else {
            // gently push out of a dazed boss
            const dir = p.cx < hb.x + hb.w / 2 ? -1 : 1;
            G.Phys.moveX(this.level, p, dir * 120 * dt);
          }
        }
      }
    },
    punchImpact(atk, e) {
      this.sfx('punch');
      this.hitstop(0.06);
      this.shake(3, 0.1);
      const x = this.player.facing > 0 ? atk.x + atk.w - 8 : atk.x + 8;
      this.parts.burst(x, atk.y + atk.h / 2, 8, { color: ['#fff', '#ffe14a', '#ff7563'], speed: 240, life: 0.3, size: 5, shape: 'spark' });
      this.parts.spawn({ x, y: atk.y + atk.h / 2, life: 0.18, size: 4, size1: 28, shape: 'ring', color: '#fff' });
    },

    // ---- camera -------------------------------------------------------------
    snapCamera() {
      const p = this.player;
      const W = G.R.W, H = G.R.H, L = this.level;
      this.cam.x = U.clamp(p.cx - W / 2, 0, Math.max(0, L.pw - W));
      this.cam.y = U.clamp(p.cy - H * 0.55, 0, Math.max(0, L.ph - H));
      if (L.pw < W) this.cam.x = (L.pw - W) / 2;
      this.cam.look = 0;
    },
    updateCamera(dt) {
      const p = this.player;
      const W = G.R.W, H = G.R.H, L = this.level;
      if (p.x > -1000 && !p.dead) {
        const lookT = p.facing * 70 + p.vx * 0.18;
        this.cam.look = U.damp(this.cam.look, U.clamp(lookT, -110, 110), 3, dt);
        const tx = p.cx - W / 2 + this.cam.look;
        let ty = p.cy - H * 0.56;
        // when standing, frame the ground; while falling, look down faster
        const k = p.vy > 500 ? 10 : 4;
        this.cam.x = U.damp(this.cam.x, tx, 6, dt);
        this.cam.y = U.damp(this.cam.y, ty, k, dt);
      }
      this.cam.x = L.pw < W ? (L.pw - W) / 2 : U.clamp(this.cam.x, 0, L.pw - W);
      this.cam.y = U.clamp(this.cam.y, 0, Math.max(0, L.ph - H));
      this.view.x = this.cam.x; this.view.y = this.cam.y; this.view.w = W; this.view.h = H;
    },
    onResize() { this.updateCamera(0); },

    // ---- pause ---------------------------------------------------------------
    openPause() {
      this.state = 'paused';
      this.sfx('menuBack');
      const W = G.R.W;
      this.pauseMenu = new G.UI.Menu([
        { label: 'Resume', onSelect: () => this.closePause() },
        { label: 'Restart Level', onSelect: () => G.Scenes.go('play', { id: this.id }) },
        { label: 'Options', onSelect: () => { this.optionsMenu = G.OptionsMenu.build(W / 2, 150, () => { this.optionsMenu = null; }); } },
        { label: 'Exit to Map', sub: 'progress in this level is lost', onSelect: () => G.Scenes.go('overworld', {}) },
      ], { x: W / 2, y: 190, w: 340, itemH: 54, onBack: () => this.closePause() });
    },
    closePause() { this.state = this.dialogue ? 'dialogue' : 'play'; G.Input.flush(); },
    updatePause(dt) {
      if (this.optionsMenu) { this.optionsMenu.update(dt); return; }
      if (G.Input.pressed.pause && !G.Input.pressed.confirm) { this.closePause(); return; }
      this.pauseMenu.update(dt);
    },

    finish() {
      // persist results
      const sd = G.Save.data;
      const rec = this.rec;
      const newShards = this.shards.map((s, i) => s && !rec.shards[i]);
      rec.shards = rec.shards.map((s, i) => s || this.shards[i]);
      const firstClear = !rec.done;
      rec.done = true;
      rec.bestGems = Math.max(rec.bestGems || 0, this.gems);
      rec.bestTime = rec.bestTime == null ? this.time : Math.min(rec.bestTime, this.time);
      sd.gems += this.gems;
      sd.gemsTotal += this.gems;
      const next = G.Worlds.next(this.id);
      let unlocked = null;
      if (next && G.Save.unlock(next)) unlocked = next;
      let story = null;
      if (this.def.boss) {
        if (this.id === '1-B' && !sd.story.world2) story = 'world2';
        if (this.id === '2-B' && !sd.story.world3) { story = 'world3'; sd.upgrades.dash = true; }
        if (this.id === '3-B' && !sd.story.world4) story = 'world4';
        if (this.id === '4-B') { story = 'ending'; sd.complete = true; }
      }
      if (unlocked) sd.node = unlocked;
      G.Save.persist();
      G.Scenes.go('results', {
        id: this.id, name: this.def.name, gems: this.gems, gemsTotal: this.gemsTotal, shards: this.shards.slice(),
        newShards, oldShards: rec.shards.slice(), time: this.time, best: rec.bestTime, deaths: this.deaths, firstClear, unlocked, story, boss: !!this.def.boss,
      });
    },

    // ---- rendering ---------------------------------------------------------
    render(ctx) {
      const W = G.R.W, H = G.R.H;
      const cx = Math.round(this.cam.x * 2) / 2 + G.R.shakeX, cy = Math.round(this.cam.y * 2) / 2 + G.R.shakeY;
      this.bg.draw(ctx, cx, cy, W, H, this.level.ph);
      this.bg.drawAmbient(ctx, cx, cy, W, H);
      ctx.save();
      ctx.translate(-cx, -cy);
      const view = { x: cx, y: cy, w: W, h: H };
      this.tiles.draw(ctx, view);
      // back layer entities
      for (const e of this.entities) if (e.layer === 0 && e.near(this, 120)) e.draw(ctx, this);
      this.parts.draw(ctx, false, view);
      this.drawPlayerShadow(ctx);
      if (this.player.x > -1000) this.player.draw(ctx);
      for (const e of this.entities) if (e.layer === 1 && e.near(this, 120)) e.draw(ctx, this);
      this.tiles.drawDynamic(ctx, view, this.t);
      this.parts.draw(ctx, true, view);
      ctx.restore();

      if (this.theme === G.Themes.caves) this.drawVignette(ctx, this.player.cx - cx, this.player.cy - cy);
      this.drawHUD(ctx);
      if (G.Input.touchVisible() && this.state !== 'paused') this.drawTouch(ctx);
      if (this.fade > 0) { ctx.fillStyle = 'rgba(10,10,20,' + this.fade + ')'; ctx.fillRect(0, 0, W, H); }
      if (this.respawnT > 0) { ctx.fillStyle = 'rgba(10,10,20,' + U.clamp(1 - this.respawnT / 0.45, 0, 1) + ')'; ctx.fillRect(0, 0, W, H); }
      if (this.state === 'dialogue' && this.dialogue) this.dialogue.draw(ctx);
      if (this.state === 'complete') this.drawComplete(ctx);
      if (this.state === 'paused') this.drawPause(ctx);
    },

    drawPlayerShadow(ctx) {
      const p = this.player;
      if (p.dead || p.x < -1000) return;
      const L = this.level;
      const tx = Math.floor(p.cx / TS());
      for (let ty = Math.floor(p.bottom / TS()); ty < Math.min(L.h, Math.floor(p.bottom / TS()) + 6); ty++) {
        if (G.Phys.solid(L, tx, ty) || G.Phys.oneway(L, tx, ty)) {
          const d = ty * TS() - p.bottom;
          const a = U.clamp(0.3 - d / 600, 0, 0.3);
          const s = U.clamp(1 - d / 400, 0.4, 1);
          ctx.fillStyle = 'rgba(0,0,0,' + a + ')';
          ctx.beginPath(); ctx.ellipse(p.cx, ty * TS() + 1, 16 * s, 4 * s, 0, 0, U.TAU); ctx.fill();
          return;
        }
      }
    },

    drawVignette(ctx, px, py) {
      const W = G.R.W, H = G.R.H;
      const g = ctx.createRadialGradient(px, py, 120, px, py, Math.max(W, H) * 0.75);
      g.addColorStop(0, 'rgba(8,4,20,0)');
      g.addColorStop(1, 'rgba(8,4,20,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    },

    drawHUD(ctx) {
      const W = G.R.W, H = G.R.H, UI = G.UI;
      const p = this.player;
      // hearts
      for (let i = 0; i < p.maxHp; i++) {
        const full = i < p.hp;
        const bob = full && p.hp === 1 ? Math.sin(this.t * 10) * 2 : 0;
        G.Icons.heart(ctx, 30 + i * 34, 30 + bob, 1.05, full, this.hpFlash > 0 && i === p.hp - 1 ? this.hpFlash : 0);
      }
      // gems
      G.Icons.gem(ctx, 30, 70, 0.9, this.t * 2);
      UI.text(ctx, String(this.gems), 48, 71, { size: 22, weight: 700, stroke: 4, strokeColor: 'rgba(10,10,30,0.7)' });
      // shards
      const sx = W / 2 - 40;
      if (!this.def.boss) for (let i = 0; i < 3; i++) {
        const have = this.shards[i] || this.rec.shards[i];
        if (have) G.Icons.shard(ctx, sx + i * 40, 32, 0.8, this.t + i, !this.shards[i]);
        else { ctx.fillStyle = 'rgba(20,20,40,0.45)'; U.poly(ctx, [sx + i * 40, 16, sx + i * 40 + 8, 26, sx + i * 40 + 6, 44, sx + i * 40 - 6, 44, sx + i * 40 - 8, 26]); ctx.fill(); }
      }
      // level label
      const pauseOffset = G.Input.touchVisible() ? 64 : 20;
      UI.text(ctx, G.Worlds.label(this.id) + '  ' + this.def.name, W - pauseOffset, 30, { size: 17, weight: 600, align: 'right', color: 'rgba(255,255,255,0.9)', stroke: 4, strokeColor: 'rgba(10,10,30,0.55)' });
      if (G.Save.options.timer) UI.text(ctx, U.formatTime(this.time), W - pauseOffset, 56, { size: 17, weight: 600, align: 'right', color: '#ffe9a8', stroke: 4, strokeColor: 'rgba(10,10,30,0.55)' });
      // level intro banner
      if (this.introT < 3 && !this.def.boss && this.state === 'play') {
        const k = this.introT < 0.4 ? U.ease.outBack(this.introT / 0.4) : this.introT > 2.5 ? 1 - (this.introT - 2.5) / 0.5 : 1;
        ctx.save();
        ctx.globalAlpha = U.clamp(k, 0, 1);
        const y = 120 - (1 - k) * 30;
        UI.text(ctx, 'WORLD ' + this.world.id + ' — ' + this.world.name.toUpperCase(), W / 2, y - 28, { size: 16, weight: 600, align: 'center', color: '#fff', stroke: 4, strokeColor: 'rgba(10,10,30,0.6)' });
        UI.text(ctx, this.def.name, W / 2, y + 4, { size: 40, weight: 700, align: 'center', color: '#fff', stroke: 7, strokeColor: 'rgba(30,10,30,0.7)' });
        ctx.restore();
      }
      // boss bar
      const b = this.boss;
      if (b && (b.active || this.state === 'bossIntro' || this.state === 'dialogue')) {
        this.bossBarShow = Math.min(1, this.bossBarShow + 0.03);
        const bw = Math.min(520, W - 200), bx = (W - bw) / 2, by = H - 46 + (1 - this.bossBarShow) * 60;
        UI.text(ctx, b.name + ' — ' + b.title, W / 2, by - 14, { size: 17, weight: 700, align: 'center', color: '#fff', stroke: 4, strokeColor: 'rgba(10,10,30,0.7)' });
        U.roundRect(ctx, bx - 3, by - 3, bw + 6, 22, 8);
        ctx.fillStyle = 'rgba(15,12,30,0.85)'; ctx.fill();
        const k = U.clamp(b.hp / b.maxHp, 0, 1);
        this._bossShown = this._bossShown == null ? k : U.lerp(this._bossShown, k, 0.08);
        ctx.fillStyle = '#fff';
        ctx.fillRect(bx, by, bw * this._bossShown, 16);
        const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        g.addColorStop(0, '#ff3b4f'); g.addColorStop(1, '#ff9a3a');
        ctx.fillStyle = g;
        ctx.fillRect(bx, by, bw * k, 16);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(bx, by, bw * k, 5);
        if (b.vulnerable && Math.floor(this.t * 6) % 2 === 0) UI.text(ctx, 'HIT IT NOW!', W / 2, by - 40, { size: 20, weight: 700, align: 'center', color: '#ffe14a', stroke: 5, strokeColor: 'rgba(60,20,0,0.7)' });
      }
      if (this.bossBanner > 0 && b) {
        const t = 2.6 - this.bossBanner;
        const k = t < 0.3 ? U.ease.outBack(t / 0.3) : this.bossBanner < 0.4 ? this.bossBanner / 0.4 : 1;
        ctx.save();
        ctx.globalAlpha = U.clamp(k, 0, 1);
        ctx.fillStyle = 'rgba(10,8,25,0.55)';
        ctx.fillRect(0, H * 0.3 - 50 * k, W, 100 * k);
        UI.text(ctx, b.name, W / 2 + (1 - k) * 200, H * 0.3 - 8, { size: 48, weight: 700, align: 'center', color: '#fff', stroke: 8, strokeColor: '#b3261e' });
        UI.text(ctx, b.title.toUpperCase(), W / 2 - (1 - k) * 200, H * 0.3 + 30, { size: 18, weight: 700, align: 'center', color: '#ffd38a' });
        ctx.restore();
      }
      if (this.bossDefeated && this.goal && this.state === 'play') {
        UI.text(ctx, 'The Prism Gate is open! →', W / 2, H - 40, { size: 20, weight: 700, align: 'center', color: '#fff', stroke: 5, strokeColor: 'rgba(10,10,30,0.6)', alpha: 0.6 + 0.4 * Math.sin(this.t * 4) });
      }
    },

    drawTouch(ctx) {
      const I = G.Input;
      for (const b of I.touchButtons) {
        if (b.id === 'dash' && !G.Save.data.upgrades.dash) continue;
        const held = I.isTouchHeld(b.id);
        ctx.fillStyle = held ? 'rgba(255,120,100,0.45)' : 'rgba(255,255,255,0.14)';
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * U.TAU + Math.PI / 8;
          ctx.lineTo(b.x + Math.cos(a) * b.r, b.y + Math.sin(a) * b.r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        G.UI.text(ctx, b.label, b.x, b.y + 1, { size: b.r > 40 ? 18 : 14, weight: 700, align: 'center', color: 'rgba(255,255,255,0.85)' });
      }
    },

    drawComplete(ctx) {
      const W = G.R.W, H = G.R.H;
      const k = U.clamp(this.completeT / 0.5, 0, 1);
      ctx.save();
      ctx.globalAlpha = k;
      const s = U.ease.outBack(k);
      ctx.translate(W / 2, H * 0.32);
      ctx.scale(s, s);
      G.UI.text(ctx, this.def.boss ? 'BOSS DEFEATED!' : 'LEVEL CLEAR!', 0, 0, { size: 56, weight: 700, align: 'center', color: '#fff', stroke: 10, strokeColor: '#b3261e', shadow: 'rgba(0,0,0,0.3)', shadowOff: 6 });
      ctx.restore();
    },

    drawPause(ctx) {
      const W = G.R.W, H = G.R.H;
      ctx.fillStyle = 'rgba(8,8,20,0.6)';
      ctx.fillRect(0, 0, W, H);
      if (this.optionsMenu) { G.OptionsMenu.draw(ctx, this.optionsMenu); return; }
      G.UI.text(ctx, 'PAUSED', W / 2, 110, { size: 48, weight: 700, align: 'center', color: '#fff', stroke: 8, strokeColor: '#b3261e' });
      this.pauseMenu.draw(ctx);
      G.UI.hint(ctx, 'Gems ' + this.gems + '  ·  Time ' + U.formatTime(this.time) + '  ·  Falls ' + this.deaths, W / 2, H - 30, 'center');
    },
  };
  const NO_INPUT = { left: false, right: false, up: false, down: false, jump: false, jumpPressed: false, attackPressed: false, dashPressed: false, downPressed: false };
  G.Scenes.register('play', Play);
})(window.G);
