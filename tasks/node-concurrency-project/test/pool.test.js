import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { pool, createPool, testWorker, sha256, settle, within, runNode } from './helpers.js';

const job = (id, ms) => ({ id, data: new Uint8Array(0), algorithm: `sleep:${ms}` });

test('run() resolves with the checksum of the job, computed in a worker', { timeout: 30_000 }, async () => {
  const p = pool({ size: 2 });
  const bytes = new Uint8Array(100_000).map((_, i) => i % 251);
  const a = await within(p.run({ id: 'export-1', data: bytes }), 15_000, 'run');
  assert.equal(a.id, 'export-1');
  assert.equal(a.checksum, sha256(bytes), 'sha256 by default');
  assert.ok(Number.isInteger(a.threadId) && a.threadId > 0, 'threadId is the worker thread that did the job');
  const b = await within(p.run({ id: 7, data: Buffer.from('order 7'), algorithm: 'md5' }), 15_000, 'run');
  assert.equal(b.checksum, createHash('md5').update('order 7').digest('hex'), 'the job\'s algorithm is used');
  assert.equal(b.id, 7);
});

test('a bad job rejects with its error message, and the worker keeps working', { timeout: 30_000 }, async () => {
  const p = pool({ size: 1 });
  await assert.rejects(within(p.run({ id: 'x', data: new Uint8Array(1), algorithm: 'no-such-digest' }), 15_000, 'run'), (err) => {
    assert.match(err.message, /Digest method not supported/);
    return true;
  });
  const ok = await within(p.run({ id: 'y', data: new Uint8Array(1) }), 15_000, 'run');
  assert.equal(ok.checksum, sha256(new Uint8Array(1)));
  assert.equal(p.stats().created, 1, 'a bad job is not a crash: the same worker is used again');
});

test('never more than size workers: they are reused and extra jobs wait in a queue', { timeout: 30_000 }, async () => {
  const p = pool({ size: 2, workerUrl: testWorker });
  const pending = [1, 2, 3, 4, 5, 6].map((n) => p.run(job(n, 100)));
  assert.deepEqual(p.stats(), { created: 2, running: 2, queued: 4 }, 'right after six run() calls');
  const results = await settle(pending);
  assert.ok(results.every((r) => r.status === 'fulfilled'), 'every job resolves');
  assert.equal(new Set(results.map((r) => r.value.threadId)).size, 2, 'the six jobs ran on the same two workers');
  assert.deepEqual(p.stats(), { created: 2, running: 0, queued: 0 });
  for (const bad of [0, -1, 1.5, '2']) {
    assert.throws(() => createPool({ size: bad, workerUrl: testWorker }), RangeError, `size ${JSON.stringify(bad)} is a RangeError`);
  }
});

test('without a size, the pool starts os.availableParallelism() workers at most', { timeout: 30_000 }, async () => {
  const n = os.availableParallelism();
  const p = pool({ workerUrl: testWorker });
  const pending = Array.from({ length: n + 2 }, (_, i) => p.run(job('d' + i, 50)));
  assert.deepEqual(p.stats(), { created: n, running: n, queued: 2 }, `right after ${n + 2} run() calls, with os.availableParallelism() = ${n}`);
  const results = await settle(pending, 30_000);
  assert.ok(results.every((r) => r.status === 'fulfilled'), 'every job resolves');
});

test('jobs on different workers run at the same time', { timeout: 30_000 }, async () => {
  const p = pool({ size: 3, workerUrl: testWorker });
  await settle(['w1', 'w2', 'w3'].map((id) => p.run(job(id, 1)))); // start the three workers first: start-up time is not measured
  const started = Date.now();
  const results = await settle(['a', 'b', 'c'].map((id) => p.run(job(id, 500))));
  const took = Date.now() - started;
  assert.ok(results.every((r) => r.status === 'fulfilled'), 'every job resolves');
  assert.ok(took < 1200, `three 500 ms jobs on three workers took ${took} ms: they should overlap (one after another is 1500 ms)`);
});

test('a crashed worker fails only its job and is replaced', { timeout: 30_000 }, async () => {
  const p = pool({ size: 2, workerUrl: testWorker });
  const crash = p.run({ id: 'bad', data: new Uint8Array(0), algorithm: 'crash' });
  const others = [1, 2, 3, 4].map((n) => p.run(job(n, 50)));
  const [crashed, ...rest] = await settle([crash, ...others]);
  assert.equal(crashed.status, 'rejected');
  assert.equal(crashed.reason.message, 'worker stopped with exit code 1');
  assert.ok(rest.every((r) => r.status === 'fulfilled'), 'the other jobs still finish');
  assert.equal(p.stats().created, 3, 'one new worker replaced the crashed one');

  const q = pool({ size: 1, workerUrl: testWorker });
  const [thrown, after] = await settle([q.run({ id: 't', data: new Uint8Array(0), algorithm: 'throw' }), q.run(job('next', 10))]);
  assert.equal(thrown.status, 'rejected');
  assert.equal(thrown.reason.message, 'worker bug in job t', 'an uncaught error in the worker rejects its job with that error');
  assert.equal(after.status, 'fulfilled', 'the queued job runs on the replacement');
  assert.equal(q.stats().created, 2);
});

test('close() rejects queued jobs, lets running ones finish, and later run() calls reject', { timeout: 30_000 }, async () => {
  const p = pool({ size: 1, workerUrl: testWorker });
  const running = p.run(job('running', 200));
  const queued = [p.run(job('q1', 10)), p.run(job('q2', 10))];
  const closing = p.close();
  const [r, q1, q2] = await settle([running, ...queued]);
  assert.equal(r.status, 'fulfilled', 'the running job finishes');
  for (const q of [q1, q2]) {
    assert.equal(q.status, 'rejected');
    assert.equal(q.reason.message, 'pool closed');
  }
  await within(closing, 10_000, 'close()');
  await assert.rejects(p.run(job('late', 10)), { message: 'pool closed' });
});

test('after close() nothing is left running, so a script can end by itself', { timeout: 40_000 }, async () => {
  const run = await runNode(fileURLToPath(new URL('./fixtures/close-script.js', import.meta.url)), [], { ms: 15_000 });
  assert.match(run.stdout, /closed after invoice-1/, `stderr: ${run.stderr}`);
  assert.ok(run.exitedByItself, 'the script did not end after close(): a worker is still alive');
});
