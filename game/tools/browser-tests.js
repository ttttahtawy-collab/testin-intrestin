#!/usr/bin/env node
// Browser integration tests (headless Chromium via Playwright):
//  1. every level loads, renders and runs for a moment without errors
//  2. every boss can be fought to defeat: a bot keeps Ember invulnerable,
//     moves next to the boss during its vulnerable windows and punches/stomps,
//     then walks into the unlocked Prism Gate -> results screen
//   node tools/browser-tests.js [outDir] [--only=renders|bosses]
'use strict';
const path = require('path');
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith('--')) || path.join(__dirname, 'screens');
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7);
fs.mkdirSync(out, { recursive: true });
const base = 'file://' + path.join(root, 'index.html');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  let errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  let failed = 0;
  const ids = await (async () => { await page.goto(base); await page.waitForTimeout(400); return page.evaluate(() => G.Worlds.order()); })();

  if (only !== 'bosses') for (const id of ids) {
    errors = [];
    await page.goto(base + '?level=' + id);
    await page.waitForTimeout(900);
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(700);
    await page.keyboard.up('ArrowRight');
    await page.screenshot({ path: path.join(out, 'level-' + id + '.png') });
    const ok = errors.length === 0;
    if (!ok) failed++;
    console.log((ok ? 'OK ' : 'ERR') + ' render ' + id + (ok ? '' : ' ' + errors.join(' | ')));
  }

  if (only !== 'renders') for (const id of ids.filter((i) => i.endsWith('-B'))) {
    errors = [];
    await page.goto(base + '?level=' + id);
    await page.waitForTimeout(1300);
    // advance the intro dialogue
    for (let i = 0; i < 30; i++) {
      const st = await page.evaluate(() => G.Scenes.current.state);
      if (st === 'play') break;
      await page.keyboard.press('Enter');
      await page.waitForTimeout(120);
    }
    const t0 = Date.now();
    let result = 'timeout';
    let shotTaken = false;
    while (Date.now() - t0 < 150000) {
      const s = await page.evaluate(() => {
        const P = G.Scenes.current;
        if (G.Scenes.currentName !== 'play') return { scene: G.Scenes.currentName };
        const p = P.player, b = P.boss;
        p.invuln = 5; p.hp = p.maxHp; // keep the bot alive
        if (P.state === 'dialogue') return { dialogue: true };
        if (!b || b.dead) {
          // walk into the gate
          if (P.goal && !P.goal.locked) { p.x = P.goal.cx - p.w / 2; p.y = P.goal.y + P.goal.h - p.h - 2; }
          return { bossDead: true, state: P.state };
        }
        if (b.vulnerable) {
          const hb = b.hurtBox();
          // stand beside the hurtbox, facing it, at its foot level
          const side = p.cx < hb.x + hb.w / 2 ? -1 : 1;
          p.x = side < 0 ? hb.x - p.w - 4 : hb.x + hb.w + 4;
          p.y = Math.min(hb.y + hb.h, P.level.ph - G.TILE * 3) - p.h;
          p.vy = 0;
          p.facing = -side;
          return { hit: true, hp: b.hp, st: b.state };
        }
        // reflect projectiles: stand still otherwise
        return { hp: b.hp, st: b.state, vul: b.vulnerable };
      });
      if (s.scene === 'results') { result = 'results'; break; }
      if (s.dialogue) { await page.keyboard.press('Enter'); await page.waitForTimeout(80); continue; }
      if (s.hit) {
        await page.keyboard.press('KeyX');
        await page.waitForTimeout(120);
        if (!shotTaken) { await page.screenshot({ path: path.join(out, 'boss-' + id + '.png') }); shotTaken = true; }
      } else await page.waitForTimeout(150);
    }
    const ok = result === 'results' && errors.length === 0;
    if (!ok) failed++;
    console.log((ok ? 'OK ' : 'BAD') + ' boss ' + id + ' -> ' + result + ' in ' + Math.round((Date.now() - t0) / 1000) + 's' + (errors.length ? ' errors: ' + errors.join(' | ') : ''));
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
