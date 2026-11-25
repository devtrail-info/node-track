// DevTrail type-check for TypeScript tracks.
//   npm run typecheck -- <task-id>   type-checks one task (tasks/<id> plus the shared folders such as test-utils)
//   npm run typecheck                type-checks the whole repo (fails while any task is still unsolved)
// Each task's starter sits next to the others, and some starters don't type-check on purpose, so check your task
// with its id. The one-task check writes a temporary tsconfig that extends tsconfig.json, runs `tsc --noEmit -p` on
// it and deletes it.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TASK_TSCONFIG_PREFIX = '.tsconfig.typecheck-';
export const INSTALL_MESSAGE = 'Type-checking needs TypeScript. Run npm install first.';

/**
 * The tsconfig for one task: extends ./tsconfig.json; every `include` entry under tasks/ becomes tasks/<id>, the
 * other entries (test-utils, shared types) stay.
 */
export function taskTsconfig(id, rootConfig) {
  const include = rootConfig.include ?? ['tasks', 'test-utils'];
  const out = [];
  for (const entry of include) {
    const e = /^(\.\/)?tasks(\/|$)/.test(entry) ? `tasks/${id}` : entry;
    if (!out.includes(e)) out.push(e);
  }
  if (!out.includes(`tasks/${id}`)) out.unshift(`tasks/${id}`);
  return { extends: './tsconfig.json', include: out };
}

/** Path of the repo's tsc (typescript/bin/tsc), or null when TypeScript isn't installed. */
export function findTsc(root = process.cwd()) {
  try {
    const pkg = createRequire(path.join(root, 'package.json')).resolve('typescript/package.json');
    const tsc = path.join(path.dirname(pkg), 'bin/tsc');
    return existsSync(tsc) ? tsc : null;
  } catch {
    return null;
  }
}

/**
 * Type-checks one task (or the whole repo when `id` is empty). Returns the exit status.
 * `node` is the Node binary that runs tsc (default: this one).
 */
export function runTypecheck(id, { root = process.cwd(), node = process.execPath, stdio = 'inherit' } = {}) {
  const rootTsconfig = path.join(root, 'tsconfig.json');
  if (!existsSync(rootTsconfig)) {
    console.error('This track has no TypeScript (no tsconfig.json).');
    return 1;
  }
  if (id && (!/^[a-z0-9][a-z0-9-]*$/.test(id) || !existsSync(path.join(root, 'tasks', id)))) {
    console.error(`No tasks/${id} folder. Check the task id.`);
    return 1;
  }
  const tsc = findTsc(root);
  if (!tsc) {
    console.error(INSTALL_MESSAGE);
    return 1;
  }
  if (!id) return spawnSync(node, [tsc, '--noEmit', '-p', 'tsconfig.json'], { cwd: root, stdio }).status ?? 1;

  let rootConfig = {};
  try {
    rootConfig = JSON.parse(readFileSync(rootTsconfig, 'utf8'));
  } catch {
    rootConfig = {}; // tsconfig with comments: fall back to the default include
  }
  const name = `${TASK_TSCONFIG_PREFIX}${id}-${process.pid}.json`;
  const file = path.join(root, name);
  writeFileSync(file, `${JSON.stringify(taskTsconfig(id, rootConfig), null, 2)}\n`);
  try {
    return spawnSync(node, [tsc, '--noEmit', '-p', name], { cwd: root, stdio }).status ?? 1;
  } finally {
    rmSync(file, { force: true });
  }
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  const args = process.argv.slice(2);
  if (args.length > 1) {
    console.error('Usage: npm run typecheck -- <task-id>   (or npm run typecheck for the whole repo)');
    process.exit(1);
  }
  process.exit(runTypecheck(args[0] ?? ''));
}
