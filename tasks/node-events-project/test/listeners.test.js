import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reserveStock, sendConfirmation, trackOrders } from '../listeners.js';

const order = (items, extra = {}) => ({ id: 'A-1', customer: 'ana@example.com', items, total: 0, ...extra });

test('reserveStock takes the ordered units from stock', () => {
  const stock = new Map([['pen', 10], ['notebook', 3]]);
  reserveStock(stock)(order([{ sku: 'pen', qty: 4, price: 150 }, { sku: 'notebook', qty: 3, price: 400 }]));
  assert.deepEqual(Object.fromEntries(stock), { pen: 6, notebook: 0 });
});

test('reserveStock throws "Out of stock: <sku>" and changes nothing when one item is short', () => {
  const stock = new Map([['pen', 10], ['notebook', 1]]);
  const reserve = reserveStock(stock);
  assert.throws(
    () => reserve(order([{ sku: 'pen', qty: 2, price: 150 }, { sku: 'notebook', qty: 2, price: 400 }])),
    { message: 'Out of stock: notebook' },
  );
  assert.deepEqual(Object.fromEntries(stock), { pen: 10, notebook: 1 }, 'the pens were taken even though the order failed');
});

test('reserveStock treats a sku that is not in the map as 0 units', () => {
  const stock = new Map([['pen', 10]]);
  assert.throws(() => reserveStock(stock)(order([{ sku: 'stapler', qty: 1, price: 900 }])), { message: 'Out of stock: stapler' });
  assert.deepEqual(Object.fromEntries(stock), { pen: 10 });
});

test('reserveStock adds up the same sku on two lines before checking', () => {
  const stock = new Map([['pen', 3]]);
  assert.throws(
    () => reserveStock(stock)(order([{ sku: 'pen', qty: 2, price: 150 }, { sku: 'pen', qty: 2, price: 150 }])),
    { message: 'Out of stock: pen' },
  );
  assert.equal(stock.get('pen'), 3);
});

test('sendConfirmation pushes one message per order', () => {
  const outbox = [];
  const send = sendConfirmation(outbox);
  send(order([{ sku: 'pen', qty: 1, price: 150 }], { id: 'B-7', customer: 'leo@example.com', total: 150 }));
  send(order([{ sku: 'pen', qty: 2, price: 150 }], { id: 'B-8', total: 300 }));
  assert.deepEqual(outbox, [
    { to: 'leo@example.com', subject: 'Order B-7 confirmed', total: 150 },
    { to: 'ana@example.com', subject: 'Order B-8 confirmed', total: 300 },
  ]);
});

test('trackOrders counts placed orders, revenue, failures and reasons', () => {
  const stats = { placed: 0, failed: 0, revenue: 0, reasons: {} };
  const { onPlaced, onFailed } = trackOrders(stats);
  onPlaced(order([], { total: 300 }));
  onPlaced(order([], { total: 1250 }));
  onFailed({ order: {}, reason: 'no items' });
  onFailed({ order: {}, reason: 'Out of stock: pen' });
  onFailed({ order: {}, reason: 'no items' });
  assert.deepEqual(stats, { placed: 2, failed: 3, revenue: 1550, reasons: { 'no items': 2, 'Out of stock: pen': 1 } });
});
