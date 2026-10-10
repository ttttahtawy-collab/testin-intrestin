#!/usr/bin/env node
// End-to-end flow test: audio engine, save/load persistence, touch layout
// on a phone-sized screen, and frame-time performance.
//   node tools/flow-test.js [outDir]
'use strict';
const path = require('path');
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const root = path.join(__dirname, '..');
const out = process.argv[2] || path.join(__dirname, 'screens');
fs.mkdirSync(out, { recursive: true });
const base = 'file://' + path.join(root, 'index.html');
const fail = (m) => { console.log('FAIL ' + m); process.exitCode = 1; };

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  // ---------- desktop flow ----------
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(150); };
  await page.goto(base);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(800);

  // audio: every sfx + every music track
  const audio = await page.evaluate(async () => {
    G.Audio.unlock();
    await new Promise((r) => setTimeout(r, 200));
    const names = ['jump', 'djump', 'walljump', 'land', 'step', 'slide', 'gem', 'shard', 'heart', 'punch', 'whiff', 'hit', 'stomp', 'pop', 'hurt', 'die', 'spring', 'poundStart', 'pound', 'dash', 'checkpoint', 'menuMove', 'menuSelect', 'menuBack', 'deny', 'buy', 'shoot', 'crumble', 'break', 'bossHit', 'roar', 'boom', 'warn', 'laser', 'wind', 'text', 'victory', 'unlock', 'respawn'];
    const missing = names.filter((n) => !G.Audio.has(n));
    for (const n of names) { G.Audio._lastPlay = {}; G.Audio.play(n); }
    const tracks = ['title', 'overworld', 'w1', 'w2', 'w3', 'w4', 'boss', 'final', 'ending', 'story'];
    for (const t of tracks) { G.Music.play(t); await new Promise((r) => setTimeout(r, 350)); }
    G.Music.play('title');
    return { state: G.Audio.ctx && G.Audio.ctx.state, missing };
  });
  console.log('audio context:', audio.state, 'missing sfx:', audio.missing.length ? audio.missing : 'none');
  if (audio.missing.length) fail('missing sfx');

  // new game -> slot 1 -> skip intro -> map -> play 1-1
  await press('Enter'); await page.waitForTimeout(500);
  await press('Enter'); await page.waitForTimeout(900);
  await press('Escape'); await page.waitForTimeout(900);
  if (await page.evaluate(() => G.Scenes.currentName) !== 'overworld') fail('expected overworld after intro');
  await press('Enter'); await page.waitForTimeout(900);
  if (await page.evaluate(() => G.Scenes.currentName) !== 'play') fail('expected play scene');
  // performance sample while running right
  await page.keyboard.down('ArrowRight');
  const perf = await page.evaluate(async () => {
    const S = G.Scenes.current;
    const times = [];
    for (let i = 0; i < 120; i++) {
      const t0 = performance.now();
      S.update(1 / 60);
      G.R.begin(); G.Scenes.render(G.R.ctx); G.R.end();
      times.push(performance.now() - t0);
      await new Promise((r) => requestAnimationFrame(r));
    }
    times.sort((a, b) => a - b);
    return { median: times[60].toFixed(2), p95: times[114].toFixed(2) };
  });
  await page.keyboard.up('ArrowRight');
  console.log('frame cost (update+render) ms: median', perf.median, 'p95', perf.p95);
  // grab a shard and some gems, then teleport to the goal
  await page.evaluate(() => {
    const S = G.Scenes.current;
    const sh = S.entities.find((e) => e.idx === 0);
    S.player.x = sh.x; S.player.y = sh.y;
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const S = G.Scenes.current; S.player.x = S.goal.cx - 13; S.player.y = S.goal.y + S.goal.h - 60; });
  await page.waitForTimeout(3500);
  if (await page.evaluate(() => G.Scenes.currentName) !== 'results') fail('expected results');
  await page.screenshot({ path: path.join(out, 'flow-results.png') });
  await press('Enter'); await page.waitForTimeout(1200);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ember_prism_slots_v1'))[0]);
  console.log('saved: 1-1 done =', saved.levels['1-1'].done, 'shards =', JSON.stringify(saved.levels['1-1'].shards), 'unlocked =', saved.unlocked.join(','), 'gems =', saved.gems);
  if (!saved.levels['1-1'].done || saved.unlocked.indexOf('1-2') < 0 || !saved.levels['1-1'].shards[0]) fail('save contents');

  // reload -> Load Game -> slot 1
  await page.reload();
  await page.waitForTimeout(900);
  const sel = await page.evaluate(() => G.Scenes.current.menu.items[G.Scenes.current.menu.sel].label);
  if (sel !== 'Load Game') fail('Load Game should be preselected, got ' + sel);
  await press('Enter'); await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, 'flow-load.png') });
  await press('Enter'); await page.waitForTimeout(900);
  const ow = await page.evaluate(() => ({ scene: G.Scenes.currentName, node: G.Scenes.current.order[G.Scenes.current.cur] }));
  console.log('after load:', JSON.stringify(ow));
  if (ow.scene !== 'overworld' || ow.node !== '1-2') fail('load flow');
  // shop opens with X and buying with no gems is denied gracefully
  await press('KeyX'); await page.waitForTimeout(600);
  if (await page.evaluate(() => G.Scenes.currentName) !== 'shop') fail('shop');
  await page.screenshot({ path: path.join(out, 'flow-shop.png') });
  console.log(errors.length ? 'page errors: ' + errors.join(' | ') : 'desktop flow: no page errors');
  if (errors.length) fail('page errors');

  // ---------- phone landscape with touch ----------
  const ctx2 = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const m = await ctx2.newPage();
  const merr = [];
  m.on('pageerror', (e) => merr.push(e.message));
  await m.goto(base + '?level=1-1');
  await m.waitForTimeout(900);
  await m.touchscreen.tap(400, 200); // first touch reveals the touch controls
  await m.waitForTimeout(200);
  // hold the on-screen RIGHT button via pointer events
  const btn = await m.evaluate(() => { const b = G.Input.touchButtons.find((x) => x.id === 'right'); const s = G.R.scale; return { x: (b.x * s * G.R.dpr + G.R.ox) / G.R.dpr, y: (b.y * s * G.R.dpr + G.R.oy) / G.R.dpr }; });
  const x0 = await m.evaluate(() => G.Scenes.current.player.x);
  const cdp = await ctx2.newCDPSession(m);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: btn.x, y: btn.y, id: 1 }] });
  await m.waitForTimeout(700);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const x1 = await m.evaluate(() => G.Scenes.current.player.x);
  console.log('touch: visible =', await m.evaluate(() => G.Input.touchVisible()), 'moved', Math.round(x1 - x0), 'px with the RIGHT button');
  if (x1 - x0 < 50) fail('touch movement');
  await m.screenshot({ path: path.join(out, 'flow-phone.png') });
  if (merr.length) fail('mobile errors: ' + merr.join(' | '));
  await browser.close();
  console.log(process.exitCode ? 'FLOW TEST FAILED' : 'FLOW TEST PASSED');
})();
