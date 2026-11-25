import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runScript, fixture, within, pidFile, readPid, diesWithin } from './helpers.js';

test('arguments reach the script unchanged: no shell, so nothing in them is run', { timeout: 30_000 }, async () => {
  const args = ['report 2026.txt', 'orders.csv; echo INJECTED', '$HOME', '"quoted"', '--', ''];
  const result = await within(runScript(fixture('echo-args.js'), args, { timeoutMs: 20_000 }), 15_000, 'runScript');
  assert.deepEqual(JSON.parse(result.stdout), args, 'each argument arrives as one string, exactly as given');
  assert.doesNotMatch(result.stdout, /^INJECTED$/m, 'the text after ; must not run as a command');
  assert.equal(result.code, 0);
  assert.equal(result.signal, null);
  assert.equal(result.timedOut, false);
});

test('a non-zero exit code resolves with the code, stdout and stderr (no rejection)', { timeout: 30_000 }, async () => {
  const result = await within(runScript(fixture('exit-with.js'), ['3'], { timeoutMs: 20_000 }), 15_000, 'runScript');
  assert.deepEqual(result, { code: 3, signal: null, stdout: 'partial report\n', stderr: 'invoice 7 failed\n', timedOut: false });
  const ok = await within(runScript(fixture('exit-with.js'), ['0'], { timeoutMs: 20_000 }), 15_000, 'runScript');
  assert.equal(ok.code, 0);
});

test('output larger than maxOutputBytes rejects with ERR_CHILD_PROCESS_STDIO_MAXBUFFER and stops the script', { timeout: 30_000 }, async () => {
  const file = pidFile();
  const started = Date.now();
  await assert.rejects(within(runScript(fixture('stuck.js'), [file, 'normal', '5000'], { maxOutputBytes: 1000, timeoutMs: 30_000 }), 15_000, 'runScript'), (err) => {
    assert.equal(err.code, 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER');
    return true;
  });
  assert.ok(Date.now() - started < 10_000, 'rejects as soon as the limit is passed, not at the timeout');
  assert.ok(await diesWithin(await readPid(file)), 'the script was stopped');
});
