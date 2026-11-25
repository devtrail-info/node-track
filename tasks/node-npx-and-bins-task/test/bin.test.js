import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const taskDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const binFile = path.join(taskDir, 'bin', 'order-total.js');
const orders = path.join(taskDir, 'fixtures', 'orders.json');
const readPkg = async () => JSON.parse(await readFile(path.join(taskDir, 'package.json'), 'utf8'));

// Runs a command with real Node, no shell. Resolves with { code, stdout, stderr }, also when the exit code is not 0.
function run(args, options = {}) {
  return new Promise((resolve) => {
    execFile(process.execPath, args, { cwd: taskDir, timeout: 5000, ...options }, (error, stdout, stderr) => {
      resolve({ code: error ? (error.code ?? 1) : 0, stdout, stderr });
    });
  });
}

const temps = [];
const makeTemp = async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'devtrail-'));
  temps.push(dir);
  return dir;
};
after(async () => {
  for (const dir of temps) await rm(dir, { recursive: true, force: true });
});

test('package.json has a "bin" field that maps order-total to ./bin/order-total.js', async () => {
  const pkg = await readPkg();
  assert.ok(pkg.bin, 'add a "bin" field to package.json');
  // The string form means one command named like the package ("order-total").
  const target = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin['order-total'];
  assert.equal(path.posix.normalize(target ?? ''), 'bin/order-total.js');
});

test('bin/order-total.js starts with the #!/usr/bin/env node line', async () => {
  const code = await readFile(binFile, 'utf8');
  assert.equal(code.split(/\r?\n/)[0], '#!/usr/bin/env node');
});

test('node bin/order-total.js fixtures/orders.json prints the summary', async () => {
  const r = await run([binFile, orders]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout.trim(), '3 orders, total 123.45 EUR');
});

test('without a file name it prints the usage to stderr and exits with code 1', async () => {
  const r = await run([binFile]);
  assert.equal(r.code, 1);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /Usage: order-total/);
});

test('--version prints the version from package.json', async () => {
  const r = await run([binFile, '--version']);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout.trim(), (await readPkg()).version);
});

test('it also starts through a symlink, the way node_modules/.bin/order-total runs it', { skip: process.platform === 'win32' && 'symlinks need extra rights on Windows' }, async () => {
  const tmp = await makeTemp();
  const binDir = path.join(tmp, 'node_modules', '.bin');
  await mkdir(binDir, { recursive: true });
  const link = path.join(binDir, 'order-total');
  await symlink(binFile, link);
  const r = await run([link, orders], { cwd: tmp });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout.trim(), '3 orders, total 123.45 EUR', 'nothing was printed: the "is this the program that was run?" check failed');
  const v = await run([link, '--version'], { cwd: tmp });
  assert.equal(v.stdout.trim(), (await readPkg()).version);
});

test('--version reads package.json at run time: a copy with another version prints that version', async () => {
  const tmp = await makeTemp();
  await cp(path.join(taskDir, 'bin'), path.join(tmp, 'bin'), { recursive: true });
  await cp(path.join(taskDir, 'lib'), path.join(tmp, 'lib'), { recursive: true });
  const pkg = await readPkg();
  await writeFile(path.join(tmp, 'package.json'), JSON.stringify({ ...pkg, version: '9.9.9-test' }, null, 2));
  const r = await run([path.join(tmp, 'bin', 'order-total.js'), '--version'], { cwd: tmp });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout.trim(), '9.9.9-test', 'the version must come from the package.json next to the bin folder, not from the code');
});

test('importing bin/order-total.js from other code runs nothing and does not crash', async () => {
  const url = pathToFileURL(binFile).href;
  const r = await run(['--input-type=module', '-e', `const m = await import(${JSON.stringify(url)}); console.log(typeof m.main);`]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'function');
});
