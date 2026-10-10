// Bundles the game into tetherfall-standalone.html (one file, opens straight from disk).
// Usage: node build.mjs   (needs esbuild: npm i -D esbuild)
import { readFileSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';

const out = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  alias: { three: './vendor/three.module.min.js' },
  legalComments: 'inline', // keeps the three.js MIT notice
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('style.css', 'utf8');
let html = readFileSync('index.html', 'utf8');
html = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${css}\n</style>`);
html = html.replace(/<script type="importmap">.*?<\/script>\n?/s, '');
html = html.replace('<script type="module" src="src/main.js"></script>', () => `<script>\n${js}\n</script>`);
writeFileSync('tetherfall-standalone.html', html);
console.log('wrote tetherfall-standalone.html', (html.length / 1024).toFixed(0) + ' KB');
