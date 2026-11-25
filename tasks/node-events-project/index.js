import { EventEmitter } from 'node:events';
import { reserveStock, sendConfirmation, trackOrders } from './listeners.js';

// See README.md, step 2.
export class OrderService extends EventEmitter {
  placeOrder(order) {
    // TODO: check the order, emit 'order:placed' or 'order:failed', route listener errors to 'error'
    throw new Error('placeOrder is not written yet');
  }
}

// See README.md, step 3. Returns a disconnect() function.
export function connectListeners(service, { stock, outbox, stats }) {
  // TODO: attach the stock, email and analytics listeners in the right order
  throw new Error('connectListeners is not written yet');
}
