# Task: node-errors-project

Build a **resilient fetcher**: the tool the shop uses every night to download price lists and stock files from
dozens of suppliers. Supplier servers are slow, flaky, rate-limited and sometimes down. The fetcher must still finish
on time, never hammer anyone, and say exactly what went wrong.

```text
tasks/node-errors-project/
  index.js   <- fetchAll, formatReport and the CLI (you write them)
  test/      <- the tests and a local test server (do not change)
```

The tests start a local HTTP server with slow, failing, flaky and rate-limited endpoints, so no internet is needed.

## fetchAll(urls, options)

`fetchAll(urls, options)` fetches every URL with `GET` (use the global `fetch`) and resolves with a report. It never
rejects because a URL failed. Options and defaults:

| Option | Default | Meaning |
|---|---|---|
| `concurrency` | `4` | at most this many requests in progress at once |
| `timeoutMs` | `2000` | the time limit for **one attempt**, reading the body included |
| `retries` | `2` | retries after the first attempt (so at most `retries + 1` attempts per URL) |
| `baseDelayMs` | `100` | the first backoff |
| `maxDelayMs` | `2000` | the largest wait between attempts |
| `random` | `Math.random` | the jitter source (the tests pass their own) |
| `signal` | none | an `AbortSignal` that cancels the whole run |

1. **Concurrency.** Never more than `concurrency` requests at once; start the next URL as soon as one finishes.
2. **Results.** The report is `{ results, summary }`. `results` has one entry per URL, **in input order**:
   - success (status 200 to 299): `{ url, ok: true, status, attempts, body }` (`body` is the response text);
   - failure: `{ url, ok: false, attempts, error: { code, message } }`, plus `status` when the server answered.
3. **Error codes.**
   - `HTTP_<status>` when the last answer was not 2xx (for example `HTTP_404`);
   - `TIMEOUT` when the last attempt took longer than `timeoutMs`;
   - `NETWORK` when there was no answer at all (connection refused or reset);
   - `CANCELLED` when the run was cancelled before this URL finished.
   `message` is any helpful text.
4. **Retries.** Retry `TIMEOUT`, `NETWORK` and the statuses `429`, `500`, `502`, `503` and `504`. Any other status
   fails at once.
5. **Backoff.** Before retry number `n` (1, 2, ...), wait
   `random() * Math.min(maxDelayMs, baseDelayMs * 2 ** (n - 1))` milliseconds. When the answer had a
   `Retry-After` header with a whole number of seconds, wait `Math.min(maxDelayMs, seconds * 1000)` instead.
6. **Cancellation.** When `signal` aborts: start no new request, abort the requests in progress, stop any backoff
   wait at once, and resolve with the report. Every URL that had not finished gets `CANCELLED` (with the attempts it
   made: `0` if it never started). Results that had finished are kept. An already aborted signal makes no request.
7. **Summary.** `{ ok, failed, cancelled, retries }`: how many succeeded, how many failed (cancelled ones included),
   how many were cancelled, and how many retries were made in total (attempts beyond the first).

## The report as text

`formatReport(report)` returns one line per result, then a summary line, joined with `\n`:

```text
OK 200 http://prices.example/a.csv (1 attempt)
FAIL HTTP_404 http://prices.example/b.csv (1 attempt)
OK 200 http://stock.example/today.json (3 attempts)
2 ok, 1 failed, 2 retries
```

## The CLI

`node tasks/node-errors-project/index.js urls.txt` reads one URL per line (ignore blank lines and spaces around a
URL), runs `fetchAll` with the defaults, prints `formatReport`, and exits with code `0` when every URL succeeded and
`1` otherwise. Ctrl+C (`SIGINT`) cancels the run, so the report shows what was finished.

## Rules

- Only `node:` built-ins and the global `fetch`. No npm packages.
- Do not change anything in `test/`.

## Check your work

```
npm run task -- node-errors-project
```

When all tests pass, commit and push your branch `task/node-errors-project`.
