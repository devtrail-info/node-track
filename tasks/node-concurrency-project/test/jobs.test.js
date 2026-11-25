import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runJobs, testWorker, sha256, within, runNode, indexPath } from './helpers.js';

const dirs = [];
after(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

test('runJobs reports results in the order they finish, through onResult and in the returned array', { timeout: 30_000 }, async () => {
  const seen = [];
  const jobs = [
    { id: 'slow', data: new Uint8Array(0), algorithm: 'sleep:1500' },
    { id: 'fast', data: new Uint8Array(0), algorithm: 'sleep:50' },
    { id: 'medium', data: new Uint8Array(0), algorithm: 'sleep:800' },
  ];
  const results = await within(runJobs(jobs, { size: 3, workerUrl: testWorker, onResult: (r) => seen.push(r.id) }), 15_000, 'runJobs');
  assert.deepEqual(seen, ['fast', 'medium', 'slow'], 'onResult is called as each job finishes');
  assert.deepEqual(results.map((r) => r.id), ['fast', 'medium', 'slow'], 'the array is in completion order too');
  assert.deepEqual(results[0], { id: 'fast', checksum: 'slept 50' });
});

test('runJobs never rejects for a failed job: the failure is a result with an error message', { timeout: 30_000 }, async () => {
  const jobs = [
    { id: 'broken', data: new Uint8Array(0), algorithm: 'crash' },
    { id: 'fine', data: new Uint8Array(0), algorithm: 'sleep:1000' },
  ];
  const results = await within(runJobs(jobs, { size: 2, workerUrl: testWorker }), 15_000, 'runJobs');
  assert.deepEqual(results, [
    { id: 'broken', error: 'worker stopped with exit code 1' },
    { id: 'fine', checksum: 'slept 1000' },
  ]);
});

test('runJobs without a size uses at most os.availableParallelism() workers', { timeout: 30_000 }, async () => {
  const n = os.availableParallelism();
  const jobs = Array.from({ length: n + 3 }, (_, i) => ({ id: 'j' + i, data: new Uint8Array(0), algorithm: 'whoami:100' }));
  const results = await within(runJobs(jobs, { workerUrl: testWorker }), 25_000, 'runJobs');
  assert.equal(results.length, n + 3);
  const threads = new Set(results.map((r) => r.checksum));
  assert.ok(threads.size <= n, `${threads.size} worker threads were used for ${n + 3} jobs; the default is os.availableParallelism() = ${n}`);
  const two = await within(runJobs(jobs.slice(0, 2), { workerUrl: testWorker }), 15_000, 'runJobs');
  assert.ok(new Set(two.map((r) => r.checksum)).size <= 2, 'two jobs never need more than two workers');
});

test('the CLI prints one checksum line per file and a summary, and exits with 0 or 1', { timeout: 40_000 }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'devtrail-'));
  dirs.push(dir);
  const files = ['a.bin', 'b.bin', 'c.bin'].map((name) => path.join(dir, name));
  const contents = ['invoice A', 'invoice B'.repeat(1000), 'invoice C'];
  await Promise.all(files.map((file, i) => writeFile(file, contents[i])));

  const ok = await runNode(indexPath, files, { env: { POOL_SIZE: '2' } });
  assert.equal(ok.code, 0, `stderr: ${ok.stderr}`);
  files.forEach((file, i) => assert.ok(ok.stdout.includes(`${sha256(contents[i])}  ${file}`), `a line "<checksum>  ${path.basename(file)}"`));
  assert.match(ok.stdout.trim().split('\n').at(-1), /^3 files, 0 failed$/);

  const missing = path.join(dir, 'missing.bin');
  const bad = await runNode(indexPath, [files[0], missing], { env: { POOL_SIZE: '2' } });
  assert.equal(bad.code, 1, 'exit code 1 when a file failed');
  assert.match(bad.stdout, new RegExp(`ERROR  .*missing\\.bin`));
  assert.match(bad.stdout.trim().split('\n').at(-1), /^2 files, 1 failed$/);
});
