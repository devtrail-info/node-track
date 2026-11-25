import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVersion, satisfies } from '../semver.js';

test('parseVersion splits a version into numbers', () => {
  assert.deepEqual(parseVersion('1.4.2'), { major: 1, minor: 4, patch: 2, prerelease: null });
  assert.deepEqual(parseVersion('10.0.31'), { major: 10, minor: 0, patch: 31, prerelease: null });
  assert.deepEqual(parseVersion('2.0.0-rc.1'), { major: 2, minor: 0, patch: 0, prerelease: 'rc.1' });
});

test('parseVersion throws a TypeError for text that is not a full version', () => {
  for (const bad of ['1.2', 'v1.2.3', '1.2.x', 'latest', '01.2.3', '']) {
    assert.throws(() => parseVersion(bad), TypeError, `parseVersion('${bad}') should throw`);
  }
});

test('an exact range matches only that version', () => {
  assert.equal(satisfies('16.4.7', '16.4.7'), true);
  assert.equal(satisfies('16.4.7', '=16.4.7'), true);
  assert.equal(satisfies('16.4.8', '16.4.7'), false);
});

test('a tilde range allows newer patches in the same minor version', () => {
  assert.equal(satisfies('9.6.0', '~9.6.0'), true);
  assert.equal(satisfies('9.6.4', '~9.6.0'), true);
  assert.equal(satisfies('9.7.0', '~9.6.0'), false);
  assert.equal(satisfies('9.5.9', '~9.6.0'), false);
  assert.equal(satisfies('0.2.9', '~0.2.3'), true);
  assert.equal(satisfies('10.6.0', '~9.6.0'), false);
});

test('a caret range allows newer minors and patches in the same major version', () => {
  assert.equal(satisfies('4.21.2', '^4.18.0'), true);
  assert.equal(satisfies('4.17.9', '^4.18.0'), false);
  assert.equal(satisfies('5.0.0', '^4.18.0'), false);
});

test('a caret range on 0.x keeps the first number that is not zero', () => {
  assert.equal(satisfies('0.4.3', '^0.4.1'), true);
  assert.equal(satisfies('0.5.0', '^0.4.1'), false);
  assert.equal(satisfies('0.0.3', '^0.0.3'), true);
  assert.equal(satisfies('0.0.4', '^0.0.3'), false);
  assert.equal(satisfies('1.4.5', '^0.4.1'), false);
  assert.equal(satisfies('1.0.3', '^0.0.3'), false);
});

test('* matches every release version', () => {
  assert.equal(satisfies('0.0.1', '*'), true);
  assert.equal(satisfies('42.1.0', '*'), true);
});

test('a pre-release version matches only a range that names it exactly', () => {
  assert.equal(satisfies('2.0.0-rc.1', '^1.2.3'), false);
  assert.equal(satisfies('1.5.0-beta.1', '^1.2.3'), false);
  assert.equal(satisfies('2.0.0-rc.1', '*'), false);
  assert.equal(satisfies('2.0.0-rc.1', '2.0.0-rc.1'), true);
  assert.equal(satisfies('2.0.0-rc.2', '2.0.0-rc.1'), false);
  assert.equal(satisfies('2.0.0', '2.0.0-rc.1'), false);
});

test('other ranges throw a RangeError', () => {
  for (const range of ['latest', '>=1.2.0', '1.x', '^1.2', 'file:../lib', '1.2.3 - 1.4.0', '^2.0.0-rc.1']) {
    assert.throws(() => satisfies('1.2.3', range), RangeError, `satisfies('1.2.3', '${range}') should throw`);
  }
});
