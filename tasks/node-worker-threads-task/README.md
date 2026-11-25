# Task: node-worker-threads-task

The shop's export service signs every nightly export file with a checksum that is hashed many times over (a slow
"key stretching" step). Done on the main thread, one big file freezes the whole service: no requests, no timers, no
health checks until the hash is done. Your job: move the hashing to a **worker thread**, so the main thread stays
free, and handle the worker's errors, its exit and cancellation.

```text
tasks/node-worker-threads-task/
  index.js        <- hashInWorker (you rewrite it) and a small CLI (done)
  hash-worker.js  <- the code that runs inside the worker (you write it)
  test/           <- the tests and their fixture workers (do not change)
```

## What to do

`hashInWorker(data, options)` takes the bytes (`Uint8Array` or `Buffer`) and returns a promise for the hex digest.
Options and defaults: `algorithm = 'sha256'`, `rounds = 1`, `transfer = false`, `signal` (an `AbortSignal`), and
`workerUrl` (the worker file; default `new URL('./hash-worker.js', import.meta.url)`; the tests pass their own
fixture workers here).

The digest: hash `data` with `algorithm`, then hash that digest again, `rounds` times in total, and return the last
digest as hex. With `rounds: 1` it is the normal hash: `createHash('sha256').update(data).digest('hex')`.

1. **The worker.** Start one `Worker` from `workerUrl` per call, with `workerData: { data, algorithm, rounds }` (the
   tests' fixture workers read the same three fields). `hash-worker.js` reads them, hashes, and posts the hex string
   to its parent. `hashInWorker` resolves with that string.
   `await hashInWorker(new Uint8Array([1, 2, 3]))` gives `'039058c6f2c0cb49...'`.
2. **The main thread stays free.** While the worker hashes `rounds: 1_000_000` times (about half a second), timers on
   the main thread keep firing.
3. **Copy or transfer.** By default the bytes are copied to the worker and the caller keeps them. With
   `transfer: true`, move them instead: right after the call, `data.byteLength` is `0` in the caller.
4. **Errors.** If the worker throws (for example `algorithm: 'no-such-digest'` makes `createHash` throw
   `Digest method not supported`), reject with that error. If the worker exits without sending an answer, reject
   with `new Error('worker stopped with exit code <code>')`, for example `worker stopped with exit code 3`.
   Settle the promise once only.
5. **Cancel.** When `signal` aborts, terminate the worker and reject with `signal.reason` at once. When `signal` is
   already aborted, reject with `signal.reason` without starting a worker.
6. **Nothing left behind.** After the answer, nothing may keep the process alive: a script that calls
   `hashInWorker` once must end by itself.

## Rules

- Only `node:` built-ins (`node:worker_threads`, `node:crypto`). No npm packages.
- Start the worker from a URL or an absolute path, never from a path like `'./hash-worker.js'` (that is relative to
  the current working directory, not to `index.js`).
- Do not change anything in `test/`.

## Try it by hand

```
node tasks/node-worker-threads-task/index.js package.json sha256 3000000
```

The dots are a heartbeat on the main thread: with the hash in a worker they keep coming while it works. With the
starter code they appear only after the hash is done.

## Check your work

```
npm run task -- node-worker-threads-task
```

When all tests pass, commit and push your branch `task/node-worker-threads-task`.
