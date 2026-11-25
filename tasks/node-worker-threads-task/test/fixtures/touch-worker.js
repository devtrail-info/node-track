// A worker that records that it was started: it creates the file named in workerData.algorithm.
import { workerData, parentPort } from 'node:worker_threads';
import { writeFileSync } from 'node:fs';

writeFileSync(workerData.algorithm, 'started');
parentPort.postMessage('started');
