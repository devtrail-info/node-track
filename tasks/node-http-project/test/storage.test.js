import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import { setupRoot, cleanup, freshFile, start, stop, sample } from './helpers.js';

before(setupRoot);
after(cleanup);

const exists = (p) => fsp.access(p).then(() => true, () => false);

test('a missing data file means no bookmarks, and it is not created by reads', async () => {
  const file = await freshFile();
  const { api } = await start({ file });
  assert.deepEqual((await api('GET', '/bookmarks')).json, []);
  assert.equal((await api('GET', '/bookmarks/1')).status, 404);
  assert.equal(await exists(file), false, 'reads must not create the file');
});

test('every change is saved as { nextId, bookmarks } and ids are never reused', async () => {
  const file = await freshFile();
  const { api } = await start({ file });
  await api('POST', '/bookmarks', sample);
  await api('POST', '/bookmarks', { url: 'https://b.example/', title: 'B' });
  let data = JSON.parse(await fsp.readFile(file, 'utf8'));
  assert.equal(data.nextId, 3);
  assert.deepEqual(data.bookmarks.map((b) => b.id), [1, 2]);
  assert.equal(data.bookmarks[0].url, sample.url);

  assert.equal((await api('DELETE', '/bookmarks/2')).status, 204);
  data = JSON.parse(await fsp.readFile(file, 'utf8'));
  assert.deepEqual(data.bookmarks.map((b) => b.id), [1], 'the delete is saved');

  const next = await api('POST', '/bookmarks', { url: 'https://c.example/', title: 'C' });
  assert.equal(next.json.id, 3, 'id 2 is not reused');
});

test('a new server with the same file sees the saved data', async () => {
  const file = await freshFile();
  const first = await start({ file });
  await first.api('POST', '/bookmarks', sample);
  await first.api('POST', '/bookmarks', { url: 'https://b.example/', title: 'B' });
  await first.api('DELETE', '/bookmarks/2');
  await stop(first.server);

  const second = await start({ file });
  const list = await second.api('GET', '/bookmarks');
  assert.deepEqual(list.json.map((b) => b.id), [1]);
  const created = await second.api('POST', '/bookmarks', { url: 'https://c.example/', title: 'C' });
  assert.equal(created.json.id, 3, 'nextId survives the restart');
});

test('existing data in the file is served', async () => {
  const file = await freshFile();
  const stored = { nextId: 8, bookmarks: [{ id: 7, url: 'https://old.example/', title: 'Old', tags: ['x'], createdAt: '2026-01-01T00:00:00.000Z' }] };
  await fsp.writeFile(file, JSON.stringify(stored));
  const { api } = await start({ file });
  assert.deepEqual((await api('GET', '/bookmarks/7')).json, stored.bookmarks[0]);
  assert.equal((await api('POST', '/bookmarks', sample)).json.id, 8);
});

test('twenty POSTs at the same time give twenty bookmarks, all saved', async () => {
  const file = await freshFile();
  const { api } = await start({ file });
  const results = await Promise.all(
    Array.from({ length: 20 }, (_, i) => api('POST', '/bookmarks', { url: `https://site${i}.example/`, title: `Site ${i}` })),
  );
  assert.deepEqual(results.map((r) => r.status), Array(20).fill(201));
  assert.deepEqual(results.map((r) => r.json.id).sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i + 1));
  const data = JSON.parse(await fsp.readFile(file, 'utf8'));
  assert.equal(data.bookmarks.length, 20);
  assert.equal(data.nextId, 21);
  const same = await Promise.all([1, 2, 3].map(() => api('POST', '/bookmarks', { url: 'https://dup.example/', title: 'Dup' })));
  assert.deepEqual(same.map((r) => r.status).sort(), [201, 409, 409], 'two parallel POSTs of one url: one wins');
});

test('saving writes a temporary file in the same folder and renames it over the data file', async () => {
  const file = await freshFile();
  const { api } = await start({ file });
  const real = fsp.rename;
  const calls = [];
  const spy = mock.method(fsp, 'rename', async (from, to) => {
    calls.push([String(from), String(to)]);
    return real(from, to);
  });
  syncBuiltinESMExports();
  try {
    assert.equal((await api('POST', '/bookmarks', sample)).status, 201);
  } finally {
    spy.mock.restore();
    syncBuiltinESMExports();
  }
  assert.equal(calls.length, 1, 'one rename per change');
  const [from, to] = calls[0];
  assert.equal(path.resolve(to), path.resolve(file));
  assert.equal(path.dirname(path.resolve(from)), path.dirname(path.resolve(file)), 'the temporary file is in the same folder');
  assert.notEqual(path.resolve(from), path.resolve(file));
  const left = (await fsp.readdir(path.dirname(file))).filter((f) => f !== 'bookmarks.json');
  assert.deepEqual(left, [], 'no temporary files are left behind');
});

test('a corrupt data file gives 500 and is never overwritten; the server keeps running', async () => {
  const file = await freshFile();
  await fsp.writeFile(file, '{"nextId": 3, "bookmarks": [');
  const { api } = await start({ file });
  const list = await api('GET', '/bookmarks');
  assert.equal(list.status, 500);
  assert.equal(typeof list.json?.error, 'string');
  const post = await api('POST', '/bookmarks', sample);
  assert.equal(post.status, 500);
  assert.equal(await fsp.readFile(file, 'utf8'), '{"nextId": 3, "bookmarks": [', 'the file must not be overwritten');
  assert.equal((await api('GET', '/nope')).status, 404, 'the server still answers');
});
