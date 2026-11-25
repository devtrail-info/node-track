// Grades YOUR tests (reminders.test.js): they must pass on the real reminders.js and fail on every planted bug.
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mutants } from './mutants.js';
import { runTestsWith, failingTests } from './run-learner-tests.js';

const here = (name) => new URL(name, import.meta.url);
let original;
let yourTests;
let real;
const results = new Map();

before(async () => {
  original = await readFile(here('../reminders.js'), 'utf8');
  yourTests = await readFile(here('../reminders.test.js'), 'utf8');
  const run = (source, timeoutMs) => runTestsWith({ 'reminders.js': source, 'reminders.test.js': yourTests }, 'reminders.test.js', { timeoutMs });
  // A run that times out (for example on a busy machine) is tried once more before it counts.
  const runMutant = async (source) => {
    const first = await run(source, 20000);
    return first.timedOut ? run(source, 20000) : first;
  };
  // All versions run at the same time, each in its own process and folder.
  const jobs = mutants.map(async (m) => {
    if (original.includes(m.from)) results.set(m.name, await runMutant(original.replace(m.from, m.to)));
  });
  [real] = await Promise.all([run(original), ...jobs]);
});

describe('your reminders.test.js', () => {
  it('uses node:test hooks and mocks: beforeEach or afterEach, mock.fn or mock.method, and mock.timers', () => {
    // Comments do not count.
    const code = yourTests.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    assert.match(code, /\b(beforeEach|afterEach)\s*\(/, 'use beforeEach or afterEach to set up or clean up each test');
    assert.match(code, /\bmock\.(fn|method)\s*\(/, 'use mock.fn or mock.method for the mailer or the log');
    assert.match(code, /\bmock\.timers\.enable\s*\(/, 'use mock.timers instead of waiting for real seconds');
  });

  it('has at least 5 tests, and all of them pass on the real reminders.js (quickly)', () => {
    assert.ok(!real.timedOut, 'your tests took more than 10 s: mock the timers instead of waiting for real');
    assert.ok(real.tests >= 5, `found ${real.tests} test(s); write at least 5`);
    assert.equal(
      real.status,
      0,
      `your tests must pass on the real reminders.js. Failing: ${failingTests(real.output).join('; ') || 'see the output above'}`,
    );
  });

  for (const mutant of mutants) {
    it(`catches the bug: ${mutant.says}`, () => {
      const result = results.get(mutant.name);
      assert.ok(result, 'reminders.js was changed: restore it with git checkout -- reminders.js');
      assert.ok(
        !result.timedOut,
        `your tests hung for over 20 s (twice) on ${mutant.says}: that does not count as catching it. Give your tests a timeout so a bug makes them fail instead of hang.`,
      );
      assert.notEqual(result.status, 0, `all your tests passed on ${mutant.says}. Add a test that fails on it.`);
    });
  }
});
