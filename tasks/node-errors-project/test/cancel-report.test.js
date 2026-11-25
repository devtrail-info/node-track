import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAll, formatReport, startServer, wait, timed } from './helpers.js';

test('aborting stops new requests, aborts the running ones and marks the rest CANCELLED', async () => {
  const srv = await startServer();
  const urls = Array.from({ length: 6 }, (_, i) => srv.url(`/slow?ms=400&n=${i}`));
  const controller = new AbortController();
  setTimeout(() => controller.abort(new Error('user pressed Ctrl+C')), 100);
  const { value, ms } = await timed(fetchAll(urls, { concurrency: 2, signal: controller.signal }));
  assert.ok(ms < 350, `the run ends soon after the abort, without waiting for the slow answers (took ${ms} ms)`);
  await wait(100);
  assert.equal(srv.stats.started.length, 2, 'no new request starts after the abort');
  assert.equal(value.results.length, 6);
  for (const r of value.results) {
    assert.equal(r.ok, false);
    assert.equal(r.error.code, 'CANCELLED');
  }
  assert.deepEqual(value.results.map((r) => r.attempts), [1, 1, 0, 0, 0, 0]);
  assert.deepEqual(value.summary, { ok: 0, failed: 6, cancelled: 6, retries: 0 });
});

test('finished results are kept when the run is cancelled', async () => {
  const srv = await startServer();
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 120);
  const { results, summary } = await fetchAll([srv.url('/ok/fast'), srv.url('/slow?ms=1000')], { signal: controller.signal });
  assert.deepEqual(results[0], { url: srv.url('/ok/fast'), ok: true, status: 200, attempts: 1, body: 'hello fast' });
  assert.equal(results[1].error.code, 'CANCELLED');
  assert.deepEqual(summary, { ok: 1, failed: 1, cancelled: 1, retries: 0 });
});

test('an abort during the backoff wait cancels at once', async () => {
  const srv = await startServer();
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 100);
  const { value, ms } = await timed(fetchAll([srv.url('/flaky/k?fail=5')], { baseDelayMs: 2000, random: () => 1, signal: controller.signal }));
  assert.ok(ms < 400, `no waiting for the 2 s backoff (took ${ms} ms)`);
  assert.equal(value.results[0].error.code, 'CANCELLED');
  assert.equal(value.results[0].attempts, 1);
  assert.equal(srv.stats.started.length, 1);
});

test('an already aborted signal makes no request at all', async () => {
  const srv = await startServer();
  const { results } = await fetchAll([srv.url('/ok/a'), srv.url('/ok/b')], { signal: AbortSignal.abort() });
  assert.deepEqual(results.map((r) => [r.error?.code, r.attempts]), [['CANCELLED', 0], ['CANCELLED', 0]]);
  assert.equal(srv.stats.started.length, 0);
});

test('formatReport writes one line per URL and a summary', () => {
  const report = {
    results: [
      { url: 'http://shop.test/a', ok: true, status: 200, attempts: 1, body: 'x' },
      { url: 'http://shop.test/b', ok: false, status: 404, attempts: 1, error: { code: 'HTTP_404', message: 'm' } },
      { url: 'http://shop.test/c', ok: true, status: 200, attempts: 3, body: 'y' },
      { url: 'http://shop.test/d', ok: false, attempts: 0, error: { code: 'CANCELLED', message: 'cancelled' } },
    ],
    summary: { ok: 2, failed: 2, cancelled: 1, retries: 2 },
  };
  assert.equal(
    formatReport(report),
    [
      'OK 200 http://shop.test/a (1 attempt)',
      'FAIL HTTP_404 http://shop.test/b (1 attempt)',
      'OK 200 http://shop.test/c (3 attempts)',
      'FAIL CANCELLED http://shop.test/d (0 attempts)',
      '2 ok, 2 failed, 2 retries',
    ].join('\n'),
  );
});


// Windows has no real signals: child.kill('SIGINT') there ends the process at once, and no listener runs.
const noSignals = process.platform === 'win32' && 'Windows has no POSIX signals';

