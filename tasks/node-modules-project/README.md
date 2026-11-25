# Task: node-modules-project

Build **price-utils**, a small npm-style package for prices in cents. It is written as ES modules, and it works
for both kinds of users: code that uses `import` and code that uses `require()`. Every shared library in a
company (a design system, an API client, money helpers) needs exactly this setup.

This task folder **is** the package: it has its own `package.json` with `"name": "price-utils"`. The tests live
inside the package, so they can load it by its own name (`import 'price-utils'`). Node calls this
**self-reference**, and it only works when `package.json` has an `"exports"` field.

```text
tasks/node-modules-project/
  package.json            <- you add "exports" and "imports"
  src/index.js            <- main entry (ES module)
  src/format.js           <- subpath entry 'price-utils/format'
  src/internal/round.js   <- private helper (given, do not change)
  cjs/index.cjs           <- CommonJS entry for require() users
  test/                   <- the tests (do not change)
```

Money is in **cents** (whole numbers), so sums stay exact.

## What to do

1. In `src/format.js`, export `formatPrice(cents, currency = 'EUR')`. It returns the amount in units with
   2 decimals, a space, and the currency.
   For example, `formatPrice(2399)` returns `'23.99 EUR'` and `formatPrice(500, 'USD')` returns `'5.00 USD'`.
2. In `src/index.js`, export:
   - `toCents(amount)`: a number or a string in units, to whole cents.
     For example, `toCents(19.99)` returns `1999` and `toCents('4.50')` returns `450`.
   - `addTax(cents, ratePercent)`: the price with tax, rounded half up with `roundHalfUp`.
     For example, `addTax(1999, 20)` returns `2399` and `addTax(1000, 7.5)` returns `1075`.
   - `formatPrice`, re-exported from `./format.js`.
3. Add an `"imports"` field to `package.json` that maps `#round` to `./src/internal/round.js`. In
   `src/index.js`, import `roundHalfUp` from `'#round'` (not from a relative path).
4. Add an `"exports"` field to `package.json`:
   - `"."` with conditions: `"import"` points to `./src/index.js`, `"require"` points to `./cjs/index.cjs`.
     Add `"default"` last, pointing to `./src/index.js`.
   - `"./format"` points to `./src/format.js`.
   - Nothing else from `src/` is public. For example, `import 'price-utils/src/internal/round.js'` must fail
     with `ERR_PACKAGE_PATH_NOT_EXPORTED`.
5. In `cjs/index.cjs`, write the CommonJS version: export `toCents`, `addTax` and `formatPrice` with
   `module.exports`, with the same results as the ES module. It must not `require()` the files in `src/`, so it
   also works on Node versions without `require(esm)`.
   For example, `require('price-utils').addTax(1999, 20)` returns `2399`.

## Rules

- Only `node:` built-ins. No npm packages, no build tools.
- Do not change `src/internal/round.js` or anything in `test/`.
- Keep `"type": "module"` in `package.json`, and keep the `"main"` field (old tools read it; `"exports"` wins in
  Node).
- The package has no state (no counters, no caches, no classes), so two copies of the code (ES module and
  CommonJS) can't disagree. Keep it that way.

## Check your work

```
npm run task -- node-modules-project
```

When all tests pass, commit and push your branch `task/node-modules-project`.
