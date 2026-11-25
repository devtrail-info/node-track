# Task: node-npx-and-bins-task

Turn a small script into a real command-line tool that npm can install. Every tool you run with `npx` or from an
npm script (test runners, linters, code generators) is set up exactly like this: a `bin` field, a shebang line, and
a start check that works when npm runs the file through a link.

This task folder **is** a package called `order-total`, with its own `package.json`:

```text
tasks/node-npx-and-bins-task/
  package.json          <- you add "bin"
  bin/order-total.js    <- the command (you change it)
  lib/summary.js        <- given, do not change
  fixtures/orders.json  <- sample orders
  test/                 <- the tests (do not change)
```

## What to do

1. Add a `"bin"` field to `package.json` that maps the command name `order-total` to `./bin/order-total.js` (the object form, or the string form, which uses the package name).
   For example, after `npm install` of this package, `npx order-total` starts that file.
2. Make the first line of `bin/order-total.js` the shebang `#!/usr/bin/env node`, so the system knows to run the
   file with Node when it is started as a command.
3. Fix the "is this the program that was run?" check at the bottom of `bin/order-total.js`. npm starts a bin
   through a **symlink** (a link file) in `node_modules/.bin`, and the check must be true then too. It must also not
   crash when another module imports the file.
   For example, `node node_modules/.bin/order-total fixtures/orders.json` prints
   `3 orders, total 123.45 EUR`, and `await import('./bin/order-total.js')` prints nothing.
4. Add `--version`: it prints the `version` from this folder's `package.json`, read at run time (don't copy the
   number into the code).
   For example, `node bin/order-total.js --version` prints `1.3.0`.
5. Keep what already works: `node bin/order-total.js fixtures/orders.json` prints `3 orders, total 123.45 EUR`, and
   with no file name the usage goes to stderr with exit code 1.

## Rules

- Only `node:` built-ins. No npm packages.
- Do not change `lib/summary.js` or anything in `test/`.
- Don't use `import.meta.main` for requirement 3: it exists only from Node 22.18 (and 24.2), is still experimental,
  and this repo supports every Node 22 release.

## Try it by hand

On macOS or Linux, from this folder:

```
chmod +x bin/order-total.js
./bin/order-total.js fixtures/orders.json
npm link
order-total fixtures/orders.json
npm unlink -g order-total
```

`npm link` installs the package globally as a link, so the `order-total` command works in any folder until you
unlink it. On Windows, skip `chmod` and the `./bin/...` line; `npm link` creates an `order-total.cmd` file instead.

## Check your work

```
npm run task -- node-npx-and-bins-task
```

When all tests pass, commit and push your branch `task/node-npx-and-bins-task`.
