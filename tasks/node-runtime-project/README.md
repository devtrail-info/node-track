# Task: node-runtime-project

Build a **non-blocking sales report**. Your program summarises 1,000,000 generated orders while a heartbeat timer
keeps ticking every 10 ms. Real servers do this when they build a big export or a nightly report and must keep
answering health checks and other requests at the same time.

`orders.js` gives you `makeOrder(i)`, which returns the order with index `i` (starting at 0):

```js
makeOrder(0); // { id: 'ORD-0000001', region: 'north', amountCents: 500, status: 'refunded' }
makeOrder(1); // { id: 'ORD-0000002', region: 'south', amountCents: 8419, status: 'paid' }
```

Money is in **cents** (whole numbers), so sums stay exact.

## What to do

Open `index.js`.

1. Export `buildReport(count, options)`. It makes the orders `makeOrder(0)` up to `makeOrder(count - 1)` and
   returns a **promise** of a report object:

   ```js
   await buildReport(4);
   // {
   //   orders: 4,
   //   paid: 3,
   //   refunded: 1,
   //   revenueCents: 49014,  // sum of amountCents of PAID orders only
   //   byRegion: { north: 0, south: 8419, east: 16338, west: 24257 }, // paid revenue per region
   // }
   ```

   `count` defaults to `1_000_000`. Every region key is always present, even when it is `0`.
2. Work in **chunks** of `options.chunkSize` orders (default `50_000`). Between chunks, give the event loop a
   turn with `setImmediate` (or `setImmediate` from `node:timers/promises`).
3. After each chunk, call `options.onProgress(done)` if it was given, where `done` is how many orders are summed
   so far. For example, `buildReport(10, { chunkSize: 4, onProgress })` calls `onProgress(4)`, `onProgress(8)`,
   `onProgress(10)`.
4. Export `formatReport(report)`. It returns the report as text, one line each, money in units with 2 decimals:

   ```text
   Orders: 4
   Paid: 3
   Refunded: 1
   Revenue: 490.14
   north: 0.00
   south: 84.19
   east: 163.38
   west: 242.57
   ```

5. When the file is run directly (`node tasks/node-runtime-project/index.js`), start a heartbeat with
   `setInterval(..., 10)` that counts its beats, build the report for 1,000,000 orders, stop the heartbeat, then
   print `formatReport(report)` and a last line `Heartbeats during the work: <n>`.

## Rules

- Only `node:` built-ins. No npm packages.
- Do not change `orders.js`.
- Do not build an array of 1,000,000 orders first. Make each order, add it to the totals, and move on.
- No worker threads or child processes: share the one main thread by chunking.
- `process.nextTick`, `queueMicrotask` and `await Promise.resolve()` do not give the event loop a turn.

## Check your work

```
npm run task -- node-runtime-project
```

When all tests pass, commit and push your branch `task/node-runtime-project`.
