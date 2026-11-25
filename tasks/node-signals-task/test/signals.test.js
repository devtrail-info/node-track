import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const taskDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = path.join(taskDir, 'index.js');

// Windows has no real signals: child.kill('SIGINT') there ends the process at once, and no handler runs.
const noSignals = process.platform === 'win32' && 'Windows has no POSIX signals (see the README)';

// Starts index.js with real Node. stdin, stdout and stderr are pipes the test controls.
function start() {
  const child = spawn(process.execPath, [script], { cwd: taskDir, stdio: ['pipe', 'pipe', 'pipe'] });
  const run = { child, stdout: '', stderr: '' };
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (d) => (run.stdout += d));
  child.stderr.on('data', (d) => (run.stderr += d));
  run.exited = new Promise((resolve) => child.on('exit', (code, signal) => resolve({ code, signal })));
  return run;
}

// Resolves when check() is true; rejects with `message` after `ms`.
async function waitFor(check, ms, message) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error(message);
    await new Promise((r) => setTimeout(r, 20));
  }
}

// Waits for the exit; if the program does not stop in time, kills it and fails with `message`.
async function exitOrFail(run, ms, message) {
  const timer = setTimeout(() => run.child.kill('SIGKILL'), ms);
  const result = await run.exited;
  clearTimeout(timer);
  if (result.signal === 'SIGKILL') assert.fail(message);
  return result;
}

const lines = (text) => text.split(/\r?\n/).filter((l) => l !== '');

test('when stdin ends, it prints each order and the summary, and exits with 0', async () => {
  const run = start();
  run.child.stdin.end('A-1,12.50\nA-2,19.99\n\nA-3,5\n');
  const { code } = await exitOrFail(run, 5000, 'the program did not exit after stdin ended');
  assert.deepEqual(lines(run.stdout), [
    'order A-1: 12.50',
    'order A-2: 19.99',
    'order A-3: 5.00',
    'Processed 3 orders, total 37.49 EUR',
  ]);
  assert.equal(run.stderr, '');
  assert.equal(code, 0);
});

test('bad lines (also after an empty line, and amounts like 12abc) are reported on stderr with their line number, skipped, and make the exit code 1', async () => {
  const run = start();
  run.child.stdin.end('A-1,10\noops\nB-2,\n,5\nC-3,-1\nD-4,abc\nE-5,1,2\n\nG-7,x\nH-8,12abc\nF-6,2.25\n');
  const { code } = await exitOrFail(run, 5000, 'the program did not exit after stdin ended');
  assert.deepEqual(lines(run.stdout), ['order A-1: 10.00', 'order F-6: 2.25', 'Processed 2 orders, total 12.25 EUR']);
  assert.deepEqual(lines(run.stderr), [
    'skipped line 2: oops',
    'skipped line 3: B-2,',
    'skipped line 4: ,5',
    'skipped line 5: C-3,-1',
    'skipped line 6: D-4,abc',
    'skipped line 7: E-5,1,2',
    'skipped line 9: G-7,x',
    'skipped line 10: H-8,12abc',
  ]);
  assert.equal(code, 1);
});

test('Ctrl+C (SIGINT) prints the summary so far and exits with 130, while stdin is still open', { skip: noSignals }, async () => {
  const run = start();
  run.child.stdin.write('A-1,12.50\nA-2,19.99\n');
  await waitFor(() => lines(run.stdout).length >= 2, 5000, 'the two order lines were never printed');
  run.child.kill('SIGINT');
  const { code, signal } = await exitOrFail(run, 3000, 'after SIGINT the program kept running: stdin is still open, so nothing makes it stop by itself');
  assert.equal(signal, null, 'the process was killed by the signal: no SIGINT listener ran');
  assert.equal(code, 130);
  assert.equal(lines(run.stdout).at(-1), 'Processed 2 orders, total 32.49 EUR (interrupted)');
});

test('SIGTERM prints the summary so far and exits with 143', { skip: noSignals }, async () => {
  const run = start();
  run.child.stdin.write('B-1,100\nB-2,0.5\nB-3,7.25\n');
  await waitFor(() => lines(run.stdout).length >= 3, 5000, 'the three order lines were never printed');
  run.child.kill('SIGTERM');
  const { code, signal } = await exitOrFail(run, 3000, 'after SIGTERM the program kept running: stdin is still open, so nothing makes it stop by itself');
  assert.equal(signal, null, 'the process was killed by the signal: no SIGTERM listener ran');
  assert.equal(code, 143);
  assert.equal(lines(run.stdout).at(-1), 'Processed 3 orders, total 107.75 EUR (stopped)');
});
