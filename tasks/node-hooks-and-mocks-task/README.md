# Task: node-hooks-and-mocks-task

The billing team has an invoice reminder service: every minute it emails customers whose invoices are overdue, and
it retries a failed email with exponential backoff. The code works, but it has no tests, so nobody dares to touch it.
Your job is the other way round from most tasks: **the code is done, you write the tests**. Real apps test code like
this (clocks, timers, retries, emails) every day, and they do it without waiting real minutes or sending real email.

```text
tasks/node-hooks-and-mocks-task/
  reminders.js        <- the service (done, do not change it)
  reminders.test.js   <- YOUR tests go here
  test/               <- the grader (do not change it)
```

Read the comment at the top of `reminders.js`: it describes every option and what the service returns.

## What to do

Write at least 5 tests in `reminders.test.js` with `node:test` and `node:assert/strict`. Together they must check
these cases:

1. `remindOverdue()` emails only invoices that are **not paid** and whose `dueAt` is **before** now, and resolves
   with `{ sent: [...ids], failed: [] }`. Example: invoices due an hour ago (unpaid), an hour ago (paid) and in an
   hour give `sent: ['<id of the first>']`.
2. Each email goes to the invoice's `email` with the subject `Invoice <id> is overdue`.
3. An invoice due **exactly now** is not overdue yet. To test "exactly now" you need a clock that does not move.
4. A failed send is retried: with `baseMs: 1000` and `random: () => 1` the first retry happens at 1000 ms (not
   before), and the second 2000 ms after that.
5. The wait is multiplied by `random()`: with `random: () => 0.5` the first retry happens at 500 ms.
6. After `retries` extra attempts (default 2, so 3 sends in all) the invoice goes to `failed`, `log.error` is called
   once with `reminder failed for <id>: <error message>`, and the next invoices are still handled.
7. `start(intervalMs)` runs a reminder round every `intervalMs`, the first one after `intervalMs` (not at once), and
   the function it returns stops the rounds.

Use:

- `beforeEach` (and `afterEach`) to build fresh fake invoices, a fake mailer and a fake log for every test, and to
  clean up after it.
- `mock.fn()` (or `mock.method()`) for `mailer.send` and `log.error`, so you can read the calls and their arguments.
- `mock.timers` for `setTimeout`, `setInterval` and `Date`, so a 60-second interval takes no real time.

Two tips:

- A planted bug can make one of your tests wait for a timer that never fires. On Node 24 such a test waits
  forever, so give your tests a time limit: `describe('retries', { timeout: 2000 }, () => { ... })` (the tests
  inside inherit it).
- If you need a helper that lets pending `await`s run, `new Promise((resolve) => setImmediate(resolve))` works as
  long as `'setImmediate'` is not in the `apis` you mock.

## How you are graded

The grader runs your `reminders.test.js` against the real `reminders.js`, where every test must pass, and then
against twelve versions of it with one planted bug each (for example "never retries" or "stop() does not stop").
Your tests must **fail** on every one of them. If a bug gets through, the grader names it, for example
`all your tests passed on a version that ignores random()`: add a test that would catch it. Your tests must also
finish in under 10 seconds per run.

## Rules

- Only `node:` built-ins. No npm packages.
- Do not change `reminders.js` or anything in `test/`.
- `reminders.test.js` may import only `./reminders.js` and `node:` modules (the grader copies it into an empty folder).

## Check your work

```
npm run task -- node-hooks-and-mocks-task
```

Your own tests run first (against `reminders.js`), then the grader. When all tests pass, commit and push your
branch `task/node-hooks-and-mocks-task`.
