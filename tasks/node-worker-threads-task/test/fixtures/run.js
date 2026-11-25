// Used by the tests: runs hashInWorker in its own process, so a test can check that nothing is left running.
import * as mod from '../../index.js';

const hashInWorker = mod.hashInWorker ?? mod.default?.hashInWorker;
const mode = process.argv[2];

if (mode === 'done') {
  const hex = await hashInWorker(new Uint8Array([1, 2, 3]));
  console.log('hash ' + hex);
} else if (mode === 'abort') {
  const controller = new AbortController();
  const reason = new Error('user cancelled the export');
  setTimeout(() => controller.abort(reason), 100);
  try {
    await hashInWorker(new Uint8Array(8), { signal: controller.signal, workerUrl: new URL('./spin-worker.js', import.meta.url) });
    console.log('resolved');
  } catch (err) {
    console.log('rejected ' + (err === reason ? 'with the reason' : String(err && err.message)));
  }
}
