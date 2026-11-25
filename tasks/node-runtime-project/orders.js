// Generates fake orders for the report. Do not change this file.
// The same index always gives the same order, so the totals are always the same.

const REGIONS = ['north', 'south', 'east', 'west'];

export function makeOrder(i) {
  return {
    id: 'ORD-' + String(i + 1).padStart(7, '0'),
    region: REGIONS[i % 4],
    amountCents: ((i * 7919) % 50000) + 500,
    status: i % 20 === 0 ? 'refunded' : 'paid',
  };
}
