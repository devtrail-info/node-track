import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRoot, removeRoot, photoFolder, snapshot } from './helpers.js';

const script = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'index.js');

function run(args) {
  return new Promise((resolve) => {
    execFile(process.execPath, [script, ...args], { timeout: 5000 }, (error, stdout, stderr) => {
      resolve({ code: error ? (error.code ?? 1) : 0, stdout, stderr });
    });
  });
}
const lines = (text) => text.trim().split(/\r?\n/);

before(makeRoot);
after(removeRoot);

const PHOTOS = {
  'IMG_20240101_000000.jpg': 'new',
  '2024/01/IMG_20240101_000000.jpg': 'old',
  'IMG_20240517_101500.jpg': 'beach',
  'notes.txt': 'shopping list',
};

test('node index.js <folder> moves the photos, prints each step and a summary', async () => {
  const dir = await photoFolder({ 'IMG_20240517_101500.jpg': 'beach', 'notes.txt': 'shopping list' });
  const r = await run([dir]);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(lines(r.stdout), [
    'moved IMG_20240517_101500.jpg -> 2024/05/IMG_20240517_101500.jpg',
    'skipped notes.txt (no date in the name)',
    'Moved 1, skipped 1, conflicts 0.',
  ]);
  assert.deepEqual(await snapshot(dir), { '2024/05/IMG_20240517_101500.jpg': 'beach', 'notes.txt': 'shopping list' });
});

test('a conflict is reported and the exit code is 1', async () => {
  const dir = await photoFolder(PHOTOS);
  const r = await run([dir]);
  assert.equal(r.code, 1, r.stderr);
  assert.deepEqual(lines(r.stdout), [
    'conflict IMG_20240101_000000.jpg: 2024/01/IMG_20240101_000000.jpg already exists',
    'moved IMG_20240517_101500.jpg -> 2024/05/IMG_20240517_101500.jpg',
    'skipped notes.txt (no date in the name)',
    'Moved 1, skipped 1, conflicts 1.',
  ]);
});

test('--dry-run prints the plan and changes nothing, before or after the folder', async () => {
  for (const args of [(d) => [d, '--dry-run'], (d) => ['--dry-run', d]]) {
    const dir = await photoFolder(PHOTOS);
    const before = await snapshot(dir);
    const r = await run(args(dir));
    assert.equal(r.code, 1, r.stderr);
    assert.deepEqual(lines(r.stdout), [
      'conflict IMG_20240101_000000.jpg: 2024/01/IMG_20240101_000000.jpg already exists',
      'would move IMG_20240517_101500.jpg -> 2024/05/IMG_20240517_101500.jpg',
      'skipped notes.txt (no date in the name)',
      'Would move 1, skipped 1, conflicts 1.',
    ]);
    assert.deepEqual(await snapshot(dir), before);
  }
});

test('bad usage prints the usage line to stderr and exits with code 2', async () => {
  const dir = await photoFolder({ 'IMG_20240517_101500.jpg': 'beach' });
  for (const args of [[], ['--dry-run'], [dir, dir], [dir, '--force']]) {
    const r = await run(args);
    assert.equal(r.code, 2, `args ${JSON.stringify(args)}`);
    assert.match(r.stderr, /Usage: node index\.js <folder> \[--dry-run\]/);
    assert.equal(r.stdout, '');
  }
  assert.deepEqual(await snapshot(dir), { 'IMG_20240517_101500.jpg': 'beach' });
});

test('a missing folder or a file prints "Not a folder" and exits with code 1', async () => {
  const dir = await photoFolder({ 'notes.txt': 'x' });
  for (const target of [path.join(dir, 'nope'), path.join(dir, 'notes.txt')]) {
    const r = await run([target]);
    assert.equal(r.code, 1);
    assert.match(r.stderr, new RegExp(`Not a folder: ${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  }
});
