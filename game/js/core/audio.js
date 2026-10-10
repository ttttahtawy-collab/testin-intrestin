// Procedural sound effects via the Web Audio API. No audio files needed:
// every effect is synthesised from oscillators, envelopes and noise.
(function (G) {
  'use strict';
  const A = (G.Audio = {
    ctx: null, master: null, sfxBus: null, musicBus: null, noiseBuf: null,
    unlocked: false, _lastPlay: {},
  });

  A.init = function () {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      A.ctx = new AC();
    } catch (e) { A.ctx = null; return; }
    const c = A.ctx;
    A.master = c.createGain();
    A.master.gain.value = 0.9;
    // Gentle limiter so stacked effects never clip harshly.
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 12; comp.ratio.value = 6;
    comp.attack.value = 0.003; comp.release.value = 0.2;
    A.master.connect(comp); comp.connect(c.destination);
    A.sfxBus = c.createGain(); A.sfxBus.connect(A.master);
    A.musicBus = c.createGain(); A.musicBus.connect(A.master);
    // 1 second of white noise, reused by every noisy effect.
    const len = c.sampleRate;
    A.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = A.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A.applyVolumes();
    document.addEventListener('visibilitychange', () => {
      if (!A.ctx) return;
      if (document.hidden) A.ctx.suspend();
      else if (A.unlocked) A.ctx.resume();
    });
  };

  A.unlock = function () {
    if (!A.ctx) return;
    if (A.ctx.state !== 'running') A.ctx.resume();
    A.unlocked = true;
  };

  A.applyVolumes = function () {
    if (!A.ctx) return;
    const o = G.Save ? G.Save.options : { music: 0.6, sfx: 0.8 };
    A.sfxBus.gain.value = o.sfx * 0.9;
    A.musicBus.gain.value = o.music * 0.55;
  };

  // --- building blocks -------------------------------------------------
  function env(g, t, a, peak, d, sustain, r) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + d);
    if (r) g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + r);
  }
  // Tone with pitch sweep.
  function tone(opts) {
    const c = A.ctx, t = (opts.at || c.currentTime) + (opts.delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = opts.type || 'square';
    o.frequency.setValueAtTime(opts.f0, t);
    if (opts.f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.f1), t + (opts.sweep || opts.dur));
    if (opts.vib) {
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = opts.vib; lg.gain.value = opts.vibDepth || 20;
      l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + opts.dur + 0.05);
    }
    let node = o;
    if (opts.lp) {
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp;
      o.connect(f); node = f;
    }
    node.connect(g);
    g.connect(opts.bus || A.sfxBus);
    env(g, t, opts.a || 0.005, opts.vol || 0.2, opts.dur, 0.0001, 0);
    o.start(t);
    o.stop(t + opts.dur + 0.05);
  }
  function noise(opts) {
    const c = A.ctx, t = (opts.at || c.currentTime) + (opts.delay || 0);
    const s = c.createBufferSource(); s.buffer = A.noiseBuf;
    s.playbackRate.value = opts.rate || 1;
    const f = c.createBiquadFilter();
    f.type = opts.filter || 'lowpass';
    f.frequency.setValueAtTime(opts.f0 || 1000, t);
    if (opts.f1) f.frequency.exponentialRampToValueAtTime(opts.f1, t + opts.dur);
    f.Q.value = opts.q || 1;
    const g = c.createGain();
    s.connect(f); f.connect(g); g.connect(opts.bus || A.sfxBus);
    env(g, t, opts.a || 0.002, opts.vol || 0.2, opts.dur, 0.0001, 0);
    s.start(t, Math.random() * 0.5);
    s.stop(t + opts.dur + 0.05);
  }
  A.tone = tone; A.noise = noise;

  const N = (semi) => 440 * Math.pow(2, (semi - 9) / 12); // semitone from C4

  const SFX = {
    jump: () => tone({ type: 'square', f0: 280, f1: 620, dur: 0.13, vol: 0.09, lp: 2600 }),
    djump: () => {
      tone({ type: 'triangle', f0: 520, f1: 1150, dur: 0.16, vol: 0.16 });
      tone({ type: 'sine', f0: 1500, f1: 2300, dur: 0.12, vol: 0.05, delay: 0.04 });
    },
    walljump: () => {
      tone({ type: 'square', f0: 360, f1: 760, dur: 0.12, vol: 0.08, lp: 2400 });
      noise({ f0: 3000, filter: 'bandpass', dur: 0.06, vol: 0.08 });
    },
    land: () => noise({ f0: 500, f1: 120, dur: 0.08, vol: 0.18 }),
    step: () => noise({ f0: 900, filter: 'bandpass', q: 2, dur: 0.03, vol: 0.035 }),
    slide: () => noise({ f0: 2500, filter: 'bandpass', q: 3, dur: 0.06, vol: 0.025 }),
    gem: () => {
      const p = 1 + Math.random() * 0.06;
      tone({ type: 'sine', f0: 1318 * p, dur: 0.07, vol: 0.12 });
      tone({ type: 'sine', f0: 1976 * p, dur: 0.16, vol: 0.12, delay: 0.06 });
    },
    shard: () => {
      [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone({ type: 'triangle', f0: N(s + 12), dur: 0.22, vol: 0.12, delay: i * 0.055 }));
      tone({ type: 'sine', f0: N(36), dur: 0.6, vol: 0.05, delay: 0.35, vib: 6, vibDepth: 15 });
    },
    heart: () => [0, 4, 7, 12].forEach((s, i) => tone({ type: 'sine', f0: N(s + 7), dur: 0.15, vol: 0.14, delay: i * 0.06 })),
    punch: () => {
      noise({ f0: 1800, f1: 400, filter: 'bandpass', q: 0.8, dur: 0.09, vol: 0.16 });
      tone({ type: 'sine', f0: 240, f1: 90, dur: 0.08, vol: 0.12 });
    },
    whiff: () => noise({ f0: 1200, f1: 3000, filter: 'bandpass', q: 1.5, dur: 0.08, vol: 0.06 }),
    hit: () => {
      tone({ type: 'square', f0: 320, f1: 120, dur: 0.1, vol: 0.12, lp: 1800 });
      noise({ f0: 2000, f1: 300, dur: 0.1, vol: 0.14 });
    },
    stomp: () => {
      tone({ type: 'sine', f0: 420, f1: 140, dur: 0.14, vol: 0.2 });
      noise({ f0: 900, f1: 200, dur: 0.07, vol: 0.12 });
    },
    pop: () => {
      tone({ type: 'sine', f0: 800, f1: 200, dur: 0.1, vol: 0.16 });
      [0, 7, 12].forEach((s, i) => tone({ type: 'triangle', f0: N(s + 24), dur: 0.08, vol: 0.06, delay: 0.05 + i * 0.04 }));
    },
    hurt: () => {
      tone({ type: 'sawtooth', f0: 520, f1: 160, dur: 0.28, vol: 0.12, lp: 2000, vib: 30, vibDepth: 40 });
      noise({ f0: 1500, f1: 200, dur: 0.15, vol: 0.1 });
    },
    die: () => [12, 7, 3, 0, -5].forEach((s, i) => tone({ type: 'square', f0: N(s), dur: 0.16, vol: 0.09, delay: i * 0.11, lp: 1600 })),
    spring: () => tone({ type: 'sine', f0: 180, f1: 900, dur: 0.25, vol: 0.2, vib: 22, vibDepth: 60 }),
    poundStart: () => tone({ type: 'triangle', f0: 900, f1: 300, dur: 0.12, vol: 0.08 }),
    pound: () => {
      tone({ type: 'sine', f0: 140, f1: 35, dur: 0.3, vol: 0.32 });
      noise({ f0: 700, f1: 80, dur: 0.3, vol: 0.22 });
    },
    dash: () => noise({ f0: 600, f1: 4000, filter: 'bandpass', q: 1.2, dur: 0.16, vol: 0.14 }),
    checkpoint: () => [0, 7, 12, 16].forEach((s, i) => tone({ type: 'triangle', f0: N(s + 12), dur: 0.3, vol: 0.1, delay: i * 0.08 })),
    menuMove: () => tone({ type: 'triangle', f0: 880, dur: 0.05, vol: 0.08 }),
    menuSelect: () => { tone({ type: 'triangle', f0: 660, dur: 0.06, vol: 0.1 }); tone({ type: 'triangle', f0: 1320, dur: 0.1, vol: 0.1, delay: 0.06 }); },
    menuBack: () => { tone({ type: 'triangle', f0: 700, dur: 0.06, vol: 0.08 }); tone({ type: 'triangle', f0: 440, dur: 0.08, vol: 0.08, delay: 0.05 }); },
    deny: () => tone({ type: 'square', f0: 160, dur: 0.15, vol: 0.08, lp: 900 }),
    buy: () => [0, 4, 7, 11, 14].forEach((s, i) => tone({ type: 'sine', f0: N(s + 12), dur: 0.14, vol: 0.12, delay: i * 0.05 })),
    shoot: () => tone({ type: 'square', f0: 900, f1: 300, dur: 0.12, vol: 0.06, lp: 2500 }),
    crumble: () => noise({ f0: 600, f1: 150, dur: 0.25, vol: 0.12, rate: 0.6 }),
    break: () => { noise({ f0: 1400, f1: 200, dur: 0.22, vol: 0.2 }); tone({ type: 'square', f0: 200, f1: 70, dur: 0.12, vol: 0.08, lp: 900 }); },
    bossHit: () => {
      tone({ type: 'sawtooth', f0: 300, f1: 70, dur: 0.25, vol: 0.18, lp: 1400 });
      noise({ f0: 3000, f1: 200, dur: 0.22, vol: 0.2 });
    },
    roar: () => {
      tone({ type: 'sawtooth', f0: 110, f1: 70, dur: 0.9, vol: 0.18, lp: 700, vib: 9, vibDepth: 12 });
      noise({ f0: 500, f1: 200, dur: 0.9, vol: 0.12 });
    },
    boom: () => {
      tone({ type: 'sine', f0: 110, f1: 30, dur: 0.7, vol: 0.35 });
      noise({ f0: 1200, f1: 60, dur: 0.8, vol: 0.3 });
    },
    warn: () => { tone({ type: 'square', f0: 660, dur: 0.08, vol: 0.06, lp: 2000 }); tone({ type: 'square', f0: 660, dur: 0.08, vol: 0.06, lp: 2000, delay: 0.12 }); },
    laser: () => tone({ type: 'sawtooth', f0: 1200, f1: 200, dur: 0.5, vol: 0.08, lp: 3000, vib: 40, vibDepth: 80 }),
    wind: () => noise({ f0: 400, f1: 1600, filter: 'bandpass', q: 0.7, dur: 0.8, vol: 0.12, a: 0.2 }),
    text: () => tone({ type: 'triangle', f0: 600 + Math.random() * 200, dur: 0.03, vol: 0.035 }),
    victory: () => {
      const seq = [0, 4, 7, 12, 7, 12, 16, 19, 24];
      seq.forEach((s, i) => tone({ type: i % 2 ? 'triangle' : 'square', f0: N(s + 12), dur: 0.18, vol: 0.08, delay: i * 0.09, lp: 3000 }));
    },
    unlock: () => [0, 5, 9, 12, 17].forEach((s, i) => tone({ type: 'triangle', f0: N(s + 12), dur: 0.2, vol: 0.1, delay: i * 0.07 })),
    respawn: () => [0, 7, 12].forEach((s, i) => tone({ type: 'sine', f0: N(s + 12), dur: 0.15, vol: 0.1, delay: i * 0.06 })),
  };

  // Rate-limited play so 20 gems collected on the same frame don't explode.
  A.play = function (name) {
    if (!A.ctx || !A.unlocked || A.ctx.state !== 'running') return;
    const f = SFX[name];
    if (!f) return;
    const now = A.ctx.currentTime;
    if (A._lastPlay[name] && now - A._lastPlay[name] < 0.03) return;
    A._lastPlay[name] = now;
    try { f(); } catch (e) { /* audio failures must never break the game */ }
  };
  A.has = (name) => !!SFX[name];
})(window.G);
