import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { analyzeLog } from '../index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, '..', 'fixtures', 'access.log');
const indexUrl = pathToFileURL(path.join(here, '..', 'index.js')).href;

let dir;
before(async () => {
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'devtrail-'));
});
after(async () => {
  await fsp.rm(dir, { recursive: true, force: true });
});

test('analyzeLog summarises the sample log', async () => {
  assert.deepEqual(await analyzeLog(fixture), {
    lines: 8,
    malformed: 1,
    statusCounts: { 200: 4, 201: 1, 404: 1, 500: 1 },
    slowest: [
      { method: 'POST', path: '/api/pay', status: 500, ms: 1520 },
      { method: 'GET', path: '/api/report', status: 200, ms: 980 },
      { method: 'GET', path: '/api/orders', status: 200, ms: 980 },
    ],
  });
});

test('the top option sets how many slow requests are kept', async () => {
  const one = await analyzeLog(fixture, { top: 1 });
  assert.deepEqual(one.slowest, [{ method: 'POST', path: '/api/pay', status: 500, ms: 1520 }]);
  const many = await analyzeLog(fixture, { top: 10 });
  assert.deepEqual(
    many.slowest.map((e) => `${e.ms} ${e.path}`),
    ['1520 /api/pay', '980 /api/report', '980 /api/orders', '120 /api/orders', '120 /api/orders', '35 /menu', '12 /menu/चाय'],
  );
});

test('an empty file gives an empty report', async () => {
  const file = path.join(dir, 'empty.log');
  await fsp.writeFile(file, '');
  assert.deepEqual(await analyzeLog(file), { lines: 0, malformed: 0, statusCounts: {}, slowest: [] });
});

test('a missing file rejects with ENOENT instead of crashing', async () => {
  await assert.rejects(analyzeLog(path.join(dir, 'missing.log')), { code: 'ENOENT' });
});

test('analyzeLog reads the file as a stream (readFile is switched off here)', async () => {
  const saved = { readFile: fs.readFile, readFileSync: fs.readFileSync, promisesReadFile: fs.promises.readFile };
  const off = () => {
    throw new Error('read the log with a stream, not readFile');
  };
  fs.readFile = off;
  fs.readFileSync = off;
  fs.promises.readFile = off;
  syncBuiltinESMExports();
  try {
    const report = await analyzeLog(fixture);
    assert.equal(report.lines, 8);
  } finally {
    fs.readFile = saved.readFile;
    fs.readFileSync = saved.readFileSync;
    fs.promises.readFile = saved.promisesReadFile;
    syncBuiltinESMExports();
  }
});

test('a 2,000,000-line log (about 100 MB) is analysed in a small, steady amount of memory', async () => {
  const file = path.join(dir, 'big.log');
  const out = fs.createWriteStream(file);
  const counts = {};
  let slowestMs = -1;
  let slowestPath = '';
  let slowestStatus = 0;
  for (let i = 0; i < 2_000_000; i++) {
    const status = i % 7 === 0 ? 500 : i % 11 === 0 ? 404 : 200;
    const ms = (i * 7919) % 5000;
    const p = `/api/item/${i % 1000}`;
    counts[status] = (counts[status] ?? 0) + 1;
    if (ms > slowestMs) {
      slowestMs = ms;
      slowestPath = p;
      slowestStatus = status;
    }
    if (!out.write(`2026-11-25T09:00:00Z GET ${p} ${status} ${ms}ms\n`)) await new Promise((r) => out.once('drain', r));
  }
  await new Promise((r) => out.end(r));

  // Run analyzeLog in a fresh process and ask it for its peak memory (resident set size).
  const script = `const { analyzeLog } = await import(${JSON.stringify(indexUrl)});
const report = await analyzeLog(${JSON.stringify(file)});
console.log(JSON.stringify({ report, maxRssMb: process.resourceUsage().maxRSS / 1024 }));`;
  const { stdout } = await new Promise((resolve, reject) => {
    execFile(process.execPath, ['--input-type=module', '-e', script], { timeout: 30000, maxBuffer: 1 << 20 }, (err, so, se) =>
      err ? reject(new Error(se || err.message)) : resolve({ stdout: so }),
    );
  });
  const { report, maxRssMb } = JSON.parse(stdout);
  assert.equal(report.lines, 2_000_000);
  assert.equal(report.malformed, 0);
  assert.deepEqual(report.statusCounts, counts);
  assert.deepEqual(report.slowest[0], { method: 'GET', path: slowestPath, status: slowestStatus, ms: slowestMs });
  assert.equal(report.slowest.length, 3);
  assert.ok(
    maxRssMb < 200,
    `peak memory was ${Math.round(maxRssMb)} MB for a 100 MB file: stream the file and keep only the top entries, ` +
      'do not collect all lines or all entries (a streaming solution stays well under 200 MB)',
  );
});
