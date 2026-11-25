// Given, do not change. Turns a list of orders into one line of text.
export function summarize(orders, currency = 'EUR') {
  const cents = orders.reduce((sum, order) => sum + order.totalCents, 0);
  const label = orders.length === 1 ? 'order' : 'orders';
  return `${orders.length} ${label}, total ${(cents / 100).toFixed(2)} ${currency}`;
}
