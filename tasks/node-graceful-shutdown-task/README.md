# Task: node-graceful-shutdown-task

The orders API runs in containers. On every deploy, the platform sends `SIGTERM` to the old process, waits a grace
period, and then sends `SIGKILL`. Right now the server dies at once, and customers who were waiting for a report get
a broken connection. Your job: make it shut down **gracefully**.

```text
tasks/node-graceful-shutdown-task/
  index.js   <- the orders API (done) and createShutdown (you write it), plus the CLI
  test/      <- the tests (do not change)
```

`createOrdersServer()` is done: `GET /report?ms=<n>` answers after `n` milliseconds (a slow report), `GET /health`
answers `ok`. Do not change what it answers.

## What to do

Write `createShutdown(server, { timeoutMs = 10000, log = console.log, onClose = async () => {} })`. It is called
right after the server is created, before it listens. It returns a function `shutdown(signal)` that returns a
promise for an **exit code**.

1. **Log.** The first call logs `<signal> received: shutting down`, for example `SIGTERM received: shutting down`.
2. **Stop accepting.** New connections are refused from that moment. Keep-alive connections that are idle are closed
   at once.
3. **Finish the work in flight.** If requests are in progress, log `waiting for <n> request(s)` (`n` = how many) and
   let them finish normally. A keep-alive connection whose request finishes during the shutdown must be closed then,
   not after the keep-alive timeout.
4. **Then close the rest.** When every connection has closed, `await onClose()` (in a real app: the database pool,
   queue consumers, ...), log `shutdown complete` and resolve with `0`.
   If `onClose` rejects, log `shutdown error: <message>` and resolve with `1`.
5. **Deadline.** If the shutdown has not finished after `timeoutMs`, log `forced shutdown after <timeoutMs> ms`,
   destroy every remaining connection, and resolve with `1` without calling `onClose`. The deadline must never fire
   after a shutdown that has finished: clear it then, so the process can end at once (the CLI tests check that).
   `unref()` it as well, as good practice.
6. **Once.** Later calls return the same promise and log nothing.
7. **The CLI** (`main()`): on `SIGTERM` and on `SIGINT`, run the shutdown and exit with the code it gives. After a
   forced shutdown, do not wait for anything: exit right away. The deadline comes from `SHUTDOWN_TIMEOUT_MS`
   (default `10000`), the port from `PORT` (default `3000`).

## Hints for the HTTP parts

- `server.close(callback)` stops accepting; the callback runs when the last connection has closed.
- `server.closeIdleConnections()` and `server.closeAllConnections()` close the idle ones, or all of them.
- The server emits `'request'` with `(req, res)` for every request, and `res` emits `'close'` when that response is
  over, whatever happened.
- A response sent with the header `Connection: close` makes Node close the connection after it.

## Rules

- Only `node:` built-ins. No npm packages.
- Do not change anything in `test/`.

## Try it by hand

```
PORT=3000 node tasks/node-graceful-shutdown-task/index.js
curl 'localhost:3000/report?ms=5000'      # in a second terminal
```

While curl waits, press Ctrl+C in the first terminal: the report must still arrive, and then the server stops. Run
it again with `SHUTDOWN_TIMEOUT_MS=1000` and the same curl: now it is forced. `echo $?` shows the exit code.

## Windows

Windows has no POSIX signals: `child.kill('SIGTERM')` ends a process at once, so the three CLI tests are
**skipped on Windows**; the other tests still run. Use WSL to run them all, or press Ctrl+C by hand.

## Check your work

```
npm run task -- node-graceful-shutdown-task
```

When all tests pass, commit and push your branch `task/node-graceful-shutdown-task`.
