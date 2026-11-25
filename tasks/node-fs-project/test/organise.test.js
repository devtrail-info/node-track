import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import { planMoves, organise } from '../index.js';
import { makeRoot, removeRoot, photoFolder, snapshot } from './helpers.js';

before(makeRoot);
after(removeRoot);

const PHOTOS = {
  'IMG_20240517_101500.jpg': 'beach',
  'PXL_20231231_235959123.jpg': 'fireworks',
  'Screenshot 2024-05-02 at 09.12.00.png': 'receipt',
  'notes.txt': 'shopping list',
};

test('planMoves lists the files with their target folder, sorted by name', async () => {
  const dir = await photoFolder(PHOTOS);
  assert.deepEqual(await planMoves(dir), [
    { file: 'IMG_20240517_101500.jpg', target: '2024/05/IMG_20240517_101500.jpg', action: 'move' },
    { file: 'PXL_20231231_235959123.jpg', target: '2023/12/PXL_20231231_235959123.jpg', action: 'move' },
    { file: 'Screenshot 2024-05-02 at 09.12.00.png', target: '2024/05/Screenshot 2024-05-02 at 09.12.00.png', action: 'move' },
    { file: 'notes.txt', target: null, action: 'skip' },
  ]);
});

test('planMoves leaves out folders, hidden files and files inside subfolders', async () => {
  const dir = await photoFolder({
    '.DS_Store': 'x',
    '.IMG_20240101.jpg': 'hidden',
    'old_20240101/': null,
    '2023/12/IMG_20231224.jpg': 'already sorted',
    'IMG_20240101_000000.jpg': 'new year',
  });
  assert.deepEqual(await planMoves(dir), [
    { file: 'IMG_20240101_000000.jpg', target: '2024/01/IMG_20240101_000000.jpg', action: 'move' },
  ]);
});

test('planMoves marks a file whose target already exists as a conflict', async () => {
  const dir = await photoFolder({ 'IMG_20240101_000000.jpg': 'new', '2024/01/IMG_20240101_000000.jpg': 'old' });
  assert.deepEqual(await planMoves(dir), [
    { file: 'IMG_20240101_000000.jpg', target: '2024/01/IMG_20240101_000000.jpg', action: 'conflict' },
  ]);
});

test('planMoves changes nothing on disk', async () => {
  const dir = await photoFolder(PHOTOS);
  await planMoves(dir);
  assert.deepEqual(await snapshot(dir), await snapshot(await photoFolder(PHOTOS)));
});

test('organise moves dated files into YYYY/MM folders and leaves the rest', async () => {
  const dir = await photoFolder(PHOTOS);
  const plan = await organise(dir);
  assert.deepEqual(
    plan.map((e) => e.action),
    ['move', 'move', 'move', 'skip'],
  );
  assert.deepEqual(await snapshot(dir), {
    '2023/12/PXL_20231231_235959123.jpg': 'fireworks',
    '2024/05/IMG_20240517_101500.jpg': 'beach',
    '2024/05/Screenshot 2024-05-02 at 09.12.00.png': 'receipt',
    'notes.txt': 'shopping list',
  });
});

test('organise with dryRun returns the plan and changes nothing', async () => {
  const dir = await photoFolder(PHOTOS);
  const before = await snapshot(dir);
  const plan = await organise(dir, { dryRun: true });
  assert.equal(plan.length, 4);
  assert.equal(plan[0].action, 'move');
  assert.deepEqual(await snapshot(dir), before);
  assert.deepEqual(await fsp.readdir(path.join(dir)).then((names) => names.sort()), Object.keys(PHOTOS).sort(), 'no folders may be created in a dry run');
});

