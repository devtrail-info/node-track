# Node track

Practice tasks for the DevTrail Node track. Each task is a small folder in `tasks/`.
You need Node 22 or newer (Node 24 LTS is the one the lessons use) and Git.

<!-- devtrail:workflow:start -->
## How to do a task

1. Clone your copy of this repo and open the folder.
2. Run `npm install`. This also turns on the test check before each push.
3. Make a branch for the task: `git switch -c task/<task-id>`
4. Open `tasks/<task-id>/README.md` and read what to build.
5. Write your code in `tasks/<task-id>/`.
6. Run the tests: `npm run task -- <task-id>` (`npm test` runs every task)
7. Save your work: `git add -A` and `git commit -m "Solve <task-id>"`
8. Push it: `git push -u origin task/<task-id>`

DevTrail marks the task as done when it sees your push.

Before each push, the repo runs the tests for your task. If a test fails, the push stops.
If you still want to push, use `git push --no-verify`. This skips the check.
It is your choice.

The push also stops if the branch is `task/<task-id>` but your repo has no `tasks/<task-id>` folder yet.

## Get new tasks

New tasks are added to the template over time. To get them, run this on your `main` branch
(the task page shows it with the right owner and track):

```
git switch main
git pull --no-rebase --no-edit --allow-unrelated-histories -X theirs https://github.com/<owner>/<track> main
git push --no-verify origin main
```

The new tasks are not solved yet, so that one push of `main` skips the test check. Then start the new task branch
from `main`. Your repo was made from the template, so the first pull joins two
separate histories (`--allow-unrelated-histories`). Where a line differs, the template's version wins (`-X theirs`);
your `task/...` branches are not touched.
<!-- devtrail:workflow:end -->

## Tasks

- `node-hello`: write a function that says hello.
- `node-blocking-the-loop-task`: count primes in chunks so a heartbeat timer keeps firing.
- `node-runtime-project`: a non-blocking report that sums 1,000,000 orders in chunks.
- `node-cjs-esm-interop-task`: move a CommonJS helper to an ES module and keep old `require()` code working.
- `node-modules-project`: the price-utils package, ES modules with `exports` for both `import` and `require()`.
- `node-npx-and-bins-task`: turn a script into a command-line tool with a `bin` field and a shebang.
- `node-npm-project`: a dependency checker that compares `package.json` ranges with `package-lock.json`.
- `node-signals-task`: an order meter that reads stdin and prints a summary on Ctrl+C (SIGINT) or SIGTERM.
- `node-process-project`: a todo CLI with `add`, `list --json` and `done <id>`, exit codes and a `TODO_FILE` data file.
- `node-atomic-writes-json-task`: a JSON file store with atomic writes (temp file + rename) and queued updates.
- `node-fs-project`: a photo organiser that moves files into `YYYY/MM` folders, with a dry run and no overwrites.
- `node-events-project`: an order pipeline where an EventEmitter service drives stock, email and analytics listeners.
- `node-buffer-project`: an order record codec, fixed-size big-endian numbers and a length-prefixed UTF-8 name.
- `node-streams-project`: an access-log analyzer that streams a big log through a line splitter with `pipeline` and reports status counts and the slowest requests.
- `node-routing-by-hand-task`: a router for a raw `node:http` server with params, query, 404, 405 with `Allow`, HEAD and 500 on crashes.
- `node-json-bodies-task`: read JSON bodies safely (415, 413 with `Connection: close`, 400) behind a `POST /orders` endpoint (201, `Location`, 422).
- `node-http-project`: a Bookmarks JSON API on raw `node:http`, with validation, correct status codes and atomic JSON file storage.
- `node-http-over-tcp-task`: an HTTP client on raw `node:net`: CRLF request, read until close, parse status, headers and Content-Length or chunked bodies, with a timeout.
- `node-net-project`: a TCP chat server with nicknames, broadcast, `/who` and `/quit`, newline framing, a line limit, idle timeouts and clean disconnects.
- `node-graceful-shutdown-task`: graceful shutdown for an HTTP API: stop accepting, finish requests in flight, close keep-alive connections, onClose, a hard deadline and exit codes on SIGTERM/SIGINT.
- `node-errors-project`: a resilient fetcher with a concurrency limit, a timeout per attempt, retries with backoff, jitter and Retry-After, cancellation, and an error report.
- `node-worker-threads-task`: hash a buffer in a worker thread: workerData, transfer lists, error and exit handling, and cancellation with terminate().
- `node-child-processes-task`: run a script with execFile and no shell, capture output and exit codes, SIGTERM then SIGKILL on timeout, maxBuffer and AbortSignal.
- `node-concurrency-project`: a job runner with a fixed-size worker thread pool, a FIFO queue, crash replacement, close(), results in completion order and a checksum CLI.
- `node-hooks-and-mocks-task`: write the tests for an invoice reminder service with hooks, `mock.fn` and `mock.timers`; twelve planted bugs must fail them.
- `node-testing-project`: test an invoice module, fix its three bugs and make its O(n²) duplicate check fast; eleven planted bugs must fail your tests.
