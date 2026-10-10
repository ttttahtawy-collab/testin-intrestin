// Story chapters, the open world between them (bounties, incursions, a background
// director that keeps the frontier dangerous) and the endless Siege mode.
import * as THREE from 'three';
import { G, CX, CZ, WALLS, zoneOf } from './worldgen.js';
import { STATS } from './player.js';

const CHAPTERS = ['First Flight', 'The Day the Gate Fell', 'Hold Corvane', 'Beyond the Walls', 'Reclaim the Wall', 'Epilogue · The open frontier'];
const TOP = G + 44 + 1; // standing height on top of the great walls

export function createStory(game) {
  const S = {
    active: null, // running chapter
    steps: [], i: 0, acc: 0, d: {},
    noTravel: false,
    contract: null,
    incursion: null,
    dir: { t: 0, scoutT: 0, incT: 240 + Math.random() * 200 },
    siege: null,
  };
  const g = game;
  const info = () => g.info;
  const P = () => g.player;
  const gate = (id) => info().gates.find((q) => q.id === id);
  const town = (id) => info().towns.find((t) => t.id === id);
  const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const distP = (p) => Math.hypot(p.x - P().pos.x, (p.y ?? P().pos.y) - P().pos.y, p.z - P().pos.z);
  const say = (who, name, text, secs = 9) => g.say(who, name, text, secs);
  const NAMES = { holt: 'Sgt. Garrick Holt', varn: 'Capt. Aldous Varn', dorne: 'Cmdr. Edric Dorne', bram: 'Quartermaster Bram', osric: 'Clerk Osric', mattis: 'Chief Engineer Mattis', tobin: 'Tobin', kael: 'Kael' };
  const line = (who, text) => ({ who, name: NAMES[who], text });
  const alive = (list) => list.filter((t) => t.alive);
  const flags = () => g.save.flags;

  // ---------------- people placed in the world ----------------
  const spots = () => {
    const I = info();
    const cor = town('corvane'), mer = town('merrow');
    const tw = I.spawns.tharskWall, cw = I.spawns.corvaneWall;
    return {
      holt: { x: I.yard.x - 4, z: I.yard.z0 + 3, yaw: Math.PI },
      varn: { x: tw.x + 5, y: TOP, z: tw.z, yaw: Math.PI },
      dorneCorvane: { x: cw.x + 5, y: TOP, z: cw.z, yaw: Math.PI },
      dorneTharsk: { x: tw.x - 5, y: TOP, z: tw.z, yaw: Math.PI },
      mattis: { x: CX + 12, y: TOP, z: CZ + 639.5, yaw: 0 },
      bramC: { x: cor.plaza.x + 5, z: cor.plaza.z + 5 },
      bramM: { x: mer.plaza.x + 5, z: mer.plaza.z + 5 },
      bramCamp: { x: I.yard.x + 8, z: I.yard.z0 - 6 },
      osric: { x: cor.plaza.x - 5, z: cor.plaza.z + 5 },
    };
  };
  const TOWNSFOLK = [
    'They say the walls were raised in a single year. Nobody remembers how.',
    'My brother joined the Scout Regiment. I pray every time the bell rings.',
    'Titans don’t eat to live, you know. They just… eat people.',
    'The garrison drinks more than it drills. Don’t tell the captain I said so.',
    'Grain prices have doubled since the outer farms emptied out.',
    'You’re one of those rig fliers? Mind the chimneys, lad.',
    'I saw a titan once, from the top of the wall. It smiled at me.',
    'Merchants won’t take the south road any more. Not past the forest.',
  ];
  function placeCommonTalkers() {
    const sp = spots();
    const bram = (p) => g.addTalker({ ...p, name: NAMES.bram, role: 'Upgrades', portrait: 'bram', outfit: 'engineer', lines: () => [line('bram', `Marks buy steel, lad. You’ve got <b>${g.save.marks}</b>. Let’s see what fits your rig.`)], after: () => g.openShop() });
    bram(sp.bramC); bram(sp.bramM); bram(sp.bramCamp);
    g.addTalker({ ...sp.osric, name: NAMES.osric, role: 'Bounties', portrait: 'osric', outfit: 'civilian', quest: () => !S.contract && S.active === null, lines: () => contractLines(), after: () => { if (S.offer) acceptContract(S.offer); } });
    const cor = town('corvane'), mer = town('merrow');
    const folks = [[mer.plaza.x - 9, mer.plaza.z - 6], [mer.plaza.x + 10, mer.plaza.z - 9], [mer.plaza.x - 3, mer.plaza.z + 12], [cor.plaza.x + 2, cor.plaza.z - 10]];
    if (g.save.chapter >= 5) { const th = town('tharsk'); folks.push([th.plaza.x + 8, th.plaza.z - 4]); }
    folks.forEach(([x, z], k) => g.addTalker({ x, z, name: ['Old Harlan', 'Wendel the baker', 'Pieter', 'Gus the carter', 'Rolf'][k], role: 'Townsman', portrait: k % 2 ? 'townsman' : 'elder', outfit: 'civilian', lines: () => [{ who: k % 2 ? 'townsman' : 'elder', text: TOWNSFOLK[(k * 3 + Math.floor(g.time / 30)) % TOWNSFOLK.length] }] }));
  }
  function placeHolt() {
    g.addTalker({ ...spots().holt, name: NAMES.holt, role: 'Drill instructor', portrait: 'holt', outfit: 'officer', lines: () => [
      line('holt', 'Still breathing? Good. Remember: <b>T</b> locks a titan, <b>X</b> sends you at its nape. From behind, always from behind.'),
      line('holt', 'Hit a wall and the rig will try to slide you along it — but the ground still breaks bones. <b>G</b> brakes.'),
    ] });
  }

  // ---------------- world state that follows the story ----------------
  function applyWorldState(ch) {
    const sm = g.smash;
    const fallen = ch >= 2 && ch < 5;
    if (fallen) {
      g.quiet = true;
      for (const id of ['tharskS', 'outerS']) {
        const q = gate(id);
        sm.bashWall({ x: q.x, y: G + 9, z: q.z }, 9, null, true);
      }
      g.quiet = false;
      for (const id of ['tharsk', 'hollowford', 'ashby', 'kettle', 'fenmoor']) town(id).civilians = 0;
    }
    if (ch >= 5) town('tharsk').civilians = 20;
  }
  const fallenOuter = () => g.save.chapter >= 2 && g.save.chapter < 5 && !S.siege;

  // ---------------- chapters ----------------
  // Each step: text [who, line] | enter() | tick(dt) | obj() | check() | beacon() | fail()
  function chapterSteps(ch) {
    const I = info();
    if (ch === 0) {
      const tut = S.d;
      return [
        {
          enter: () => { say('holt', NAMES.holt, 'On your feet, cadet. This is the Tether Rig — two anchors, a tank of gas and a pair of blades. Walk to the yellow beacon in the yard with <b>WASD</b>.'); },
          beacon: () => ({ x: I.yard.x, y: G + 1, z: I.yard.z0 + 6 }),
          obj: () => `Reach the beacon · ${Math.round(distP({ x: I.yard.x, z: I.yard.z0 + 6 }))} m`,
          check: () => distP({ x: I.yard.x, y: G + 1, z: I.yard.z0 + 6 }) < 4,
        },
        {
          enter: () => say('holt', NAMES.holt, 'Left anchor: <b>hold LEFT MOUSE</b> at a post or a tree. If you aim a little off, the rig finds the nearest surface for you. Hang on and stay off the ground.'),
          obj: () => `Left anchor ${P().hooks[0].attached ? '✓' : '✗'} · air time ${S.acc.toFixed(1)} / 3.0 s`,
          tick: (dt) => { if (P().hooks[0].attached && !P().onGround) S.acc += dt; },
          check: () => S.acc >= 3,
        },
        {
          enter: () => say('holt', NAMES.holt, 'Right anchor: <b>hold RIGHT MOUSE</b>. Let one go, fire the other — swing like a pendulum.'),
          obj: () => `Right anchor ${P().hooks[1].attached ? '✓' : '✗'} · air time ${S.acc.toFixed(1)} / 3.0 s`,
          tick: (dt) => { if (P().hooks[1].attached && !P().onGround) S.acc += dt; },
          check: () => S.acc >= 3,
        },
        {
          enter: () => say('holt', NAMES.holt, 'Hold <b>SPACE</b> in the air to fire your gas jets along your aim. The new tanks last — but they don’t last forever.'),
          obj: () => `Gas boost ${S.acc.toFixed(1)} / 1.5 s`,
          tick: (dt) => { if (P().boosting) S.acc += dt; },
          check: () => S.acc >= 1.5,
        },
        {
          enter: () => say('holt', NAMES.holt, 'Hold <b>SHIFT</b> while anchored to reel in hard. If you fly at a wall, the rig slides you along it — unless you’re reeling.'),
          obj: () => `Reel in ${S.acc.toFixed(1)} / 1.0 s`,
          tick: (dt) => { if (P().reeling) S.acc += dt; },
          check: () => S.acc >= 1,
        },
        {
          enter: () => say('holt', NAMES.holt, 'The ground is the one thing you can’t cut. Hold <b>G</b> for the landing thrusters and touch down in the yard.'),
          beacon: () => I.yard,
          obj: () => `Land in the training yard · ${Math.round(distP(I.yard))} m`,
          check: () => P().onGround && P().pos.x > I.yard.x0 && P().pos.x < I.yard.x1 && P().pos.z > I.yard.z0 && P().pos.z < I.yard.z1,
        },
        {
          enter: () => { spawnDummy(); say('holt', NAMES.holt, 'The dummy. Every titan hides its <b>core</b> at the back of the neck. Get behind it and press <b>F</b>. Faster means deeper.'); },
          obj: () => 'Cut the dummy’s core (F)',
          check: () => !tut.dummy || !tut.dummy.alive,
        },
        {
          enter: () => { tut.strikeKill = false; spawnDummy(); say('holt', NAMES.holt, 'Now the trick that keeps scouts alive: press <b>T</b> to lock on, and when the prompt shows, press <b>X</b> — a <b>Nape Strike</b>. The rig fires both anchors and throws you at the neck. Behind is safe. In front, it will catch you.', 14); },
          obj: () => 'Lock on (T) and Nape Strike (X) the dummy',
          check: () => tut.strikeKill,
          tick: () => { if (tut.dummy && tut.dummy.removed && !tut.strikeKill) spawnDummy(); },
        },
        {
          enter: () => { g.swappedOnce = false; say('holt', NAMES.holt, 'Every cut dulls your blades. Press <b>R</b> to swap in a fresh pair.'); S.d.sharp = P().spares; },
          obj: () => 'Swap blades (R)',
          check: () => P().spares < S.d.sharp,
        },
        {
          enter: () => say('holt', NAMES.holt, 'Green beacons are depots. Press <b>E</b> at one to refill gas and blades. Inside the walls, press <b>U</b> there to spend marks on upgrades.'),
          beacon: () => I.depots.find((d) => d.name === 'Cadet camp depot'),
          obj: () => 'Resupply at the camp depot (E)',
          check: () => S.acc > 0,
          tick: () => {},
          onResupply: () => { S.acc = 1; },
        },
        {
          enter: () => {
            say('holt', NAMES.holt, 'Final exam. We caught a live one last month and kept it chained in the pit — <b>it just broke loose</b>. It is not a dummy. Kill it, cadet!', 12);
            g.sfx.roar(1);
            tut.exam = g.spawnTitan('pure', I.yard.x + 46, I.yard.z + 10, 9);
            tut.exam.yaw = -Math.PI / 2;
          },
          beacon: () => (tut.exam && tut.exam.alive ? tut.exam.pos : null),
          obj: () => `Fell the escaped titan · ${tut.exam && tut.exam.alive ? Math.round(dist2(tut.exam.pos, P().pos)) + ' m' : ''}`,
          tick: () => { if (tut.exam && tut.exam.removed) { tut.exam = g.spawnTitan('pure', I.yard.x + 46, I.yard.z + 10, 9); } },
          check: () => tut.exam && !tut.exam.alive,
        },
      ];
    }
    if (ch === 1) {
      const d = S.d;
      const gS = gate('tharskS'), gIn = gate('outerS');
      const th = town('tharsk');
      return [
        {
          enter: () => {
            d.varn = g.addTalker({ ...spots().varn, name: NAMES.varn, role: 'Garrison captain', portrait: 'varn', outfit: 'garrison', lines: () => [
              line('varn', 'So you’re Holt’s new flier. Welcome to Tharsk — the district that sticks out of the Outer Wall like a sore thumb.'),
              line('varn', 'A hundred years of peace on this wall. The worst I deal with is drunk guards. Walk the battlements to the south gate tower and back.'),
              line('tobin', 'Captain! Something’s moving in the forest. Something… tall.'),
            ], quest: () => S.i === 0 });
            const vs = g.addSquad('Varn’s squad', spots().varn.x - 10, spots().varn.z, 3, { x: th.ox, z: th.oz, r: 260 }, { garrison: true });
            vs[0].name = 'Tobin';
            g.addSquad('Garrison', gS.x + 30, gS.z - 20, 3, { x: th.ox, z: th.oz, r: 260 }, { garrison: true });
            g.addSquad('Garrison', gS.x - 50, gS.z - 40, 3, { x: th.ox, z: th.oz, r: 260 }, { garrison: true });
            say('varn', NAMES.varn, 'Recruit! Over here on the wall. Come talk to me.');
          },
          beacon: () => d.varn.pos,
          obj: () => 'Talk to Captain Varn (E)',
          check: () => S.talked === d.varn,
        },
        {
          enter: () => say('varn', NAMES.varn, 'Go on, the gate tower. Take a look at the forest while you’re there.'),
          beacon: () => ({ x: gS.x, y: TOP, z: gS.z }),
          obj: () => `Walk the wall to the south gate · ${Math.round(distP({ x: gS.x, y: TOP, z: gS.z }))} m`,
          check: () => dist2({ x: gS.x, z: gS.z }, P().pos) < 14 && P().pos.y > TOP - 3,
        },
        {
          enter: () => {
            d.colossal = g.spawnTitan('colossal', gS.x + gS.nx * 34, gS.z + gS.nz * 34, 58, { yaw: Math.atan2(-gS.nx, -gS.nz) });
            d.colossal.passive = true;
            d.colossal.special = 999;
            g.fx.steam(d.colossal.pos.clone().setY(G + 30), 300, 30, 8, 5);
            g.sfx.roar(1.5);
            g.shake = 1.2;
            g.radio('Tobin', 'What… what IS that?!', 'alert');
            P().yaw = Math.atan2(-(d.colossal.pos.x - P().pos.x), -(d.colossal.pos.z - P().pos.z)); P().pitch = 0.25;
            say('varn', NAMES.varn, 'It’s taller than the wall… Everyone, GET DOWN!', 8);
            S.acc = 0;
          },
          obj: () => 'Something is standing over the wall…',
          tick: (dt) => {
            S.acc += dt;
            if (S.acc > 5 && !d.kicked) { d.kicked = true; d.colossal.kickAt({ x: gS.x, y: G + 9, z: gS.z }); }
            if (S.acc > 9.5 && d.colossal.alive && !d.gone) {
              d.gone = true;
              g.fx.steam(d.colossal.pos.clone().setY(G + 30), 600, 40, 10, 6);
              d.colossal.remove();
            }
          },
          check: () => S.acc > 11,
        },
        {
          enter: () => {
            g.raiseAlarm(th);
            g.radio('Garrison', 'The outer gate is GONE! Titans incoming!', 'alert');
            say('varn', NAMES.varn, 'The gate is breached! Every civilian runs for the inner gate — every soldier buys them time. <b>Keep the titans off the townsfolk!</b>', 10);
            d.spawned = 0; d.wave = [];
            S.acc = 0;
          },
          obj: () => `Evacuate Tharsk · saved <b>${th.evacuated || 0}</b> · lost <b>${d.lost || 0}</b> · still in town <b>${th.civilians}</b> · ${Math.max(0, Math.ceil(240 - S.acc))} s`,
          tick: (dt) => {
            S.acc += dt;
            d.t = (d.t || 0) - dt;
            const live = alive(d.wave).length;
            if (d.t <= 0 && d.spawned < 26 && live < 12) {
              d.t = d.spawned < 6 ? 1 : 9;
              const t = g.spawnNear(gS.x + gS.nx * 90, gS.z + gS.nz * 90, 10, 70, ['outside'], g.randomType(1), { goal: { x: th.ox, z: th.oz } });
              if (t) { d.wave.push(t); d.spawned++; }
            }
          },
          check: () => (th.civilians <= 0 && !g.civilians.some((c) => c.town === th && c.alive)) || S.acc > 240,
        },
        {
          enter: () => {
            d.arm = g.spawnTitan('armored', gS.x + gS.nx * 40, gS.z + gS.nz * 40, 15, { goal: { x: gIn.x, z: gIn.z - 40 } });
            d.arm.passive = true;
            g.sfx.roar(1.4);
            g.radio('Tobin', 'Another one — it’s covered in ARMOUR! It’s heading for the inner gate!', 'alert');
            say('varn', NAMES.varn, 'If that inner gate falls, the whole Outer Territory falls with it! <b>Cut its knees to make it kneel, then strike the nape!</b>', 11);
            S.acc = 0; d.innerFell = false;
          },
          beacon: () => (d.arm.alive ? d.arm.pos : null),
          obj: () => d.innerFell ? `The inner gate has fallen! Fell the Armored or hold out · ${Math.max(0, Math.ceil(80 - S.acc))} s` : 'Stop the Armored before it breaks the inner gate',
          tick: (dt) => {
            if (d.innerFell) S.acc += dt;
            if (!d.arm.alive && !d.innerFell) {
              d.innerFell = true;
              g.bashWall({ x: gIn.x, y: G + 9, z: gIn.z }, 9, null, true);
              g.radio('Garrison', 'The inner gate was already cracked — it’s caving in!', 'alert');
            }
          },
          check: () => d.innerFell && (!d.arm.alive || S.acc > 80),
          onBreach: (rec) => {
            if (rec.wallId === 2 && Math.hypot(rec.x - gIn.x, rec.z - gIn.z) < 40) {
              d.innerFell = true; d.arm.passive = false;
              g.radio('Varn', 'It broke through… The Outer Wall is lost.', 'alert');
            }
          },
        },
        {
          enter: () => {
            if (d.arm.alive) { g.fx.steam(d.arm.pos.clone().setY(G + 10), 300, 12, 6, 4); d.arm.remove(); g.radio('Tobin', 'It ran — it just ran into the steam!', 'ally'); }
            else g.radio('Tobin', 'It’s steaming away… there’s nothing inside the shell!', 'ally');
            say('varn', NAMES.varn, 'Fall back! Everyone to the Corvane district wall — we hold the line there.', 10);
          },
          beacon: () => info().spawns.corvaneWall,
          obj: () => `Fall back to the Corvane wall · ${Math.round(distP(info().spawns.corvaneWall))} m`,
          check: () => distP(info().spawns.corvaneWall) < 16,
        },
      ];
    }
    if (ch === 2) {
      const d = S.d;
      const cor = town('corvane'), mid = gate('middleS');
      const corW = WALLS[4];
      const spawnWave = (n, mix, boss) => {
        const list = [];
        for (let k = 0; k < n; k++) {
          const ang = Math.PI / 2 + (Math.random() - 0.5) * 2.2;
          const tx = corW.cx + Math.cos(ang) * (corW.R + 70), tz = corW.cz + Math.sin(ang) * (corW.R + 70);
          const type = mix ? g.randomType(mix) : 'pure';
          const t = g.spawnNear(tx, tz, 0, 50, ['outer'], type, { goal: { x: corW.cx + Math.cos(ang) * corW.R, z: corW.cz + Math.sin(ang) * corW.R } });
          if (t) list.push(t);
        }
        if (boss) { const b = g.spawnNear(corW.cx, corW.cz + corW.R + 90, 0, 40, ['outer'], boss, { goal: { x: corW.cx, z: corW.cz + corW.R } }); if (b) { list.push(b); d.boss = b; } }
        return list;
      };
      return [
        {
          enter: () => {
            d.dorne = g.addTalker({ ...spots().dorneCorvane, name: NAMES.dorne, role: 'Scout Regiment', portrait: 'dorne', outfit: 'officer', lines: () => [
              line('dorne', 'Commander Dorne, Scout Regiment. Varn speaks well of you. That’s rare.'),
              line('dorne', 'The Outer Territory belongs to the titans now. Corvane is the next gate they will reach, and behind it, half a million people.'),
              line('dorne', 'They will come in waves. They will pound this wall. If the <b>Middle Wall gate</b> behind us falls, it’s over. Hold them.'),
            ] });
            say('dorne', NAMES.dorne, 'You — the flier from Tharsk. Report to me on the wall.');
          },
          beacon: () => d.dorne.pos,
          obj: () => 'Talk to Commander Dorne (E)',
          check: () => S.talked === d.dorne,
        },
        {
          enter: () => {
            g.addSquad('Dorne’s squad', cor.ox - 40, corW.cz + corW.R - 2, 3, { x: corW.cx, z: corW.cz + 60, r: 240 });
            g.addSquad('Squad Hale', cor.ox + 45, corW.cz + corW.R - 6, 3, { x: corW.cx, z: corW.cz + 60, r: 240 });
            g.addSquad('Garrison', cor.ox + 80, corW.cz + 70, 2, { x: corW.cx, z: corW.cz + 60, r: 240 }, { garrison: true });
            d.wave = spawnWave(11, 1);
            g.radio('Garrison', 'Titans sighted across the fields — eleven of them!', 'alert');
            S.noTravel = true;
          },
          obj: () => `Wave 1 of 3 · titans left <b>${alive(d.wave).length}</b>`,
          check: () => alive(d.wave).length === 0,
          fail: () => d.lostGate && 'The Middle Wall gate behind Corvane was breached.',
        },
        {
          enter: () => { d.wave = spawnWave(15, 4); g.radio('Dorne', 'Second wave! Abnormals among them — watch the ones that run!', 'alert'); say('dorne', NAMES.dorne, 'Abnormals ignore the rules. They leap, they turn, they go for fliers. Never strike one from the front.'); },
          obj: () => `Wave 2 of 3 · titans left <b>${alive(d.wave).length}</b>`,
          check: () => alive(d.wave).length === 0,
          fail: () => d.lostGate && 'The Middle Wall gate behind Corvane was breached.',
        },
        {
          enter: () => { d.wave = spawnWave(11, 3, 'jaw'); g.sfx.roar(1); g.radio('Garrison', 'Something small and FAST — it’s tearing through the field!', 'alert'); say('dorne', NAMES.dorne, 'That is no ordinary titan. Kill it before it reaches the wall — and do not let it bite.'); },
          beacon: () => (d.boss && d.boss.alive ? d.boss.pos : null),
          obj: () => `Wave 3 · kill <b>the Jaw</b>${d.boss && d.boss.alive ? '' : ' ✓'} · titans left <b>${alive(d.wave).length}</b>`,
          check: () => alive(d.wave).length <= 2 && d.boss && !d.boss.alive,
          fail: () => d.lostGate && 'The Middle Wall gate behind Corvane was breached.',
        },
      ];
    }
    if (ch === 3) {
      const d = S.d;
      const I2 = info();
      const tw = [...I2.towers].map((t, i) => ({ t, i })).sort((a, b) => dist2(a.t, gate('tharskS')) - dist2(b.t, gate('tharskS'))).slice(0, 3).map((o) => o.i);
      const keep = I2.keep;
      return [
        {
          enter: () => {
            d.dorne = g.addTalker({ ...spots().dorneTharsk, name: NAMES.dorne, role: 'Scout Regiment', portrait: 'dorne', outfit: 'officer', lines: () => [
              line('dorne', 'Corvane held. Now we take the fight to them.'),
              line('dorne', 'Light the signal fires on the <b>three watchtowers</b> south of here. That marks a supply line to the Forest of Giants.'),
              line('dorne', 'Squad Kael went ahead to the <b>Old Keep</b> two days ago. Nothing since. Find them.'),
              line('kael', '(static) …anyone… the Keep… they keep coming…'),
            ] });
            say('dorne', NAMES.dorne, 'Over here, on the Tharsk wall. We ride out today.');
          },
          beacon: () => d.dorne.pos,
          obj: () => 'Talk to Commander Dorne (E)',
          check: () => S.talked === d.dorne,
        },
        {
          enter: () => {
            d.escort = g.addSquad('Your escort', P().pos.x + 4, P().pos.z, 4, { x: P().pos.x, z: P().pos.z, r: 180 });
            say('dorne', NAMES.dorne, 'Four of my best ride with you. Climb each watchtower and press <b>E</b> at the top to light the fire.');
          },
          beacon: () => { const t = tw.map((i) => info().towers[i]).find((t) => !t.lit); return t || null; },
          obj: () => `Light the signal fires · ${tw.filter((i) => info().towers[i].lit).length} / 3`,
          tick: () => followEscort(d.escort),
          check: () => tw.every((i) => info().towers[i].lit),
        },
        {
          enter: () => {
            d.kael = g.addSquad('Squad Kael', keep.x - 20, keep.z - 20, 3, { x: keep.x, z: keep.z, r: 110 });
            d.kael[0].name = 'Kael';
            d.keepT = [];
            for (let k = 0; k < 7; k++) { const t = g.spawnNear(keep.x, keep.z, 30, 80, ['outside'], g.randomType(2), {}); if (t) d.keepT.push(t); }
            g.radio('Kael', 'Is that a signal fire?! We’re at the Keep — PLEASE hurry!', 'alert');
          },
          beacon: () => keep,
          obj: () => `Save Squad Kael at the Old Keep · titans left <b>${alive(d.keepT).length}</b> · survivors <b>${alive(d.kael).length}</b>/3`,
          tick: () => followEscort(d.escort),
          check: () => alive(d.keepT).length === 0,
        },
        {
          enter: () => {
            const n = alive(d.kael).length;
            if (n) { g.addMarks(n * 60, `Squad Kael saved (${n}/3)`); g.radio('Kael', 'We owe you our lives. Something is moving in the forest — something that THROWS.', 'ally'); }
            d.beast = g.spawnTitan('beast', info().forest.x + 40, info().forest.z - 20, 17);
            d.beastRoar = 25;
            say('dorne', NAMES.dorne, 'The beast-like one in the forest — it hurls rocks like cannon shot. Keep moving, use the trees, and get to its nape.', 11);
          },
          beacon: () => (d.beast.alive ? d.beast.pos : null),
          obj: () => `Kill <b>the Beast</b> in the Forest of Giants · ${Math.round(dist2(d.beast.pos, P().pos))} m`,
          tick: (dt) => {
            followEscort(d.escort);
            d.beastRoar -= dt;
            if (d.beastRoar <= 0 && d.beast.alive) {
              d.beastRoar = 40;
              d.beast.state = 'roar'; d.beast.timer = 2;
              g.sfx.roar(1.3);
              g.radio('Kael', 'It ROARED — more of them are coming!', 'alert');
              for (let k = 0; k < 3; k++) g.spawnNear(d.beast.pos.x, d.beast.pos.z, 30, 70, ['outside'], 'pure', {});
            }
          },
          check: () => !d.beast.alive,
        },
      ];
    }
    if (ch === 4) {
      const d = S.d;
      const gIn = gate('outerS'), gS = gate('tharskS');
      return [
        {
          enter: () => {
            d.mattis = g.addTalker({ ...spots().mattis, name: NAMES.mattis, role: 'Engineers', portrait: 'mattis', outfit: 'engineer', lines: () => [
              line('mattis', 'So you’re the one who keeps coming back alive. Good. I need someone like that.'),
              line('mattis', 'My crew can fill the inner gate breach — stone by stone. It takes two minutes. Titans will smell us working.'),
              line('mattis', 'Keep them off my men. If all four die, the breach stays open and Tharsk stays theirs.'),
            ] });
            say('mattis', NAMES.mattis, 'Flier! Up here, on the Outer Wall above the broken gate.');
          },
          beacon: () => d.mattis.pos,
          obj: () => 'Talk to Chief Engineer Mattis (E)',
          check: () => S.talked === d.mattis,
        },
        {
          enter: () => {
            d.rec = g.smash.breaches.find((b) => b.wallId === 2 && Math.hypot(b.x - gIn.x, b.z - gIn.z) < 40);
            if (!d.rec) { g.bashWall({ x: gIn.x, y: G + 9, z: gIn.z }, 9, null, true); d.rec = g.smash.breaches.find((b) => b.wallId === 2 && Math.hypot(b.x - gIn.x, b.z - gIn.z) < 40); }
            d.eng = [];
            for (let k = 0; k < 4; k++) {
              const e = g.addTalker({ x: gIn.x - 6 + k * 4, z: gIn.z - 14, name: `Engineer ${['Ott', 'Brandt', 'Lew', 'Haskel'][k]}`, role: 'Sealing the breach', portrait: 'mattis', outfit: 'engineer', lines: () => [{ who: 'mattis', text: 'Keep them off us!' }] });
              e.targetable = true; d.eng.push(e);
            }
            g.smash.sealRate = Math.max(10, d.rec.removed.length / 4 / 120);
            g.smash.seal(d.rec);
            g.addSquad('Dorne’s squad', gIn.x - 30, gIn.z - 30, 4, { x: gIn.x, z: gIn.z, r: 200 });
            g.addSquad('Garrison', gIn.x + 30, gIn.z - 30, 3, { x: gIn.x, z: gIn.z, r: 200 }, { garrison: true });
            d.wave = []; d.t = 0;
            S.noTravel = true;
          },
          beacon: () => ({ x: gIn.x, y: G + 1, z: gIn.z }),
          obj: () => `Defend the engineers · sealed <b>${Math.round(g.smash.sealProgress(d.rec) * 100)}%</b> · engineers <b>${d.eng.filter((e) => e.alive).length}</b>/4`,
          tick: (dt) => {
            d.t -= dt;
            if (d.t <= 0 && alive(d.wave).length < 10) {
              d.t = 7;
              const fromTharsk = Math.random() < 0.5;
              const t = fromTharsk
                ? g.spawnNear(gS.x, gS.z - 60, 0, 60, ['tharsk'], g.randomType(2), { goal: { x: gIn.x, z: gIn.z + 10 } })
                : g.spawnNear(gIn.x, gIn.z - 120, 0, 60, ['outer'], g.randomType(2), { goal: { x: gIn.x, z: gIn.z - 12 } });
              if (t) d.wave.push(t);
            }
          },
          check: () => d.rec.sealed,
          fail: () => d.eng.every((e) => !e.alive) && 'Every engineer was killed. The breach stays open.',
        },
        {
          enter: () => {
            for (const e of d.eng) if (e.alive) g.removeTalker(e);
            d.arm = g.spawnTitan('armored', gS.x + gS.nx * 30, gS.z + gS.nz * 30, 15, { goal: { x: gIn.x, z: gIn.z - 40 } });
            d.arm.passive = true;
            g.sfx.roar(1.4);
            say('mattis', NAMES.mattis, 'It’s sealed! … No. No, no — the armoured one is back, and it’s heading for my new stones!', 10);
            d.newBreach = false;
          },
          beacon: () => (d.arm.alive ? d.arm.pos : null),
          obj: () => 'Kill <b>the Armored</b> before it breaks the new gate (cut both knees, then the nape)',
          check: () => !d.arm.alive,
          fail: () => d.newBreach && 'The Armored broke through the sealed gate.',
          onBreach: (rec) => { if (rec.wallId === 2 && Math.hypot(rec.x - gIn.x, rec.z - gIn.z) < 40) d.newBreach = true; },
        },
        {
          enter: () => {
            d.col = g.spawnTitan('colossal', gS.x + gS.nx * 80, gS.z + gS.nz * 80, 58, { goal: { x: gS.x, z: gS.z + 10 } });
            g.sfx.roar(2); g.shake = 1;
            say('dorne', NAMES.dorne, 'The Colossal — the one that started all this. It vents scalding steam in bursts. <b>Strike between the bursts.</b> End it!', 12);
          },
          beacon: () => (d.col.alive ? d.col.pos : null),
          obj: () => `Kill <b>the Colossal</b>${d.col.steamT > 0 ? ' · <span class="warn">venting steam — stay clear</span>' : ''}`,
          check: () => !d.col.alive,
        },
      ];
    }
    return [];
  }

  function followEscort(list) {
    if (!list) return;
    const p = P().pos;
    for (const s of list) {
      if (!s.alive) continue;
      s.area.x = p.x; s.area.z = p.z;
      s.home.set(p.x + Math.sin(s.anim) * 6, p.y + 12, p.z + Math.cos(s.anim) * 6);
      if (s.state === 'perch' && dist2(s.pos, p) > 30) s.state = 'return';
    }
  }

  function spawnDummy() {
    const I = info();
    if (S.d.dummy && !S.d.dummy.removed) S.d.dummy.remove();
    S.d.dummy = g.spawnTitan('pure', I.yard.x + 0.5, I.yard.z - 1.5, 7.5, { dummy: true, yaw: 0 });
  }

  const CH_START = {
    0: () => info().spawns.camp,
    1: () => info().spawns.tharskWall,
    2: () => info().spawns.corvaneWall,
    3: () => ({ ...info().spawns.tharskWall, x: info().spawns.tharskWall.x - 10 }),
    4: () => ({ x: CX + 4, y: TOP + 0.01, z: CZ + 639.5, yaw: Math.PI }),
  };
  const CH_TITLE = {
    0: ['Chapter I · First Flight', 'Cadet Training Camp, Middle Territory'],
    1: ['Chapter II · The Day the Gate Fell', 'Tharsk District, the southern tip of the Outer Wall'],
    2: ['Chapter III · Hold Corvane', 'Corvane District, the Middle Wall'],
    3: ['Chapter IV · Beyond the Walls', 'The frontier south of Tharsk'],
    4: ['Chapter V · Reclaim the Wall', 'The Outer Wall above Tharsk'],
  };

  function runChapter(ch, trainingOnly = false) {
    S.active = ch; S.trainingOnly = trainingOnly;
    S.d = {}; S.i = -1; S.acc = 0; S.talked = null; S.noTravel = false;
    S.steps = chapterSteps(ch);
    S.contract = null; S.incursion = null;
    g.setMode(CHAPTERS[ch], trainingOnly ? 'Training' : `Chapter ${ch + 1} of 5`);
    g.titleCard(...CH_TITLE[ch]);
    next();
  }
  function next() {
    S.i++; S.acc = 0;
    const s = S.steps[S.i];
    if (!s) { finishChapter(); return; }
    if (s.enter) s.enter();
  }
  function finishChapter() {
    const ch = S.active;
    const rewards = [150, 350, 450, 500, 800];
    S.noTravel = false;
    g.setCounters(null);
    if (S.trainingOnly) {
      g.complete('Training complete', `You earned your wings, cadet.<br><br>Felled ${g.session.kills} titan(s).`, () => { location.reload(); });
      S.active = null;
      return;
    }
    g.addMarks(rewards[ch] || 200, null);
    g.save.chapter = Math.max(g.save.chapter, ch + 1);
    if (ch === 1) g.save.flags.tharskFallen = true;
    try { localStorage.setItem('tetherfall-save-v2', JSON.stringify(g.save)); } catch (e) { /* ignore */ }
    const texts = {
      0: 'You graduated from the Cadet Corps. <b>Captain Varn</b> of the Tharsk garrison has asked for you.',
      1: `Tharsk has fallen and the Outer Territory with it.<br>Civilians saved <b>${town('tharsk').evacuated || 0}</b>, lost <b>${S.d.lost || 0}</b>.<br><br>The survivors gather behind the Corvane wall.`,
      2: 'Corvane held against three waves and the Jaw. <b>Commander Dorne</b> wants you for an expedition beyond the walls.',
      3: 'The supply line is lit, Squad Kael is home and the Beast is dead. <b>Chief Engineer Mattis</b> waits on the Outer Wall.',
      4: 'The breach is sealed. The Armored and the Colossal are dead. <b>The wall stands.</b><br><br>The frontier is yours — bounties, lost insignias, caches and titans that never stop coming.',
    };
    S.active = null;
    g.complete(`${CHAPTERS[ch]} — complete`, `${texts[ch]}<br><br><small>+${rewards[ch]} marks</small>`, () => openWorld(false));
  }
  function failChapter(reason) {
    const ch = S.active;
    S.active = null;
    g.complete('Mission failed', `${reason}<br><br>Try the chapter again.`, () => {
      try { sessionStorage.setItem('tetherfall-launch', JSON.stringify({ mode: 'story', opts: { chapter: ch, direct: true } })); } catch (e) { /* ignore */ }
      location.reload();
    });
  }

  // ---------------- the open world between chapters ----------------
  function giverFor(ch) {
    const sp = spots();
    if (ch === 1) return { ...sp.varn, name: NAMES.varn, portrait: 'varn', outfit: 'garrison', role: 'Chapter II', line: 'Tharsk could use a flier. Ready to walk the wall?' };
    if (ch === 2) return { ...sp.dorneCorvane, name: NAMES.dorne, portrait: 'dorne', outfit: 'officer', role: 'Chapter III', line: 'They’re massing in the fields. Are you ready to hold Corvane?' };
    if (ch === 3) return { ...sp.dorneTharsk, name: NAMES.dorne, portrait: 'dorne', outfit: 'officer', role: 'Chapter IV', line: 'The expedition leaves from the Tharsk wall. Ready to ride out?' };
    if (ch === 4) return { ...sp.mattis, name: NAMES.mattis, portrait: 'mattis', outfit: 'engineer', role: 'Chapter V', line: 'My crew is ready to seal the breach. Are you?' };
    return null;
  }
  function openWorld(teleport) {
    S.active = null; S.steps = []; S.noTravel = false;
    const ch = g.save.chapter;
    g.setMode(ch >= 5 ? 'The Open Frontier' : 'Between missions', ch >= 5 ? 'Bounties · insignias · caches · incursions' : `Next: ${CHAPTERS[ch]}`);
    g.setObjective('');
    g.setCounters(null);
    if (S.giver) { g.removeTalker(S.giver); S.giver = null; }
    const gv = giverFor(ch);
    if (gv) {
      S.giver = g.addTalker({ ...gv, quest: () => true, lines: () => [line(gv.portrait, gv.line), { who: gv.portrait, name: gv.name, text: '<i>(The chapter begins.)</i>' }], after: () => { const t = S.giver; S.giver = null; g.removeTalker(t); runChapter(ch); } });
      // make sure the way there is on the map
      const near = [...g.info.depots].sort((a, b) => dist2(a, gv) - dist2(b, gv))[0];
      if (near && !g.save.depots.includes(near.name)) g.save.depots.push(near.name);
      g.say(gv.portrait, gv.name, `When you’re ready, find me — follow the <b>yellow beacon</b>. Press <b>M</b> for the map and fast travel.`, 9);
    }
    if (teleport) {
      const sp = ch === 0 ? info().spawns.camp : ch >= 5 ? info().spawns.merrow : { ...CH_START[ch](), x: CH_START[ch]().x - 6 };
      g.teleport(sp);
    }
  }

  // ---------------- bounties ----------------
  function contractLines() {
    if (g.save.chapter < 1) return [line('osric', 'Bounties are for graduates, cadet. Come back with your wings.')];
    if (S.active !== null) return [line('osric', 'You have orders already. Come back when the mission is done.')];
    if (S.contract) return [line('osric', `Your contract: <b>${S.contract.title}</b>. ${S.contract.obj()}`)];
    S.offer = makeContract();
    return [line('osric', `I have work: <b>${S.offer.title}</b>. ${S.offer.desc} Pays <b>${S.offer.reward}</b> marks. Signed — it’s yours.`)];
  }
  function makeContract() {
    const I = info();
    const r = Math.random();
    if (r < 0.3) {
      const start = g.session.kills;
      return { title: 'Cull the herd', desc: 'Fell six titans beyond the walls.', reward: 180, obj: () => `Titans felled ${Math.min(6, g.session.kills - start)}/6`, check: () => g.session.kills - start >= 6 };
    }
    if (r < 0.55) {
      const left = I.caches.filter((c) => !c.taken);
      if (left.length >= 2) {
        const pick = left.sort(() => Math.random() - 0.5).slice(0, 2);
        g.save.flags.mapCaches = true;
        return { title: 'Supply run', desc: 'Recover two of the old expedition caches beyond the walls.', reward: 160, obj: () => `Caches ${pick.filter((c) => c.taken).length}/2`, check: () => pick.every((c) => c.taken), beacon: () => pick.find((c) => !c.taken) };
      }
    }
    if (r < 0.8) {
      const unlit = I.towers.map((t, i) => ({ t, i })).filter((o) => !o.t.lit);
      if (unlit.length) {
        const pick = unlit.slice(0, 2);
        return { title: 'Signal fires', desc: `Light ${pick.length === 2 ? 'two watchtower beacons' : 'the last watchtower beacon'} beyond the walls.`, reward: 160, obj: () => `Fires ${pick.filter((o) => o.t.lit).length}/${pick.length}`, check: () => pick.every((o) => o.t.lit), beacon: () => { const o = pick.find((q) => !q.t.lit); return o && o.t; } };
      }
    }
    const ruins = I.towns.filter((t) => t.ruined);
    const site = ruins[Math.floor(Math.random() * ruins.length)];
    const c = { title: `Pinned at ${site.name.replace(' (abandoned)', '')}`, desc: `A patrol is trapped in the ruins of ${site.name.replace(' (abandoned)', '')}. Clear the titans around them.`, reward: 240, site };
    c.obj = () => c.started ? `Titans left ${alive(c.ts).length} · patrol alive ${alive(c.sq).length}/3` : `Reach ${site.name.replace(' (abandoned)', '')}`;
    c.beacon = () => ({ x: site.ox, z: site.oz });
    c.tick = () => {
      if (!c.started && dist2({ x: site.ox, z: site.oz }, P().pos) < 260) {
        c.started = true;
        c.sq = g.addSquad('Patrol', site.ox, site.oz, 3, { x: site.ox, z: site.oz, r: 100 });
        c.ts = [];
        for (let k = 0; k < 6; k++) { const t = g.spawnNear(site.ox, site.oz, 25, 70, ['outside'], g.randomType(3), {}); if (t) c.ts.push(t); }
      }
    };
    c.check = () => c.started && alive(c.ts).length === 0;
    return c;
  }
  function acceptContract(c) { S.contract = c; S.offer = null; g.radio('Osric', `Contract signed: ${c.title}`, 'info'); }

  // ---------------- background director ----------------
  function director(dt) {
    const D = S.dir;
    D.t -= dt;
    const p = P().pos;
    if (D.t <= 0) {
      D.t = 2.5;
      const zone = zoneOf(p.x, p.z);
      let want = 0, zones = null;
      if (zone === 'outside') { want = 11 + Math.min(6, g.save.chapter * 2); zones = ['outside']; }
      else if (zone === 'tharsk' && (fallenOuter() || g.save.chapter >= 5)) { want = fallenOuter() ? 7 : 3; zones = ['tharsk', 'outside']; }
      else if (zone === 'outer' && fallenOuter()) { want = 9; zones = ['outer']; }
      else if (p.y > TOP - 4 && (zone === 'outer' || zone === 'tharsk')) { want = 6; zones = ['outside']; }
      if (S.active !== null && S.active !== 3) want = Math.min(want, 4);
      if (S.siege) want = 0;
      const bg = g.titans.filter((t) => t.bg && t.alive);
      for (const t of bg) if (dist2(t.pos, p) > 700) t.remove();
      const near = bg.filter((t) => dist2(t.pos, p) < 380).length;
      if (near < want && zones) {
        const t = g.spawnNear(p.x, p.z, 150, 340, zones, g.randomType(Math.min(6, g.save.chapter * 1.5)), {});
        if (t) {
          t.bg = true;
          // some of them go and test the walls
          if (zones[0] === 'outside' && Math.random() < 0.3) {
            const w = WALLS[2], a = Math.atan2(t.pos.z - w.cz, t.pos.x - w.cx);
            t.goal = { x: w.cx + Math.cos(a) * (w.R + 2), z: w.cz + Math.sin(a) * (w.R + 2) };
          }
        }
      }
      // garrison soldiers keep watch near you
      const bgs = g.scouts.filter((s) => s.bg && s.alive);
      for (const s of bgs) if (dist2(s.pos, p) > 650) { s.alive = false; s.dispose(); }
      if (bgs.length < 6 && !S.siege) {
        const dep = info().depots.filter((dd) => dd.kind === 'wall' && dist2(dd, p) < 320 && !bgs.some((s) => dist2(s.home, dd) < 20));
        if (dep.length) {
          const dd = dep[Math.floor(Math.random() * dep.length)];
          for (const s of g.addSquad('Garrison', dd.x, dd.z, 3, { x: dd.x, z: dd.z, r: 240 }, { garrison: true })) s.bg = true;
        }
      }
      // engineers quietly seal breaches nobody is fighting over
      for (const b of g.smash.breaches) {
        if (!b.open || b.sealing || !b.openedAt || g.time - b.openedAt < 200 || S.active !== null) continue;
        if (fallenOuter() && b.wallId === 2 || fallenOuter() && b.wallId === 3) continue;
        if (g.titans.some((t) => t.alive && dist2(t.pos, b) < 90)) continue;
        g.smash.sealRate = 60;
        g.smash.seal(b);
        g.radio('Engineers', `Sealing the breach in the ${WALLS[b.wallId].name}.`, 'info');
      }
    }
    // incursions: a pack hits a stretch of the Outer Wall
    if (S.active === null && g.save.chapter >= 1 && !S.siege) {
      D.incT -= dt;
      if (D.incT <= 0 && !S.incursion) {
        D.incT = 360 + Math.random() * 300;
        const w = WALLS[2];
        const a = [0, Math.PI, -Math.PI / 2, 0.6, 2.5, -0.9, -2.2][Math.floor(Math.random() * 7)];
        const at = { x: w.cx + Math.cos(a) * w.R, z: w.cz + Math.sin(a) * w.R };
        const ts = [];
        for (let k = 0; k < 7; k++) {
          const t = g.spawnNear(at.x + Math.cos(a) * 110, at.z + Math.sin(a) * 110, 0, 60, ['outside'], g.randomType(3), { goal: at });
          if (t) { t.inc = true; ts.push(t); }
        }
        if (ts.length) {
          S.incursion = { at, ts, name: ['the east wall', 'the west wall', 'the north wall', 'the south-east wall', 'the south-west wall', 'the north-east wall', 'the north-west wall'][[0, Math.PI, -Math.PI / 2, 0.6, 2.5, -0.9, -2.2].indexOf(a)] };
          g.radio('Garrison', `Titans massing at ${S.incursion.name} of the Outer Wall!`, 'alert');
          g.sfx.bell();
        }
      }
      if (S.incursion && alive(S.incursion.ts).length === 0) {
        g.addMarks(150, 'Incursion repelled');
        S.incursion = null;
      }
    }
  }

  // ---------------- siege mode ----------------
  function startSiege() {
    const I = info();
    S.siege = { wave: 0, t: 18, ts: [], lost: false };
    S.active = null;
    g.setMode('Siege of Tharsk', 'Hold the district. Waves never stop.');
    g.titleCard('Siege of Tharsk', 'Hold the inner gate as long as you can');
    g.teleport(I.spawns.tharskWall);
    const th = town('tharsk');
    g.addSquad('Garrison', I.spawns.tharskWall.x + 30, I.spawns.tharskWall.z - 10, 3, { x: th.ox, z: th.oz, r: 260 }, { garrison: true });
    g.addSquad('Scouts', I.spawns.tharskWall.x - 40, I.spawns.tharskWall.z - 30, 4, { x: th.ox, z: th.oz, r: 260 });
    g.addSquad('Garrison', th.ox + 90, th.oz - 40, 3, { x: th.ox, z: th.oz, r: 260 }, { garrison: true });
    placeCommonTalkers();
    for (const t of [...g.talkers]) if (t.def.role === 'Townsman' || t.def.role === 'Bounties') g.removeTalker(t);
  }
  function siegeTick(dt) {
    const s = S.siege;
    const gS = gate('tharskS'), gIn = gate('outerS');
    s.t -= dt;
    const live = alive(s.ts);
    if (s.t <= 0 && live.length <= 2) {
      s.wave++;
      const n = 4 + s.wave * 2;
      g.radio('Garrison', `Wave ${s.wave} — ${n} titans!`, 'alert');
      g.sfx.bell();
      for (let k = 0; k < n; k++) {
        const ang = Math.PI / 2 + (Math.random() - 0.5) * 2.6;
        const w = WALLS[3];
        const t = g.spawnNear(w.cx + Math.cos(ang) * (w.R + 100), w.cz + Math.sin(ang) * (w.R + 100), 0, 60, ['outside'], g.randomType(s.wave), { goal: { x: w.cx + Math.cos(ang) * w.R, z: w.cz + Math.sin(ang) * w.R } });
        if (t) s.ts.push(t);
      }
      const boss = { 4: 'jaw', 6: 'armored', 8: 'beast', 10: 'colossal' }[s.wave] || (s.wave > 10 && s.wave % 3 === 0 ? ['jaw', 'armored', 'beast'][s.wave % 9 / 3 | 0] : null);
      if (boss) {
        const b = g.spawnNear(gS.x + gS.nx * 90, gS.z + gS.nz * 90, 0, 40, ['outside'], boss, { goal: { x: gIn.x, z: gIn.z - 40 } });
        if (b) { s.ts.push(b); g.radio('Garrison', `${b.name.toUpperCase()} is coming!`, 'alert'); g.sfx.roar(1.4); }
      }
      if (s.wave % 3 === 0) g.addSquad('Reinforcements', gIn.x + 20, gIn.z + 30, 3, { x: town('tharsk').ox, z: town('tharsk').oz, r: 260 });
      s.t = 14;
    }
    g.setObjective(`Wave <b>${s.wave}</b> · titans left <b>${live.length}</b>${s.wave === 0 ? ` · first wave in ${Math.ceil(s.t)} s` : ''}`);
    g.setCounters(`Felled <b>${g.session.kills}</b> · saved <b>${g.session.saved}</b> · lost <b>${g.session.lost}</b>`);
    if (s.lost && !s.over) {
      s.over = true;
      g.save.best = Math.max(g.save.best || 0, s.wave - 1);
      try { localStorage.setItem('tetherfall-save-v2', JSON.stringify(g.save)); } catch (e) { /* ignore */ }
      g.complete('Tharsk has fallen', `The inner gate broke on wave <b>${s.wave}</b>.<br>You felled <b>${g.session.kills}</b> titans; <b>${g.session.saved}</b> civilians escaped.<br>Best: wave ${g.save.best}.`, () => location.reload());
    }
  }

  // ---------------- events ----------------
  g.on('talked', (npc) => { S.talked = npc; });
  g.on('titanKilled', (t, by, d) => { if (t.dummy && d && d.strike) S.d.strikeKill = true; });
  g.on('resupply', () => { const s = S.steps[S.i]; if (S.active !== null && s && s.onResupply) s.onResupply(); });
  g.on('civLost', (c) => { if (S.active === 1) S.d.lost = (S.d.lost || 0) + 1; });
  g.on('breach', (rec) => {
    const s = S.steps[S.i];
    if (S.active !== null && s && s.onBreach) s.onBreach(rec);
    if (S.active === 2 && rec.wallId === 1) { const m = gate('middleS'); if (Math.hypot(rec.x - m.x, rec.z - m.z) < 60) S.d.lostGate = true; }
    if (S.siege && rec.wallId === 2) { const m = gate('outerS'); if (Math.hypot(rec.x - m.x, rec.z - m.z) < 60) S.siege.lost = true; }
  });

  // ---------------- public ----------------
  return {
    debug: S,
    get active() { return S.active; },
    get noTravel() { return S.noTravel; },
    chapterName: (ch) => CHAPTERS[Math.min(ch, 5)],
    startStory(ch, trainingOnly = false, direct = false) {
      S.siege = null;
      applyWorldState(trainingOnly ? 0 : g.save.chapter);
      if (direct && ch >= 1 && ch <= 4) {
        placeCommonTalkers(); placeHolt();
        g.teleport(CH_START[ch]());
        runChapter(ch);
        return;
      }
      if (!trainingOnly) placeCommonTalkers();
      if (ch === 0 || trainingOnly) placeHolt();
      if (ch === 0 || trainingOnly) {
        g.teleport(info().spawns.camp);
        g.discoverAll('none');
        runChapter(0, trainingOnly);
        return;
      }
      if (ch >= 1) placeHolt();
      openWorld(true);
    },
    startSiege() { applyWorldState(0); startSiege(); },
    update(dt) {
      if (S.siege) { siegeTick(dt); director(dt); return; }
      director(dt);
      if (S.active !== null) {
        const s = S.steps[S.i];
        if (!s) return;
        if (s.tick) s.tick(dt);
        g.setObjective(s.obj ? s.obj() : '');
        const f = s.fail && s.fail();
        if (f) { failChapter(f); return; }
        if (s.check && s.check()) { g.sfx.pickup(); next(); }
        return;
      }
      // between chapters: contracts and incursions
      const c = S.contract;
      let obj = '';
      if (c) {
        if (c.tick) c.tick(dt);
        obj = `<b>${c.title}</b> · ${c.obj()}`;
        if (c.check()) { g.addMarks(c.reward, `Contract complete: ${c.title}`); S.contract = null; }
      }
      if (S.incursion) obj += `${obj ? ' · ' : ''}Incursion at ${S.incursion.name}: <b>${alive(S.incursion.ts).length}</b> titans`;
      if (!obj && S.giver) obj = `Next chapter: find <b>${S.giver.name}</b>`;
      g.setObjective(obj);
    },
    beaconPos() {
      if (S.active !== null) { const s = S.steps[S.i]; return s && s.beacon ? s.beacon() : null; }
      if (S.contract && S.contract.beacon) return S.contract.beacon();
      if (S.incursion) return S.incursion.at;
      if (S.giver) return S.giver.pos;
      return null;
    },
    respawnPoint() {
      if (S.siege) return info().spawns.tharskWall;
      if (S.active !== null) return CH_START[S.active]();
      // the nearest known depot inside the walls
      const p = P().pos;
      const ok = info().depots.filter((d) => g.save.depots.includes(d.name) && d.zone !== 'outside');
      ok.sort((a, b) => dist2(a, p) - dist2(b, p));
      return ok.length ? { x: ok[0].x, y: ok[0].y + 0.05, z: ok[0].z, yaw: 0 } : info().spawns.merrow;
    },
    onRespawn() { if (S.active === 1 && S.i >= 3) g.radio('Varn', 'Back on your feet — move!', 'ally'); },
    logHtml() {
      const out = [];
      if (S.siege) out.push(`<b>Siege of Tharsk</b> — wave ${S.siege.wave}`);
      else if (S.active !== null) out.push(`<b>${CHAPTERS[S.active]}</b><br>${S.steps[S.i] && S.steps[S.i].obj ? S.steps[S.i].obj() : ''}`);
      else out.push(`<b>${CHAPTERS[Math.min(5, g.save.chapter)]}</b>${S.giver ? `<br>Find ${S.giver.name} to begin.` : ''}`);
      if (S.contract) out.push(`Contract: <b>${S.contract.title}</b> — ${S.contract.obj()}`);
      if (S.incursion) out.push(`Incursion at ${S.incursion.name}`);
      const I = info();
      out.push(`Insignias ${g.save.insignias.length}/${I.insignias.length} · caches ${g.save.caches.length}/${I.caches.length} · signal fires ${I.towers.filter((t) => t.lit).length}/${I.towers.length}`);
      out.push(`Marks <b>${g.save.marks}</b> · titans felled ${g.save.stats.kills} · civilians saved ${g.save.stats.saved}`);
      return out.join('<br>');
    },
  };
}
