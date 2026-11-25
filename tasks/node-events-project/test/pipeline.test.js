import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrderService, connectListeners } from '../index.js';

function setup(stockEntries = [['pen', 10], ['notebook', 2]]) {
  const service = new OrderService();
  const deps = { stock: new Map(stockEntries), outbox: [], stats: { placed: 0, failed: 0, revenue: 0, reasons: {} } };
  return { service, ...deps, deps };
}

const penOrder = (id, qty = 2) => ({ id, customer: `${id.toLowerCase()}@example.com`, items: [{ sku: 'pen', qty, price: 150 }] });

test('a placed order takes stock, sends one email and is counted', () => {
  const { service, stock, outbox, stats, deps } = setup();
  service.on('error', () => {});
  connectListeners(service, deps);
  assert.deepEqual(service.placeOrder(penOrder('A-1')), { ok: true, total: 300 });
  assert.equal(stock.get('pen'), 8);
  assert.deepEqual(outbox, [{ to: 'a-1@example.com', subject: 'Order A-1 confirmed', total: 300 }]);
  assert.deepEqual(stats, { placed: 1, failed: 0, revenue: 300, reasons: {} });
});

test('an out-of-stock order sends no email, is counted as failed and reaches the error listener', () => {
  const { service, stock, outbox, stats, deps } = setup();
  const errors = [];
  service.on('error', (err) => errors.push(`${err.orderId}: ${err.message}`));
  connectListeners(service, deps);
  const order = { id: 'A-2', customer: 'leo@example.com', items: [{ sku: 'pen', qty: 1, price: 150 }, { sku: 'notebook', qty: 5, price: 400 }] };
  assert.deepEqual(service.placeOrder(order), { ok: false, reason: 'Out of stock: notebook' });
  assert.deepEqual(outbox, [], 'an email went out for an order that failed');
  assert.deepEqual(Object.fromEntries(stock), { pen: 10, notebook: 2 });
  assert.deepEqual(stats, { placed: 0, failed: 1, revenue: 0, reasons: { 'Out of stock: notebook': 1 } });
  assert.deepEqual(errors, ['A-2: Out of stock: notebook']);
});

test('an invalid order is counted with its reason and touches nothing else', () => {
  const { service, stock, outbox, stats, deps } = setup();
  connectListeners(service, deps);
  service.placeOrder({ id: 'A-3', customer: 'no-email', items: [{ sku: 'pen', qty: 1, price: 150 }] });
  assert.equal(stock.get('pen'), 10);
  assert.deepEqual(outbox, []);
  assert.deepEqual(stats, { placed: 0, failed: 1, revenue: 0, reasons: { 'invalid customer': 1 } });
});

test('stock runs before every other order:placed listener, even ones added before connectListeners', () => {
  const { service, stock, deps } = setup();
  const audit = [];
  service.on('error', () => {});
  service.on('order:placed', (order) => audit.push(`${order.id}: ${stock.get('pen')} pens left`));
  connectListeners(service, deps);
  service.placeOrder(penOrder('A-4', 3));
  service.placeOrder(penOrder('A-5', 50));
  assert.deepEqual(audit, ['A-4: 7 pens left'], 'the audit listener ran before stock, or ran for an order that failed');
});

test('the email goes out before the order is counted', () => {
  const { service, outbox, stats, deps } = setup();
  connectListeners(service, deps);
  const seen = [];
  const push = outbox.push.bind(outbox);
  outbox.push = (message) => {
    seen.push(`email while placed=${stats.placed}`);
    return push(message);
  };
  service.placeOrder(penOrder('A-6'));
  assert.deepEqual(seen, ['email while placed=0']);
});

test('several orders in a row add up', () => {
  const { service, stock, outbox, stats, deps } = setup();
  service.on('error', () => {});
  connectListeners(service, deps);
  service.placeOrder(penOrder('B-1', 4));
  service.placeOrder(penOrder('B-2', 4));
  service.placeOrder(penOrder('B-3', 4));
  service.placeOrder({ id: 'B-4', customer: 'b-4@example.com', items: [] });
  assert.equal(stock.get('pen'), 2);
  assert.deepEqual(outbox.map((m) => m.subject), ['Order B-1 confirmed', 'Order B-2 confirmed']);
  assert.deepEqual(stats, { placed: 2, failed: 2, revenue: 1200, reasons: { 'Out of stock: pen': 1, 'no items': 1 } });
});

test('disconnect() removes only the listeners connectListeners added', () => {
  const { service, outbox, stats, deps } = setup();
  const audit = () => {};
  const onFail = () => {};
  service.on('order:placed', audit);
  service.on('order:failed', onFail);
  const disconnect = connectListeners(service, deps);
  assert.equal(service.listenerCount('order:placed'), 4);
  assert.equal(service.listenerCount('order:failed'), 2);
  disconnect();
  assert.deepEqual(service.listeners('order:placed'), [audit]);
  assert.deepEqual(service.listeners('order:failed'), [onFail]);
  disconnect();
  assert.deepEqual(service.listeners('order:placed'), [audit], 'calling disconnect() twice removed someone else\'s listener');
  service.placeOrder(penOrder('C-1'));
  assert.deepEqual(outbox, []);
  assert.equal(stats.placed, 0);
});

test('connecting and disconnecting 20 times leaks no listeners and prints no MaxListenersExceededWarning', async () => {
  const warnings = [];
  const onWarning = (w) => warnings.push(w.name);
  process.on('warning', onWarning);
  try {
    const { service, deps } = setup();
    for (let i = 0; i < 20; i++) connectListeners(service, deps)();
    assert.equal(service.listenerCount('order:placed'), 0);
    assert.equal(service.listenerCount('order:failed'), 0);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(warnings, []);
  } finally {
    process.off('warning', onWarning);
  }
});
