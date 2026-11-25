// Task: node-streams-project. Read README.md in this folder.
import { fileURLToPath } from 'node:url';

// TODO 1: a Transform with bytes in and one string per line out.
export function createLineSplitter() {
  throw new Error('TODO: createLineSplitter');
}

// TODO 2: one log line -> { time, method, path, status, ms }, or null when it is malformed.
export function parseLine(line) {
  return null;
}

// TODO 3: stream the file once with pipeline and return
// { lines, malformed, statusCounts, slowest }.
export async function analyzeLog(filePath, { top = 3 } = {}) {
  return { lines: 0, malformed: 0, statusCounts: {}, slowest: [] };
}

// TODO 4: the command line: node index.js <access.log>
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log('TODO');
}
