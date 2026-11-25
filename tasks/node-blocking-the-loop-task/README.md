# Task: node-blocking-the-loop-task

Count prime numbers without freezing the program. A long loop on the main thread blocks every timer and
every request. Real servers use the same trick you use here when they build big reports or exports: do the
work in chunks and give the event loop a turn in between.

A **prime number** is a whole number above 1 that only divides by 1 and itself: 2, 3, 5, 7, 11, ...
The helper `isPrime(n)` is already written for you.

## What to do

Open `index.js`.

1. Change `countPrimes(limit, options)` (it is already exported) so it still returns a **promise** of how many numbers from `0` up to
   (but not including) `limit` are prime.
   For example, `await countPrimes(100)` gives `25`, and `await countPrimes(2)` gives `0`.
2. Do the work in **chunks**. `options.chunkSize` is how many numbers to check per chunk (default `10000`).
   For example, `countPrimes(1_000_000, { chunkSize: 50_000 })` checks 50,000 numbers, gives the event loop a
   turn, checks the next 50,000, and so on.
3. Between chunks, give the event loop a turn with `setImmediate` (or `setImmediate` from
   `node:timers/promises`), so timers keep firing while you count.
   For example, a `setInterval` heartbeat every 5 ms must fire several times while `countPrimes(1_000_000)` runs.
4. When the file is run directly (`node tasks/node-blocking-the-loop-task/index.js`), print
   `Primes below 1000000: 78498`.

## Rules

- Only `node:` built-ins. No npm packages.
- Do not change `isPrime`.
- Do not use worker threads or child processes. The point is to share the one main thread fairly.
- `process.nextTick`, `queueMicrotask` and `await Promise.resolve()` do **not** count as a turn for the event loop.

## Check your work

```
npm run task -- node-blocking-the-loop-task
```

When all tests pass, commit and push your branch `task/node-blocking-the-loop-task`.
