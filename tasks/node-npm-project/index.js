import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { satisfies } from './semver.js';

// Compares the direct dependencies in package.json with what package-lock.json says is installed.
// Returns one problem object per dependency that is not fine, sorted by name.
export function checkProject(pkg, lock) {
  return [];
}

// Turns one problem object into one line of the report.
export function formatProblem(problem) {
  return '';
}

// node index.js <project-folder>
export function main(args) {
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
