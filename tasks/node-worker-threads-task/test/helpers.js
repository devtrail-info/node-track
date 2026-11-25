// Test helpers for node-worker-threads-task.
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { after } from 'node:test';
import * as mod from '../index.js';

// Safety net: a worker that never ends would keep this test file running forever. Once the tests are done, end
// the file anyway (the test "after the answer nothing is left running" reports such a leak as a failure).
after(() => {
  setTimeout(() => process.exit(), 1000).unref();
});

// Works with a named export and with `export default { hashInWorker }`.
export const hashInWorker = mod.hashInWorker ?? mod.default?.hashInWorker;

export const fixture = (name) => new URL(`./fixtures/${name}`, import.meta.url);
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** The expected answer, computed here on the main thread. */
export function expectedHash(data, algorithm = 'sha256', rounds = 1) {
  let digest = data;
  for (let i = 0; i < rounds; i++) digest = createHash(algorithm).update(digest).digest();
  return Buffer.from(digest).toString('hex');
}

/** Bytes that are not from Buffer's shared pool, so they can be transferred. */
export function orderBytes(size, seed = 7) {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) bytes[i] = (i * 31 + seed) % 256;
  return bytes;
}

/**
 * Runs test/fixtures/run.js <mode> in a separate Node process and resolves with its output and how it ended.
 * If the process is still alive after `ms` (generous: a busy machine starts Node slowly), it is killed and `exitedByItself` is false.
 */
export function runScript(mode, ms = 10_000) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [fileURLToPath(fixture('run.js')), mode], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
    }, ms);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code, exitedByItself: !killed });
    });
  });
}
