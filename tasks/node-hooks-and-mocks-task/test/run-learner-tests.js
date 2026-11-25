// Runs a learner's test file against another version of a module, in a temporary folder, with real `node --test`.
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * Writes `files` ({ name: source }) into a new temporary folder (an ES module package) and runs
 * `node --test --test-reporter=tap <testFile>` there. Resolves with { status, output, tests, pass, fail, timedOut }.
 */
export async function runTestsWith(files, testFile, { timeoutMs = 10000 } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'devtrail-'));
  try {
    await writeFile(path.join(dir, 'package.json'), '{ "type": "module" }\n');
    for (const [name, source] of Object.entries(files)) await writeFile(path.join(dir, name), source);
    // Inside `node --test`, NODE_TEST_CONTEXT is set for the test process. A nested `node --test` that inherits it
    // talks the parent's internal protocol instead of printing a report, so remove it.
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const child = spawn(process.execPath, ['--test', '--test-reporter=tap', testFile], { cwd: dir, env });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    const status = await new Promise((resolve) => child.on('close', (code) => resolve(code)));
    clearTimeout(timer);
    const count = (key) => Number(output.match(new RegExp(`^# ${key} (\\d+)`, 'm'))?.[1] ?? 0);
    return { status, output, tests: count('tests'), pass: count('pass'), fail: count('fail'), timedOut };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** The lines of a TAP report that name failing tests, for a short error message. */
export function failingTests(output) {
  return output
    .split('\n')
    .filter((line) => /^\s*not ok \d+ - /.test(line))
    .map((line) => line.replace(/^\s*not ok \d+ - /, '').trim())
    .slice(0, 5);
}
