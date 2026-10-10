// Procedural chiptune-ish music sequencer. Each track is a small description
// (tempo, key, mode, chord progressions, instrumentation); melodies are
// composed deterministically from a seed so every track always sounds the same.
(function (G) {
  'use strict';
  const U = G.U;
  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11],
    lydian: [0, 2, 4, 6, 7, 9, 11],
  };
  const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  const RHYTHMS = [
    [[0, 2], [2, 2], [4, 4], [8, 2], [10, 2], [12, 4]],
    [[0, 3], [3, 3], [6, 2], [8, 4], [12, 2], [14, 2]],
    [[0, 4], [4, 2], [6, 2], [8, 6], [14, 2]],
    [[0, 2], [2, 1], [3, 1], [4, 2], [6, 2], [8, 2], [10, 2], [12, 2], [14, 2]],
    [[0, 6], [6, 2], [8, 8]],
    [[2, 2], [4, 2], [6, 2], [8, 4], [12, 4]],
    [[0, 2], [4, 2], [6, 2], [8, 2], [10, 4], [14, 2]],
  ];

  const TRACKS = {
    title: { bpm: 92, key: 0, mode: 'major', A: [0, 4, 5, 3], B: [5, 3, 0, 4], lead: 'triangle', drums: 'soft', bass: 'pulse', arp: true, pad: 0.05, seed: 11, density: 0.5 },
    overworld: { bpm: 112, key: 7, mode: 'major', A: [0, 5, 3, 4], B: [3, 4, 2, 5], lead: 'square', drums: 'pop', bass: 'bounce', arp: true, pad: 0.035, seed: 23 },
    w1: { bpm: 128, key: 5, mode: 'major', A: [0, 3, 4, 0], B: [5, 3, 1, 4], lead: 'square', drums: 'pop', bass: 'bounce', arp: false, pad: 0.035, seed: 101 },
    w2: { bpm: 104, key: 9, mode: 'minor', A: [0, 5, 2, 6], B: [3, 0, 4, 4], lead: 'triangle', drums: 'sparse', bass: 'pulse', arp: true, pad: 0.06, seed: 202, echo: true },
    w3: { bpm: 138, key: 2, mode: 'dorian', A: [0, 3, 0, 6], B: [5, 6, 0, 0], lead: 'square', drums: 'drive', bass: 'drive', arp: true, pad: 0.03, seed: 303 },
    w4: { bpm: 146, key: 4, mode: 'harmonic', A: [0, 5, 3, 4], B: [0, 6, 5, 4], lead: 'sawtooth', drums: 'drive', bass: 'drive', arp: true, pad: 0.04, seed: 404 },
    boss: { bpm: 158, key: 9, mode: 'harmonic', A: [0, 0, 5, 4], B: [3, 4, 0, 4], lead: 'sawtooth', drums: 'heavy', bass: 'drive', arp: true, pad: 0.03, seed: 505 },
    final: { bpm: 166, key: 11, mode: 'harmonic', A: [0, 5, 1, 4], B: [3, 5, 4, 4], lead: 'sawtooth', drums: 'heavy', bass: 'drive', arp: true, pad: 0.045, seed: 606 },
    ending: { bpm: 84, key: 0, mode: 'lydian', A: [0, 1, 0, 1], B: [5, 3, 4, 0], lead: 'triangle', drums: 'soft', bass: 'pulse', arp: true, pad: 0.07, seed: 707, echo: true },
    story: { bpm: 76, key: 2, mode: 'minor', A: [0, 5, 3, 4], B: [5, 6, 0, 4], lead: 'triangle', drums: 'none', bass: 'pulse', arp: true, pad: 0.07, seed: 808, echo: true },
  };

  const DRUMS = {
    none: { k: '', s: '', h: '' },
    soft: { k: 'x.......x.......', s: '........x.......', h: '..x...x...x...x.' },
    pop: { k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xo' },
    sparse: { k: 'x.........x.....', s: '........x.......', h: '....x.......x..x' },
    drive: { k: 'x...x...x...x...', s: '....x.......x..x', h: '.xx..xx..xx..xxo' },
    heavy: { k: 'x.x...x.x.x...x.', s: '....x.......x.xx', h: 'xxxxxxxxxxxxxxxx' },
  };

  function compose(def) {
    const rng = U.rng(def.seed);
    const scale = SCALES[def.mode];
    const chordTones = (deg) => [deg, deg + 2, deg + 4];
    let prev = 9; // scale index for melody (approx 1.5 octaves above key)
    const lo = 5, hi = 15;
    function bar(deg, cadence) {
      const notes = [];
      const r = cadence ? [[0, 4], [4, 4], [8, 8]] : RHYTHMS[Math.floor(rng() * RHYTHMS.length)];
      r.forEach(([st, len], i) => {
        let p;
        const last = cadence && i === r.length - 1;
        if (st % 4 === 0 || last) {
          // land on a chord tone close to the previous pitch
          const cands = [];
          chordTones(deg).forEach((t) => { for (let o = -7; o <= 14; o += 7) cands.push(t + o + 7); });
          cands.sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev));
          p = last ? cands.find((c) => ((c % 7) + 7) % 7 === ((deg % 7) + 7) % 7) || cands[0] : cands[Math.floor(rng() * 2)];
        } else {
          const stepv = [-2, -1, -1, 1, 1, 2][Math.floor(rng() * 6)];
          p = prev + stepv;
        }
        p = U.clamp(p, lo, hi);
        prev = p;
        notes.push({ st, len, p });
      });
      return notes;
    }
    const secA = def.A.map((d, i) => bar(d, false));
    const secB = def.B.map((d, i) => bar(d, i === 3 && false));
    const secA2 = def.A.map((d, i) => (i === 3 ? bar(d, true) : secA[i]));
    const melody = secA.concat(secB, secA2, secB);
    const chords = def.A.concat(def.B, def.A, def.B);
    return { melody, chords, scale };
  }

  const M = (G.Music = { current: null, currentName: null, _timer: null });

  function semi(scale, idx) {
    const o = Math.floor(idx / 7), i = ((idx % 7) + 7) % 7;
    return scale[i] + 12 * o;
  }

  M.play = function (name) {
    const A = G.Audio;
    if (M.currentName === name) return;
    M.stop();
    M.currentName = name;
    const def = TRACKS[name];
    if (!def || !A.ctx) return;
    const song = compose(def);
    const gain = A.ctx.createGain();
    gain.gain.value = 0;
    gain.connect(A.musicBus);
    gain.gain.setTargetAtTime(1, A.ctx.currentTime, 0.4);
    const tr = { def, song, gain, step: 0, next: A.ctx.currentTime + 0.1, stepDur: 60 / def.bpm / 4 };
    M.current = tr;
    M._timer = setInterval(() => tick(tr), 25);
  };

  M.stop = function () {
    const A = G.Audio;
    if (M._timer) clearInterval(M._timer);
    M._timer = null;
    if (M.current && A.ctx) {
      const g = M.current.gain;
      g.gain.cancelScheduledValues(A.ctx.currentTime);
      g.gain.setTargetAtTime(0, A.ctx.currentTime, 0.12);
      setTimeout(() => { try { g.disconnect(); } catch (e) { /* noop */ } }, 1500);
    }
    M.current = null;
    M.currentName = null;
  };

  function tick(tr) {
    const A = G.Audio;
    if (!A.ctx || A.ctx.state !== 'running') { tr.next = A.ctx ? A.ctx.currentTime + 0.05 : 0; return; }
    if (tr.next < A.ctx.currentTime - 0.2) tr.next = A.ctx.currentTime + 0.05; // recovered from suspension
    while (tr.next < A.ctx.currentTime + 0.12) {
      schedule(tr, tr.step, tr.next);
      tr.next += tr.stepDur;
      tr.step = (tr.step + 1) % (16 * tr.song.chords.length);
    }
  }

  function pad(tr, freqs, t, dur, vol) {
    const c = G.Audio.ctx;
    const g = c.createGain();
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.5;
    f.connect(g); g.connect(tr.gain);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.25);
    g.gain.setValueAtTime(vol, t + dur - 0.2);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    freqs.forEach((fr) => {
      [-6, 6].forEach((det) => {
        const o = c.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = fr; o.detune.value = det;
        o.connect(f); o.start(t); o.stop(t + dur + 0.05);
      });
    });
  }

  function schedule(tr, step, t) {
    const A = G.Audio, d = tr.def, song = tr.song, bus = tr.gain;
    const barIdx = Math.floor(step / 16), s = step % 16;
    const deg = song.chords[barIdx];
    const sc = song.scale;
    const root = 48 + d.key; // C3 + key
    const chordMidi = [0, 2, 4].map((k) => root + semi(sc, deg + k));
    const sd = tr.stepDur;

    // Drums
    const dr = DRUMS[d.drums] || DRUMS.none;
    if (dr.k[s] === 'x') A.tone({ at: t, type: 'sine', f0: 150, f1: 42, sweep: 0.12, dur: 0.16, vol: 0.55, bus });
    if (dr.s[s] === 'x') {
      A.noise({ at: t, f0: 1900, filter: 'bandpass', q: 0.8, dur: 0.13, vol: 0.22, bus });
      A.tone({ at: t, type: 'triangle', f0: 210, f1: 140, dur: 0.07, vol: 0.12, bus });
    }
    if (dr.h[s] === 'x') A.noise({ at: t, f0: 7500, filter: 'highpass', dur: 0.03, vol: 0.06, bus });
    if (dr.h[s] === 'o') A.noise({ at: t, f0: 7000, filter: 'highpass', dur: 0.14, vol: 0.06, bus });

    // Bass
    const bRoot = chordMidi[0] - 12;
    let bn = null;
    if (d.bass === 'drive' && s % 2 === 0) bn = s % 8 === 6 ? bRoot + 12 : bRoot;
    else if (d.bass === 'bounce' && (s === 0 || s === 6 || s === 8 || s === 14)) bn = s === 8 ? bRoot + 7 : s === 14 ? bRoot + 12 : bRoot;
    else if (d.bass === 'pulse' && (s === 0 || s === 8 || s === 11)) bn = s === 11 ? bRoot + 7 : bRoot;
    if (bn !== null) A.tone({ at: t, type: 'triangle', f0: midiHz(bn), dur: sd * (d.bass === 'pulse' ? 4 : 1.8), vol: 0.32, bus });

    // Pad
    if (s === 0 && d.pad) pad(tr, chordMidi.map((m) => midiHz(m + 12)), t, sd * 16, d.pad);

    // Arpeggio
    if (d.arp && s % 2 === 1) {
      const n = chordMidi[(Math.floor(s / 2)) % 3] + 24;
      A.tone({ at: t, type: 'sine', f0: midiHz(n), dur: sd * 1.5, vol: 0.045, bus });
    }

    // Lead melody
    const bar = song.melody[barIdx];
    for (const n of bar) {
      if (n.st !== s) continue;
      const m = root + 12 + semi(sc, n.p);
      const dur = sd * n.len * 0.95;
      const vol = d.lead === 'sawtooth' ? 0.07 : d.lead === 'square' ? 0.075 : 0.14;
      A.tone({ at: t, type: d.lead, f0: midiHz(m), dur, vol, bus, lp: 3200, a: 0.01 });
      if (d.echo) A.tone({ at: t + sd * 3, type: d.lead, f0: midiHz(m), dur, vol: vol * 0.35, bus, lp: 2000 });
    }
  }
})(window.G);
