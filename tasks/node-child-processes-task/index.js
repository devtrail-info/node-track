// Task: node-child-processes-task. Read README.md in this folder.
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// TODO: rewrite with execFile (README steps 1 to 5). This first version "works" for simple cases, but it builds a
// shell command from strings, treats every non-zero exit as a crash, and waits forever for a stuck script.
export function runScript(scriptPath, args = [], { timeoutMs = 5000, killGraceMs = 1000, maxOutputBytes = 1024 * 1024, signal } = {}) {
  return new Promise((resolve, reject) => {
    exec(`"${process.execPath}" ${scriptPath} ${args.join(' ')}`, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve({ code: 0, signal: null, stdout, stderr, timedOut: false });
    });
  });
}

async function main() {
  const [script, ...args] = process.argv.slice(2);
  if (!script) {
    console.error('usage: node index.js <script> [args...]');
    process.exitCode = 2;
    return;
  }
  const result = await runScript(script, args, { timeoutMs: Number(process.env.TIMEOUT_MS ?? 5000) });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  console.log(`-> code ${result.code}, signal ${result.signal}, timed out: ${result.timedOut}`);
  process.exitCode = result.code ?? 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
