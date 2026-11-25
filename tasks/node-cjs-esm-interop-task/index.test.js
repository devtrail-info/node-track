import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
// require(esm) is on by default in Node 22.12 and newer.
const noRequireEsm = !process.features.require_module;
const loadEsm = () => import('./text-utils.js');
const source = async (name) => (await readFile(path.join(here, name), 'utf8')).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

test('text-utils.js exports slugify and outputPath by name', async () => {
  const mod = await loadEsm();
  assert.equal(typeof mod.slugify, 'function');
  assert.equal(typeof mod.outputPath, 'function');
});

test('slugify turns a title into a URL-friendly name', async () => {
  const { slugify } = await loadEsm();
  assert.equal(slugify('  Summer Sale 2026! '), 'summer-sale-2026');
  assert.equal(slugify('Gift Cards & Vouchers'), 'gift-cards-vouchers');
});

test('outputPath points into the pages folder next to text-utils.js', async () => {
  const { outputPath } = await loadEsm();
  assert.equal(outputPath('Gift Cards'), path.join(here, 'pages', 'gift-cards.html'));
});

test('text-utils.js is a real ES module: no require, module.exports or __dirname', async () => {
  const code = await source('text-utils.js');
  assert.doesNotMatch(code, /\brequire\s*\(/, 'use import instead of require()');
  assert.doesNotMatch(code, /module\.exports|\bexports\./, 'use export instead of module.exports');
  assert.doesNotMatch(code, /__dirname|__filename/, 'use import.meta.dirname instead of __dirname');
  assert.match(code, /import\.meta\.dirname/);
});

test('text-utils.cjs is a bridge: require() gives the very same functions as import', { skip: noRequireEsm && 'needs Node 22.12 or newer (require(esm))' }, async () => {
  const fromRequire = require('./text-utils.cjs');
  const fromImport = await loadEsm();
  assert.equal(fromRequire.slugify, fromImport.slugify, 'text-utils.cjs still has its own copy of slugify');
  assert.equal(fromRequire.outputPath, fromImport.outputPath, 'text-utils.cjs still has its own copy of outputPath');
});

test('the old CommonJS report still prints the same two lines', { skip: noRequireEsm && 'needs Node 22.12 or newer (require(esm))' }, async () => {
  const stdout = await new Promise((resolve, reject) => {
    execFile(process.execPath, [path.join(here, 'legacy-report.cjs')], { timeout: 8000 }, (error, out) => (error ? reject(error) : resolve(out)));
  });
  assert.deepEqual(stdout.trim().split(/\r?\n/), ['summer-sale-2026', 'pages/summer-sale-2026.html']);
});

test('index.js imports slugify by name from text-utils.js', async () => {
  const code = await source('index.js');
  assert.match(code, /import\s*\{[^}]*\bslugify\b[^}]*\}\s*from\s*['"]\.\/text-utils\.js['"]/);
  const { pageLinks } = await import('./index.js');
  assert.deepEqual(pageLinks(['Gift Cards', 'Summer Sale 2026!']), ['/gift-cards', '/summer-sale-2026']);
});
