import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAll, startServer, unusedPort, timed } from './helpers.js';

test('fetches every URL and reports the results in input order', async () => {
  const srv = await startServer();
  const urls = [srv.url('/ok/asha?ms=60'), srv.url('/ok/ravi?ms=10'), srv.url('/ok/meena?ms=30')];
  const { results, summary } = await fetchAll(urls);
  assert.deepEqual(results, [
    { url: urls[0], ok: true, status: 200, attempts: 1, body: 'hello asha' },
    { url: urls[1], ok: true, status: 200, attempts: 1, body: 'hello ravi' },
    { url: urls[2], ok: true, status: 200, attempts: 1, body: 'hello meena' },
  ]);
  assert.deepEqual(summary, { ok: 3, failed: 0, cancelled: 0, retries: 0 });
  assert.deepEqual(await fetchAll([]), { results: [], summary: { ok: 0, failed: 0, cancelled: 0, retries: 0 } });
});

test('never runs more than `concurrency` requests at once, and fills free slots', async () => {
  const srv = await startServer();
  const urls = Array.from({ length: 10 }, (_, i) => srv.url(`/ok/n${i}?ms=${i % 2 ? 20 : 60}`));
  const { results } = await fetchAll(urls, { concurrency: 3 });
  assert.equal(srv.stats.peak, 3, 'at most 3 at once, and the limit is really used');
  assert.deepEqual(results.map((r) => r.body), urls.map((_, i) => `hello n${i}`));

  const srv2 = await startServer();
  await fetchAll(Array.from({ length: 8 }, (_, i) => srv2.url(`/ok/d${i}?ms=30`)));
  assert.equal(srv2.stats.peak, 4, 'the default concurrency is 4');
});

test('a 4xx answer fails at once, without retries', async () => {
  const srv = await startServer();
  const url = srv.url('/status/404');
  const { results, summary } = await fetchAll([url], { baseDelayMs: 1 });
  assert.equal(results[0].ok, false);
  assert.equal(results[0].status, 404);
  assert.equal(results[0].attempts, 1);
  assert.equal(results[0].error.code, 'HTTP_404');
  assert.equal(typeof results[0].error.message, 'string');
  assert.equal(srv.stats.started.length, 1, '404 is not retried');
  assert.deepEqual(summary, { ok: 0, failed: 1, cancelled: 0, retries: 0 });
  const r400 = await fetchAll([srv.url('/status/400'), srv.url('/status/422')], { baseDelayMs: 1 });
  assert.deepEqual(r400.results.map((r) => r.attempts), [1, 1]);
  const r5xx = await fetchAll([srv.url('/status/501'), srv.url('/status/505')], { baseDelayMs: 1 });
  assert.deepEqual(r5xx.results.map((r) => [r.error.code, r.attempts]), [['HTTP_501', 1], ['HTTP_505', 1]], 'only 500, 502, 503 and 504 are retried, not every 5xx');
});

test('503, 429, 500, 502 and 504 are retried until they succeed or retries run out', async () => {
  const srv = await startServer();
  const ok = await fetchAll([srv.url('/flaky/a?fail=2')], { baseDelayMs: 5 });
  assert.equal(ok.results[0].ok, true, 'two failures, then success with the default 2 retries');
  assert.equal(ok.results[0].attempts, 3);
  assert.equal(ok.results[0].body, 'recovered');
  assert.equal(ok.summary.retries, 2);

  const out = await fetchAll([srv.url('/flaky/b?fail=5')], { baseDelayMs: 5, retries: 1 });
  assert.equal(out.results[0].ok, false);
  assert.equal(out.results[0].attempts, 2, 'retries: 1 means at most 2 attempts');
  assert.equal(out.results[0].error.code, 'HTTP_503');

  const codes = await fetchAll([500, 502, 504, 429].map((s) => srv.url(`/flaky/s${s}?fail=1&status=${s}`)), { baseDelayMs: 5 });
  assert.deepEqual(codes.results.map((r) => [r.ok, r.attempts]), [[true, 2], [true, 2], [true, 2], [true, 2]]);
});

