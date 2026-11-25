# Task: node-testing-project

The shop's invoice module builds every invoice the company sends. It has no tests, customers have complained about
wrong totals, and the nightly import of big B2B orders (thousands of lines) has become slow. Your job: write the
tests that should have been there, use them to find and fix **three bugs**, and make the slow duplicate check fast.
This is the normal way to take over untested code in a real job: tests first, then changes.

```text
tasks/node-testing-project/
  invoice.js          <- the module: three bugs and one slow function (you fix it)
  invoice.test.js     <- YOUR tests go here
  test/               <- the grader: do not change it, and do not read it (the planted bugs and the reference
                         version in it give the three bugs away; they are encoded so you cannot read them by accident)
```

## The rules of the module

- `formatCents(cents)` turns whole cents into text with exactly two cent digits: `1205` gives `'12.05'`, `-50`
  gives `'-0.50'`, `0` gives `'0.00'`. No thousands separator.
- `lineTotal({ unitCents, qty, discountPct = 0 })` is `unitCents * qty` minus `discountPct` percent, rounded to the
  nearest cent (half a cent rounds up): `lineTotal({ unitCents: 333, qty: 1, discountPct: 50 })` gives `167`.
- `findDuplicateSkus(lines)` returns the SKUs that appear more than once, each listed once, in the order they first
  appear.
- `createInvoice({ id, lines, taxRate })` returns
  `{ id, lines: [{ sku, qty, totalCents }], subtotalCents, taxCents, totalCents }`, or throws an `InvoiceError`
  whose `code` says what is wrong:
  - `NO_LINES` when `lines` is empty;
  - `INVALID_LINE` when a line's `qty` is not a whole number from 1 up, `unitCents` is not a whole number from 0
    up, or `discountPct` is not from 0 to 100;
  - `DUPLICATE_SKU` when a SKU appears more than once; `err.details.skus` lists them (as `findDuplicateSkus` does).
- `subtotalCents` is the sum of the line totals (after discounts). `taxCents` is `subtotalCents * taxRate` rounded
  to the nearest cent. `totalCents = subtotalCents + taxCents`.

## What to do

1. **Write tests** in `invoice.test.js` (at least 8) for these cases:
   1. `formatCents` pads the cents (`1205` gives `'12.05'`).
   2. `formatCents` keeps the minus sign below one unit (`-50` gives `'-0.50'`).
   3. `lineTotal` applies the discount (`unitCents: 999, qty: 2, discountPct: 10` gives `1798`).
   4. `lineTotal` rounds half a cent up (the `167` example above).
   5. A quantity of `0` is rejected with `INVALID_LINE`.
   6. A quantity such as `1.5` is rejected with `INVALID_LINE`.
   7. An invoice without lines is rejected with `NO_LINES`.
   8. Duplicate SKUs are rejected with `DUPLICATE_SKU`.
   9. A SKU that appears three times is listed **once** in `details.skus`, and the list is in order of first
      appearance.
   10. Tax is charged on the subtotal **after** discounts.
   11. Tax is rounded to the nearest cent (a subtotal of `1005` at `taxRate: 0.1` gives `taxCents: 101`).
2. **Find and fix the three bugs** in `invoice.js`. Some of your tests fail on the code as it is: that is the
   point. Change the code, not the tests, until they pass.
3. **Make `findDuplicateSkus` fast.** It compares every line with every other line, so 3,000 lines need millions of
   steps. Make it look at each line a fixed number of times. Copying the SKUs into an array and searching that
   array with `indexOf`, `includes` or `find` for every line is still O(n²). The grader checks this in two ways:
   it counts how often your code reads `line.sku` for an invoice with 3,000 lines, and it runs
   `findDuplicateSkus` on 200,000 lines in a separate process, counting how many elements array searches look at
   (a one-pass version needs under a second there; comparing every pair would take minutes, so it is stopped
   after 5 seconds).

## How you are graded

- `test/invoice-module.test.js` checks your `invoice.js`: the bugs are fixed, the duplicate check reads
  `line.sku` only a few times per line and finishes 200,000 lines in one pass, and the file is not a copy of the
  grader's reference.
- `test/grade-your-tests.test.js` runs your `invoice.test.js` against a correct invoice module (all your tests must
  pass) and against eleven versions with one planted bug each, one for each case above (your tests must **fail** on
  every one of them). A bug that gets through is named, for example
  `all your tests passed on a version that rounds the tax down instead of to the nearest cent`.

## Rules

- Only `node:` built-ins. No npm packages.
- Keep the exports and their names. Do not change anything in `test/`.
- `invoice.test.js` may import only `./invoice.js` and `node:` modules (the grader copies it into an empty folder).

## Check your work

```
npm run task -- node-testing-project
```

When all tests pass, commit and push your branch `task/node-testing-project`.
