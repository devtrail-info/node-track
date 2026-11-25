# Task: node-atomic-writes-json-task

Build a tiny JSON file store that never leaves a half-written file behind and never loses an update. Small apps,
CLIs and dev tools keep settings, carts and job lists in a JSON file like this; editors and package managers save
their files the same way.

`index.js` already has three functions that work in the simple case. They break when the program crashes in the
middle of a write, when two updates run at the same time, and when the file is missing. Your job is to fix them.

## What to do

Open `index.js`. Use the promise API from `node:fs/promises`.

1. `readJson(file, fallback)` returns the parsed JSON in `file`.
   - If the file does not exist (`ENOENT`), return `fallback`.
   - Every other problem is a real error: let it reject. A file with broken JSON rejects with a `SyntaxError`; a
     folder rejects with `EISDIR`.
   For example, `await readJson('missing.json', [])` gives `[]`.
2. `writeJsonAtomic(file, data)` saves `data` so that `file` always holds either the old content or the new content,
   never a mix:
   - The text is `JSON.stringify(data, null, 2)` plus a final `'\n'`.
   - Write the text to a **temporary file in the same folder as `file`**, then `rename` the temporary file to `file`.
   - The temporary file's name starts with `.` and the file's own name, and ends with `.tmp`. Add something unique
     in between (a random part or a counter), so two writes at the same time never share a temporary file.
     For example, `.cart.json.8f3a1c.tmp` for `cart.json`.
   - If anything fails, remove the temporary file (ignore errors while removing it) and reject with the original
     error. `file` must keep its old content.
   For example, after `await writeJsonAtomic('cart.json', { items: 2 })` the file holds `{\n  "items": 2\n}\n`.
3. `updateJson(file, fallback, update)` reads the current value (or `fallback`), calls `update(current)` (it may
   return a promise), saves the result with `writeJsonAtomic`, and returns the saved value.
   - Calls for the **same** file must run one after another, in the order they were made, so no update is lost.
     Twenty `updateJson('count.json', 0, (n) => n + 1)` calls started at the same time must leave `20`.
   - If one update fails (its `update` throws or rejects), only that call rejects. The next calls still run.

## Rules

- Only `node:` built-ins. No npm packages.
- Use `node:fs/promises` for the file work. No `*Sync` functions.
- Keep the temporary file in the same folder as `file`: a `rename` between two disks fails with `EXDEV`.

## Check your work

```
npm run task -- node-atomic-writes-json-task
```

When all tests pass, commit and push your branch `task/node-atomic-writes-json-task`.
