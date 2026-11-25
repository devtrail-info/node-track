import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const taskDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = path.join(taskDir, 'todo.js');

const temps = [];
after(async () => {
  for (const dir of temps) await rm(dir, { recursive: true, force: true });
});

// A fresh temp folder with a todos file path in it (the file itself does not exist yet).
async function setup(todos) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'devtrail-todo-'));
  temps.push(dir);
  const file = path.join(dir, 'my-todos.json');
  if (todos !== undefined) await writeFile(file, typeof todos === 'string' ? todos : JSON.stringify(todos));
  return { dir, file };
}

// Runs todo.js with real Node, no shell. `env` replaces TODO_FILE handling: pass { TODO_FILE } or {} for none.
function run(args, { env = {}, cwd = taskDir } = {}) {
  const base = { ...process.env };
  delete base.TODO_FILE;
  return new Promise((resolve) => {
    execFile(process.execPath, [script, ...args], { cwd, env: { ...base, ...env }, timeout: 5000 }, (error, stdout, stderr) => {
      resolve({ code: error ? (error.code ?? 1) : 0, stdout, stderr });
    });
  });
}

const readTodos = async (file) => JSON.parse(await readFile(file, 'utf8'));
const lines = (text) => text.split(/\r?\n/).filter((l) => l !== '');

test('add saves the todo in the TODO_FILE file and prints "Added #1: <text>"', async () => {
  const { file } = await setup();
  const r = await run(['add', 'Buy', 'oat', 'milk'], { env: { TODO_FILE: file } });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'Added #1: Buy oat milk');
  assert.equal(r.stderr, '');
  assert.deepEqual(await readTodos(file), [{ id: 1, text: 'Buy oat milk', done: false }]);
});

test('add gives the next id after the highest one in the file', async () => {
  const { file } = await setup([
    { id: 1, text: 'Pay invoice 1042', done: true },
    { id: 5, text: 'Call the bank', done: false },
  ]);
  const r = await run(['add', 'Send report'], { env: { TODO_FILE: file } });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'Added #6: Send report');
  assert.deepEqual((await readTodos(file)).map((t) => t.id), [1, 5, 6]);
});

test('add -- <text> keeps text that starts with a dash', async () => {
  const { file } = await setup();
  const r = await run(['add', '--', '--urgent', 'call', 'the', 'bank'], { env: { TODO_FILE: file } });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'Added #1: --urgent call the bank');
});

test('list prints one line per todo with [ ] or [x]', async () => {
  const { file } = await setup([
    { id: 1, text: 'Pay invoice 1042', done: true },
    { id: 2, text: 'Call the bank', done: false },
  ]);
  const r = await run(['list'], { env: { TODO_FILE: file } });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(lines(r.stdout), ['[x] #1 Pay invoice 1042', '[ ] #2 Call the bank']);
});

test('list with no data file yet prints "No todos yet." and exits with 0', async () => {
  const { file } = await setup();
  const r = await run(['list'], { env: { TODO_FILE: file } });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'No todos yet.');
});

test('list --json prints the todos as JSON', async () => {
  const todos = [
    { id: 3, text: 'Renew domain', done: false },
    { id: 4, text: 'Back up the shop database', done: true },
  ];
  const { file } = await setup(todos);
  const r = await run(['list', '--json'], { env: { TODO_FILE: file } });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), todos);
});

test('done <id> marks that todo as done, saves it and prints "Done #<id>: <text>"', async () => {
  const { file } = await setup([
    { id: 1, text: 'Pay invoice 1042', done: false },
    { id: 2, text: 'Call the bank', done: false },
  ]);
  const r = await run(['done', '2'], { env: { TODO_FILE: file } });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'Done #2: Call the bank');
  assert.deepEqual(await readTodos(file), [
    { id: 1, text: 'Pay invoice 1042', done: false },
    { id: 2, text: 'Call the bank', done: true },
  ]);
});

test('done with an id that does not exist: error on stderr, nothing on stdout, exit code 1', async () => {
  const todos = [{ id: 1, text: 'Pay invoice 1042', done: false }];
  const { file } = await setup(todos);
  const r = await run(['done', '99'], { env: { TODO_FILE: file } });
  assert.equal(r.code, 1);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /no todo #99/i);
  assert.deepEqual(await readTodos(file), todos);
});

test('a data file with broken JSON: error on stderr naming the file, exit code 1', async () => {
  const { file } = await setup('[{"id": 1, "text": "Pay invoice"');
  const r = await run(['list'], { env: { TODO_FILE: file } });
  assert.equal(r.code, 1);
  assert.equal(r.stdout, '');
  assert.ok(r.stderr.includes(file), `stderr should name ${file}, got: ${r.stderr}`);
});

test('a data file that is valid JSON but not an array: error on stderr naming the file, exit code 1', async () => {
  const { file } = await setup('{"id": 1, "text": "Pay invoice 1042"}');
  const r = await run(['list'], { env: { TODO_FILE: file } });
  assert.equal(r.code, 1);
  assert.equal(r.stdout, '');
  assert.ok(r.stderr.includes(file), `stderr should name ${file}, got: ${r.stderr}`);
});

const badUsage = [
  [],
  ['remove', '1'],
  ['list', '--force'],
  ['list', '--json=yes'],
  ['add'],
  ['add', '   '],
  ['done'],
  ['done', 'abc'],
  ['done', '1.5'],
  ['done', '0'],
];
for (const args of badUsage) {
  test(`bad usage \`node todo.js ${args.join(' ')}\`: usage on stderr, nothing on stdout, exit code 2`, async () => {
    const { file } = await setup([{ id: 1, text: 'Pay invoice 1042', done: false }]);
    const r = await run(args, { env: { TODO_FILE: file } });
    assert.equal(r.code, 2, `expected exit code 2, got ${r.code}. stderr: ${r.stderr}`);
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /Usage: node todo\.js/);
    assert.deepEqual(await readTodos(file), [{ id: 1, text: 'Pay invoice 1042', done: false }], 'bad usage must not change the file');
  });
}

for (const flag of ['--help', '-h']) {
  test(`${flag} prints the usage on stdout and exits with 0`, async () => {
    const r = await run([flag]);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /Usage: node todo\.js/);
    assert.equal(r.stderr, '');
  });
}

test('without TODO_FILE it uses todos.json in the current folder', async () => {
  const { dir } = await setup();
  const r = await run(['add', 'Water the plants'], { cwd: dir });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(await readTodos(path.join(dir, 'todos.json')), [{ id: 1, text: 'Water the plants', done: false }]);
});
