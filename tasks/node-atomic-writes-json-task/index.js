import { readFile, writeFile } from 'node:fs/promises';

// Returns the parsed JSON in `file`, or `fallback` when the file does not exist.
export async function readJson(file, fallback) {
  const text = await readFile(file, 'utf8');
  return JSON.parse(text);
}

// Saves `data` as JSON so that `file` always holds the old or the new content, never a mix.
export async function writeJsonAtomic(file, data) {
  await writeFile(file, JSON.stringify(data, null, 2) + '\n');
}

// Reads the current value, applies `update`, saves the result. Calls for one file run one after another.
export async function updateJson(file, fallback, update) {
  const current = await readJson(file, fallback);
  const next = await update(current);
  await writeJsonAtomic(file, next);
  return next;
}
