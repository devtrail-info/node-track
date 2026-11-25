// The three listeners of the order pipeline. Each factory gets the thing it changes and returns listener functions.
// See README.md, step 1.

// Stock: `stock` is a Map of sku -> units left.
export function reserveStock(stock) {
  return function onOrderPlaced(order) {
    // TODO: check every item, throw `Out of stock: <sku>` if one is short, else take the units from stock
    throw new Error('reserveStock is not written yet');
  };
}

// Email: `outbox` is an array of messages.
export function sendConfirmation(outbox) {
  return function onOrderPlaced(order) {
    // TODO: push { to, subject, total }
    throw new Error('sendConfirmation is not written yet');
  };
}

// Analytics: `stats` is { placed, failed, revenue, reasons }.
export function trackOrders(stats) {
  return {
    onPlaced(order) {
      // TODO
      throw new Error('trackOrders is not written yet');
    },
    onFailed({ order, reason }) {
      // TODO
      throw new Error('trackOrders is not written yet');
    },
  };
}
