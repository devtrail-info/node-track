// todo CLI: node todo.js add <text> | list [--json] | done <id>
// The data file is TODO_FILE, or todos.json in the current folder.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export const USAGE = `Usage: node todo.js <command> [options]

Commands:
  add <text>      add a todo
  list [--json]   show all todos
  done <id>       mark a todo as done

Options:
  -h, --help      show this help

The todos are saved in the file named by TODO_FILE (default: todos.json in the current folder).`;

// Runs one command and returns the exit code: 0 success, 1 error, 2 bad usage.
// Print normal output with out.log and every error with out.error.
export function main(args, env = process.env, out = console) {
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
