import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { OrderService } from '../index.js';

const valid = () => ({
  id: 'A-1',
  customer: 'ana@example.com',
  items: [
    { sku: 'pen', qty: 2, price: 150 },
    { sku: 'notebook', qty: 1, price: 400 },
  ],
});

function record(service) {
  const seen = [];
  service.on('order:placed', (order) => seen.push(['placed', order]));
  service.on('order:failed', (event) => seen.push(['failed', event]));
  return seen;
}

test('OrderService is an EventEmitter', () => {
  assert.ok(new OrderService() instanceof EventEmitter);
});

test('a valid order emits order:placed with the order and its total in cents, and returns { ok: true, total }', () => {
  const service = new OrderService();
  const seen = record(service);
  const order = valid();
  assert.deepEqual(service.placeOrder(order), { ok: true, total: 700 });
  assert.deepEqual(seen, [['placed', { ...order, total: 700 }]]);
  assert.equal(order.total, undefined, 'placeOrder changed the caller\'s order object');
});

test('the total is worked out for every order', () => {
  const service = new OrderService();
  const order = { id: 'A-2', customer: 'leo@example.com', items: [{ sku: 'bag', qty: 3, price: 2599 }, { sku: 'gift-card', qty: 1, price: 0 }] };
  assert.deepEqual(service.placeOrder(order), { ok: true, total: 7797 });
});

test('listeners have already run when placeOrder returns', () => {
  const service = new OrderService();
  const seen = record(service);
  service.placeOrder(valid());
  assert.equal(seen.length, 1, 'order:placed was not emitted before placeOrder returned');
});

test('invalid orders emit order:failed with { order, reason } and return { ok: false, reason }', () => {
  const cases = [
    [{ customer: 'ana@example.com', items: valid().items }, 'missing id'],
    [{ id: '', customer: 'ana@example.com', items: valid().items }, 'missing id'],
    [{ id: 'A-1', customer: 'ana.example.com', items: valid().items }, 'invalid customer'],
    [{ id: 'A-1', items: valid().items }, 'invalid customer'],
    [{ id: 'A-1', customer: 'ana@example.com', items: [] }, 'no items'],
    [{ id: 'A-1', customer: 'ana@example.com' }, 'no items'],
    [{ id: 'A-1', customer: 'ana@example.com', items: [{ sku: 'pen', qty: 0, price: 150 }] }, 'invalid item'],
    [{ id: 'A-1', customer: 'ana@example.com', items: [{ sku: 'pen', qty: 1.5, price: 150 }] }, 'invalid item'],
    [{ id: 'A-1', customer: 'ana@example.com', items: [{ sku: 'pen', qty: 1, price: -5 }] }, 'invalid item'],
    [{ id: 'A-1', customer: 'ana@example.com', items: [{ sku: 'pen', qty: 1, price: '150' }] }, 'invalid item'],
    [{ id: 'A-1', customer: 'ana@example.com', items: [{ sku: '', qty: 1, price: 150 }] }, 'invalid item'],
    [{ id: 'A-1', customer: 'nope', items: [] }, 'invalid customer'],
    [{ id: 7, customer: 'ana@example.com', items: valid().items }, 'missing id'],
    [{ id: 'A-1', customer: 'ana@example.com', items: 'pen' }, 'no items'],
    [{ id: 'A-1', customer: 'ana@example.com', items: [{ sku: 42, qty: 1, price: 150 }] }, 'invalid item'],
    [{ id: 'A-1', customer: 'ana@example.com', items: [{ sku: 'pen', qty: 1, price: 1.5 }] }, 'invalid item'],
  ];
  for (const [order, reason] of cases) {
    const service = new OrderService();
    const seen = record(service);
    assert.deepEqual(service.placeOrder(order), { ok: false, reason }, JSON.stringify(order));
    assert.deepEqual(seen, [['failed', { order, reason }]], JSON.stringify(order));
  }
});

test('a listener that throws: order:failed with the error message, then the error goes to the error event', () => {
  const service = new OrderService();
  const events = [];
  const boom = new Error('Out of stock: pen');
  service.on('order:placed', () => {
    throw boom;
  });
  service.on('order:failed', ({ reason }) => events.push('failed: ' + reason));
  service.on('error', (err) => events.push(err));
  assert.deepEqual(service.placeOrder(valid()), { ok: false, reason: 'Out of stock: pen' });
  assert.deepEqual(events, ['failed: Out of stock: pen', boom]);
  assert.equal(boom.orderId, 'A-1', 'the error has no orderId');
});

test('with no error listener, the listener\'s error is thrown out of placeOrder (after order:failed)', () => {
  const service = new OrderService();
  const failed = [];
  const boom = new Error('mail server down');
  service.on('order:placed', () => {
    throw boom;
  });
  service.on('order:failed', ({ reason }) => failed.push(reason));
  assert.throws(() => service.placeOrder(valid()), (err) => err === boom);
  assert.deepEqual(failed, ['mail server down']);
});

test('listeners after the one that throws do not run', () => {
  const service = new OrderService();
  const ran = [];
  service.on('error', () => {});
  service.on('order:placed', () => ran.push('first'));
  service.on('order:placed', () => {
    throw new Error('stop');
  });
  service.on('order:placed', () => ran.push('third'));
  service.placeOrder(valid());
  assert.deepEqual(ran, ['first']);
});
