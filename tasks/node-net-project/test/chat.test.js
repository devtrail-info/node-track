import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, connect, join, within } from './helpers.js';

test('createChatServer returns a net server that is not listening yet', async () => {
  const { createChatServer } = await import('./helpers.js');
  const server = createChatServer();
  assert.equal(typeof server.listen, 'function');
  assert.equal(server.listening, false);
});

test('a new client is welcomed and joins with a valid nickname', async () => {
  const { port } = await startServer();
  const c = await connect(port);
  assert.equal(await c.next(), 'WELCOME send your nickname');
  c.send('asha_01\n');
  assert.equal(await c.next(), 'OK asha_01');
});

test('invalid nicknames get "ERR invalid nickname" and the client can try again', async () => {
  const { port } = await startServer();
  const c = await connect(port);
  await c.next();
  for (const bad of ['', 'two words', 'a'.repeat(21), 'ravi!', '/who', 'आशा']) {
    c.send(bad + '\n');
    assert.equal(await c.next(), 'ERR invalid nickname', JSON.stringify(bad));
  }
  c.send('a'.repeat(20) + '\r\n');
  assert.equal(await c.next(), 'OK ' + 'a'.repeat(20), 'a 20-character nickname with CRLF is fine');
});

test('a nickname in use (in any letter case) gets "ERR nickname taken"', async () => {
  const { port } = await startServer();
  await join(port, 'Ravi');
  const c = await connect(port);
  await c.next();
  c.send('ravi\n');
  assert.equal(await c.next(), 'ERR nickname taken');
  c.send('RAVI\n');
  assert.equal(await c.next(), 'ERR nickname taken');
  c.send('ravi2\n');
  assert.equal(await c.next(), 'OK ravi2');
});

test('joining is announced to the others, and messages go to everyone except the sender', async () => {
  const { port } = await startServer();
  const asha = await join(port, 'asha');
  const ravi = await join(port, 'ravi');
  assert.equal(await asha.next(), '* ravi joined');
  const meera = await join(port, 'meera');
  assert.equal(await asha.next(), '* meera joined');
  assert.equal(await ravi.next(), '* meera joined');

  ravi.send('chai at 4?\n');
  assert.equal(await asha.next(), 'ravi: chai at 4?');
  assert.equal(await meera.next(), 'ravi: chai at 4?');
  assert.deepEqual(await ravi.collect(), [], 'the sender does not get its own message back');
});

test('clients that have not joined yet see no chat and no announcements', async () => {
  const { port } = await startServer();
  const lurker = await connect(port);
  assert.equal(await lurker.next(), 'WELCOME send your nickname');
  const asha = await join(port, 'asha');
  const ravi = await join(port, 'ravi');
  await asha.next(); // * ravi joined
  ravi.send('hello\n');
  assert.equal(await asha.next(), 'ravi: hello');
  assert.deepEqual(await lurker.collect(), []);
});

test('framing: two messages in one write, one message over many writes, CRLF and split characters', async () => {
  const { port } = await startServer();
  const asha = await join(port, 'asha');
  const ravi = await join(port, 'ravi');
  await asha.next();

  ravi.send('first\nsecond\r\n');
  assert.equal(await asha.next(), 'ravi: first');
  assert.equal(await asha.next(), 'ravi: second', 'the \\r of a CRLF line ending is not part of the message');

  const bytes = Buffer.from('समोसा ₹15\n');
  for (let i = 0; i < bytes.length; i += 2) {
    ravi.socket.write(bytes.subarray(i, i + 2));
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.equal(await asha.next(), 'ravi: समोसा ₹15');
});

test('empty lines are ignored and unknown commands get "ERR unknown command"', async () => {
  const { port } = await startServer();
  const asha = await join(port, 'asha');
  const ravi = await join(port, 'ravi');
  await asha.next();
  ravi.send('\n\r\n/dance\n');
  assert.equal(await ravi.next(), 'ERR unknown command');
  assert.deepEqual(await asha.collect(), []);
});

test('/who lists the joined nicknames in alphabetical order, ignoring case', async () => {
  const { port } = await startServer();
  const zoe = await join(port, 'zoe');
  await join(port, 'asha');
  await join(port, 'Ravi');
  await connect(port); // not joined: not listed
  await zoe.collect(100);
  zoe.send('/who\n');
  assert.equal(await zoe.next(), 'USERS asha, Ravi, zoe');
});

test('/quit says BYE, the server closes the connection, and the others see "left"', async () => {
  const { port } = await startServer();
  const asha = await join(port, 'asha');
  const ravi = await join(port, 'ravi');
  await asha.next();
  ravi.send('/quit\n');
  assert.equal(await ravi.next(), 'BYE');
  await within(ravi.closed, 2000, 'closing the connection after BYE');
  assert.ok(ravi.serverEnded, 'the server ends the connection (FIN), it does not just stop answering');
  assert.equal(await asha.next(), '* ravi left');
  assert.deepEqual(await asha.collect(), [], '"left" is sent once');
  const again = await join(port, 'ravi'); // the nickname is free again
  assert.equal(await asha.next(), '* ravi joined');
  again.send('/who\n');
  assert.equal(await again.next(), 'USERS asha, ravi');
});
