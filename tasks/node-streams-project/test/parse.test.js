import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLine } from '../index.js';

test('parseLine reads the five fields, with status and duration as numbers', () => {
  assert.deepEqual(parseLine('2026-11-25T09:00:03Z POST /api/pay 500 1520ms'), {
    time: '2026-11-25T09:00:03Z',
    method: 'POST',
    path: '/api/pay',
    status: 500,
    ms: 1520,
  });
  assert.deepEqual(parseLine('2026-11-25T09:00:05Z GET /menu/चाय 404 0ms'), {
    time: '2026-11-25T09:00:05Z',
    method: 'GET',
    path: '/menu/चाय',
    status: 404,
    ms: 0,
  });
});

test('parseLine returns null for malformed lines', () => {
  const bad = [
    'this line is broken',
    '2026-11-25T09:00:03Z POST /api/pay 500',
    '2026-11-25T09:00:03Z POST /api/pay 500 1520ms extra',
    '2026-11-25T09:00:03Z POST /api/pay 5000 15ms',
    '2026-11-25T09:00:03Z POST /api/pay abc 15ms',
    '2026-11-25T09:00:03Z POST /api/pay 200 15',
    '2026-11-25T09:00:03Z POST /api/pay 200 fastms',
    '2026-11-25T09:00:03Z POST /api/pay 200 1.5ms',
    '2026-11-25T09:00:03Z POST api/pay 200 15ms',
  ];
  for (const line of bad) assert.equal(parseLine(line), null, line);
});