test('organise never replaces a file that is already in the target folder', async () => {
  const dir = await photoFolder({ 'IMG_20240101_000000.jpg': 'new', '2024/01/IMG_20240101_000000.jpg': 'old', 'IMG_20240102_000000.jpg': 'next day' });
  const plan = await organise(dir);
  assert.deepEqual(
    plan.map((e) => e.action),
    ['conflict', 'move'],
  );
  assert.deepEqual(await snapshot(dir), {
    '2024/01/IMG_20240101_000000.jpg': 'old',
    '2024/01/IMG_20240102_000000.jpg': 'next day',
    'IMG_20240101_000000.jpg': 'new',
  });
});

test('a target that appears after planning is not replaced either', async () => {
  const dir = await photoFolder({ 'IMG_20240517_101500.jpg': 'mine' });
  const targetDir = path.join(dir, '2024', '05');
  const realMkdir = fsp.mkdir;
  // Another program saves a file with the same name right after the folder is created.
  const spy = mock.method(fsp, 'mkdir', async (p, options) => {
    const result = await realMkdir(p, options);
    if (path.resolve(String(p)) === targetDir) await fsp.writeFile(path.join(targetDir, 'IMG_20240517_101500.jpg'), 'theirs');
    return result;
  });
  syncBuiltinESMExports();
  let plan;
  try {
    plan = await organise(dir);
  } finally {
    spy.mock.restore();
    syncBuiltinESMExports();
  }
  assert.equal(spy.mock.callCount() > 0, true, 'create the YYYY/MM folder with mkdir from node:fs/promises');
  assert.deepEqual(plan, [{ file: 'IMG_20240517_101500.jpg', target: '2024/05/IMG_20240517_101500.jpg', action: 'conflict' }]);
  assert.deepEqual(await snapshot(dir), {
    '2024/05/IMG_20240517_101500.jpg': 'theirs',
    'IMG_20240517_101500.jpg': 'mine',
  });
});

test('a target that appears right after an existence check is not replaced either', async () => {
  const dir = await photoFolder({ 'IMG_20240517_101500.jpg': 'mine' });
  const target = path.join(dir, '2024', '05', 'IMG_20240517_101500.jpg');
  const realExists = fs.existsSync;
  let planted = false;
  // Another program saves the same name right after you checked that it was free.
  const plant = () => {
    if (realExists(path.dirname(target)) && !realExists(target)) {
      fs.writeFileSync(target, 'theirs');
      planted = true;
    }
  };
  const isTarget = (p) => path.resolve(String(p)) === target;
  const wrap = (obj, name, sync) => {
    const real = obj[name];
    return mock.method(obj, name, function (p, ...rest) {
      if (!isTarget(p)) return real.call(this, p, ...rest);
      if (sync) {
        try {
          return real.call(this, p, ...rest);
        } finally {
          plant();
        }
      }
      return Promise.resolve(real.call(this, p, ...rest)).finally(plant);
    });
  };
  const spies = [wrap(fsp, 'stat'), wrap(fsp, 'lstat'), wrap(fsp, 'access'), wrap(fs, 'existsSync', true), wrap(fs, 'statSync', true)];
  syncBuiltinESMExports();
  let plan;
  try {
    plan = await organise(dir);
  } finally {
    spies.forEach((s) => s.mock.restore());
    syncBuiltinESMExports();
  }
  const snap = await snapshot(dir);
  if (planted) {
    assert.equal(plan[0].action, 'conflict');
    assert.equal(snap['2024/05/IMG_20240517_101500.jpg'], 'theirs', 'the file saved after your check was replaced');
    assert.equal(snap['IMG_20240517_101500.jpg'], 'mine');
  } else {
    assert.deepEqual(snap, { '2024/05/IMG_20240517_101500.jpg': 'mine' });
  }
});

test('running organise twice moves nothing the second time', async () => {
  const dir = await photoFolder(PHOTOS);
  await organise(dir);
  const after = await snapshot(dir);
  assert.deepEqual(await organise(dir), [{ file: 'notes.txt', target: null, action: 'skip' }]);
  assert.deepEqual(await snapshot(dir), after);
});
