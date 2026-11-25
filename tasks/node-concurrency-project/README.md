# Task: node-concurrency-project

Build a **job runner**: the part of the export service that computes checksums of large files on every CPU core,
without blocking the main thread and without starting a new thread for every file. A fixed-size pool of long-lived
worker threads takes jobs from a queue; results are reported as they finish; a worker that crashes fails only its
own job and is replaced.

```text
tasks/node-concurrency-project/
  index.js            <- createPool and runJobs (you write them), and the CLI (done)
  checksum-worker.js  <- the code that runs inside each worker (you write it)
  test/               <- the tests and a fixture worker (do not change)
```

## The messages between the pool and a worker

A pool worker is started once and handles many jobs. The pool sends it `{ id, data, algorithm }` with
`worker.postMessage`. The worker answers `{ id, checksum }` (the hex digest of `data`), or `{ id, error }` (the
error's message) when hashing throws, for example for an unknown algorithm. The test fixture worker uses exactly these
messages.

## createPool({ size, workerUrl })

`size` defaults to `os.availableParallelism()`, `workerUrl` to `new URL('./checksum-worker.js', import.meta.url)`.
A size that is not a whole number from 1 up throws a `RangeError`. The pool has `run(job)`, `stats()` and `close()`.

1. **One job.** `pool.run({ id, data, algorithm = 'sha256' })` resolves with `{ id, checksum, threadId }`, where
   `threadId` is the `threadId` of the worker that did the job. An `{ id, error }` answer rejects with
   `new Error(error)`, and that worker keeps working: a bad job is not a crash.
   `await pool.run({ id: 7, data: Buffer.from('order 7'), algorithm: 'md5' })` gives `{ id: 7, checksum: '...', threadId: 1 }`.
2. **A fixed number of workers, reused.** Start workers only when needed, never more than `size`, and give each new
   job to an idle worker. When all are busy the job waits in a first-in, first-out queue.
   `pool.stats()` returns `{ created, running, queued }`: workers started so far, jobs in progress, jobs waiting.
   Six `run()` calls on a pool of size 2 give `{ created: 2, running: 2, queued: 4 }` right away.
3. **Crashes.** If a worker dies while it runs a job (an uncaught error, or it exits), reject that job: with the
   worker's error, or with `new Error('worker stopped with exit code <code>')`. Start a new worker in its place
   (`created` goes up by one) so the queue keeps moving.
4. **Close.** `pool.close()` rejects every queued job with `new Error('pool closed')`, waits for the running jobs to
   finish, terminates the workers and resolves. After that, `run()` rejects with `new Error('pool closed')` and nothing
   keeps the process alive.

## runJobs(jobs, { size, workerUrl, onResult })

5. **Results in order of completion.** Run every job through one pool (size: the option, or
   `os.availableParallelism()` but not more than the number of jobs), call `onResult(result)` as each one finishes,
   and resolve with the results **in the order they finished**. A success is `{ id, checksum }`, a failure
   `{ id, error }` (the message); `runJobs` never rejects because a job failed. Close the pool at the end.

## The CLI (done)

`node index.js <file> [file...]` prints `<checksum>  <file>` for each file as soon as it is done, `ERROR  <file>: ...`
for a failure, then `<n> files, <m> failed`, and exits with 0, or 1 when something failed. `POOL_SIZE` sets the size.

## Rules

- Only `node:` built-ins. No npm packages.
- Do not change anything in `test/`.

## Check your work

```
npm run task -- node-concurrency-project
```

When all tests pass, commit and push your branch `task/node-concurrency-project`.
