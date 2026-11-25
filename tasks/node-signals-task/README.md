# Task: node-signals-task

A small **order meter**: it reads orders from stdin, one per line, prints each one, and keeps a running total.
Shops pipe a day's orders into tools like this (`cat orders.csv | node index.js`), and operators stop them with
Ctrl+C or with `kill`. Right now, stopping it throws the total away. Your job is to make it stop politely.

```text
tasks/node-signals-task/
  index.js   <- the program (you change it)
  test/      <- the tests (do not change)
```

An order line is `<order id>,<amount>`, for example `A-1001,12.50`. Empty lines are ignored.

## What to do

1. **Skip bad lines.** A line is bad when it does not have exactly two fields, the id is empty, or the amount is
   empty, not a number, or negative. Don't count a bad line. Print `skipped line <n>: <the line>` to **stderr**
   (`<n>` counts every line read, starting at 1, empty lines included).
   For example, the input `A-1,10`, `oops` prints `skipped line 2: oops` on stderr.
2. **Exit code at the end.** When stdin ends, print the summary as now, then exit with code `0` if no line was
   skipped and `1` if any was. Let the program end by itself (use `process.exitCode`).
3. **Ctrl+C.** On `SIGINT`, print `Processed <n> orders, total <x> EUR (interrupted)` to **stdout** and exit with
   code `130`. stdin is still open at that moment, so the program will not end by itself.
   For example, after `A-1,12.50` and `A-2,19.99`, Ctrl+C prints
   `Processed 2 orders, total 32.49 EUR (interrupted)`.
4. **SIGTERM.** On `SIGTERM` (what `kill <pid>`, `docker stop` and Kubernetes send), print the same summary with
   ` (stopped)` at the end and exit with code `143`.
5. Keep what already works: one `order <id>: <amount with 2 decimals>` line per order on stdout, and the summary
   `Processed <n> orders, total <x> EUR` when stdin ends.

## Rules

- Only `node:` built-ins. No npm packages.
- Do not change anything in `test/`.
- Make sure the summary line is really written before the process ends.

## Try it by hand

```
printf 'A-1,12.50\nA-2,19.99\noops\n' | node index.js; echo "exit code: $?"
node index.js
```

The second command waits for you to type orders. Type a few lines, then press Ctrl+C and run `echo $?`.
(Ctrl+D instead ends stdin, which is the normal end.) In another terminal you can also try
`kill <pid>` (find the pid with `ps` or by printing `process.pid`).

## Windows

Windows has no POSIX signals. Ctrl+C in a terminal does reach a `SIGINT` listener, but a test cannot send one:
`child.kill('SIGINT')` and `child.kill('SIGTERM')` end the process at once, and no listener runs. So the two
signal tests are **skipped on Windows**; the other tests still run. Run them all in WSL (Linux on
Windows), or try Ctrl+C by hand.

## Check your work

```
npm run task -- node-signals-task
```

When all tests pass, commit and push your branch `task/node-signals-task`.
