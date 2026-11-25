import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { hashInWorker, fixture, orderBytes, runScript, wait } from './helpers.js';

const dirs = [];
after(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

test('an error thrown in the worker rejects the promise with that error', { timeout: 30_000 }, async () => {
  await assert.rejects(hashInWorker(orderBytes(10), { algorithm: 'no-such-digest' }), (err) => {
    assert.ok(err instanceof Error, 'an Error object');
    assert.match(err.message, /Digest method not supported/, 'the error from crypto, as thrown in the worker');
    return true;
  });
});

test('a worker that stops without answering rejects with its exit code', { timeout: 30_000 }, async () => {
  await assert.rejects(hashInWorker(orderBytes(10), { workerUrl: fixture('exit-worker.js') }), (err) => {
    assert.equal(err.message, 'worker stopped with exit code 3');
    return true;
  });
});

test('an abort terminates the worker and rejects with signal.reason, quickly', { timeout: 30_000 }, async () => {
  const controller = new AbortController();
  const reason = new Error('user cancelled the export');
  let abortedAt = Infinity;
  setTimeout(() => {
    abortedAt = Date.now();
    controller.abort(reason);
  }, 100);
  await assert.rejects(hashInWorker(orderBytes(10), { signal: controller.signal, workerUrl: fixture('slow-worker.js') }), (err) => {
    assert.equal(err, reason, 'rejects with signal.reason itself');
    return true;
  });
  assert.ok(Date.now() - abortedAt < 1000, 'rejects right after the abort, without waiting for the worker (it would run 1.5 s)');

  const run = await runScript('abort');
  assert.match(run.stdout, /rejected with the reason/);
  assert.ok(run.exitedByItself, 'after the abort the worker must be terminated: the script could not end by itself');
});

test('an already aborted signal rejects at once and starts no worker', { timeout: 30_000 }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'devtrail-'));
  dirs.push(dir);
  const marker = path.join(dir, 'started.txt');
  const reason = new Error('too late');
  await assert.rejects(
    hashInWorker(orderBytes(10), { algorithm: marker, signal: AbortSignal.abort(reason), workerUrl: fixture('touch-worker.js') }),
    (err) => err === reason,
  );
  await wait(300);
  await assert.rejects(access(marker), 'no worker may be started for an aborted signal');
});
