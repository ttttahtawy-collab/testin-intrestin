// Player controller, stats and combat input.
import * as THREE from 'three';
import { moveEntity, inWater } from '../entities/physics.js';
import { ITEMS } from './items.js';
import { B, SOLID } from '../world/blocks.js';

export const PERKS = {
  power_strike: { name: 'Power Strike', icon: '⚔', desc: 'Ability [1]: your next blow within 3s strikes for 220% damage and always staggers. Costs 25 Resolve.', ability: 1, cost: 25, start: true },
  shield_bash: { name: 'Shield Bash', icon: '⛨', desc: 'Ability [2]: slam your shield (or pommel) into the foe before you, staggering them. Costs 15 Resolve.', ability: 2, cost: 15 },
  battle_cry: { name: 'Battle Cry', icon: '📯', desc: 'Ability [3]: a war-shout that staggers nearby foes, sends beasts running, and raises your damage by 20% for 12s. Costs 35 Resolve.', ability: 3, cost: 35 },
  second_wind: { name: 'Second Wind', icon: '❖', desc: 'Ability [4]: catch your breath — restore half your stamina and heal 30 health over 6s. Costs 40 Resolve.', ability: 4, cost: 40 },
  iron_skin: { name: 'Iron Skin', icon: '⛊', desc: '+8 armour. Scars are just armour you grew yourself.' },
  long_wind: { name: 'Long Wind', icon: '≋', desc: '+25 maximum stamina and stamina returns 20% faster.' },
  heavy_hand: { name: 'Heavy Hand', icon: '✊', desc: '+15% damage with melee weapons.' },
  riposte: { name: 'Riposte', icon: '↺', desc: 'A wider parry window, and the blow after a parry deals double damage.' },
  hunters_eye: { name: "Hunter's Eye", icon: '➶', desc: '+25% bow damage and arrows fly faster and flatter.' },
  herb_wise: { name: 'Herb-Wise', icon: '❦', desc: 'Remedies heal 30% more and you gather twice the herbs.' },
  fleet_foot: { name: 'Fleet Foot', icon: '➹', desc: '+10% movement speed and dodging costs less stamina.' },
  haggler: { name: 'Haggler', icon: '⚖', desc: 'Buy for 15% less and sell for 15% more.' },
  lantern_bearer: { name: 'Lantern-Bearer', icon: '☼', desc: 'Your lantern burns 40% brighter and beasts notice you later at night.' },
  cleave: { name: 'Cleave', icon: '⟆', desc: 'Your swings can strike up to three foes at once.' },
};

export class Player {
  constructor(game) {
    this.game = game;
    this.isPlayer = true;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.radius = 0.38; this.height = 3.5; this.eye = 3.2;
    this.stepUp = true;
    this.onGround = false;
    this.level = 1; this.xp = 0; this.points = 0; this.perkPoints = 0;
    this.attr = { might: 1, vigor: 1, endurance: 1, resolve: 1 };
    this.perks = new Set(['power_strike']);
    this.gold = 15;
    this.equip = { main: null, off: null, body: null, head: null, belt: null, back: null };
    this.hp = 100; this.stamina = 100; this.resolve = 30;
    this.alive = true; this.dead = false;
    this.mode = 'melee'; // melee | bow
    this.sheathed = false;
    this.atk = null; // {t, phase, idx, heavy, charge, hitDone}
    this.combo = 0; this.comboT = 0;
    this.blockT = 0; this.blocking = false;
    this.dodgeT = 0; this.iframes = 0;
    this.staminaDelay = 0;
    this.staggerT = 0;
    this.hot = []; // heal over time [{rate, t}]
    this.buffs = {}; // name -> time left
    this.powerStrike = 0;
    this.draw = 0; this.drawing = false;
    this.useAnim = 0; this.throwAnim = 0; this.bashAnim = 0; this.cryAnim = 0;
    this.sneak = false; this.sprinting = false;
    this.noise = 0;
    this.camShake = 0; this.hitStop = 0;
    this.bob = 0; this.bobAmt = 0;
    this.quick = []; this.quickIdx = 0;
    this.maskTime = 0;
    this.fog = 0;
    this.respawn = null;
    this.fallY = 0;
    this.lastStep = 0;
    this.headBump = 0;
    this.lastHurtT = 0;
    this.onLand = (v) => this.land(v);
  }

