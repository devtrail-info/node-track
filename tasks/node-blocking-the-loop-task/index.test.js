import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { countPrimes } from './index.js';

const script = fileURLToPath(new URL('./index.js', import.meta.url));

test('countPrimes(100) resolves to 25', async () => {
  assert.equal(await countPrimes(100), 25);
});

test('countPrimes counts below the limit, not up to it', async () => {
  assert.equal(await countPrimes(0), 0);
  assert.equal(await countPrimes(2), 0);
  assert.equal(await countPrimes(3), 1);
  assert.equal(await countPrimes(8), 4);
});

test('the answer is the same for any chunk size', async () => {
  assert.equal(await countPrimes(30_000, { chunkSize: 7 }), 3245);
  assert.equal(await countPrimes(30_000, { chunkSize: 1_000_000 }), 3245);
});

test('countPrimes returns a promise', () => {
  const result = countPrimes(10);
  assert.ok(result instanceof Promise, 'countPrimes should return a promise');
  return result;
});

test('an immediate scheduled before the call runs before the count is done', async () => {
  let otherWorkRan = false;
  setImmediate(() => {
    otherWorkRan = true;
  });
  await countPrimes(200_000, { chunkSize: 10_000 });
  assert.equal(otherWorkRan, true, 'the event loop never got a turn between chunks');
});

test('a 5 ms heartbeat keeps firing while countPrimes(1_000_000) works', async () => {
  let beats = 0;
  const heartbeat = setInterval(() => {
    beats++;
  }, 5);
  try {
    const count = await countPrimes(1_000_000);
    assert.equal(count, 78498);
  } finally {
    clearInterval(heartbeat);
  }
  assert.ok(beats >= 2, `the heartbeat fired ${beats} time(s) during the work; expected at least 2`);
});

test('running the file prints the number of primes below one million', async () => {
  const stdout = await new Promise((resolve, reject) => {
    execFile(process.execPath, [script], { timeout: 8000 }, (error, out) => (error ? reject(error) : resolve(out)));
  });
  assert.equal(stdout.trim(), 'Primes below 1000000: 78498');
});
