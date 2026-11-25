// Try the pipeline by hand: node demo.js (from this folder). Not part of the tests.
import { OrderService, connectListeners } from './index.js';

const service = new OrderService();
const stock = new Map([['pen', 10], ['notebook', 2]]);
const outbox = [];
const stats = { placed: 0, failed: 0, revenue: 0, reasons: {} };

service.on('error', (err) => console.error(`error for ${err.orderId}: ${err.message}`));
const disconnect = connectListeners(service, { stock, outbox, stats });

console.log(service.placeOrder({ id: 'A-1', customer: 'ana@example.com', items: [{ sku: 'pen', qty: 2, price: 150 }] }));
console.log(service.placeOrder({ id: 'A-2', customer: 'leo@example.com', items: [{ sku: 'notebook', qty: 5, price: 400 }] }));
console.log(service.placeOrder({ id: 'A-3', customer: 'no-email', items: [{ sku: 'pen', qty: 1, price: 150 }] }));

disconnect();
console.log({ stock: Object.fromEntries(stock), outbox, stats });
console.log('listeners left:', service.listenerCount('order:placed'), service.listenerCount('order:failed'));
