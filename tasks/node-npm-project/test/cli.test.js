import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const taskDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = path.join(taskDir, 'index.js');

function run(args) {
  return new Promise((resolve) => {
    execFile(process.execPath, [script, ...args], { cwd: taskDir, timeout: 5000 }, (error, stdout, stderr) => {
      resolve({ code: error ? (error.code ?? 1) : 0, stdout, stderr });
    });
  });
}

test('node index.js fixtures/clean says everything matches and exits with code 0', async () => {
  const r = await run(['fixtures/clean']);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'All 5 dependencies match the lockfile.');
});

test('node index.js fixtures/drift prints one line per problem, a total, and exits with code 1', async () => {
  const r = await run(['fixtures/drift']);
  assert.equal(r.code, 1, r.stderr);
  assert.deepEqual(r.stdout.trim().split(/\r?\n/), [
    '@shop/logger ^1.0.0: not in the lockfile (missing)',
    '@shop/tax-rules ^0.4.1: lockfile has 0.5.0 (mismatch)',
    'express ^5.1.0: lockfile has 4.21.2 (mismatch)',
    'left-pad latest: range not supported (unsupported-range)',
    'nodemon ^3.1.9: lockfile was made for a different range (out-of-sync)',
    'pino ~9.6.0: lockfile has 9.7.0 (mismatch)',
    'zod ^3.24.0: lockfile was made for a different range (out-of-sync)',
    '7 problems in 9 dependencies.',
  ]);
});

test('without a folder it prints the usage to stderr and exits with code 1', async () => {
  const r = await run([]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /Usage: node index\.js <project-folder>/);
});
