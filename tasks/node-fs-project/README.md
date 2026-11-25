# Task: node-fs-project

Build a **photo organiser**: a command that tidies a folder full of phone photos and screenshots into one folder per
month, `2024/05/`, using the date in each file name. Photo apps, backup tools and "clean up my downloads" scripts do
the same job. It touches real files, so it must be careful: a dry run first, and it never overwrites a file.

```text
tasks/node-fs-project/
  index.js     <- dateFromName, planMoves, organise and main (you write them)
  test/        <- the tests (do not change); they build their own photo folders in a temp folder
```

Before and after `node index.js ~/Pictures/phone`:

```text
phone/                                   phone/
  IMG_20240517_101500.jpg                  2024/05/IMG_20240517_101500.jpg
  PXL_20231231_235959123.jpg     ->        2023/12/PXL_20231231_235959123.jpg
  Screenshot 2024-05-02 at 09.12.00.png    2024/05/Screenshot 2024-05-02 at 09.12.00.png
  notes.txt                                notes.txt          (no date: left alone)
```

## What to do

Open `index.js`.

1. `dateFromName(name)` returns `{ year, month }` (both strings, like `'2024'` and `'05'`) or `null`.
   - A date is 8 digits `YYYYMMDD` or the form `YYYY-MM-DD`, with no other digit directly before or after it.
   - It must be a real calendar date with a year from 1900 to 2099: `20240230` (30 February) and `2024-13-01` are not
     dates. `20240229` is (2024 is a leap year), `20230229` is not.
   - Use the first real date in the name. No date: `null`.
   For example, `dateFromName('IMG_20240517_101500.jpg')` returns `{ year: '2024', month: '05' }` and
   `dateFromName('IMG_123420240517.jpg')` returns `null` (those digits are one long number).
2. `planMoves(dir)` returns a promise of the plan: one entry per **file directly inside** `dir`, sorted by name in
   plain string order. Folders and hidden files (names starting with `.`) are not in the plan.
   Each entry is `{ file, target, action }`:
   - `{ file: 'IMG_20240517_101500.jpg', target: '2024/05/IMG_20240517_101500.jpg', action: 'move' }`
   - `{ file: 'notes.txt', target: null, action: 'skip' }`: no date in the name.
   - `{ file: 'IMG_20240101_000000.jpg', target: '2024/01/IMG_20240101_000000.jpg', action: 'conflict' }`: a file
     with that name is already in the target folder.
   `target` always uses `/`, on every system.
3. `organise(dir, { dryRun })` makes the plan and, unless `dryRun` is `true`, moves every `move` file into its
   folder, creating the folders it needs with `mkdir`. It **never replaces an existing file**: if the target appears between
   planning and moving, that entry becomes a `conflict` and the file stays where it is. It returns the plan as it
   was carried out. With `dryRun: true` nothing on disk changes.
4. `main(args)` is the command. It returns a promise of the exit code.
   - `node index.js <folder>` organises the folder and prints one line per plan entry, then a summary:
     ```text
     moved IMG_20240517_101500.jpg -> 2024/05/IMG_20240517_101500.jpg
     skipped notes.txt (no date in the name)
     conflict IMG_20240101_000000.jpg: 2024/01/IMG_20240101_000000.jpg already exists
     Moved 1, skipped 1, conflicts 1.
     ```
   - With `--dry-run` (before or after the folder) nothing moves, and the words change: `would move ... -> ...` and
     `Would move 1, skipped 1, conflicts 1.`
   - Exit code `0` when there were no conflicts, `1` when there was at least one.
   - No folder, more than one folder, or an unknown option: print `Usage: node index.js <folder> [--dry-run]` to
     stderr and return `2`. A folder that does not exist (or is a file): print `Not a folder: <folder>` to stderr
     and return `1`.

## Rules

- Only `node:` built-ins. No npm packages.
- Use `node:fs/promises` and build every path with `node:path`, never with `+`.
- `rename` silently replaces an existing target on macOS and Linux, so checking first and then renaming can still
  overwrite a file that appears in between. Find a way to move that fails instead of replacing.

## Check your work

```
npm run task -- node-fs-project
```

Then try it by hand on a copy of a real folder, with `--dry-run` first.

When all tests pass, commit and push your branch `task/node-fs-project`.
