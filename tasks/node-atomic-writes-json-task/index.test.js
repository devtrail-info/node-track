import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import { readJson, writeJsonAtomic, updateJson } from './index.js';

let dir;
let n = 0;
// A fresh folder for each test, inside one temp folder for the whole file.
async function freshDir() {
  const d = path.join(dir, `case-${++n}`);
  await fsp.mkdir(d);
  return d;
}
const tmpFiles = async (d) => (await fsp.readdir(d)).filter((name) => name.endsWith('.tmp'));

// Replaces fs/promises' rename for one test. Works for every way of importing node:fs/promises.
function spyRename(impl) {
  const spy = mock.method(fsp, 'rename', impl);
  syncBuiltinESMExports();
  return {
    spy,
    restore() {
      spy.mock.restore();
      syncBuiltinESMExports();
    },
  };
}

before(async () => {
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'devtrail-'));
});
after(async () => {
  await fsp.rm(dir, { recursive: true, force: true });
});

test('readJson returns the parsed content of a file', async () => {
  const d = await freshDir();
  await fsp.writeFile(path.join(d, 'cart.json'), '{ "items": [{ "sku": "MUG-1", "qty": 2 }] }');
  assert.deepEqual(await readJson(path.join(d, 'cart.json'), null), { items: [{ sku: 'MUG-1', qty: 2 }] });
});

test('readJson returns the fallback when the file does not exist', async () => {
  const d = await freshDir();
  assert.deepEqual(await readJson(path.join(d, 'missing.json'), []), []);
  assert.equal(await readJson(path.join(d, 'missing.json'), 0), 0);
});

test('readJson rejects with a SyntaxError for broken JSON instead of hiding it', async () => {
  const d = await freshDir();
  await fsp.writeFile(path.join(d, 'broken.json'), '{ "items": [');
  await assert.rejects(readJson(path.join(d, 'broken.json'), []), SyntaxError);
});

test('readJson rejects with EISDIR when the path is a folder', async () => {
  const d = await freshDir();
  await assert.rejects(readJson(d, []), { code: 'EISDIR' });
});

test('writeJsonAtomic writes 2-space JSON with a final newline', async () => {
  const d = await freshDir();
  const file = path.join(d, 'cart.json');
  await writeJsonAtomic(file, { items: 2, owner: 'ana' });
  assert.equal(await fsp.readFile(file, 'utf8'), '{\n  "items": 2,\n  "owner": "ana"\n}\n');
  await writeJsonAtomic(file, [1]);
  assert.equal(await fsp.readFile(file, 'utf8'), '[\n  1\n]\n');
});

test('writeJsonAtomic writes a temporary file in the same folder and renames it over the file', async () => {
  const d = await freshDir();
  const file = path.join(d, 'cart.json');
  const real = fsp.rename;
  const calls = [];
  const r = spyRename(async (from, to) => {
    calls.push([String(from), String(to), await fsp.readFile(from, 'utf8')]);
    return real(from, to);
  });
  try {
    await writeJsonAtomic(file, { items: 3 });
  } finally {
    r.restore();
  }
  assert.equal(calls.length, 1, 'expected exactly one rename');
  const [from, to, content] = calls[0];
  assert.equal(path.resolve(to), path.resolve(file), 'the rename must end at the file itself');
  assert.equal(path.dirname(path.resolve(from)), path.resolve(d), 'the temporary file must be in the same folder');
  assert.match(path.basename(from), /^\.cart\.json\..+\.tmp$/, 'temporary name: .cart.json.<something>.tmp');
  assert.equal(content, '{\n  "items": 3\n}\n', 'the temporary file must hold the full new content before the rename');
  assert.deepEqual(await tmpFiles(d), []);
});

