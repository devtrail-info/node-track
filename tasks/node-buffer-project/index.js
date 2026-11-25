// Task: node-buffer-project. Read README.md in this folder.
import { fileURLToPath } from 'node:url';

// Layout (all big-endian): id uint32 | qty uint16 | pricePaise uint32 | name length uint16 | name UTF-8
export const HEADER_SIZE = 12;

// TODO 1: validate the order and write it into a Buffer of 12 + n bytes.
export function encodeOrder(order) {
  return Buffer.alloc(0);
}

// TODO 2: read one record from a Buffer or Uint8Array; throw ERR_BAD_RECORD errors for malformed input.
export function decodeOrder(bytes) {
  return null;
}

// TODO 3: all records, one after the other.
export function encodeOrders(orders) {
  return Buffer.alloc(0);
}

// TODO 4: read records until the input is used up.
export function decodeOrders(bytes) {
  return [];
}

// TODO 5: when this file is run directly, print the sample record as hex and as decoded JSON.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log('TODO');
}
