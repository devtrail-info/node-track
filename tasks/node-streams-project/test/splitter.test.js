import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createLineSplitter } from '../index.js';

// Feeds `text` to a fresh splitter in chunks of `size` bytes and collects the lines.
async function split(text, size) {
  const bytes = Buffer.from(text);
  const chunks = [];
  for (let i = 0; i < bytes.length; i += size) chunks.push(bytes.subarray(i, i + size));
  const lines = [];
  await pipeline(Readable.from(chunks, { objectMode: false }), createLineSplitter(), async function (source) {
    for await (const line of source) lines.push(line);
  });
  return lines;
}

test('createLineSplitter returns a stream that gives one string per line', async () => {
  const lines = await split('GET /menu 200 5ms\nGET /cart 404 9ms\n', 1000);
  assert.deepEqual(lines, ['GET /menu 200 5ms', 'GET /cart 404 9ms']);
  assert.equal(typeof lines[0], 'string');
});

test('lines split across chunks come out whole, for every chunk size', async () => {
  const text = 'GET /menu/चाय 200 5ms\nGET /price/₹20 200 7ms\nGET /😀 404 1ms\n';
  for (const size of [1, 2, 3, 5, 7, 64]) {
    assert.deepEqual(await split(text, size), ['GET /menu/चाय 200 5ms', 'GET /price/₹20 200 7ms', 'GET /😀 404 1ms'], `chunk size ${size}`);
  }
});

test('the last line comes out even without a final newline, and no empty line is added', async () => {
  assert.deepEqual(await split('a\nb', 1), ['a', 'b']);
  assert.deepEqual(await split('a\nb\n', 1), ['a', 'b']);
  assert.deepEqual(await split('', 1), []);
});

test('Windows line endings are removed and empty lines in the middle are kept', async () => {
  assert.deepEqual(await split('a\r\n\r\nb\r\n', 2), ['a', '', 'b']);
});

test('a line comes out as soon as its newline arrives, before the input ends', async () => {
  const splitter = createLineSplitter();
  const seen = [];
  splitter.on('data', (line) => seen.push(line));
  splitter.write(Buffer.from('first line\nsecond'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(seen, ['first line']);
  splitter.end(Buffer.from(' line\n'));
  await new Promise((resolve) => splitter.on('end', resolve));
  assert.deepEqual(seen, ['first line', 'second line']);
});
