// Used by the tests: one job through a pool, then close(). The process must then end by itself.
import * as mod from '../../index.js';

const createPool = mod.createPool ?? mod.default?.createPool;
const pool = createPool({ size: 2 });
const result = await pool.run({ id: 'invoice-1', data: new Uint8Array([1, 2, 3]) });
await pool.close();
console.log('closed after ' + result.id);
