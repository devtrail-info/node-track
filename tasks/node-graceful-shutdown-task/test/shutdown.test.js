import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start, get, keepAliveAgent, wait, timed } from './helpers.js';

test('with no traffic, shutdown stops the server, calls onClose and resolves with 0', async () => {
  const app = await start();
  const { value, ms } = await timed(app.shutdown('SIGTERM'));
  assert.equal(value, 0, 'a clean shutdown resolves with 0');
  assert.ok(ms < 1000, `it should not wait for anything (took ${ms} ms)`);
  assert.deepEqual(app.logs, ['SIGTERM received: shutting down', 'shutdown complete']);
  assert.equal(app.closed.length, 1, 'onClose is called once');
  assert.equal(app.server.listening, false, 'the server no longer listens');
});

test('requests in flight finish, new connections are refused, then onClose runs', async () => {
  const app = await start();
  const agent = keepAliveAgent();
  const t0 = Date.now();
  const slow = get(app.port, '/report?ms=400', agent);
  await wait(100);
  const stopping = timed(app.shutdown('SIGTERM'));
  await wait(50);
  const late = await get(app.port, '/health');
  assert.equal(late.error, 'ECONNREFUSED', 'a new connection during the shutdown is refused');

  const res = await slow;
  assert.equal(res.status, 200, 'the request in flight still gets its answer');
  assert.deepEqual(JSON.parse(res.body), { report: 'done', ms: 400 });

  const { value, ms } = await stopping;
  assert.equal(value, 0);
  assert.ok(ms < 1500, `a busy keep-alive connection must not hold the shutdown until its keep-alive timeout (took ${ms} ms)`);
  assert.deepEqual(app.logs, ['SIGTERM received: shutting down', 'waiting for 1 request(s)', 'shutdown complete']);
  assert.equal(app.closed.length, 1);
  assert.ok(app.closed[0] - t0 >= 390, 'onClose runs only after the request in flight has finished');
});

test('several requests in flight are counted and all finish', async () => {
  const app = await start();
  const agent = keepAliveAgent();
  const calls = [get(app.port, '/report?ms=300', agent), get(app.port, '/report?ms=350'), get(app.port, '/report?ms=250', agent)];
  await wait(80);
  const code = await app.shutdown('SIGINT');
  const results = await Promise.all(calls);
  assert.equal(code, 0);
  assert.deepEqual(results.map((r) => r.status), [200, 200, 200]);
  assert.deepEqual(app.logs, ['SIGINT received: shutting down', 'waiting for 3 request(s)', 'shutdown complete']);
});

test('idle keep-alive connections do not delay the shutdown', async () => {
  const app = await start();
  const agent = keepAliveAgent();
  const first = await get(app.port, '/health', agent);
  assert.equal(first.status, 200);
  await wait(30); // the connection is now idle, kept open for the next request
  const { value, ms } = await timed(app.shutdown('SIGTERM'));
  assert.equal(value, 0);
  assert.ok(ms < 1000, `an idle keep-alive connection must be closed at once (took ${ms} ms)`);
  assert.deepEqual(app.logs, ['SIGTERM received: shutting down', 'shutdown complete']);
});

test('a request that takes too long is cut off after timeoutMs, and shutdown resolves with 1', async () => {
  const app = await start({ timeoutMs: 200 });
  const stuck = get(app.port, '/report?ms=5000');
  await wait(50);
  const { value, ms } = await timed(app.shutdown('SIGTERM'));
  assert.equal(value, 1, 'a forced shutdown resolves with 1');
  assert.ok(ms >= 180 && ms < 1000, `forced after about 200 ms (took ${ms} ms)`);
  assert.deepEqual(app.logs, ['SIGTERM received: shutting down', 'waiting for 1 request(s)', 'forced shutdown after 200 ms']);
  const res = await stuck;
  assert.ok(res.error, 'the stuck client loses its connection');
  assert.equal(app.closed.length, 0, 'onClose is not called after a forced shutdown');
});

test('calling shutdown again returns the same promise and logs nothing new', async () => {
  const app = await start();
  const slow = get(app.port, '/report?ms=200');
  await wait(50);
  const p1 = app.shutdown('SIGTERM');
  const p2 = app.shutdown('SIGINT');
  assert.equal(p1, p2, 'the second call returns the first promise');
  assert.equal(await p1, 0);
  await slow;
  assert.deepEqual(app.logs, ['SIGTERM received: shutting down', 'waiting for 1 request(s)', 'shutdown complete']);
  assert.equal(app.closed.length, 1);
});

test('the deadline does not fire after a clean shutdown', async () => {
  const app = await start({ timeoutMs: 250 });
  assert.equal(await app.shutdown('SIGTERM'), 0);
  await wait(400);
  assert.deepEqual(app.logs, ['SIGTERM received: shutting down', 'shutdown complete']);
});

test('a failing onClose is logged and resolves with 1', async () => {
  const app = await start({
    onClose: async () => {
      throw new Error('db pool stuck');
    },
  });
  assert.equal(await app.shutdown('SIGTERM'), 1);
  assert.deepEqual(app.logs, ['SIGTERM received: shutting down', 'shutdown error: db pool stuck']);
});
