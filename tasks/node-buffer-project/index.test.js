import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { encodeOrder, decodeOrder, encodeOrders, decodeOrders } from './index.js';

const script = fileURLToPath(new URL('./index.js', import.meta.url));
const badRecord = { code: 'ERR_BAD_RECORD' };

const chai = { id: 2041, qty: 3, pricePaise: 49900, name: 'Chai ₹' };
const CHAI_HEX = '000007f900030000c2ec00084368616920e282b9';

test('encodeOrder writes the README example byte for byte', () => {
  const buf = encodeOrder(chai);
  assert.ok(Buffer.isBuffer(buf), 'encodeOrder must return a Buffer');
  assert.equal(buf.toString('hex'), CHAI_HEX);
});

test('the name length counts UTF-8 bytes, not characters', () => {
  const buf = encodeOrder({ id: 1, qty: 1, pricePaise: 1, name: 'मसाला चाय 😀' });
  const nameBytes = Buffer.byteLength('मसाला चाय 😀');
  assert.equal(buf.length, 12 + nameBytes);
  assert.equal(buf.readUInt16BE(10), nameBytes);
  assert.equal(buf.subarray(12).toString('utf8'), 'मसाला चाय 😀');
});

test('numbers are big-endian and the largest values fit', () => {
  const buf = encodeOrder({ id: 4294967295, qty: 65535, pricePaise: 4294967294, name: '' });
  assert.equal(buf.toString('hex'), 'ffffffff' + 'ffff' + 'fffffffe' + '0000');
  const small = encodeOrder({ id: 258, qty: 513, pricePaise: 1, name: 'x' });
  assert.equal(small.toString('hex'), '00000102' + '0201' + '00000001' + '0001' + '78');
});

test('encodeOrder throws a RangeError for numbers that are not whole or out of range', () => {
  const bad = [
    { id: -1 },
    { id: 4294967296 },
    { id: 2.5 },
    { qty: 65536 },
    { qty: 1.5 },
    { qty: NaN },
    { pricePaise: 4294967296 },
    { pricePaise: 19.99 },
    { pricePaise: '7' },
    { id: undefined },
  ];
  for (const change of bad) {
    assert.throws(() => encodeOrder({ ...chai, ...change }), RangeError, JSON.stringify(change) ?? String(change));
  }
});

test('encodeOrder checks the name: a string, at most 65535 bytes of UTF-8', () => {
  assert.throws(() => encodeOrder({ ...chai, name: 42 }), TypeError);
  assert.throws(() => encodeOrder({ ...chai, name: undefined }), TypeError);
  // 32768 characters, but 65536 bytes: one byte too many
  assert.throws(() => encodeOrder({ ...chai, name: 'é'.repeat(32768) }), RangeError);
  const longest = 'é'.repeat(32767) + 'a'; // exactly 65535 bytes
  const buf = encodeOrder({ ...chai, name: longest });
  assert.equal(buf.length, 12 + 65535);
  assert.equal(decodeOrder(buf).name, longest);
});

test('decodeOrder reverses encodeOrder', () => {
  const orders = [
    chai,
    { id: 0, qty: 0, pricePaise: 0, name: '' },
    { id: 7, qty: 1, pricePaise: 2000, name: 'मसाला चाय' },
    { id: 9, qty: 1, pricePaise: 1, name: 'Unknown � item' },
    { id: 4294967295, qty: 65535, pricePaise: 4294967295, name: 'Gift box 🎁 for Zoë' },
  ];
  for (const order of orders) {
    assert.deepEqual(decodeOrder(encodeOrder(order)), order);
  }
});

test('decodeOrder accepts a plain Uint8Array, also one that is a view into a bigger buffer', () => {
  const record = encodeOrder(chai);
  assert.deepEqual(decodeOrder(new Uint8Array(record)), chai);
  const big = new Uint8Array(200);
  big.fill(0xee);
  big.set(record, 37);
  const view = big.subarray(37, 37 + record.length);
  assert.deepEqual(decodeOrder(view), chai);
});

test('decodeOrder throws a TypeError for input that is not bytes', () => {
  assert.throws(() => decodeOrder(CHAI_HEX), TypeError);
  assert.throws(() => decodeOrder([...encodeOrder(chai)]), TypeError);
  assert.throws(() => decodeOrder(null), TypeError);
});

test('decodeOrder rejects records shorter than the 12-byte header', () => {
  assert.throws(() => decodeOrder(Buffer.alloc(0)), badRecord);
  assert.throws(() => decodeOrder(encodeOrder(chai).subarray(0, 11)), badRecord);
});

test('decodeOrder rejects a name length that goes past the end', () => {
  const record = encodeOrder(chai);
  assert.throws(() => decodeOrder(record.subarray(0, record.length - 1)), badRecord);
  const lying = Buffer.from(record);
  lying.writeUInt16BE(5000, 10);
  assert.throws(() => decodeOrder(lying), badRecord);
});

test('decodeOrder rejects extra bytes after the record', () => {
  const record = encodeOrder(chai);
  assert.throws(() => decodeOrder(Buffer.concat([record, Buffer.from([0])])), badRecord);
  assert.throws(() => decodeOrder(Buffer.concat([record, record])), badRecord);
});

test('decodeOrder rejects a name that is not valid UTF-8', () => {
  const record = Buffer.from(encodeOrder({ ...chai, name: 'Chai' }));
  record[12] = 0xff;
  assert.throws(() => decodeOrder(record), badRecord);
  // a name cut in the middle of the 3-byte rupee sign, with a matching length
  const cut = Buffer.concat([Buffer.from('000000010001000000010002', 'hex'), Buffer.from([0xe2, 0x82])]);
  assert.throws(() => decodeOrder(cut), badRecord);
});

test('the ERR_BAD_RECORD errors are Error objects', () => {
  try {
    decodeOrder(Buffer.alloc(3));
    assert.fail('decodeOrder did not throw');
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.equal(err.code, 'ERR_BAD_RECORD');
  }
});

test('encodeOrders and decodeOrders handle many records', () => {
  const orders = [];
  for (let i = 0; i < 50; i++) {
    orders.push({ id: 1000 + i, qty: i % 7, pricePaise: i * 1234, name: i % 2 ? `Item ${i} ₹` : 'चाय'.repeat(i % 5) });
  }
  const all = encodeOrders(orders);
  assert.ok(Buffer.isBuffer(all));
  assert.equal(all.length, orders.reduce((sum, order) => sum + encodeOrder(order).length, 0));
  assert.deepEqual(decodeOrders(all), orders);
  assert.deepEqual(decodeOrders(new Uint8Array(all)), orders);
});

test('empty lists and cut-off record streams', () => {
  assert.equal(encodeOrders([]).length, 0);
  assert.deepEqual(decodeOrders(Buffer.alloc(0)), []);
  const all = encodeOrders([chai, { ...chai, id: 2042 }]);
  assert.throws(() => decodeOrders(all.subarray(0, all.length - 3)), badRecord);
  assert.throws(() => decodeOrders(all.subarray(0, 25)), badRecord);
});

test('running the file prints the hex and the decoded order', async () => {
  const stdout = await new Promise((resolve, reject) => {
    execFile(process.execPath, [script], { timeout: 5000 }, (err, out) => (err ? reject(err) : resolve(out)));
  });
  assert.deepEqual(stdout.trim().split('\n'), [CHAI_HEX, JSON.stringify(chai)]);
});
