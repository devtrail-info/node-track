import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, '..', 'index.js');
const fixture = path.join(here, '..', 'fixtures', 'access.log');

function run(args) {
  return new Promise((resolve) => {
    execFile(process.execPath, [script, ...args], { timeout: 5000 }, (error, stdout, stderr) => {
      resolve({ code: error ? (error.code ?? 1) : 0, stdout, stderr });
    });
  });
}

test('node index.js <log> prints the report and exits with 0', async () => {
  const r = await run([fixture]);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.stdout.trimEnd().split(/\r?\n/), [
    'lines: 8 (1 malformed)',
    'status 200: 4',
    'status 201: 1',
    'status 404: 1',
    'status 500: 1',
    'slowest:',
    '  1520ms POST /api/pay',
    '  980ms GET /api/report',
    '  980ms GET /api/orders',
  ]);
});

test('a missing file prints "error: ..." on stderr and exits with 1', async () => {
  const r = await run([path.join(here, 'no-such.log')]);
  assert.equal(r.code, 1);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /^error: .*ENOENT/m);
});

test('no file argument prints the usage on stderr and exits with 2', async () => {
  const r = await run([]);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /usage/i);
});
