# Task: node-events-project

Build an **order pipeline** with `EventEmitter`: an `OrderService` announces each order as an event, and three
independent listeners react to it (stock, email, analytics). Shops, booking systems and payment services are built
this way, so new reactions can be added without touching the code that takes the order.

```text
tasks/node-events-project/
  listeners.js   <- reserveStock, sendConfirmation, trackOrders (you write them)
  index.js       <- OrderService and connectListeners (you write them)
  demo.js        <- try it by hand: node demo.js
  test/          <- the tests (do not change)
```

An order looks like this. Prices are whole cents, so `150` is 1.50.

```js
{ id: 'A-1', customer: 'ana@example.com', items: [{ sku: 'pen', qty: 2, price: 150 }] }
```

## What to do

1. In `listeners.js`, write the three listener factories. Each one gets the thing it changes and returns listeners.
   - `reserveStock(stock)` returns `onOrderPlaced(order)`. `stock` is a `Map` of sku to units left. Add up the units
     each sku needs (the same sku can be on two lines; a sku that is not in the map has 0 units). If any sku is
     short, throw `new Error('Out of stock: <sku>')` and change **nothing**. Otherwise take the units.
     For example, with `pen: 10`, an order for 2 pens leaves `pen: 8`.
   - `sendConfirmation(outbox)` returns `onOrderPlaced(order)`, which pushes
     `{ to: order.customer, subject: 'Order <id> confirmed', total: order.total }` onto the `outbox` array.
   - `trackOrders(stats)` returns `{ onPlaced, onFailed }`. `stats` starts as
     `{ placed: 0, failed: 0, revenue: 0, reasons: {} }`. `onPlaced(order)` adds 1 to `placed` and `order.total` to
     `revenue`. `onFailed({ order, reason })` adds 1 to `failed` and counts the reason:
     `reasons: { 'no items': 2 }`.
2. In `index.js`, write `OrderService`, a class that extends `EventEmitter`, with `placeOrder(order)`:
   - Check the order in this order and stop at the first problem: `id` is not a non-empty string → `'missing id'`;
     `customer` is not a string with `@` → `'invalid customer'`; `items` is not a non-empty array → `'no items'`; an
     item has an empty or non-string `sku`, a `qty` that is not a whole number of at least 1, or a `price` that is
     not a whole number of at least 0 → `'invalid item'`.
     For a problem, emit `'order:failed'` with `{ order, reason }` and return `{ ok: false, reason }`.
   - Otherwise work out `total` (the sum of `qty * price`), emit `'order:placed'` with a **new** object
     `{ ...order, total }`, and return `{ ok: true, total }`.
     For example, the order above returns `{ ok: true, total: 300 }`.
   - If an `'order:placed'` listener throws, the order failed: emit `'order:failed'` with
     `{ order, reason: err.message }`, set `err.orderId = order.id`, emit `'error'` with that error, and return
     `{ ok: false, reason: err.message }`. With no `'error'` listener, Node's own rule applies: the `'error'` emit
     throws the error out of `placeOrder`.
3. In `index.js`, write `connectListeners(service, { stock, outbox, stats })`. It attaches the stock and email
   listeners and both analytics listeners, and returns a `disconnect()` function.
   - Stock runs **first**, before every other `'order:placed'` listener, even ones added before
     `connectListeners` was called. So an order that is out of stock sends no email and is not counted as placed.
   - Then the email, then the analytics count.
   - `disconnect()` removes exactly the four listeners it added, and nothing else. Calling it twice is harmless.
     For example, after 20 rounds of `connectListeners(service, deps)()` the service has no listeners left and
     Node prints no `MaxListenersExceededWarning`.

## Rules

- Only `node:` built-ins. No npm packages.
- Keep `placeOrder` synchronous: when it returns, every listener has already run.
- Do not change anything in `test/`.

## Check your work

```
npm run task -- node-events-project
```

When all tests pass, commit and push your branch `task/node-events-project`.
