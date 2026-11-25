// A pool worker for the tests. Same messages as checksum-worker.js, but the job's `algorithm` picks a behaviour:
//   'sleep:<ms>'  wait <ms> without using the CPU, then answer { id, checksum: 'slept <ms>' }
//   'crash'       exit with code 1 without answering
//   'throw'       throw an uncaught error (the worker dies with it)
//   'whoami:<ms>' wait <ms>, then answer { id, checksum: '<threadId of this worker>' }
import { parentPort, threadId } from 'node:worker_threads';

const pause = new Int32Array(new SharedArrayBuffer(4));

parentPort.on('message', ({ id, algorithm }) => {
  if (algorithm === 'crash') process.exit(1);
  if (algorithm === 'throw') throw new Error(`worker bug in job ${id}`);
  const ms = Number(String(algorithm).split(':')[1]);
  Atomics.wait(pause, 0, 0, ms);
  const whoami = String(algorithm).startsWith('whoami:');
  parentPort.postMessage({ id, checksum: whoami ? String(threadId) : `slept ${ms}` });
});
