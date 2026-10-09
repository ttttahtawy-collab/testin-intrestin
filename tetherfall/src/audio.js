// Tiny synthesized sound effects (no audio files needed).
export class Sfx {
  constructor() {
    this.ctx = null;
    this.volume = 0.7;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // looping beds: wind (speed) and gas hiss (boost)
    this.wind = this.loop(400, 'lowpass', 0);
    this.gas = this.loop(3000, 'bandpass', 0);
  }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
  loop(freq, type, gain) {
    const src = this.ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
    return { f, g };
  }
  burst(dur, freq, type = 'bandpass', gain = 0.4, endFreq = freq) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource(); src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  tone(dur, freq, gain = 0.3, type = 'sine', endFreq = freq) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  hookFire() { this.burst(0.18, 2500, 'highpass', 0.25, 6000); this.tone(0.06, 900, 0.1, 'square', 300); }
  hookHit() { this.tone(0.12, 180, 0.35, 'triangle', 60); this.burst(0.08, 1200, 'bandpass', 0.2); }
  slash() { this.burst(0.2, 5000, 'bandpass', 0.35, 1200); }
  cut() { this.burst(0.3, 800, 'lowpass', 0.5, 100); this.tone(0.25, 140, 0.4, 'sawtooth', 50); }
  kill() { this.tone(0.9, 110, 0.5, 'sine', 35); this.tone(0.5, 660, 0.15, 'triangle', 880); this.burst(1.2, 600, 'lowpass', 0.4, 80); }
  hurt() { this.tone(0.25, 120, 0.5, 'square', 50); }
  pickup() { this.tone(0.15, 520, 0.2, 'triangle', 780); this.tone(0.2, 780, 0.15, 'triangle', 1040); }
  swap() { this.burst(0.1, 3000, 'highpass', 0.2); this.tone(0.08, 1400, 0.1, 'square', 1800); }
  stomp() { this.tone(0.3, 60, 0.35, 'sine', 30); }
  update(speed, boosting) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const w = Math.min(0.5, Math.max(0, (speed - 8) / 70));
    this.wind.g.gain.setTargetAtTime(w, t, 0.1);
    this.wind.f.frequency.setTargetAtTime(300 + speed * 18, t, 0.1);
    this.gas.g.gain.setTargetAtTime(boosting ? 0.18 : 0, t, 0.05);
  }
}
