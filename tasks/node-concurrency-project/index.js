// Task: node-concurrency-project. Read README.md in this folder.
import { Worker } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const defaultWorker = new URL('./checksum-worker.js', import.meta.url);

// TODO (milestones 1 to 4 in the README): a fixed-size pool of long-lived workers with a queue.
export function createPool({ size = os.availableParallelism(), workerUrl = defaultWorker } = {}) {
  return {
    size,
    run(job) {
      return Promise.reject(new Error('run() is not written yet'));
    },
    stats() {
      return { created: 0, running: 0, queued: 0 };
    },
    async close() {},
  };
}

// TODO (milestone 5): run every job through one pool, report results in completion order, then close the pool.
export async function runJobs(jobs, { size, workerUrl, onResult = () => {} } = {}) {
  return [];
}

// The CLI is done: it uses runJobs. Try it once runJobs works.
async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('usage: node index.js <file> [file...]');
    process.exitCode = 2;
    return;
  }
  const size = Number(process.env.POOL_SIZE) || undefined;
  const jobs = await Promise.all(
    files.map(async (file) => ({ id: file, data: await readFile(file).catch(() => null) })),
  );
  const missing = jobs.filter((job) => job.data === null);
  for (const job of missing) console.log(`ERROR  ${job.id}: cannot read file`);
  const results = await runJobs(jobs.filter((job) => job.data !== null), {
    size,
    onResult: (r) => console.log(r.error ? `ERROR  ${r.id}: ${r.error}` : `${r.checksum}  ${r.id}`),
  });
  const failed = missing.length + results.filter((r) => r.error).length;
  console.log(`${files.length} files, ${failed} failed`);
  process.exitCode = failed > 0 ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
