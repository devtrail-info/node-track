# Task: node-process-project

Build a **todo CLI**: a command-line tool that keeps a todo list in a JSON file. It is small, but it behaves like a
real Unix tool: it reads its arguments with `util.parseArgs`, finds its data file through an environment variable,
prints results on stdout and problems on stderr, and tells the shell how it went with its exit code. Scripts and CI
jobs can then use it safely, for example `node todo.js list --json | jq length` or
`node todo.js done 3 && echo "nice"`.

```text
tasks/node-process-project/
  todo.js   <- the CLI (you write main)
  test/     <- the tests (do not change)
```

The data file holds a JSON array of todos: `[{ "id": 1, "text": "Pay invoice 1042", "done": false }]`.

## What to do

Write `main(args, env, out)` in `todo.js`. It runs one command and **returns** the exit code; the last lines of
the file already set `process.exitCode` from it. Print normal output with `out.log(...)` and every error with
`out.error(...)` (`out` is `console` when the file runs).

1. **Arguments.** Read `args` with `parseArgs` from `node:util`, with positionals allowed and the options
   `--json` (boolean) and `-h`/`--help` (boolean). Keep `strict` on. The first positional is the command.
2. **Data file.** Use the path in `env.TODO_FILE`; when it is not set (or empty), use `todos.json` in the current
   folder. A file that does not exist yet means "no todos". Save with `JSON.stringify` (any formatting).
3. **`add <text>`**: the words after `add`, joined with spaces, are the text. The new id is one more than the highest
   id in the file (1 for an empty list). Save, then print `Added #<id>: <text>`.
   For example, `node todo.js add Buy oat milk` prints `Added #1: Buy oat milk`, and `add -- --urgent call` adds
   the text `--urgent call` (everything after `--` is a positional).
4. **`list`**: one line per todo, `[x] #1 Pay invoice 1042` for done ones and `[ ] #2 Call the bank` for the
   others, or `No todos yet.` With `--json`, print the array as JSON instead.
5. **`done <id>`**: mark that todo as done, save, and print `Done #<id>: <text>`.
6. **Exit codes and errors.** Every error goes to stderr, never stdout.
   - `0`: success. `-h`/`--help` prints the `USAGE` text on **stdout** and returns 0.
   - `2`, bad usage: no command, an unknown command, an option `parseArgs` rejects, `add` without text (or only
     spaces), `done` without an id or with an id that is not a whole number above 0 (`abc`, `1.5`, `0`). Print
     `Error: <what is wrong>`, then the `USAGE` text, on stderr. Don't touch the data file.
   - `1`, other errors: `done` with an id that is not in the list (`Error: no todo #99`), and a data file that is
     not valid JSON or not an array (the message must include the file's path).

## Rules

- Only `node:` built-ins. No npm packages.
- Never call `process.exit()` in `main`: return the code instead, so output is never cut off and `main` can be
  tested.
- Do not change anything in `test/`.

## Try it by hand

From this folder (on Windows PowerShell, set the variable with `$env:TODO_FILE="demo.json"` instead):

```
TODO_FILE=demo.json node todo.js add Pay invoice 1042
TODO_FILE=demo.json node todo.js add Call the bank
TODO_FILE=demo.json node todo.js done 1
TODO_FILE=demo.json node todo.js list
TODO_FILE=demo.json node todo.js list --json
node todo.js done abc; echo "exit code: $?"
node todo.js list > out.txt 2> errors.txt
```

Delete `demo.json`, `out.txt` and `errors.txt` when you are done (and don't commit them).

## Check your work

```
npm run task -- node-process-project
```

When all tests pass, commit and push your branch `task/node-process-project`.
