// Loads the package by its name, the way users do. A file inside a package can import the package by its own
// name ("self-reference"), but only when package.json has an "exports" field.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('import "price-utils" gives toCents, addTax and formatPrice', async () => {
  const { toCents, addTax, formatPrice } = await import('price-utils');
  assert.equal(toCents(19.99), 1999);
  assert.equal(toCents('4.50'), 450);
  assert.equal(addTax(1999, 20), 2399);
  assert.equal(addTax(1000, 7.5), 1075);
  assert.equal(formatPrice(2399), '23.99 EUR');
  assert.equal(formatPrice(500, 'USD'), '5.00 USD');
});

test('import "price-utils" resolves to the ES module source src/index.js', () => {
  assert.match(import.meta.resolve('price-utils'), /\/src\/index\.js$/);
});

test('import "price-utils/format" gives formatPrice', async () => {
  const { formatPrice } = await import('price-utils/format');
  assert.equal(formatPrice(12345, 'GBP'), '123.45 GBP');
  assert.match(import.meta.resolve('price-utils/format'), /\/src\/format\.js$/);
});

test('the internal helper is private: "price-utils/src/internal/round.js" is not exported', async () => {
  await assert.rejects(import('price-utils/src/internal/round.js'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
});

test('"#round" is mapped in the "imports" field and src/index.js uses it', async () => {
  const { roundHalfUp } = await import('#round');
  assert.equal(roundHalfUp(2.5), 3);
  const code = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  assert.match(code, /from\s*['"]#round['"]/, "import roundHalfUp from '#round' in src/index.js");
});