test('two writes at the same time use different temporary files and both succeed', async () => {
  const d = await freshDir();
  const file = path.join(d, 'cart.json');
  const real = fsp.rename;
  const temps = [];
  const r = spyRename(async (from, to) => {
    temps.push(String(from));
    return real(from, to);
  });
  try {
    await Promise.all(Array.from({ length: 10 }, (_, i) => writeJsonAtomic(file, { version: i })));
  } finally {
    r.restore();
  }
  assert.equal(new Set(temps).size, 10, 'each write needs its own temporary file');
  const saved = JSON.parse(await fsp.readFile(file, 'utf8'));
  assert.ok(saved.version >= 0 && saved.version < 10);
  assert.deepEqual(await tmpFiles(d), []);
});

test('when the rename fails, the old file stays and no temporary file is left', async () => {
  const d = await freshDir();
  const file = path.join(d, 'cart.json');
  await fsp.writeFile(file, '{ "items": 1 }');
  const r = spyRename(async () => {
    throw Object.assign(new Error('EPERM: operation not permitted, rename'), { code: 'EPERM' });
  });
  try {
    await assert.rejects(writeJsonAtomic(file, { items: 99 }), { code: 'EPERM' });
  } finally {
    r.restore();
  }
  assert.equal(await fsp.readFile(file, 'utf8'), '{ "items": 1 }');
  assert.deepEqual(await tmpFiles(d), [], 'remove the temporary file when something fails');
});

test('data that JSON cannot save rejects and leaves the old file unchanged', async () => {
  const d = await freshDir();
  const file = path.join(d, 'cart.json');
  await fsp.writeFile(file, '{ "items": 1 }');
  await assert.rejects(writeJsonAtomic(file, { total: 10n }), TypeError);
  assert.equal(await fsp.readFile(file, 'utf8'), '{ "items": 1 }');
  assert.deepEqual(await tmpFiles(d), []);
});

test('updateJson starts from the fallback and returns the saved value', async () => {
  const d = await freshDir();
  const file = path.join(d, 'jobs.json');
  const saved = await updateJson(file, [], (jobs) => [...jobs, { id: 1, task: 'send-invoice' }]);
  assert.deepEqual(saved, [{ id: 1, task: 'send-invoice' }]);
  assert.deepEqual(JSON.parse(await fsp.readFile(file, 'utf8')), saved);
});

test('updateJson accepts an async update function', async () => {
  const d = await freshDir();
  const file = path.join(d, 'jobs.json');
  await fsp.writeFile(file, '{ "done": 4 }');
  const saved = await updateJson(file, null, async (state) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { done: state.done + 1 };
  });
  assert.deepEqual(saved, { done: 5 });
});

test('20 updates started at the same time are all kept', async () => {
  const d = await freshDir();
  const file = path.join(d, 'count.json');
  await Promise.all(Array.from({ length: 20 }, () => updateJson(file, 0, (count) => count + 1)));
  assert.equal(JSON.parse(await fsp.readFile(file, 'utf8')), 20);
});

test('updates for one file run in the order they were called', async () => {
  const d = await freshDir();
  const file = path.join(d, 'log.json');
  const slow = (entry, ms) => async (list) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    return [...list, entry];
  };
  await Promise.all([updateJson(file, [], slow('a', 30)), updateJson(file, [], slow('b', 1)), updateJson(file, [], slow('c', 10))]);
  assert.deepEqual(JSON.parse(await fsp.readFile(file, 'utf8')), ['a', 'b', 'c']);
});

test('a failing update rejects on its own and the next updates still run', async () => {
  const d = await freshDir();
  const file = path.join(d, 'count.json');
  const results = await Promise.allSettled([
    updateJson(file, 0, (count) => count + 1),
    updateJson(file, 0, () => {
      throw new Error('payment service down');
    }),
    updateJson(file, 0, (count) => count + 1),
  ]);
  assert.deepEqual(
    results.map((r) => r.status),
    ['fulfilled', 'rejected', 'fulfilled'],
  );
  assert.equal(results[1].reason.message, 'payment service down');
  assert.equal(JSON.parse(await fsp.readFile(file, 'utf8')), 2);
  assert.equal(await updateJson(file, 0, (count) => count + 1), 3);
});
