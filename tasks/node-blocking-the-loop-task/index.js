// Task: node-blocking-the-loop-task. Read README.md in this folder.
import { fileURLToPath } from 'node:url';

// Do not change this helper.
export function isPrime(n) {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) {
    if (n % d === 0) return false;
  }
  return true;
}

// TODO: this gives the right answer, but it blocks the event loop until the
// whole count is done. Check `chunkSize` numbers at a time and give the event
// loop a turn with setImmediate between chunks.
export async function countPrimes(limit, { chunkSize = 10_000 } = {}) {
  let count = 0;
  for (let n = 0; n < limit; n++) {
    if (isPrime(n)) count++;
  }
  return count;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  countPrimes(1_000_000).then((count) => console.log(`Primes below 1000000: ${count}`));
}
