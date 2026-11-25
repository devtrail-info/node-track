// Test helpers for node-child-processes-task.
import { after } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as mod from '../index.js';

// Works with a named export and with `export default { runScript }`.
export const runScript = mod.runScript ?? mod.default?.runScript;

export const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Every stuck script writes its pid to a file in this folder. After the tests, any that is still alive is killed,
// so a wrong solution cannot leave processes behind.
const dir = await mkdtemp(path.join(os.tmpdir(), 'devtrail-'));
let counter = 0;
const pidFiles = [];
after(async () => {
  for (const file of pidFiles) {
    const pid = Number(await readFile(file, 'utf8').catch(() => 0));
    if (pid && isAlive(pid)) process.kill(pid, 'SIGKILL');
  }
  await rm(dir, { recursive: true, force: true });
});

export function pidFile() {
  const file = path.join(dir, `stuck-${++counter}.pid`);
  pidFiles.push(file);
  return file;
}

/** Waits until the script has written its pid file (it may start slowly on a busy machine), then returns the pid. */
export async function readPid(file, ms = 8000) {
  const end = Date.now() + ms;
  for (;;) {
    const text = await readFile(file, 'utf8').catch(() => '');
    if (text) return Number(text);
    if (Date.now() > end) throw new Error(`the script never wrote its pid file ${path.basename(file)} within ${ms} ms: did it start?`);
    await wait(20);
  }
}

/** True when the pid file exists right now (no waiting). */
export async function pidFileExists(file) {
  return Boolean(await readFile(file, 'utf8').catch(() => ''));
}

/** Waits until the process is gone; returns false if it is still alive after `ms`. */
export async function diesWithin(pid, ms = 3000) {
  const end = Date.now() + ms;
  while (isAlive(pid)) {
    if (Date.now() > end) return false;
    await wait(20);
  }
  return true;
}

export function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Fails (instead of hanging) when the promise has not settled after `ms`. */
export function within(promise, ms, what) {
  let timer;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what}: still not settled after ${ms} ms`)), ms);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}
