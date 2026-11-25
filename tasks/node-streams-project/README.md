# Task: node-streams-project

Build an **access-log analyzer**: a tool that reads a web server's log file, however big, and reports how many
requests ended with each status code and which requests were the slowest. Operations teams run tools like this on
gigabyte-sized logs after an incident, so it must stream the file and never hold it in memory.

```text
tasks/node-streams-project/
  index.js             <- createLineSplitter, parseLine, analyzeLog and the command line (you write them)
  fixtures/access.log  <- a small sample log
  test/                <- the tests (do not change)
```

## The log format

One request per line, five fields separated by spaces: time, method, path, status code, duration in milliseconds.

```text
2026-11-25T09:00:03Z POST /api/pay 500 1520ms
```

Real logs are messy: lines can be broken, empty, or end with `\r\n` (Windows), paths can contain any UTF-8 text
(`/menu/चाय`), and the last line may have no newline.

## What to do

Open `index.js`.

1. Export `createLineSplitter()`. It returns a **Transform** stream: bytes in, one **string per line** out (object
   mode on the readable side), without the `\n` and without a trailing `\r`.
   - Chunks can end anywhere, also in the middle of a UTF-8 character.
   - The last line comes out even if the input does not end with `\n`; no empty line is added at the end.
   - Empty lines in the middle come out as `''`.
   - Each line comes out as soon as its `\n` has arrived.
   ```js
   // chunks 'GET /a 200 5ms\nGET /' and 'b 404 9ms'  ->  'GET /a 200 5ms', 'GET /b 404 9ms'
   ```
2. Export `parseLine(line)`. It returns `{ time, method, path, status, ms }` with `status` and `ms` as numbers, or
   `null` if the line is malformed: not exactly five fields, a status that is not a three-digit number from 100 to
   599, a duration that is not whole digits followed by `ms`, or a path that does not start with `/`.
   ```js
   parseLine('2026-11-25T09:00:03Z POST /api/pay 500 1520ms');
   // { time: '2026-11-25T09:00:03Z', method: 'POST', path: '/api/pay', status: 500, ms: 1520 }
   parseLine('this line is broken'); // null
   ```
3. Export `async analyzeLog(filePath, { top = 3 } = {})`. It reads the file **once, as a stream**, using
   `pipeline` from `node:stream/promises` with your line splitter (`readline` over a read stream also works), and resolves with:
   - `lines`: the number of non-empty lines (empty or whitespace-only lines are skipped),
   - `malformed`: how many of those `parseLine` rejected,
   - `statusCounts`: `{ [status]: count }` for the good lines,
   - `slowest`: the `top` slowest good requests as `{ method, path, status, ms }`, slowest first; on equal `ms` the
     one that appears first in the file comes first.

   A missing file must **reject** (with the `ENOENT` error), never crash the process.
   ```js
   await analyzeLog('fixtures/access.log');
   // { lines: 8, malformed: 1, statusCounts: { 200: 4, 201: 1, 404: 1, 500: 1 },
   //   slowest: [{ method: 'POST', path: '/api/pay', status: 500, ms: 1520 }, ...] }
   ```
4. When the file is run directly, `node tasks/node-streams-project/index.js <log>` prints the report:
   ```text
   lines: 8 (1 malformed)
   status 200: 4
   status 201: 1
   status 404: 1
   status 500: 1
   slowest:
     1520ms POST /api/pay
     980ms GET /api/report
     980ms GET /api/orders
   ```
   Status lines are sorted by status code; each slow request is indented by two spaces. Exit code 0. If the file
   cannot be read, print `error: <message>` on **stderr** and exit with 1. Without a file argument, print a usage
   line on stderr and exit with 2.

## Rules

- Only `node:` built-ins. No npm packages.
- Never read the whole file into memory: no `readFile`, and do not collect all lines or all entries in an array.
  Keep only the current top list while reading. One test analyses a 100 MB log in a separate process and checks its
  peak memory.
- Use `pipeline` (or `readline` over a read stream), not `.pipe()`, so a failing stream is cleaned up and its error reaches your `catch`.

## Check your work

```
npm run task -- node-streams-project
```

When all tests pass, commit and push your branch `task/node-streams-project`.