// Runs the CLI on a temporary URL file. When `sigintWhen` is given, it is polled every 20 ms and SIGINT is sent
// once it returns true.
async function runCli(lines, { sigintWhen } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fetcher-'));
  const file = path.join(dir, 'urls.txt');
  await writeFile(file, lines);
  const script = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'index.js');
  const child = spawn(process.execPath, [script, file], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => (stdout += d));
  child.stderr.on('data', (d) => (stderr += d));
  let sentAt = null;
  if (sigintWhen) {
    const poll = setInterval(() => {
      if (!sigintWhen()) return;
      clearInterval(poll);
      sentAt = Date.now();
      child.kill('SIGINT');
    }, 20);
    child.on('exit', () => clearInterval(poll));
  }
  const timer = setTimeout(() => child.kill('SIGKILL'), 8000);
  const [code, signal] = await new Promise((resolve) => child.on('exit', (...args) => resolve(args)));
  const exitedAt = Date.now();
  clearTimeout(timer);
  await rm(dir, { recursive: true, force: true });
  return { code, signal, stdout, stderr, afterSignalMs: sentAt === null ? null : exitedAt - sentAt };
}

test('the CLI prints the report and exits with 1 when a URL failed', async () => {
  const srv = await startServer();
  const run = await runCli(`${srv.url('/ok/one')}\n\n${srv.url('/status/404')}\n  ${srv.url('/ok/two')}  \n`);
  assert.equal(
    run.stdout.trim(),
    [`OK 200 ${srv.url('/ok/one')} (1 attempt)`, `FAIL HTTP_404 ${srv.url('/status/404')} (1 attempt)`, `OK 200 ${srv.url('/ok/two')} (1 attempt)`, '2 ok, 1 failed, 0 retries'].join('\n'),
    `stderr: ${run.stderr}`,
  );
  assert.equal(run.code, 1, 'exit code 1 when any URL failed');
});

test('the CLI exits with 0 when every URL succeeded', async () => {
  const srv = await startServer();
  const run = await runCli(`${srv.url('/ok/one')}\n${srv.url('/ok/two')}\n`);
  assert.equal(run.stdout.trim(), [`OK 200 ${srv.url('/ok/one')} (1 attempt)`, `OK 200 ${srv.url('/ok/two')} (1 attempt)`, '2 ok, 0 failed, 0 retries'].join('\n'), `stderr: ${run.stderr}`);
  assert.equal(run.code, 0, 'exit code 0 when everything succeeded');
});

test('Ctrl+C (SIGINT) cancels the run: the report is printed and the exit code is 1', { skip: noSignals }, async () => {
  const srv = await startServer();
  // Press Ctrl+C only once the fast answer has been sent and the slow request is running, plus a margin for the
  // CLI to read that answer. Waiting for these events instead of a fixed delay keeps the test stable on slow machines.
  let readyAt = null;
  const ready = () => {
    if (readyAt === null && srv.stats.finished.includes('/ok/fast') && srv.stats.started.some((p) => p.startsWith('/slow'))) readyAt = Date.now();
    return readyAt !== null && Date.now() - readyAt >= 300;
  };
  const run = await runCli(`${srv.url('/ok/fast')}\n${srv.url('/slow?ms=4000')}\n`, { sigintWhen: ready });
  assert.equal(run.signal, null, `the CLI must handle SIGINT, not be killed by it. stderr: ${run.stderr}`);
  assert.match(run.stdout, new RegExp(`OK 200 ${srv.url('/ok/fast').replace(/[.?]/g, '\\$&')} \\(1 attempt\\)`), 'finished results are printed');
  assert.match(run.stdout, /FAIL CANCELLED .*\/slow\?ms=4000/, 'the unfinished URL is reported as CANCELLED');
  assert.equal(run.code, 1);
  assert.ok(run.afterSignalMs < 1500, `the CLI stops soon after Ctrl+C, without waiting for the slow server (took ${run.afterSignalMs} ms)`);
});
