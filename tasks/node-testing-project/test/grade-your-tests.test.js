// Grades YOUR tests (invoice.test.js): they must pass on a correct invoice module and fail on every planted bug.
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mutants } from './mutants.js';
import { referenceSource } from './reference-source.js';
import { runTestsWith, failingTests } from './run-learner-tests.js';

const here = (name) => new URL(name, import.meta.url);
let reference;
let yourTests;
let real;
const results = new Map();

before(async () => {
  reference = referenceSource;
  yourTests = await readFile(here('../invoice.test.js'), 'utf8');
  const run = (source, timeoutMs) => runTestsWith({ 'invoice.js': source, 'invoice.test.js': yourTests }, 'invoice.test.js', { timeoutMs });
  // A run that times out (for example on a busy machine) is tried once more before it counts.
  const runMutant = async (source) => {
    const first = await run(source, 20000);
    return first.timedOut ? run(source, 20000) : first;
  };
  const jobs = mutants.map(async (m) => {
    if (reference.includes(m.from)) results.set(m.name, await runMutant(reference.replace(m.from, m.to)));
  });
  [real] = await Promise.all([run(reference), ...jobs]);
});

describe('your invoice.test.js', () => {
  it('has at least 8 tests, and all of them pass on a correct invoice module', () => {
    assert.ok(!real.timedOut, 'your tests took more than 10 s');
    assert.ok(real.tests >= 8, `found ${real.tests} test(s); write at least 8`);
    assert.equal(
      real.status,
      0,
      `your tests must pass on a correct invoice module. Failing: ${failingTests(real.output).join('; ') || 'see the output above'}`,
    );
  });

  for (const mutant of mutants) {
    it(`catches the bug: ${mutant.says}`, () => {
      const result = results.get(mutant.name);
      assert.ok(result, 'a grader file in test/ was changed: restore it with git checkout -- test');
      assert.ok(
        !result.timedOut,
        `your tests hung for over 20 s (twice) on ${mutant.says}: that does not count as catching it. Give your tests a timeout so a bug makes them fail instead of hang.`,
      );
      assert.notEqual(result.status, 0, `all your tests passed on ${mutant.says}. Add a test that fails on it.`);
    });
  }
});
