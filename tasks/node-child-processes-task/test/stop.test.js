import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runScript, fixture, within, pidFile, readPid, pidFileExists, diesWithin, wait } from './helpers.js';

// Windows has no POSIX signals: kill() always ends a child at once there, so a script cannot catch SIGTERM and the
// SIGTERM-then-SIGKILL escalation cannot be observed. Both timeout tests are skipped there (not run on Windows).
const noSignals = process.platform === 'win32' && 'Windows has no POSIX signals (see the README)';

// The timeouts are generous on purpose: on a busy machine a new Node process can take a second or more to start,
// and the script must be running (and, for "stubborn", must have installed its SIGTERM handler) before the signal.
test('a script that runs too long gets SIGTERM after timeoutMs and resolves with timedOut: true', { timeout: 30_000, skip: noSignals }, async () => {
  const file = pidFile();
  const started = Date.now();
  const result = await within(runScript(fixture('stuck.js'), [file], { timeoutMs: 1500 }), 15_000, 'runScript');
  const took = Date.now() - started;
  assert.equal(result.timedOut, true);
  assert.equal(result.code, null, 'a killed process has no exit code');
  assert.equal(result.signal, 'SIGTERM');
  assert.match(result.stdout, /working/, 'the output so far is kept');
  assert.ok(took >= 1400 && took < 10_000, `stopped at about timeoutMs (took ${took} ms)`);
  assert.ok(await diesWithin(await readPid(file)), 'the script was stopped');
});

test('a script that ignores SIGTERM gets SIGKILL killGraceMs later', { timeout: 30_000, skip: noSignals }, async () => {
  const file = pidFile();
  const started = Date.now();
  const result = await within(runScript(fixture('stuck.js'), [file, 'stubborn'], { timeoutMs: 1500, killGraceMs: 500 }), 15_000, 'runScript');
  const took = Date.now() - started;
  assert.equal(result.timedOut, true);
  assert.equal(result.signal, 'SIGKILL');
  assert.match(result.stdout, /ignoring SIGTERM/, 'SIGTERM was sent first');
  assert.ok(took >= 1900 && took < 12_000, `SIGKILL after timeoutMs + killGraceMs (took ${took} ms)`);
  assert.ok(await diesWithin(await readPid(file)), 'the script was stopped');
});

test('an abort stops the script and rejects with signal.reason; an aborted signal starts nothing', { timeout: 30_000 }, async () => {
  const file = pidFile();
  const controller = new AbortController();
  const reason = new Error('export cancelled');
  const pending = runScript(fixture('stuck.js'), [file], { signal: controller.signal, timeoutMs: 30_000 });
  const outcome = pending.then(() => 'resolved', (err) => err);
  const pid = await readPid(file); // wait until the script is really running, however slow the machine is
  const abortedAt = Date.now();
  controller.abort(reason);
  const err = await within(outcome, 10_000, 'runScript after the abort');
  assert.equal(err, reason, 'rejects with signal.reason itself');
  assert.ok(Date.now() - abortedAt < 5000, 'rejects soon after the abort, not at the timeout');
  assert.ok(await diesWithin(pid), 'the script was stopped');

  const never = pidFile();
  await assert.rejects(runScript(fixture('stuck.js'), [never], { signal: AbortSignal.abort(reason) }), (e) => e === reason);
  await wait(1000);
  assert.equal(await pidFileExists(never), false, 'no script may start for an aborted signal');
});
