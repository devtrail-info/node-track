import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashInWorker, expectedHash, orderBytes, runScript } from './helpers.js';

test('hashInWorker resolves with the right hex digest, for rounds and other algorithms too', { timeout: 30_000 }, async () => {
  const data = orderBytes(1000);
  assert.equal(await hashInWorker(data), expectedHash(data), 'one round of sha256 by default');
  assert.equal(await hashInWorker(data, { rounds: 3 }), expectedHash(data, 'sha256', 3), 'rounds: 3 hashes the digest again, twice');
  assert.equal(await hashInWorker(data, { algorithm: 'md5' }), expectedHash(data, 'md5'), 'the algorithm option is used');
  assert.equal(await hashInWorker(Buffer.from('invoice 2026-118')), expectedHash(Buffer.from('invoice 2026-118')), 'a Buffer works too');
});

test('the hashing runs in a worker: timers on the main thread keep firing while it works', { timeout: 30_000 }, async () => {
  const data = orderBytes(64 * 1024);
  const rounds = 1_000_000;
  let ticks = 0;
  let last = Date.now();
  let maxGap = 0;
  const beat = setInterval(() => {
    const now = Date.now();
    maxGap = Math.max(maxGap, now - last);
    last = now;
    ticks++;
  }, 10);
  const started = Date.now();
  let hex;
  try {
    hex = await hashInWorker(data, { rounds });
  } finally {
    clearInterval(beat);
  }
  const took = Date.now() - started;
  assert.equal(hex, expectedHash(data, 'sha256', rounds));
  assert.ok(ticks >= 3, `a 10 ms timer fired only ${ticks} time(s) during ${took} ms of hashing: the main thread was blocked`);
  // Generous for busy machines; a solution that hashes on the main thread gets no ticks at all during the hash.
  assert.ok(maxGap < Math.max(250, took * 0.6), `the main thread was blocked for ${maxGap} ms in one go (of ${took} ms)`);
});

test('transfer: true moves the bytes to the worker; without it they are copied', { timeout: 30_000 }, async () => {
  const kept = orderBytes(4096);
  const keptHash = expectedHash(kept);
  assert.equal(await hashInWorker(kept), keptHash);
  assert.equal(kept.byteLength, 4096, 'without transfer the caller keeps its bytes (they were copied)');

  const moved = orderBytes(4096, 9);
  const movedHash = expectedHash(moved);
  const pending = hashInWorker(moved, { transfer: true });
  assert.equal(moved.byteLength, 0, 'with transfer: true the bytes belong to the worker right after the call');
  assert.equal(await pending, movedHash, 'and the worker still hashes the right bytes');
});

test('after the answer nothing is left running, so a script can end by itself', { timeout: 30_000 }, async () => {
  const run = await runScript('done');
  assert.ok(run.exitedByItself, `the script did not end within 10 s after printing the hash: is a worker or listener still alive? stdout: ${run.stdout} stderr: ${run.stderr}`);
  assert.match(run.stdout, new RegExp('hash ' + expectedHash(new Uint8Array([1, 2, 3]))));
});
