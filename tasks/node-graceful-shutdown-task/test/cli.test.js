import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { get, wait } from './helpers.js';

const taskDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = path.join(taskDir, 'index.js');

// Windows has no real signals: child.kill('SIGTERM') there ends the process at once, and no listener runs.
const noSignals = process.platform === 'win32' && 'Windows has no POSIX signals (see the README)';

// Starts index.js with real Node on a random port. Resolves once it has printed "listening on <port>".
async function startCli(env = {}) {
  const child = spawn(process.execPath, [script], {
    cwd: taskDir,
    env: { ...process.env, PORT: '0', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const run = { child, stdout: '', stderr: '' };
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (d) => (run.stdout += d));
  child.stderr.on('data', (d) => (run.stderr += d));
  run.exited = new Promise((resolve) => child.on('exit', (code, signal) => resolve({ code, signal, at: Date.now() })));
  const end = Date.now() + 5000;
  while (!/listening on (\d+)/.test(run.stdout)) {
    if (Date.now() > end) {
      child.kill('SIGKILL');
      throw new Error(`the program never printed "listening on <port>". stdout: ${run.stdout} stderr: ${run.stderr}`);
    }
    await wait(20);
  }
  run.port = Number(run.stdout.match(/listening on (\d+)/)[1]);
  return run;
}

// Waits for the process to exit, or kills it and fails after `ms`.
async function exitWithin(run, ms) {
  const timer = setTimeout(() => run.child.kill('SIGKILL'), ms);
  const result = await run.exited;
  clearTimeout(timer);
  return result;
}

test('SIGTERM: the request in flight finishes and the process exits with 0 by itself', { skip: noSignals }, async () => {
  const run = await startCli();
  const slow = get(run.port, '/report?ms=400');
  await wait(100);
  const sent = Date.now();
  run.child.kill('SIGTERM');
  const res = await slow;
  assert.equal(res.status, 200, 'the request in flight gets its answer');
  const exit = await exitWithin(run, 4000);
  assert.equal(exit.signal, null, `the process must handle SIGTERM, not be killed by it. stderr: ${run.stderr}`);
  assert.equal(exit.code, 0, `exit code 0 after a clean shutdown. stderr: ${run.stderr}`);
  assert.ok(exit.at - sent < 2000, `the process should end soon after the last request (took ${exit.at - sent} ms)`);
  assert.match(run.stdout, /SIGTERM received: shutting down/);
  assert.match(run.stdout, /shutdown complete/);
});

test('SIGINT with no traffic: exits with 0 at once, without waiting for the deadline', { skip: noSignals }, async () => {
  const run = await startCli();
  const sent = Date.now();
  run.child.kill('SIGINT');
  const exit = await exitWithin(run, 4000);
  assert.equal(exit.signal, null, `the process must handle SIGINT. stderr: ${run.stderr}`);
  assert.equal(exit.code, 0);
  assert.ok(exit.at - sent < 1500, `the 10 s deadline must not keep the process alive (took ${exit.at - sent} ms)`);
  assert.match(run.stdout, /SIGINT received: shutting down/);
});

test('a stuck request: forced after SHUTDOWN_TIMEOUT_MS, exit code 1', { skip: noSignals }, async () => {
  const run = await startCli({ SHUTDOWN_TIMEOUT_MS: '300' });
  const stuck = get(run.port, '/report?ms=10000');
  await wait(100);
  const sent = Date.now();
  run.child.kill('SIGTERM');
  const exit = await exitWithin(run, 4000);
  assert.equal(exit.code, 1, `exit code 1 after a forced shutdown. stderr: ${run.stderr}`);
  assert.ok(exit.at - sent < 2000, `forced after about 300 ms (took ${exit.at - sent} ms)`);
  assert.match(run.stdout, /forced shutdown after 300 ms/);
  assert.ok((await stuck).error, 'the stuck client loses its connection');
});
