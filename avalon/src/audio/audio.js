// Procedural sound: ambience and effects synthesized with WebAudio. No music.
import { B } from '../world/blocks.js';

export class Audio {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.vol = 0.8;
    this.started = false;
  }

  start() {
    if (this.started) { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.vol; this.master.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    this.amb = c.createGain(); this.amb.gain.value = 0.55; this.amb.connect(this.master);
    // noise buffer
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.brown = c.createBuffer(1, len, c.sampleRate);
    const bd = this.brown.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    // ambient loops
    this.wind = this.loop(this.brown, 'lowpass', 500, 0);
    this.windHi = this.loop(this.noise, 'bandpass', 1400, 0, 0.6);
    this.rain = this.loop(this.noise, 'highpass', 1800, 0);
    this.fire = this.loop(this.brown, 'bandpass', 900, 0, 1.5);
    this.water = this.loop(this.brown, 'bandpass', 600, 0, 0.8);
    this.started = true;
    this.chirpT = 0;
  }

  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }

  loop(buf, type, freq, gain, q = 1) {
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(this.amb);
    src.start(0, Math.random() * 1.5);
    return { src, f, g };
  }

  // spatial attenuation
  spatial(pos) {
    if (!pos) return { v: 1, pan: 0 };
    const P = this.game.player;
    if (!P) return { v: 1, pan: 0 };
    const dx = pos.x - P.pos.x, dz = pos.z - P.pos.z;
    const d = Math.hypot(dx, dz, (pos.y || P.pos.y) - P.pos.y);
    const v = Math.max(0, 1 - d / 60) ** 1.6;
    const ang = Math.atan2(dx, -dz) + P.yaw;
    return { v, pan: Math.max(-1, Math.min(1, Math.sin(ang))) };
  }

  out(vol, pan = 0) {
    const c = this.ctx;
    const g = c.createGain(); g.gain.value = vol;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(this.sfx); }
    else g.connect(this.sfx);
    return g;
  }

  noiseHit({ t = 0, dur = 0.15, freq = 1000, type = 'bandpass', q = 1, vol = 0.5, pos = null, sweep = 0, attack = 0.005, buf = null }) {
    if (!this.ctx) return;
    const sp = this.spatial(pos);
    if (sp.v <= 0.01) return;
    const c = this.ctx, now = c.currentTime + t;
    const src = c.createBufferSource(); src.buffer = buf || this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, now); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), now + dur);
    const g = this.out(0, sp.pan);
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(vol * sp.v, now + attack); g.gain.exponentialRampToValueAtTime(0.0008, now + dur);
    src.connect(f); f.connect(g);
    src.start(now, Math.random() * 1.5); src.stop(now + dur + 0.05);
  }
  tone({ t = 0, dur = 0.2, freq = 440, to = null, type = 'sine', vol = 0.3, pos = null, attack = 0.01 }) {
    if (!this.ctx) return;
    const sp = this.spatial(pos);
    if (sp.v <= 0.01) return;
    const c = this.ctx, now = c.currentTime + t;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, now);
    if (to) o.frequency.exponentialRampToValueAtTime(to, now + dur);
    const g = this.out(0, sp.pan);
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(vol * sp.v, now + attack); g.gain.exponentialRampToValueAtTime(0.0008, now + dur);
    o.connect(g); o.start(now); o.stop(now + dur + 0.05);
  }

  update(dt) {
    if (!this.ctx) return;
    const g = this.game;
    if (!g.player || g.state !== 'play') { if (this.wind) { this.wind.g.gain.value = 0.15; } return; }
    const w = g.weather ? g.weather.cur : { wind: 1, rain: 0 };
    const P = g.player;
    const alt = Math.max(0, (P.pos.y - 50) / 50);
    const indoor = g.indoor ? 0.3 : 1;
    const k = Math.min(1, dt * 2);
    const set = (n, v) => { n.g.gain.value += (v - n.g.gain.value) * k; };
    set(this.wind, (0.18 + w.wind * 0.18 + alt * 0.3) * indoor);
    set(this.windHi, (0.02 + w.wind * 0.03 + alt * 0.08) * indoor);
    this.windHi.f.frequency.value = 900 + Math.sin(g.time.real * 0.3) * 400 + w.wind * 200;
    set(this.rain, w.rain * (g.indoor ? 0.18 : 0.32) * (g.biome === 7 ? 0 : 1));
    // fire proximity
    let fd = 1e9;
    for (const c of g.world.meta.campfires) { const d = Math.hypot(c.x - P.pos.x, c.z - P.pos.z); if (d < fd) fd = d; }
    set(this.fire, Math.max(0, 1 - fd / 14) * 0.35);
    if (fd < 10 && Math.random() < dt * 6) this.noiseHit({ dur: 0.04, freq: 2500 + Math.random() * 2000, type: 'highpass', vol: 0.08 * (1 - fd / 10) });
    // water proximity (river / sea)
    const i = Math.floor(P.pos.z) * 2048 + Math.floor(P.pos.x);
    let wet = 0;
    for (const [ox, oz] of [[6, 0], [-6, 0], [0, 6], [0, -6], [12, 12], [-12, -12]]) if (g.world.water[i + oz * 2048 + ox] > 0) wet++;
    set(this.water, wet / 6 * 0.25);
    // birds by day, crickets at night, wolves howl at night
    this.chirpT -= dt;
    if (this.chirpT <= 0 && !g.indoor) {
      const night = g.isNight();
      if (!night && w.rain < 0.3 && g.biome !== 2) { this.chirpT = 0.6 + Math.random() * 3; this.bird(); }
      else if (night) { this.chirpT = 0.15 + Math.random() * 0.6; this.cricket(); if (Math.random() < 0.01) this.howl(); }
      else this.chirpT = 2;
      if (g.biome === 2 && Math.random() < 0.15) this.frog();
    }
  }

  bird() {
    const P = this.game.player;
    const pos = { x: P.pos.x + (Math.random() - 0.5) * 60, y: P.pos.y + 10, z: P.pos.z + (Math.random() - 0.5) * 60 };
    const base = 2200 + Math.random() * 1800;
    const n = 1 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) this.tone({ t: k * 0.11, dur: 0.08 + Math.random() * 0.05, freq: base * (0.9 + Math.random() * 0.25), to: base * (1.1 + Math.random() * 0.3), type: 'sine', vol: 0.05, pos });
  }
  cricket() {
    const P = this.game.player;
    const pos = { x: P.pos.x + (Math.random() - 0.5) * 30, y: P.pos.y, z: P.pos.z + (Math.random() - 0.5) * 30 };
    for (let k = 0; k < 3; k++) this.tone({ t: k * 0.05, dur: 0.03, freq: 4200 + Math.random() * 200, type: 'square', vol: 0.012, pos });
  }
  frog() { const P = this.game.player; const pos = { x: P.pos.x + (Math.random() - 0.5) * 30, y: P.pos.y, z: P.pos.z + (Math.random() - 0.5) * 30 }; this.tone({ dur: 0.18, freq: 180, to: 120, type: 'sawtooth', vol: 0.05, pos }); }
  howl() {
    const P = this.game.player;
    const pos = { x: P.pos.x + (Math.random() - 0.5) * 120, y: P.pos.y, z: P.pos.z + (Math.random() - 0.5) * 120 };
    this.tone({ dur: 2.4, freq: 380, to: 520, type: 'sine', vol: 0.12, pos, attack: 0.6 });
    this.tone({ t: 0.05, dur: 2.2, freq: 760, to: 1040, type: 'sine', vol: 0.03, pos, attack: 0.6 });
  }

  // ---------- effects ----------
  footstep(block, vol = 0.7, water = false) {
    if (water) { this.noiseHit({ dur: 0.18, freq: 900, type: 'bandpass', q: 0.8, vol: 0.25 * vol }); return; }
    const hard = [B.COBBLE, B.STONE, B.STONE_DARK, B.STONE_LIGHT, B.GRANITE, B.PLANKS, B.PLANKS_DARK, B.GRAVEL].includes(block);
    const wood = [B.PLANKS, B.PLANKS_DARK].includes(block);
    const snow = block === B.SNOW;
    this.noiseHit({ dur: wood ? 0.09 : hard ? 0.07 : 0.12, freq: wood ? 500 : hard ? 1800 : snow ? 1200 : 700, type: 'bandpass', q: hard ? 2 : 0.7, vol: 0.22 * vol, buf: hard ? this.noise : this.brown, sweep: 0.6 });
    if (wood) this.tone({ dur: 0.06, freq: 160, to: 90, type: 'triangle', vol: 0.08 * vol });
  }
  whoosh(pos, s = 1) { this.noiseHit({ dur: 0.22 * s, freq: 500, type: 'bandpass', q: 1.2, vol: 0.3 * s, pos, sweep: 3.5, attack: 0.06 }); }
  hit(heavy) {
    this.noiseHit({ dur: 0.12, freq: 260, type: 'lowpass', vol: heavy ? 0.9 : 0.6, buf: this.brown });
    this.tone({ dur: 0.12, freq: heavy ? 110 : 150, to: 50, type: 'triangle', vol: heavy ? 0.5 : 0.35 });
    this.noiseHit({ dur: 0.05, freq: 3000, type: 'highpass', vol: 0.12 });
  }
  clang(pos, s = 1) {
    const base = 1200 + Math.random() * 600;
    for (const [m, v] of [[1, 0.25], [2.76, 0.12], [5.4, 0.06]]) this.tone({ dur: 0.5 * s, freq: base * m, type: 'sine', vol: v * s, pos, attack: 0.002 });
    this.noiseHit({ dur: 0.06, freq: 4000, type: 'highpass', vol: 0.3 * s, pos });
  }
  charge() { this.tone({ dur: 0.4, freq: 180, to: 320, type: 'sawtooth', vol: 0.05 }); }
  sheathe() { this.noiseHit({ dur: 0.25, freq: 3000, type: 'bandpass', q: 4, vol: 0.12, sweep: 1.6, attack: 0.05 }); }
  cloth() { this.noiseHit({ dur: 0.2, freq: 800, type: 'bandpass', q: 0.6, vol: 0.18, buf: this.brown }); }
  ui(kind) {
    if (kind === 'click') this.tone({ dur: 0.05, freq: 900, type: 'triangle', vol: 0.06 });
    else if (kind === 'open' || kind === 'page') this.noiseHit({ dur: 0.25, freq: 2200, type: 'bandpass', q: 0.5, vol: 0.1, sweep: 0.5, attack: 0.04 });
    else if (kind === 'close') this.noiseHit({ dur: 0.15, freq: 1500, type: 'bandpass', q: 0.5, vol: 0.07 });
    else if (kind === 'deny') this.tone({ dur: 0.15, freq: 160, type: 'square', vol: 0.05 });
  }
  coins() { for (let k = 0; k < 4; k++) this.tone({ t: k * 0.045 + Math.random() * 0.02, dur: 0.12, freq: 2400 + Math.random() * 1600, type: 'sine', vol: 0.06 }); }
  pickup() { this.tone({ dur: 0.08, freq: 700, to: 1100, type: 'triangle', vol: 0.05 }); }
  chest() { this.tone({ dur: 0.35, freq: 140, to: 90, type: 'sawtooth', vol: 0.05 }); this.noiseHit({ dur: 0.3, freq: 400, vol: 0.15, buf: this.brown }); }
  door(open) { this.tone({ dur: 0.5, freq: open ? 260 : 220, to: open ? 340 : 180, type: 'sawtooth', vol: 0.025 }); this.noiseHit({ t: open ? 0 : 0.35, dur: 0.12, freq: 200, type: 'lowpass', vol: open ? 0.05 : 0.2, buf: this.brown }); }
  harvest() { this.noiseHit({ dur: 0.18, freq: 1800, type: 'bandpass', q: 0.8, vol: 0.15 }); }
  craft() { this.noiseHit({ dur: 0.4, freq: 600, type: 'bandpass', vol: 0.15, buf: this.brown }); this.tone({ t: 0.3, dur: 0.3, freq: 660, to: 880, type: 'triangle', vol: 0.05 }); }
  consume(food) { for (let k = 0; k < 3; k++) this.noiseHit({ t: k * 0.18, dur: 0.1, freq: food ? 900 : 500, type: 'bandpass', vol: 0.15, buf: this.brown }); }
  levelUp() { [523, 659, 784].forEach((f, k) => this.tone({ t: k * 0.12, dur: 0.6, freq: f, type: 'triangle', vol: 0.07 })); }
  quest(upd, done) { const seq = done ? [392, 523, 659] : upd ? [440, 554] : [330, 440]; seq.forEach((f, k) => this.tone({ t: k * 0.14, dur: 0.7, freq: f, type: 'sine', vol: 0.06, attack: 0.03 })); }
  discover() { [294, 392].forEach((f, k) => this.tone({ t: k * 0.25, dur: 1.2, freq: f, type: 'sine', vol: 0.05, attack: 0.1 })); }
  death() { this.tone({ dur: 2.5, freq: 110, to: 55, type: 'sine', vol: 0.2, attack: 0.05 }); }
  victory() { [262, 330, 392, 523].forEach((f, k) => this.tone({ t: k * 0.12, dur: 0.9, freq: f, type: 'triangle', vol: 0.06 })); }
  hurtPlayer() { this.noiseHit({ dur: 0.15, freq: 300, type: 'lowpass', vol: 0.5, buf: this.brown }); this.tone({ dur: 0.18, freq: 180, to: 120, type: 'sawtooth', vol: 0.06 }); }
  cough() { for (let k = 0; k < 3; k++) this.noiseHit({ t: k * 0.22, dur: 0.16, freq: 700, type: 'bandpass', q: 1.5, vol: 0.25, attack: 0.01 }); }
  breath() { this.noiseHit({ dur: 0.9, freq: 900, type: 'bandpass', q: 0.6, vol: 0.18, attack: 0.3 }); }
  battleCry() { this.tone({ dur: 0.9, freq: 150, to: 120, type: 'sawtooth', vol: 0.18, attack: 0.05 }); this.noiseHit({ dur: 0.9, freq: 500, type: 'bandpass', vol: 0.3, attack: 0.05 }); }
  bowDraw() { this.tone({ dur: 0.6, freq: 120, to: 200, type: 'sawtooth', vol: 0.025, attack: 0.2 }); }
  bowShot(pos) { this.tone({ dur: 0.15, freq: 180, to: 90, type: 'triangle', vol: 0.2, pos }); this.noiseHit({ dur: 0.2, freq: 1500, vol: 0.12, pos, sweep: 0.4 }); }
  thud(pos) { this.noiseHit({ dur: 0.08, freq: 400, type: 'lowpass', vol: 0.3, pos, buf: this.brown }); }
  fireBurst(pos) { this.noiseHit({ dur: 0.8, freq: 600, type: 'lowpass', vol: 0.8, pos, buf: this.brown, attack: 0.01 }); }
  slam(pos) { this.noiseHit({ dur: 0.7, freq: 150, type: 'lowpass', vol: 1, pos, buf: this.brown }); this.tone({ dur: 0.6, freq: 70, to: 35, type: 'sine', vol: 0.6, pos }); }
  telegraph(pos) { this.tone({ dur: 0.25, freq: 1400, to: 2200, type: 'sine', vol: 0.12, pos }); }
  thunder() { this.noiseHit({ dur: 3.5, freq: 120, type: 'lowpass', vol: 0.9, buf: this.brown, attack: 0.08 }); this.noiseHit({ t: 0.1, dur: 2.2, freq: 300, type: 'lowpass', vol: 0.4, buf: this.brown, attack: 0.2 }); }
  creature(kind, ev, pos) {
    if (!this.ctx) return;
    switch (kind) {
      case 'wolf':
        if (ev === 'alert' || ev === 'attack') this.tone({ dur: 0.35, freq: 220, to: 160, type: 'sawtooth', vol: 0.12, pos });
        if (ev === 'hurt') this.tone({ dur: 0.25, freq: 900, to: 500, type: 'sine', vol: 0.15, pos });
        if (ev === 'die') this.tone({ dur: 0.7, freq: 700, to: 200, type: 'sine', vol: 0.15, pos });
        break;
      case 'bear':
        if (ev === 'roar' || ev === 'alert') { this.tone({ dur: 1.4, freq: 110, to: 70, type: 'sawtooth', vol: 0.4, pos, attack: 0.1 }); this.noiseHit({ dur: 1.3, freq: 300, type: 'lowpass', vol: 0.5, pos, buf: this.brown, attack: 0.1 }); }
        if (ev === 'attack') this.noiseHit({ dur: 0.4, freq: 250, type: 'lowpass', vol: 0.5, pos, buf: this.brown });
        if (ev === 'hurt' || ev === 'die') this.tone({ dur: 0.6, freq: 160, to: 90, type: 'sawtooth', vol: 0.3, pos });
        break;
      case 'boar':
        this.tone({ dur: 0.3, freq: ev === 'hurt' ? 700 : 260, to: ev === 'hurt' ? 400 : 180, type: 'sawtooth', vol: 0.12, pos });
        break;
      case 'rat': this.tone({ dur: 0.1, freq: 2400, to: 1800, type: 'square', vol: 0.04, pos }); break;
      case 'crow': this.tone({ dur: 0.18, freq: 700, to: 500, type: 'sawtooth', vol: 0.08, pos }); if (ev === 'flee') this.noiseHit({ dur: 0.4, freq: 900, vol: 0.12, pos }); break;
      case 'chicken': this.tone({ dur: 0.12, freq: 900, to: 700, type: 'square', vol: 0.03, pos }); break;
      case 'sheep': this.tone({ dur: 0.5, freq: 340, to: 300, type: 'sawtooth', vol: 0.04, pos, attack: 0.05 }); break;
      case 'cow': this.tone({ dur: 0.9, freq: 140, to: 120, type: 'sawtooth', vol: 0.05, pos, attack: 0.1 }); break;
      case 'deer': case 'rabbit': case 'goat': if (ev === 'flee') this.noiseHit({ dur: 0.3, freq: 600, vol: 0.12, pos, buf: this.brown }); break;
      default: // humans
        if (ev === 'hurt') this.tone({ dur: 0.18, freq: 200 + Math.random() * 60, to: 140, type: 'sawtooth', vol: 0.08, pos });
        if (ev === 'die') this.tone({ dur: 0.6, freq: 180, to: 80, type: 'sawtooth', vol: 0.1, pos });
        if (ev === 'attack') this.noiseHit({ dur: 0.15, freq: 400, type: 'bandpass', vol: 0.1, pos, buf: this.brown });
    }
  }
  voice(actor, text) {
    if (!this.ctx || !actor || !actor.pos) return;
    // a soft murmur of syllables rather than speech
    const n = Math.min(6, 2 + Math.floor(text.length / 40));
    const base = actor.npc && actor.npc.app && actor.npc.app.female ? 210 : actor.npc && actor.npc.app && actor.npc.app.scale < 0.8 ? 280 : 120;
    for (let k = 0; k < n; k++) this.tone({ t: k * 0.11, dur: 0.1, freq: base * (0.85 + Math.random() * 0.35), type: 'triangle', vol: 0.025, pos: actor.pos, attack: 0.02 });
  }
}