  // ---------- derived stats ----------
  get maxHp() { return 90 + this.attr.vigor * 12 + this.level * 4; }
  get maxStamina() { let s = 90 + this.attr.endurance * 10; if (this.perks.has('long_wind')) s += 25; for (const k of ['body', 'belt']) { const it = this.equip[k] && ITEMS[this.equip[k]]; if (it && it.stamBonus) s += it.stamBonus; } return s; }
  get maxResolve() { return 40 + this.attr.resolve * 10; }
  get armor() {
    let a = 0;
    for (const k of ['body', 'head', 'off', 'belt']) { const it = this.equip[k] && ITEMS[this.equip[k]]; if (it && it.armor) a += it.armor; }
    if (this.perks.has('iron_skin')) a += 8;
    return a;
  }
  get weapon() { return ITEMS[this.equip.main] || { name: 'Fists', dmg: 4, speed: 1.3, reach: 3.4, stam: 8, shape: null }; }
  get shield() { const it = ITEMS[this.equip.off]; return it && it.type === 'shield' ? it : null; }
  get lantern() { const it = ITEMS[this.equip.off]; return it && it.type === 'light' ? it : null; }
  get bow() { return ITEMS[this.equip.back] && ITEMS[this.equip.back].type === 'bow' ? ITEMS[this.equip.back] : null; }
  get meleeMult() {
    let m = 1 + (this.attr.might - 1) * 0.06;
    if (this.perks.has('heavy_hand')) m += 0.15;
    const belt = ITEMS[this.equip.belt]; if (belt && belt.dmgBonus) m += belt.dmgBonus;
    if (this.buffs.cry > 0) m += 0.2;
    return m;
  }
  get xpNext() { return 120 + (this.level - 1) * 90; }
  get speedMul() { return this.perks.has('fleet_foot') ? 1.1 : 1; }

