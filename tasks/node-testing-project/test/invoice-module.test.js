// Checks YOUR invoice.js: the three bugs are fixed and the duplicate check is no longer O(n^2).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { referenceSource } from './reference-source.js';
import { createInvoice, formatCents, lineTotal, findDuplicateSkus, InvoiceError } from '../invoice.js';

const line = (sku, unitCents, qty, discountPct) => ({ sku, unitCents, qty, ...(discountPct === undefined ? {} : { discountPct }) });
const codeOf = (fn) => {
  try {
    fn();
  } catch (err) {
    return err instanceof InvoiceError ? err.code : `not an InvoiceError: ${err}`;
  }
  return 'no error';
};

const normalize = (code) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/\s+/g, '');

describe('invoice.js', () => {
  it('is your own fix, not a copy of the grader\'s reference', () => {
    const yours = readFileSync(new URL('../invoice.js', import.meta.url), 'utf8');
    assert.notEqual(normalize(yours), normalize(referenceSource), 'invoice.js is a copy of the grader\'s reference version: fix the original code instead');
  });

  it('formatCents always shows two cent digits and keeps the sign', () => {
    assert.equal(formatCents(1205), '12.05');
    assert.equal(formatCents(1250), '12.50');
    assert.equal(formatCents(7), '0.07');
    assert.equal(formatCents(0), '0.00');
    assert.equal(formatCents(-50), '-0.50');
    assert.equal(formatCents(-123456), '-1234.56');
  });

  it('rejects a quantity of 0 (and other bad quantities) with INVALID_LINE', () => {
    assert.equal(codeOf(() => createInvoice({ id: 'I-1', lines: [line('MUG', 900, 0)], taxRate: 0.2 })), 'INVALID_LINE');
    assert.equal(codeOf(() => createInvoice({ id: 'I-1', lines: [line('MUG', 900, -2)], taxRate: 0.2 })), 'INVALID_LINE');
    assert.equal(codeOf(() => createInvoice({ id: 'I-1', lines: [line('MUG', 900, 1.5)], taxRate: 0.2 })), 'INVALID_LINE');
    assert.equal(codeOf(() => createInvoice({ id: 'I-1', lines: [line('MUG', 900, 1)], taxRate: 0.2 })), 'no error');
  });

  it('charges tax on the discounted subtotal, rounded to the nearest cent', () => {
    const invoice = createInvoice({ id: 'I-2', lines: [line('MUG', 1000, 2, 25), line('TEA', 505, 1)], taxRate: 0.1 });
    assert.equal(invoice.subtotalCents, 2005);
    assert.equal(invoice.taxCents, 201, 'tax is 10% of 2005 = 200.5, rounded to 201');
    assert.equal(invoice.totalCents, 2206);
    assert.deepEqual(invoice.lines, [
      { sku: 'MUG', qty: 2, totalCents: 1500 },
      { sku: 'TEA', qty: 1, totalCents: 505 },
    ]);
  });

  it('keeps the rules that already worked', () => {
    assert.equal(lineTotal(line('A', 333, 1, 50)), 167);
    assert.equal(codeOf(() => createInvoice({ id: 'I-3', lines: [], taxRate: 0 })), 'NO_LINES');
    assert.deepEqual(findDuplicateSkus([line('B', 1, 1), line('A', 1, 1), line('B', 1, 1), line('A', 1, 1), line('B', 1, 1)]), ['B', 'A']);
    try {
      createInvoice({ id: 'I-4', lines: [line('X', 1, 1), line('X', 1, 1)], taxRate: 0 });
      assert.fail('expected DUPLICATE_SKU');
    } catch (err) {
      assert.equal(err.code, 'DUPLICATE_SKU');
      assert.deepEqual(err.details.skus, ['X']);
    }
  });

  it('checks 3000 lines for duplicates with a few reads of line.sku per line, not millions', () => {
    let reads = 0;
    const lines = Array.from({ length: 3000 }, (_, i) => {
      const sku = `SKU-${i}`;
      return {
        get sku() {
          reads++;
          return sku;
        },
        unitCents: 100,
        qty: 1,
      };
    });
    const invoice = createInvoice({ id: 'BIG', lines, taxRate: 0 });
    assert.equal(invoice.subtotalCents, 300000);
    assert.ok(reads <= 40 * lines.length, `line.sku was read ${reads} times for ${lines.length} lines: the duplicate check is still O(n^2)`);
  });

  it('finds duplicates among 200,000 lines in one pass, without scanning the list again for every line', () => {
    const helper = fileURLToPath(new URL('./big-import-check.js', import.meta.url));
    const invoiceFile = fileURLToPath(new URL('../invoice.js', import.meta.url));
    // A one-pass check takes well under a second here; comparing every pair of 200,000 lines takes minutes.
    const run = spawnSync(process.execPath, [helper, invoiceFile], { encoding: 'utf8', timeout: 5000 });
    assert.ok(!run.error, 'findDuplicateSkus did not finish 200,000 lines within 5 s: it still compares every pair of lines (O(n^2))');
    assert.doesNotMatch(run.stdout, /^SCAN/m, `${run.stdout.trim()}: copying the SKUs out and searching them with indexOf/includes/find for every line is still O(n^2)`);
    assert.equal(run.status, 0, `the check crashed: ${run.stderr.split('\n').slice(0, 3).join(' ')}`);
    assert.match(run.stdout, /^RESULT \["SKU-0","SKU-1"\]$/m, 'findDuplicateSkus on the big input returns ["SKU-0","SKU-1"]');
  });
});
