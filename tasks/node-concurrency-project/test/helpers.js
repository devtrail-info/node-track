// Test helpers for node-concurrency-project.
import { after } from 'node:test';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as mod from '../index.js';

// Works with named exports and with `export default { createPool, runJobs }`.
export const createPool = mod.createPool ?? mod.default?.createPool;
export const runJobs = mod.runJobs ?? mod.default?.runJobs;

export const testWorker = new URL('./fixtures/test-worker.js', import.meta.url);
export const indexPath = fileURLToPath(new URL('../index.js', import.meta.url));
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const sha256 = (data) => createHash('sha256').update(data).digest('hex');

// Every pool a test makes is closed after the tests, even when a test failed half-way.
const pools = [];
export function pool(options) {
  const p = createPool(options);
  pools.push(p);
  return p;
}
after(async () => {
  for (const p of pools) await Promise.race([Promise.resolve(p.close?.()).catch(() => {}), wait(2000)]);
  // Safety net: if a solution leaves a worker running, end this test file anyway (the "nothing is left running"
  // test reports that as a failure).
  setTimeout(() => process.exit(), 1000).unref();
});

/** Fails (instead of hanging) when the promise has not settled after `ms`. */
export function within(promise, ms, what) {
  let timer;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what}: still not settled after ${ms} ms`)), ms);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

/** Settles every promise and returns [{ status, value | reason }] like Promise.allSettled, with a time limit. */
export const settle = (promises, ms = 15_000) => within(Promise.allSettled(promises), ms, 'the jobs');

/** Runs `node <file> ...args` and resolves with { code, stdout, stderr, exitedByItself } (killed after `ms`). */
export function runNode(file, args = [], { env = {}, ms = 15_000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [file, ...args], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
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
      resolve({ code, stdout, stderr, exitedByItself: !killed });
    });
  });
}