  eyePos(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + this.eye + this.headBump, this.pos.z); }
  forward(out = new THREE.Vector3()) { return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)); }

  gainXp(n, why) {
    if (n <= 0) return;
    this.xp += n;
    this.game.ui.xpPopup(n, why);
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext; this.level++; this.points++; this.perkPoints++;
      this.hp = this.maxHp; this.stamina = this.maxStamina;
      this.game.ui.levelUp(this.level);
      this.game.audio.levelUp();
    }
  }

  // ---------- update ----------
  update(dt, input) {
    const game = this.game;
    if (this.dead) { this.vel.x *= 0.9; this.vel.z *= 0.9; moveEntity(game.world, this, dt); return; }
    const uiBlocked = game.ui.blocking;
    // look
    if (!uiBlocked) {
      const sens = 0.0022 * input.sensitivity;
      this.yaw -= input.mouse.dx * sens;
      this.pitch -= input.mouse.dy * sens;
      if (input.touch.active) { this.yaw -= input.touch.look.x; this.pitch -= input.touch.look.y; input.touch.look.x = 0; input.touch.look.y = 0; }
      this.yaw -= input.edgeTurn() * dt * 2.2;
      this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
    }
    // timers
    this.blockT += dt; this.comboT -= dt; this.iframes -= dt; this.staminaDelay -= dt; this.powerStrike -= dt;
    for (const k in this.buffs) this.buffs[k] -= dt;
    if (this.staggerT > 0) this.staggerT -= dt;
    this.useAnim = Math.max(0, this.useAnim - dt); this.throwAnim = Math.max(0, this.throwAnim - dt); this.bashAnim = Math.max(0, this.bashAnim - dt); this.cryAnim = Math.max(0, this.cryAnim - dt);
    // heal over time
    for (const h of this.hot) { const d = Math.min(dt, h.t); this.hp = Math.min(this.maxHp, this.hp + h.rate * d); h.t -= dt; }
    this.hot = this.hot.filter((h) => h.t > 0);
    // movement input
    let mx = 0, mz = 0;
    if (!uiBlocked) {
      if (input.down('KeyW') || input.down('ArrowUp')) mz -= 1;
      if (input.down('KeyS') || input.down('ArrowDown')) mz += 1;
      if (input.down('KeyA') || input.down('ArrowLeft')) mx -= 1;
      if (input.down('KeyD') || input.down('ArrowRight')) mx += 1;
      if (input.touch.active) { mx += input.touch.move.x; mz += input.touch.move.y; }
      if (input.hit('KeyC')) { this.sneak = !this.sneak; game.ui.toast(this.sneak ? 'Sneaking' : 'Standing', 1); }
    }
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    const wantSprint = !uiBlocked && (input.down('ShiftLeft') || input.down('ShiftRight')) && ml > 0.1 && mz < 0.3;
    this.sprinting = wantSprint && this.stamina > 2 && !this.blocking && !this.atk && !this.drawing && this.onGround !== null;
    if (this.sprinting) { this.sneak = false; this.stamina -= 11 * dt; this.staminaDelay = 0.6; }
    let speed = 7.2;
    if (this.sprinting) speed = 12.5;
    if (this.sneak) speed = 3.8;
    if (this.blocking || this.drawing) speed *= 0.5;
    if (this.atk) speed *= this.atk.heavy ? 0.35 : 0.6;
    if (this.useAnim > 0) speed *= 0.6;
    if (this.inWater) speed *= 0.55;
    if (this.staggerT > 0) speed = 0;
    speed *= this.speedMul;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let wx = (mx * cy + mz * sy) * speed, wz = (-mx * sy + mz * cy) * speed;
    // dodge
    if (this.dodgeT > 0) {
      this.dodgeT -= dt;
      wx = this.dodgeDir.x * 17; wz = this.dodgeDir.z * 17;
    } else if (!uiBlocked && (input.hit('KeyV') || input.hit('AltLeft')) && this.onGround && this.staggerT <= 0) {
      const cost = this.perks.has('fleet_foot') ? 15 : 22;
      if (this.stamina >= cost * 0.5) {
        this.stamina -= cost; this.staminaDelay = 0.8;
        let dx = wx, dz = wz;
        if (Math.hypot(dx, dz) < 0.1) { dx = sy; dz = cy; }
        const l = Math.hypot(dx, dz);
        this.dodgeDir = { x: dx / l, z: dz / l };
        this.dodgeT = 0.24; this.iframes = 0.3; this.atk = null;
        game.audio.whoosh(this.pos, 0.8);
      }
    }
    const accel = this.onGround ? 12 : 3;
    const k = Math.min(1, dt * accel);
    this.vel.x += (wx - this.vel.x) * k;
    this.vel.z += (wz - this.vel.z) * k;
    // jump / swim
    if (!uiBlocked && input.down('Space')) {
      if (this.onGround && !this.jumpLatch && this.stamina > 4 && this.staggerT <= 0) { this.vel.y = 13.5; this.stamina -= 6; this.staminaDelay = 0.4; this.jumpLatch = true; }
    } else this.jumpLatch = false;
    const wasAir = !this.onGround;
    moveEntity(game.world, this, dt, { swimUp: !uiBlocked && input.down('Space') });
    if (this.stepped) this.headBump -= this.stepped * 0.9; // smooth step-up
    this.headBump *= Math.pow(0.0005, dt);
    // footsteps & bob
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && hs > 1) {
      this.bob += hs * dt * 0.95;
      this.bobAmt += (Math.min(1, hs / 10) - this.bobAmt) * Math.min(1, dt * 6);
      if (Math.floor(this.bob / Math.PI) !== this.lastStep) {
        this.lastStep = Math.floor(this.bob / Math.PI);
        const under = game.world.get(this.pos.x, this.pos.y - 0.5, this.pos.z);
        game.audio.footstep(under, this.sprinting ? 1 : this.sneak ? 0.35 : 0.7, this.inWater);
      }
    } else this.bobAmt *= Math.pow(0.02, dt);
    // noise level for enemy hearing
    this.noise = this.sneak ? 2 : this.sprinting ? 14 : hs > 1 ? 6 : 3;
    if (this.atk) this.noise = 14;
    // stamina regen
    if (this.staminaDelay <= 0 && !this.sprinting) {
      let rate = 24 * (this.perks.has('long_wind') ? 1.2 : 1) * (this.buffs.tea > 0 ? 1.8 : 1) * (this.blocking ? 0.4 : 1);
      this.stamina = Math.min(this.maxStamina, this.stamina + rate * dt);
    }
    // resolve slowly recovers
    this.resolve = Math.min(this.maxResolve, this.resolve + dt * 0.6);
    // environment: withering fog
    this.updateFog(dt);
    if (!uiBlocked) this.combatInput(dt, input);
    else { this.blocking = false; if (this.drawing) { this.drawing = false; this.draw = 0; } }
    this.updateAttack(dt);
    // lantern toggle
    if (!uiBlocked && input.hit('KeyL')) { this.lanternOff = !this.lanternOff; game.audio.ui('click'); }
    if (this.pos.y < -20) this.die('the deep');
    if (this.hp <= 0 && !this.dead) this.die();
  }

  land(v) {
    const dmg = Math.max(0, (v - 26) * 2.2);
    if (dmg > 0 && !this.inWater) { this.hurt(dmg, null, { fall: true }); }
    this.game.audio.footstep(B.DIRT, 1.2);
    this.camShake = Math.min(0.5, v / 60);
  }

  updateFog(dt) {
    const g = this.game;
    const exposure = g.fogExposure(this.pos);
    this.fog = exposure;
    if (exposure > 0.3) {
      const masked = g.inventory.has('fog_mask') && this.maskTime > 0;
      if (masked) { this.maskTime -= dt; this.choking = 0; }
      else {
        this.choking = Math.min(1, (this.choking || 0) + dt * 0.5);
        this.hp -= dt * 4.5 * exposure;
        this.stamina = Math.min(this.stamina, this.maxStamina * 0.6);
        if ((this.coughT = (this.coughT || 0) - dt) < 0) { this.coughT = 2.5 + Math.random() * 2; g.audio.cough(); if (!g.inventory.has('fog_mask')) g.ui.toast('The fog burns your lungs. You need a fen-mask.', 2.5); else if (this.maskTime <= 0) g.ui.toast('Your mask filter is spent. Use a Fog-Mask Filter.', 2.5); }
      }
    } else this.choking = Math.max(0, (this.choking || 0) - dt);
  }

  // ---------- combat ----------
  combatInput(dt, input) {
    const game = this.game;
    if (this.staggerT > 0) { this.blocking = false; return; }
    if (input.hit('KeyF')) { this.sheathed = !this.sheathed; game.audio.sheathe(); if (this.mode === 'bow') this.mode = 'melee'; }
    if (input.hit('KeyB')) {
      if (this.bow) { this.mode = this.mode === 'bow' ? 'melee' : 'bow'; this.sheathed = false; game.audio.sheathe(); game.ui.toast(this.mode === 'bow' ? this.bow.name : this.weapon.name, 1); }
      else game.ui.toast('You carry no bow.', 1.5);
    }
    // abilities
    for (let i = 1; i <= 4; i++) if (input.hit('Digit' + i)) this.useAbility(i);
    if (input.hit('KeyX')) this.useQuick();
    if (input.hit('KeyZ')) this.cycleQuick();
    if (input.hit('KeyG')) this.throwItem();
    if (this.sheathed) { this.blocking = false; if (input.mouseHit(0)) { this.sheathed = false; game.audio.sheathe(); } return; }
    if (this.mode === 'bow') { this.bowInput(dt, input); return; }
    // block
    const wantBlock = input.mouseDown(2) && !this.atk && this.dodgeT <= 0 && this.useAnim <= 0;
    if (wantBlock && !this.blocking) { this.blocking = true; this.blockT = 0; }
    if (!wantBlock) this.blocking = false;
    // attack: tap = light combo, hold = charged heavy
    if (input.mouseHit(0) && !this.blocking) { this.pressing = true; this.pressT = 0; }
    if (this.pressing) {
      this.pressT += dt;
      if (!input.mouseDown(0)) {
        this.pressing = false;
        if (this.atk && this.atk.phase === 'charge') this.releaseHeavy();
        else if (!this.atk) this.startAttack(false);
        else this.queued = true;
      } else if (this.pressT > 0.22 && !this.atk) {
        this.startAttack(true);
        if (this.atk) { this.atk.phase = 'charge'; this.atk.charge = 0; this.game.audio.charge(); }
      }
    }
    if (this.atk && this.atk.phase === 'charge') this.atk.charge = Math.min(1, this.atk.charge + dt / 0.7);
  }

  startAttack(heavy) {
    const w = this.weapon;
    const cost = w.stam * (heavy ? 1.8 : 1);
    if (this.stamina < 3) { this.game.ui.toast('Too winded to swing', 0.8); return; }
    this.stamina -= cost; this.staminaDelay = 0.9;
    const idx = this.comboT > 0 ? (this.combo + 1) % 3 : 0;
    this.combo = idx;
    this.atk = { t: 0, phase: 'windup', idx, heavy, charge: 0, hitDone: false, canHeavy: true, speed: w.speed || 1 };
    this.queued = false;
    for (const a of this.game.actors) if (a.alive && a.aggro) a.onThreat(this);
  }

  releaseHeavy() {
    const a = this.atk;
    a.phase = 'windup'; a.t = 0.05; a.canHeavy = false;
    this.staminaDelay = 1;
    for (const x of this.game.actors) if (x.alive && x.aggro) x.onThreat(this);
  }

  updateAttack(dt) {
    const a = this.atk;
    if (!a) return;
    if (this.hitStop > 0) { this.hitStop -= dt; return; }
    if (a.phase === 'charge') return;
    a.t += dt * a.speed;
    const WIND = a.heavy ? 0.16 : 0.14, ACT = 0.1, REC = a.heavy ? 0.42 : 0.3;
    if (a.phase === 'windup' && a.t >= WIND) { a.phase = 'active'; a.t = 0; this.game.audio.whoosh(this.pos, a.heavy ? 1.3 : 1); }
    else if (a.phase === 'active') {
      if (!a.hitDone && a.t >= ACT * 0.4) {
        a.hitDone = true;
        let mult = this.meleeMult * (a.heavy ? 1.7 + a.charge * 0.7 : 1) * (a.idx === 2 ? 1.25 : 1);
        let stag = a.heavy ? 1.5 : 1;
        if (this.powerStrike > 0) { mult *= 2.2; stag = 9; this.powerStrike = 0; this.game.fx.flash(0.25); }
        if (this.ripost > 0) { mult *= 2; this.ripost = 0; }
        this.game.combat.playerMelee(this, this.weapon, mult, { heavy: a.heavy, stagger: stag * (this.weapon.stagger || 1), cleave: this.perks.has('cleave') || a.heavy });
      }
      if (a.t >= ACT) { a.phase = 'recover'; a.t = 0; }
    } else if (a.phase === 'recover') {
      if (this.queued && a.t > REC * 0.35) { this.comboT = 0.5; this.atk = null; this.startAttack(false); return; }
      if (a.t >= REC) { this.atk = null; this.comboT = 0.45; }
    }
  }

  bowInput(dt, input) {
    const bow = this.bow;
    const arrows = this.game.inventory.count('arrow');
    this.blocking = false;
    if (input.mouseDown(0) && arrows > 0) {
      if (!this.drawing) { this.drawing = true; this.draw = 0; this.game.audio.bowDraw(); }
      this.draw = Math.min(1, this.draw + dt / (bow.draw || 0.8));
      this.stamina -= dt * (this.draw >= 1 ? 6 : 2); this.staminaDelay = 0.5;
    } else if (this.drawing) {
      if (this.draw > 0.2) {
        this.game.inventory.remove('arrow', 1);
        this.game.combat.playerArrow(this, bow, this.draw);
      }
      this.drawing = false; this.draw = 0;
    } else if (input.mouseHit(0) && arrows <= 0) this.game.ui.toast('No arrows', 1);
  }

  useAbility(i) {
    const id = Object.keys(PERKS).find((k) => PERKS[k].ability === i);
    if (!id) return;
    const P = PERKS[id];
    if (!this.perks.has(id)) { this.game.ui.toast(`${P.name} is not yet learned`, 1.5); return; }
    if (this.resolve < P.cost) { this.game.ui.toast('Not enough Resolve', 1); this.game.audio.ui('deny'); return; }
    this.resolve -= P.cost;
    const g = this.game;
    switch (id) {
      case 'power_strike': this.powerStrike = 3; g.ui.toast('Power Strike ready', 1); g.audio.charge(); break;
      case 'shield_bash': this.bashAnim = 0.4; g.combat.bash(this); break;
      case 'battle_cry': this.cryAnim = 0.8; this.buffs.cry = 12; g.combat.battleCry(this); break;
      case 'second_wind': this.stamina = Math.min(this.maxStamina, this.stamina + this.maxStamina * 0.5); this.hot.push({ rate: 5, t: 6 }); g.audio.breath(); g.ui.toast('Second Wind', 1); break;
    }
    g.ui.flashAbility(i);
  }

  // quickslot of consumables
  refreshQuick() {
    const inv = this.game.inventory;
    this.quick = inv.items.filter((s) => ['consumable', 'food'].includes(ITEMS[s.id].type)).map((s) => s.id);
    if (this.quickIdx >= this.quick.length) this.quickIdx = 0;
  }
  cycleQuick() { this.refreshQuick(); if (this.quick.length) { this.quickIdx = (this.quickIdx + 1) % this.quick.length; this.game.audio.ui('click'); } }
  useQuick() { this.refreshQuick(); const id = this.quick[this.quickIdx]; if (id) this.game.useItem(id); else this.game.ui.toast('Nothing to use', 1); }

  throwItem() {
    const inv = this.game.inventory;
    const id = inv.has('firepot') ? 'firepot' : inv.has('throwknife') ? 'throwknife' : null;
    if (!id) { this.game.ui.toast('Nothing to throw', 1); return; }
    if (this.stamina < 8) return;
    this.stamina -= 10; this.staminaDelay = 0.6;
    inv.remove(id, 1);
    this.throwAnim = 0.45;
    this.game.combat.playerThrow(this, id);
  }

  // incoming damage; returns damage dealt
  hurt(dmg, src, o = {}) {
    if (this.dead) return 0;
    const g = this.game;
    if (!o.fall && !o.fog && this.iframes > 0) { g.ui.toast('Dodged!', 0.6); return 0; }
    if (!o.fall && src && this.blocking && !o.unblockable) {
      // facing check
      const dx = src.pos.x - this.pos.x, dz = src.pos.z - this.pos.z;
      const toSrc = Math.atan2(-dx, -dz);
      let d = toSrc - this.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      if (Math.abs(d) < 1.3) {
        const window = this.perks.has('riposte') ? 0.32 : 0.22;
        if (this.blockT < window && src.stagger) {
          src.stagger(1.3);
          this.resolve = Math.min(this.maxResolve, this.resolve + 10);
          if (this.perks.has('riposte')) this.ripost = 1;
          g.fx.sparks(src.center, 20); g.audio.clang(this.pos, 1.4); g.ui.toast('Parried!', 0.8); this.hitStop = 0.08;
          g.fx.flash(0.15);
          return 0;
        }
        const sh = this.shield;
        const blk = sh ? sh.block : 0.45;
        const cost = dmg * (sh ? 0.9 : 1.4);
        this.stamina -= cost; this.staminaDelay = 1;
        g.fx.sparks(this.eyePos().addScaledVector(this.forward(), 1.2), 8); g.audio.clang(this.pos, 1);
        this.camShake = 0.15;
        if (this.stamina < 0) { this.stamina = 0; this.staggerT = 0.9; this.blocking = false; g.ui.toast('Guard broken!', 1); dmg *= 0.6; }
        else { dmg *= 1 - blk; this.blockFlash = 0.2; if (dmg < 1) return 0; }
      }
    }
    const armorRed = o.fall || o.fog ? 1 : 100 / (100 + this.armor * 3.5);
    const dealt = Math.max(1, Math.round(dmg * armorRed));
    this.hp -= dealt;
    this.lastHurtT = g.time.real;
    this.camShake = Math.min(0.6, 0.15 + dealt / 40);
    g.ui.hurt(dealt);
    g.audio.hurtPlayer();
    if (o.stagger && dealt > 8 && !this.blocking) this.staggerT = 0.35 * o.stagger;
    if (src && src.pos) {
      const dx = this.pos.x - src.pos.x, dz = this.pos.z - src.pos.z, l = Math.hypot(dx, dz) || 1;
      const kb = o.knock || 4;
      this.vel.x += dx / l * kb; this.vel.z += dz / l * kb;
    }
    if (this.hp <= 0) this.die(src && src.name);
    return dealt;
  }

  die(by) {
    if (this.dead) return;
    this.dead = true; this.hp = 0; this.atk = null; this.blocking = false;
    this.game.onPlayerDeath(by);
  }
}
