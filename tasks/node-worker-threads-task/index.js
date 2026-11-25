// Task: node-worker-threads-task. Read README.md in this folder.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const defaultWorker = new URL('./hash-worker.js', import.meta.url);

// TODO: run the hashing in a worker thread started from `workerUrl` (README steps 1 to 5).
// Right now it hashes on the main thread: correct answers, but nothing else can run meanwhile.
export async function hashInWorker(data, { algorithm = 'sha256', rounds = 1, transfer = false, signal, workerUrl = defaultWorker } = {}) {
  let digest = data;
  for (let i = 0; i < rounds; i++) digest = createHash(algorithm).update(digest).digest();
  return Buffer.from(digest).toString('hex');
}

async function main() {
  const [file, algorithm = 'sha256', rounds = '1'] = process.argv.slice(2);
  if (!file) {
    console.error('usage: node index.js <file> [algorithm] [rounds]');
    process.exitCode = 2;
    return;
  }
  // A heartbeat: while the hash runs in a worker, the dots keep coming.
  const beat = setInterval(() => process.stdout.write('.'), 100);
  try {
    const hex = await hashInWorker(await readFile(file), { algorithm, rounds: Number(rounds), transfer: true });
    console.log(`\n${hex}  ${file}`);
  } catch (err) {
    console.error(`\nerror: ${err.message}`);
    process.exitCode = 1;
  } finally {
    clearInterval(beat);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
