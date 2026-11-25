// Grader helper, run in a child process by invoice-module.test.js: findDuplicateSkus on 200,000 lines.
// It counts the elements that array searches (indexOf, includes, find, some, filter, ...) look at, and stops as soon
// as that is far more than a one-pass check needs. Code that compares every pair with plain loops is stopped by the
// parent's deadline instead: 200,000 lines mean about 20 billion pairs.
import { pathToFileURL } from 'node:url';

const LIMIT_PER_LINE = 50;
const N = 200_000;
const { findDuplicateSkus } = await import(pathToFileURL(process.argv[2]).href);

const lines = Array.from({ length: N }, (_, i) => ({ sku: `SKU-${i}`, unitCents: 100, qty: 1 }));
lines.push({ sku: 'SKU-1', unitCents: 100, qty: 1 }, { sku: 'SKU-0', unitCents: 100, qty: 1 });

let visited = 0;
const limit = LIMIT_PER_LINE * lines.length;
const tooMuch = () => {
  process.stdout.write(`SCAN array searches looked at more than ${limit} elements for ${lines.length} lines\n`);
  process.exit(3);
};
const P = Array.prototype;
for (const name of ['indexOf', 'lastIndexOf', 'includes']) {
  const original = P[name];
  P[name] = function (...args) {
    visited += this.length;
    if (visited > limit) tooMuch();
    return original.apply(this, args);
  };
}
for (const name of ['find', 'findIndex', 'findLast', 'findLastIndex', 'some', 'every', 'filter']) {
  const original = P[name];
  P[name] = function (callback, thisArg) {
    return original.call(this, function (...args) {
      if (++visited > limit) tooMuch();
      return callback.apply(this, args);
    }, thisArg);
  };
}

const result = findDuplicateSkus(lines);
process.stdout.write(`RESULT ${JSON.stringify(result)}\n`);
