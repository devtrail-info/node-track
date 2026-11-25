import path from 'node:path';
import { pathToFileURL } from 'node:url';

// 'IMG_20240517_101500.jpg' -> { year: '2024', month: '05' }; no real date in the name -> null
export function dateFromName(name) {
  return null;
}

// The plan for the files directly inside `dir`: [{ file, target, action }], sorted by file name.
export async function planMoves(dir) {
  return [];
}

// Carries out the plan (unless dryRun) and returns it. Never replaces an existing file.
export async function organise(dir, { dryRun = false } = {}) {
  return planMoves(dir);
}

// node index.js <folder> [--dry-run]  -> resolves to the exit code
export async function main(args) {
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}
