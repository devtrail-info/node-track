import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildReport, formatReport } from './index.js';
import { makeOrder } from './orders.js';

const script = fileURLToPath(new URL('./index.js', import.meta.url));

const FULL = {
  orders: 1_000_000,
  paid: 950_000,
  refunded: 50_000,
  revenueCents: 24_225_000_000,
  byRegion: { north: 5_100_000_000, south: 6_375_250_000, east: 6_375_000_000, west: 6_374_750_000 },
};

test('buildReport(4) sums the first four orders', async () => {
  assert.deepEqual(await buildReport(4), {
    orders: 4,
    paid: 3,
    refunded: 1,
    revenueCents: 49014,
    byRegion: { north: 0, south: 8419, east: 16338, west: 24257 },
  });
});

test('buildReport(1000) matches a simple count of the same orders', async () => {
  const expected = { orders: 0, paid: 0, refunded: 0, revenueCents: 0, byRegion: { north: 0, south: 0, east: 0, west: 0 } };
  for (let i = 0; i < 1000; i++) {
    const order = makeOrder(i);
    expected.orders++;
    if (order.status === 'paid') {
      expected.paid++;
      expected.revenueCents += order.amountCents;
      expected.byRegion[order.region] += order.amountCents;
    } else {
      expected.refunded++;
    }
  }
  assert.deepEqual(await buildReport(1000, { chunkSize: 128 }), expected);
});

test('buildReport() with no arguments summarises 1,000,000 orders', async () => {
  assert.deepEqual(await buildReport(), FULL);
});

test('onProgress is called after each chunk with the orders done so far', async () => {
  const calls = [];
  await buildReport(10, { chunkSize: 4, onProgress: (done) => calls.push(done) });
  assert.deepEqual(calls, [4, 8, 10]);
});

test('the event loop gets a turn between chunks', async () => {
  let otherWorkRan = false;
  setImmediate(() => {
    otherWorkRan = true;
  });
  await buildReport(200_000, { chunkSize: 10_000 });
  assert.equal(otherWorkRan, true, 'an immediate scheduled before the call did not run until the report was done');
});

test('a 10 ms heartbeat fires while 1,000,000 orders are summarised', async () => {
  let beats = 0;
  const heartbeat = setInterval(() => {
    beats++;
  }, 10);
  let report;
  try {
    report = await buildReport(1_000_000);
  } finally {
    clearInterval(heartbeat);
  }
  assert.deepEqual(report, FULL);
  assert.ok(beats >= 1, 'the heartbeat never fired during the work: the loop was blocked');
});

test('formatReport prints one line per value, money with 2 decimals', () => {
  const text = formatReport({
    orders: 4,
    paid: 3,
    refunded: 1,
    revenueCents: 49014,
    byRegion: { north: 0, south: 8419, east: 16338, west: 24257 },
  });
  assert.equal(
    text,
    ['Orders: 4', 'Paid: 3', 'Refunded: 1', 'Revenue: 490.14', 'north: 0.00', 'south: 84.19', 'east: 163.38', 'west: 242.57'].join('\n'),
  );
});

test('running the file prints the full report and the heartbeat count', async () => {
  const stdout = await new Promise((resolve, reject) => {
    execFile(process.execPath, [script], { timeout: 8000 }, (error, out) => (error ? reject(error) : resolve(out)));
  });
  const lines = stdout.trim().split(/\r?\n/);
  assert.deepEqual(lines.slice(0, 8), [
    'Orders: 1000000',
    'Paid: 950000',
    'Refunded: 50000',
    'Revenue: 242250000.00',
    'north: 51000000.00',
    'south: 63752500.00',
    'east: 63750000.00',
    'west: 63747500.00',
  ]);
  assert.match(lines[8] ?? '', /^Heartbeats during the work: [1-9]\d*$/);
});
