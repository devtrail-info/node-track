// DevTrail task test runner. Works with Node 22 and newer (24 LTS is the reference).
//   npm run task -- <task-id>   runs the tests of one task
//   npm test                    runs the tests of every task
// `node --test <folder>` is not safe across Node versions (Node 22+ runs the folder as a script), so this lists the
// test files itself and passes their paths to `node --test`.
// TypeScript tests (*.test.ts) count only in a repo whose package.json declares tsx; they run through tsx
// (`node --import tsx --test ...`), so such a repo needs `npm install` first. Plain JavaScript repos need no
// dependencies and ignore *.test.ts files.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TEST_FILE = /\.test\.(js|mjs|cjs|ts)$/;
export const INSTALL_MESSAGE = 'TypeScript tasks need tsx. Run npm install first.';

/** True when the repo's package.json lists tsx in dependencies or devDependencies (a TypeScript track). */
export function declaresTsx(root = process.cwd()) {
  try {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    return Boolean(pkg.dependencies?.tsx || pkg.devDependencies?.tsx);
  } catch {
    return false;
  }
}

function walk(dir, rel, out, ts) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const abs = path.join(dir, name);
    const r = `${rel}/${name}`;
    if (statSync(abs).isDirectory()) walk(abs, r, out, ts);
    else if (TEST_FILE.test(name) && (ts || !name.endsWith('.ts'))) out.push(r);
  }
}

/**
 * Test files of tasks/<id>, relative to `root` with forward slashes, sorted. Empty when the folder is missing.
 * *.test.ts files count only when the repo declares tsx.
 */
export function listTaskTests(id, root = process.cwd()) {
  const dir = path.join(root, 'tasks', id);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  const out = [];
  walk(dir, `tasks/${id}`, out, declaresTsx(root));
  return out.sort();
}

/** Task ids (folders under tasks/), sorted. */
export function listTaskIds(root = process.cwd()) {
  const dir = path.join(root, 'tasks');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => statSync(path.join(dir, n)).isDirectory())
    .sort();
}

/** True when any of the files is TypeScript, so the tests must run through tsx. */
export const needsTsx = (files) => files.some((f) => f.endsWith('.ts'));

/** True when the files need tsx and it isn't installed in the repo at `root`. */
export function tsxMissing(files, root = process.cwd()) {
  if (!needsTsx(files)) return false;
  try {
    createRequire(path.join(root, 'package.json')).resolve('tsx/package.json');
    return false;
  } catch {
    return true;
  }
}

/**
 * Arguments for `node` that run exactly these test files (optionally with a reporter such as 'tap').
 * `--import tsx` is resolved from the working directory, so run node with `cwd` set to the repo root.
 */
export const nodeTestArgs = (files, { reporter } = {}) => [
  ...(needsTsx(files) ? ['--import', 'tsx'] : []),
  '--test',
  ...(reporter ? [`--test-reporter=${reporter}`] : []),
  ...files,
];

/** Runs the tests of one task. Returns the exit status (1 when the task has no test files or tsx is missing). */
export function runTaskTests(id, { root = process.cwd(), stdio = 'inherit' } = {}) {
  const files = listTaskTests(id, root);
  if (files.length === 0) {
    console.error(`No test files in tasks/${id}.`);
    return 1;
  }
  if (tsxMissing(files, root)) {
    console.error(INSTALL_MESSAGE);
    return 1;
  }
  const r = spawnSync(process.execPath, nodeTestArgs(files), { cwd: root, stdio });
  return r.status ?? 1;
}

function main(args) {
  const ids = args.length ? args : listTaskIds();
  if (ids.length === 0) {
    console.error('No tasks found. Usage: npm run task -- <task-id>');
    return 1;
  }
  for (const id of ids) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id) || !existsSync(path.join('tasks', id))) {
      console.error(`No tasks/${id} folder. Check the task id.`);
      return 1;
    }
  }
  const files = ids.flatMap((id) => listTaskTests(id));
  if (files.length === 0) {
    console.error('No test files found.');
    return 1;
  }
  if (tsxMissing(files)) {
    console.error(INSTALL_MESSAGE);
    return 1;
  }
  const r = spawnSync(process.execPath, nodeTestArgs(files), { stdio: 'inherit' });
  return r.status ?? 1;
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  process.exit(main(process.argv.slice(2)));
}
