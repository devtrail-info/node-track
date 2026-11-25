import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkProject, formatProblem } from '../index.js';

const load = async (name) => {
  const dir = new URL(`../fixtures/${name}/`, import.meta.url);
  const pkg = JSON.parse(await readFile(new URL('package.json', dir), 'utf8'));
  const lock = JSON.parse(await readFile(new URL('package-lock.json', dir), 'utf8'));
  return { pkg, lock };
};

test('a project whose lockfile matches package.json has no problems', async () => {
  const { pkg, lock } = await load('clean');
  assert.deepEqual(checkProject(pkg, lock), []);
});

test('the drift project: one problem per broken dependency, sorted by name', async () => {
  const { pkg, lock } = await load('drift');
  assert.deepEqual(
    checkProject(pkg, lock).map((p) => `${p.name}:${p.problem}`),
    [
      '@shop/logger:missing',
      '@shop/tax-rules:mismatch',
      'express:mismatch',
      'left-pad:unsupported-range',
      'nodemon:out-of-sync',
      'pino:mismatch',
      'zod:out-of-sync',
    ],
  );
});

test('each problem says the name, dependency type, range and installed version', async () => {
  const { pkg, lock } = await load('drift');
  const problems = checkProject(pkg, lock);
  assert.deepEqual(problems.find((p) => p.name === 'express'), {
    name: 'express',
    type: 'dependencies',
    range: '^5.1.0',
    installed: '4.21.2',
    problem: 'mismatch',
  });
  assert.deepEqual(problems.find((p) => p.name === '@shop/logger'), {
    name: '@shop/logger',
    type: 'dependencies',
    range: '^1.0.0',
    installed: null,
    problem: 'missing',
  });
  assert.equal(problems.find((p) => p.name === 'nodemon').type, 'devDependencies');
});

test('only top-level node_modules entries count, not nested copies', () => {
  const pkg = { dependencies: { debug: '^4.3.0' } };
  const lock = {
    packages: {
      '': { dependencies: { debug: '^4.3.0' } },
      'node_modules/express/node_modules/debug': { version: '4.4.0' },
    },
  };
  assert.equal(checkProject(pkg, lock)[0]?.problem, 'missing');
});

test('a project with no dependency fields has no problems', () => {
  assert.deepEqual(checkProject({ name: 'empty' }, { packages: { '': {} } }), []);
});

test('formatProblem writes one readable line per kind of problem', () => {
  const base = { type: 'dependencies' };
  assert.equal(formatProblem({ ...base, name: 'express', range: '^5.1.0', installed: '4.21.2', problem: 'mismatch' }), 'express ^5.1.0: lockfile has 4.21.2 (mismatch)');
  assert.equal(formatProblem({ ...base, name: '@shop/logger', range: '^1.0.0', installed: null, problem: 'missing' }), '@shop/logger ^1.0.0: not in the lockfile (missing)');
  assert.equal(formatProblem({ ...base, name: 'zod', range: '^3.24.0', installed: '3.24.2', problem: 'out-of-sync' }), 'zod ^3.24.0: lockfile was made for a different range (out-of-sync)');
  assert.equal(formatProblem({ ...base, name: 'left-pad', range: 'latest', installed: '1.3.0', problem: 'unsupported-range' }), 'left-pad latest: range not supported (unsupported-range)');
});
