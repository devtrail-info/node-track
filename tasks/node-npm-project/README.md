# Task: node-npm-project

Build a **dependency checker**: a small command that reads a project's `package.json` and `package-lock.json` and
lists every direct dependency whose locked version does not fit its range. Teams run checks like this in CI to catch
a lockfile that someone forgot to update, before `npm ci` fails on the build server or the wrong version ships.

You write your own small semver (only the range forms real projects use most), then the checker, then the
command-line report.

```text
tasks/node-npm-project/
  semver.js            <- parseVersion and satisfies (you write them)
  index.js             <- checkProject, formatProblem and main (you write them)
  fixtures/clean/      <- a project whose lockfile is fine
  fixtures/drift/      <- a project with seven problems
  test/                <- the tests (do not change)
```

The fixture lockfiles are trimmed: real ones also have `integrity` hashes and many more packages.

## What to do

1. In `semver.js`, write `parseVersion(version)`. It returns `{ major, minor, patch, prerelease }` with numbers, and
   `prerelease` is the text after `-` or `null`. Anything that is not a full `MAJOR.MINOR.PATCH` version (no leading
   zeros, no `v`) throws a `TypeError`.
   For example, `parseVersion('2.0.0-rc.1')` returns `{ major: 2, minor: 0, patch: 0, prerelease: 'rc.1' }`.
2. In `semver.js`, write `satisfies(version, range)` for these ranges:
   - `*`: any version without a pre-release.
   - exact: `1.2.3` or `=1.2.3` (also `2.0.0-rc.1`): only that version.
   - `~1.2.3`: at least 1.2.3, same major and minor.
   - `^1.2.3`: at least 1.2.3, and the first number that is not zero stays the same (`^0.4.1` allows `0.4.x` only,
     `^0.0.3` allows only `0.0.3`).
   - A version with a pre-release only satisfies an exact range that names it.
   - Any other range (`latest`, `>=1.2.0`, `1.x`, `^1.2`, `^2.0.0-rc.1`, ...) throws a `RangeError`.
   For example, `satisfies('4.21.2', '^4.18.0')` is `true` and `satisfies('0.5.0', '^0.4.1')` is `false`.
3. In `index.js`, write `checkProject(pkg, lock)`. Check every entry in `dependencies` and `devDependencies`. The
   installed version is `lock.packages['node_modules/<name>'].version` (top level only). For each dependency, take
   the **first** problem in this list, or none:
   - `unsupported-range`: your `satisfies` throws a `RangeError` for the range,
   - `missing`: the lockfile has no `node_modules/<name>` entry,
   - `mismatch`: the installed version does not satisfy the range,
   - `out-of-sync`: the range differs from the one the lockfile's root entry (`lock.packages['']`) recorded for that
     dependency type. `npm ci` still installs (the locked version fits), but the lockfile is stale: the next
     `npm install` rewrites it, and that change was never reviewed. (`missing` and `mismatch` are the ones that make
     `npm ci` stop.)
   Return `{ name, type, range, installed, problem }` objects (`type` is `'dependencies'` or `'devDependencies'`,
   `installed` is `null` when missing), sorted by name in plain string order.
   For example, for `fixtures/drift`, the `express` problem is
   `{ name: 'express', type: 'dependencies', range: '^5.1.0', installed: '4.21.2', problem: 'mismatch' }`.
4. In `index.js`, write `formatProblem(problem)`, one line per problem:
   - `express ^5.1.0: lockfile has 4.21.2 (mismatch)`
   - `@shop/logger ^1.0.0: not in the lockfile (missing)`
   - `zod ^3.24.0: lockfile was made for a different range (out-of-sync)`
   - `left-pad latest: range not supported (unsupported-range)`
5. In `index.js`, write `main(args)`: `node index.js <project-folder>` reads both files from the folder and returns
   the exit code.
   - No problems: print `All <n> dependencies match the lockfile.` and return `0`.
   - Problems: print one line per problem, then `<count> problems in <n> dependencies.`, and return `1`.
   - No folder given: print `Usage: node index.js <project-folder>` to stderr and return `1`.
   For example, from this folder, `node index.js fixtures/clean` prints `All 5 dependencies match the lockfile.`

## Rules

- Only `node:` built-ins. No npm packages: the point is to write the semver rules yourself.
- Do not change anything in `fixtures/` or `test/`.
- Keep `satisfies` pure (no files, no printing), so `checkProject` can use it and the tests can call it directly.

## Check your work

```
npm run task -- node-npm-project
```

When all tests pass, commit and push your branch `task/node-npm-project`.
