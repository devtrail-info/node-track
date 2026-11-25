// The same package, loaded from CommonJS with require().
const { test } = require('node:test');
const assert = require('node:assert/strict');

test('require("price-utils") gives toCents, addTax and formatPrice', () => {
  const { toCents, addTax, formatPrice } = require('price-utils');
  assert.equal(toCents(19.99), 1999);
  assert.equal(toCents('4.50'), 450);
  assert.equal(addTax(1999, 20), 2399);
  assert.equal(addTax(1000, 7.5), 1075);
  assert.equal(formatPrice(2399), '23.99 EUR');
  assert.equal(formatPrice(500, 'USD'), '5.00 USD');
});

test('require("price-utils") resolves to the CommonJS file cjs/index.cjs', () => {
  assert.match(require.resolve('price-utils'), /[\\/]cjs[\\/]index\.cjs$/);
});

test('the CommonJS entry is real CommonJS: it does not require() the ES module source', () => {
  const code = require('node:fs').readFileSync(require.resolve('price-utils'), 'utf8');
  assert.match(code, /module\.exports/);
  assert.doesNotMatch(code, /require\(\s*['"][^'"]*src\//, 'cjs/index.cjs should work without require(esm)');
});

test('the internal helper is private for require() too', () => {
  assert.throws(() => require('price-utils/src/internal/round.js'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
});
