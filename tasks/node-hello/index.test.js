import { test } from 'node:test';
import assert from 'node:assert/strict';
import { greet } from './index.js';

test('greet returns a hello message', () => {
  assert.equal(greet('DevTrail'), 'Hello, DevTrail!');
});

test('greet uses the name it is given', () => {
  assert.equal(greet('Ada'), 'Hello, Ada!');
});