test('retries wait random() * min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1))', async () => {
  const srv = await startServer();
  const slow = await timed(fetchAll([srv.url('/flaky/c?fail=2')], { baseDelayMs: 120, random: () => 1 }));
  assert.ok(slow.ms >= 330, `120 ms then 240 ms of backoff (took ${slow.ms} ms)`);
  const capped = await timed(fetchAll([srv.url('/flaky/d?fail=2')], { baseDelayMs: 120, maxDelayMs: 130, random: () => 1 }));
  assert.ok(capped.ms >= 230 && capped.ms < 330, `120 ms then 130 ms (capped) (took ${capped.ms} ms)`);
  const jitter = await timed(fetchAll([srv.url('/flaky/e?fail=2')], { baseDelayMs: 300, random: () => 0 }));
  assert.ok(jitter.ms < 250, `random() = 0 means no wait at all (took ${jitter.ms} ms)`);
});

test('a Retry-After header in seconds is respected, capped by maxDelayMs', async () => {
  const srv = await startServer();
  const { value, ms } = await timed(fetchAll([srv.url('/retry-after/x')], { random: () => 0, maxDelayMs: 400 }));
  assert.equal(value.results[0].ok, true);
  assert.equal(value.results[0].attempts, 2);
  assert.ok(ms >= 370 && ms < 900, `waits min(1 s, 400 ms) before retrying (took ${ms} ms)`);
});

test('each attempt has its own timeout; timeouts are retried and reported as TIMEOUT', async () => {
  const srv = await startServer();
  const { value, ms } = await timed(fetchAll([srv.url('/slow?ms=3000')], { timeoutMs: 150, retries: 1, baseDelayMs: 1 }));
  const r = value.results[0];
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'TIMEOUT');
  assert.equal(r.attempts, 2);
  assert.ok(ms >= 280 && ms < 1200, `two attempts of 150 ms (took ${ms} ms)`);
  const fast = await fetchAll([srv.url('/slow?ms=50'), srv.url('/slow?ms=50')], { timeoutMs: 300, concurrency: 1 });
  assert.deepEqual(fast.results.map((x) => x.ok), [true, true], 'the timeout is per attempt, not for the whole run');
});

test('the attempt timeout also covers reading the body', async () => {
  const srv = await startServer();
  const { value, ms } = await timed(fetchAll([srv.url('/trickle?ms=1500')], { timeoutMs: 150, retries: 0 }));
  const r = value.results[0];
  assert.equal(r.ok, false, 'the headers came at once, but the body did not finish in time');
  assert.equal(r.error.code, 'TIMEOUT');
  assert.ok(ms < 700, `stopped at the deadline, not when the body ended (took ${ms} ms)`);
});

test('connection failures are retried and reported as NETWORK', async () => {
  const srv = await startServer();
  const port = await unusedPort();
  const { results, summary } = await fetchAll([srv.url('/reset'), `http://127.0.0.1:${port}/orders`], { baseDelayMs: 1, retries: 2 });
  for (const r of results) {
    assert.equal(r.ok, false);
    assert.equal(r.error.code, 'NETWORK');
    assert.equal(r.attempts, 3);
  }
  assert.equal(srv.stats.started.filter((p) => p === '/reset').length, 3);
  assert.deepEqual(summary, { ok: 0, failed: 2, cancelled: 0, retries: 4 });
});

test('one failing URL does not stop the others', async () => {
  const srv = await startServer();
  const urls = [srv.url('/status/500'), srv.url('/ok/a'), srv.url('/reset'), srv.url('/ok/b')];
  const { results, summary } = await fetchAll(urls, { retries: 0 });
  assert.deepEqual(results.map((r) => r.ok), [false, true, false, true]);
  assert.deepEqual(results.map((r) => (r.ok ? r.body : r.error.code)), ['HTTP_500', 'hello a', 'NETWORK', 'hello b']);
  assert.deepEqual(summary, { ok: 2, failed: 2, cancelled: 0, retries: 0 });
});
