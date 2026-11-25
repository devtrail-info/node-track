// Task: node-runtime-project. Read README.md in this folder.
import { fileURLToPath } from 'node:url';
import { makeOrder } from './orders.js';

// TODO 1-3: sum `count` orders in chunks and resolve with the report object.
export async function buildReport(count = 1_000_000, { chunkSize = 50_000, onProgress } = {}) {
  const report = {
    orders: 0,
    paid: 0,
    refunded: 0,
    revenueCents: 0,
    byRegion: { north: 0, south: 0, east: 0, west: 0 },
  };
  return report;
}

// TODO 4: turn the report into the text shown in README.md.
export function formatReport(report) {
  return '';
}

// TODO 5: when this file is run directly, run the report with a 10 ms heartbeat.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log('TODO');
}
