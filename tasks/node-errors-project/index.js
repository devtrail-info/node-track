// Task: node-errors-project. Read README.md in this folder.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export async function fetchAll(urls, options = {}) {
  const { concurrency = 4, timeoutMs = 2000, retries = 2, baseDelayMs = 100, maxDelayMs = 2000, random = Math.random, signal } = options;
  // TODO: a concurrency limit, a timeout per attempt, retries with backoff, cancellation, the error report.
  // This first version fetches everything at once and stops at the first problem.
  const results = await Promise.all(
    urls.map(async (url) => {
      const res = await fetch(url);
      return { url, ok: true, status: res.status, attempts: 1, body: await res.text() };
    }),
  );
  return { results, summary: { ok: results.length, failed: 0, cancelled: 0, retries: 0 } };
}

export function formatReport(report) {
  // TODO: README, "The report as text"
  return '';
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node index.js <file with one URL per line>');
    process.exitCode = 2;
    return;
  }
  const urls = (await readFile(file, 'utf8')).split('\n').map((l) => l.trim()).filter(Boolean);
  const report = await fetchAll(urls);
  console.log(formatReport(report));
  // TODO: exit code, and Ctrl+C cancels the run
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
