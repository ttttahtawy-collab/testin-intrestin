// Movement abilities as plug-in modules. The player's core controller handles
// running, gravity and the ground jump; everything else is an ability:
//
//   airJump(p, c)  -> true if it consumed a mid-air jump press
//   update(p, c, dt)  runs every frame before physics (e.g. wall slide)
//   tryStart(p, c) -> true to take over as the player's current action
//   act(p, c, dt)  -> per-frame control while active; return true when done
//   onLand(p)      -> called when landing while this action is active
//   reset(p)       -> called on landing / respawn
//
// To add a new mechanic, register it here and add its name to
// Player.prototype.abilityNames (or unlock it via the save file).
(function (G) {
  'use strict';
  const U = G.U;
  const A = (G.Abilities = { list: {} });
  A.register = function (name, def) { def.name = name; def.priority = def.priority || 0; A.list[name] = def; };
  A.get = (names) => names.map((n) => A.list[n]).filter(Boolean).sort((a, b) => b.priority - a.priority);

  A.register('wallJump', {
    priority: 10,
    update(p, c, dt) {
      p.wallSliding = false;
      if (p.onGround || p.action) { p.wallCoyote = 0; return; }
      const L = p.level;
      const wd = G.Phys.wallAt(L, p, 1) ? 1 : G.Phys.wallAt(L, p, -1) ? -1 : 0;
      p.wallDir = wd;
      if (wd) { p.wallCoyote = p.C.WALL_COYOTE; p.lastWallDir = wd; }
      else p.wallCoyote -= dt;
      if (wd && p.ix === wd && p.vy > 0) {
        if (!p.wasWallSliding) { p.airJumps = p.maxAirJumps; p.dashAvail = true; }
        p.wallSliding = true;
        p.vy = Math.min(p.vy, p.C.WALL_SLIDE);
        p.facing = -wd;
      }
      p.wasWallSliding = p.wallSliding;
    },
    airJump(p) {
      if (p.wallCoyote <= 0) return false;
      const d = p.lastWallDir;
      p.vx = -d * p.C.WJ_X;
      p.vy = -p.C.WJ_Y;
      p.facing = -d;
      p.wallJumpLock = p.C.WJ_LOCK;
      p.wallCoyote = 0;
      p.cutable = true;
      p.stretch(0.8, 1.22);
      p.emit('walljump', { dir: d });
      return true;
    },
  });

  A.register('doubleJump', {
    priority: 5,
    airJump(p) {
      if (p.airJumps <= 0) return false;
      p.airJumps--;
      p.vy = -p.C.DJUMP;
      p.cutable = true;
      p.spinT = 0.34;
      p.stretch(0.85, 1.18);
      p.emit('djump');
      return true;
    },
  });

  A.register('groundPound', {
    priority: 8,
    tryStart(p, c) {
      if (p.onGround || !c.downPressed || p.hurtT > 0) return false;
      p.poundPhase = 'wind';
      p.vx = 0; p.vy = 0;
      p.emit('poundStart');
      return true;
    },
    act(p, c, dt) {
      if (p.poundPhase === 'wind') {
        p.vx = 0; p.vy = 0;
        if (p.actionT > 0.13) { p.poundPhase = 'fall'; p.vy = p.C.POUND_V; }
      } else if (p.poundPhase === 'fall') {
        p.vx = 0;
        p.vy = p.C.POUND_V;
      } else if (p.poundPhase === 'land') {
        p.vx = 0;
        if (p.actionT > 0.16) return true;
      }
      return false;
    },
    onLand(p) {
      if (p.poundPhase !== 'fall') return;
      p.poundPhase = 'land';
      p.actionT = 0;
      p.stretch(1.35, 0.7);
      p.emit('pound', { x: p.x + p.w / 2, y: p.y + p.h });
    },
    // allow bouncing out of a pound when it hits an enemy
  });

  A.register('dash', {
    priority: 9,
    tryStart(p, c) {
      if (!c.dashPressed || !p.dashAvail || p.hurtT > 0 || p.dashCd > 0) return false;
      p.dashAvail = false;
      p.dashCd = 0.32;
      p.dashDir = c.left && !c.right ? -1 : c.right && !c.left ? 1 : p.facing;
      p.facing = p.dashDir;
      p.emit('dash');
      return true;
    },
    act(p, c, dt) {
      p.vx = p.dashDir * p.C.DASH_V;
      p.vy = 0;
      if (p.actionT > 0.15 || p.hitWallX) {
        p.vx = p.dashDir * p.C.RUN;
        return true;
      }
      return false;
    },
  });
})(window.G);
