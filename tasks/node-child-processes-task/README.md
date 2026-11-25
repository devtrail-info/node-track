# Task: node-child-processes-task

The shop's admin panel runs maintenance scripts on demand: rebuild the search index, re-send an invoice, export a
report. Each one is a separate Node script, started as a **child process** so that a slow or crashing script can
never take the server down with it. Your job: the function that runs such a script safely, captures what it prints,
and stops it if it runs too long.

```text
tasks/node-child-processes-task/
  index.js   <- runScript (you rewrite it) and a small CLI (done)
  test/      <- the tests and the scripts they run (do not change)
```

## What to do

`runScript(scriptPath, args, options)` runs `node <scriptPath> ...args` and returns a promise for
`{ code, signal, stdout, stderr, timedOut }`. Options and defaults: `timeoutMs = 5000`, `killGraceMs = 1000`,
`maxOutputBytes = 1024 * 1024`, `signal` (an `AbortSignal`).

1. **No shell.** Run `process.execPath` (the Node that runs your code) with `[scriptPath, ...args]` using
   `execFile`. Every argument must reach the script exactly as given, even `'orders.csv; echo INJECTED'` or `'$HOME'`:
   nothing in an argument may ever run as a command.
2. **Exit codes are results, not crashes.** A script that ends by itself resolves, whatever its exit code:
   `await runScript('exit-with.js', ['3'])` gives
   `{ code: 3, signal: null, stdout: 'partial report\n', stderr: 'invoice 7 failed\n', timedOut: false }`.
3. **Timeout.** If the script is still running after `timeoutMs`, send it `SIGTERM`. If it is still alive
   `killGraceMs` later (some scripts catch `SIGTERM`), send `SIGKILL`. Resolve with `timedOut: true`, `code: null`,
   the `signal` that ended it (`'SIGTERM'` or `'SIGKILL'`) and the output printed so far.
4. **Output limit.** If the script prints more than `maxOutputBytes` on stdout or stderr, stop it and reject with an
   error whose `code` is `'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'` (`execFile` can do this for you).
5. **Cancel.** When `signal` aborts, stop the script and reject with `signal.reason`. An already aborted `signal`
   rejects with `signal.reason` without running anything.

## Rules

- Only `node:` built-ins. No npm packages, no `shell: true`, no `exec`.
- Do not change anything in `test/`.

## Try it by hand

```
node tasks/node-child-processes-task/index.js tasks/node-child-processes-task/test/fixtures/exit-with.js 4
echo $?
TIMEOUT_MS=500 node tasks/node-child-processes-task/index.js tasks/node-child-processes-task/test/fixtures/stuck.js /tmp/stuck.pid
```

## Windows

Windows has no POSIX signals: `kill()` always ends the process at once, so a script cannot catch `SIGTERM` and the
SIGTERM-then-SIGKILL escalation cannot be observed there. The two timeout tests are **skipped on Windows** (not tested
on Windows); use WSL to run them all.

## Check your work

```
npm run task -- node-child-processes-task
```

When all tests pass, commit and push your branch `task/node-child-processes-task`.
