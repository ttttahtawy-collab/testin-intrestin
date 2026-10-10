#!/usr/bin/env node
// Browser smoke test: boots the game in headless Chromium, navigates menus with
// real keyboard input, plays the first level for a few seconds and saves
// screenshots to tools/screens/. Fails on any page error.
//   node tools/smoke-test.js [outDir]
'use strict';
const path = require('path');
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const root = path.join(__dirname, '..');
const out = process.argv[2] || path.join(__dirname, 'screens');
fs.mkdirSync(out, { recursive: true });
const url = 'file://' + path.join(root, 'index.html');

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  const shot = (n) => page.screenshot({ path: path.join(out, n + '.png') });
  const key = async (k, hold = 60) => { await page.keyboard.down(k); await page.waitForTimeout(hold); await page.keyboard.up(k); await page.waitForTimeout(120); };
  const scene = () => page.evaluate(() => G.Scenes.currentName);

  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(1500);
  await shot('01-title');
  await key('Enter'); // New Game
  await page.waitForTimeout(600);
  await shot('02-slots');
  await key('Enter'); // slot 1
  await page.waitForTimeout(1200);
  await shot('03-cutscene');
  console.log('scene after new game:', await scene());
  await key('Escape'); // skip cutscene
  await page.waitForTimeout(1200);
  await shot('04-overworld');
  console.log('scene after skip:', await scene());
  await key('Enter'); // play 1-1
  await page.waitForTimeout(1500);
  console.log('scene after enter:', await scene());
  await shot('05-level-start');
  // run right, jumping
  await page.keyboard.down('ArrowRight');
  for (let i = 0; i < 6; i++) { await key('Space', 250); await page.waitForTimeout(250); }
  await shot('06-running');
  await page.keyboard.up('ArrowRight');
  const st = await page.evaluate(() => { const p = G.Scenes.current.player; return { x: Math.round(p.x), y: Math.round(p.y), hp: p.hp, gems: G.Scenes.current.gems }; });
  console.log('player after running:', JSON.stringify(st));
  await key('KeyX');
  await key('Escape');
  await page.waitForTimeout(300);
  await shot('07-pause');
  await key('Escape');
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
  await browser.close();
  process.exit(errors.some((e) => !e.startsWith('warning')) ? 1 : 0);
})();
