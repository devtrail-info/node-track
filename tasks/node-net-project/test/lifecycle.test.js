import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';
import { startServer, connect, join, within, wait } from './helpers.js';

test('a client that disconnects without /quit is announced once and its nickname is freed', async () => {
  const { port } = await startServer();
  const asha = await join(port, 'asha');
  const ravi = await join(port, 'ravi');
  await asha.next();
  ravi.socket.end(); // polite FIN, no /quit
  assert.equal(await asha.next(), '* ravi left');
  const meera = await join(port, 'meera');
  await asha.next();
  meera.socket.resetAndDestroy(); // the connection is reset
  assert.equal(await asha.next(), '* meera left');
  assert.deepEqual(await asha.collect(), []);
  await join(port, 'meera');
});

test('a client that leaves before joining is not announced', async () => {
  const { port } = await startServer();
  const asha = await join(port, 'asha');
  const lurker = await connect(port);
  await lurker.next();
  lurker.socket.resetAndDestroy();
  await wait(50);
  const gone = await connect(port);
  await gone.next();
  gone.socket.end();
  assert.deepEqual(await asha.collect(200), []);
});

test('a line longer than 1024 bytes gets "ERR line too long" and the connection is closed', async () => {
  const { port } = await startServer();
  const asha = await join(port, 'asha');
  const ravi = await join(port, 'ravi');
  await asha.next();
  ravi.send('x'.repeat(2000)); // no newline yet
  assert.equal(await ravi.next(), 'ERR line too long');
  await within(ravi.closed, 2000, 'closing the connection');
  assert.equal(await asha.next(), '* ravi left');
  assert.deepEqual(await asha.collect(), [], 'nothing of the long line is broadcast');

  const meera = await join(port, 'meera');
  await asha.next();
  meera.send('₹'.repeat(341) + '\n'); // 1023 bytes: fine
  assert.equal(await asha.next(), 'meera: ' + '₹'.repeat(341));
  meera.send('y'.repeat(1025) + '\n');
  assert.equal(await meera.next(), 'ERR line too long');
  await within(meera.closed, 2000, 'closing the connection');
  assert.equal(await asha.next(), '* meera left');

  const zoe = await join(port, 'zoe');
  assert.equal(await asha.next(), '* zoe joined');
  zoe.send('z'.repeat(1024) + '\n'); // exactly 1024 bytes: allowed
  assert.equal(await asha.next(), 'zoe: ' + 'z'.repeat(1024), 'a line of exactly 1024 bytes is allowed');
  zoe.send('₹'.repeat(400) + '\n'); // 400 characters, but 1200 bytes
  assert.equal(await zoe.next(), 'ERR line too long', 'the limit counts bytes, not characters');
  await within(zoe.closed, 2000, 'closing the connection');
});

test('the server keeps working when clients misbehave', async () => {
  const { port } = await startServer();
  const asha = await join(port, 'asha');
  for (let i = 0; i < 5; i++) {
    const c = await connect(port);
    c.send('half a nick');
    c.socket.resetAndDestroy();
  }
  await wait(100);
  const ravi = await join(port, 'ravi');
  assert.equal(await asha.next(), '* ravi joined');
  ravi.send('still here\n');
  assert.equal(await asha.next(), 'ravi: still here');
});

test('an idle client gets "BYE idle" and is disconnected; activity keeps a client connected', async () => {
  const { port } = await startServer({ idleMs: 300 });
  const asha = await join(port, 'asha');
  const ravi = await join(port, 'ravi');
  await asha.next();
  for (let i = 0; i < 5; i++) {
    await wait(150);
    asha.send('/who\n'); // activity on asha's connection only
  }
  assert.equal(await ravi.next(1000), 'BYE idle', 'nothing was sent or received on ravi\'s connection for 300 ms');
  await within(ravi.closed, 2000, 'closing the idle connection');
  assert.equal(asha.serverEnded, false, 'asha was active and stays connected');
  const lines = await asha.collect(50);
  assert.ok(lines.includes('* ravi left'), 'the others see that ravi left');
});

test('a client that never closes its side after BYE is destroyed by the server within a few seconds', async () => {
  const { server, port } = await startServer();
  const socket = net.connect({ port, host: '127.0.0.1', allowHalfOpen: true }); // never sends its own FIN
  socket.on('error', () => {});
  let text = '';
  socket.on('data', (chunk) => (text += chunk));
  await once(socket, 'connect');
  socket.write('asha\n/quit\n');
  const count = () => new Promise((resolve) => server.getConnections((err, n) => resolve(n)));
  try {
    const waitedFrom = Date.now();
    while (!text.endsWith('BYE\n')) {
      if (Date.now() - waitedFrom > 2000) assert.fail(`expected BYE after /quit, got ${JSON.stringify(text)}`);
      await wait(10);
    }
    assert.equal(await count(), 1, 'the connection is still open right after BYE (waiting for the client)');
    const started = Date.now();
    while ((await count()) > 0) {
      if (Date.now() - started > 3000) assert.fail('the server still holds the connection 3 s after BYE: destroy it after a grace period');
      await wait(50);
    }
  } finally {
    socket.destroy();
  }
});

test('stop() says goodbye to every client, closes them and the server', async () => {
  const { server, port } = await startServer();
  const asha = await join(port, 'asha');
  const ravi = await join(port, 'ravi');
  const lurker = await connect(port);
  await lurker.next();
  await asha.next();
  const stopped = server.stop();
  assert.ok(stopped instanceof Promise, 'stop() returns a promise');
  assert.equal(await ravi.next(), 'BYE server shutting down');
  assert.equal(await lurker.next(), 'BYE server shutting down');
  await within(Promise.all([asha.closed, ravi.closed, lurker.closed]), 2000, 'closing every connection');
  await within(stopped, 2000, 'stop() resolving');
  assert.equal(server.listening, false);
});
