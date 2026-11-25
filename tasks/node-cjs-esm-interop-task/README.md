# Task: node-cjs-esm-interop-task

Move a CommonJS helper to an ES module, and keep the old CommonJS code working. Real teams do this all the
time: new code is written as ES modules, but old files (scripts, config, tests) still use `require()`, and you
can't change them all in one day.

You need **Node 22.12 or newer** (Node 24 LTS is fine). Check with `node -v`. On older versions two tests are
skipped, because `require()` of an ES module only works by default from Node 22.12.

The folder has three files:

- `text-utils.cjs`: the helper today (CommonJS). It exports `slugify(title)` and `outputPath(title)`.
- `legacy-report.cjs`: old CommonJS code that uses the helper. **Do not change it.**
- `index.js`: new code, an ES module, that uses the helper.

## What to do

1. Create `text-utils.js`, an **ES module** with the same two functions as **named exports**.
   Move the code from `text-utils.cjs` and change it to ES module style: `import` instead of `require()`,
   `export` instead of `module.exports`, and `import.meta.dirname` instead of `__dirname`.
   For example, `slugify('  Summer Sale 2026! ')` returns `'summer-sale-2026'`, and
   `outputPath('Gift Cards')` returns `<this folder>/pages/gift-cards.html`.
2. Turn `text-utils.cjs` into a **bridge** with no code of its own: it loads `text-utils.js` with `require()` and
   exports what it gets. Then there is only one copy of the code.
   For example, `require('./text-utils.cjs').slugify === (await import('./text-utils.js')).slugify` is `true`.
3. Change `index.js` to import `slugify` **by name** from `./text-utils.js` (with the `.js` extension).
   For example, `pageLinks(['Gift Cards'])` returns `['/gift-cards']`.
4. `legacy-report.cjs` must still print the same two lines, without any change to that file:

   ```text
   summer-sale-2026
   pages/summer-sale-2026.html
   ```

## Rules

- Only `node:` built-ins. No npm packages.
- Do not change `legacy-report.cjs`.
- `text-utils.js` must not use `require()`, `module.exports`, `exports.` or `__dirname`.
- Do not copy the functions into `text-utils.cjs`. One real copy, in `text-utils.js`.

## Check your work

```
npm run task -- node-cjs-esm-interop-task
```

You can also run the old report yourself: `node tasks/node-cjs-esm-interop-task/legacy-report.cjs`.

When all tests pass, commit and push your branch `task/node-cjs-esm-interop-task`.
