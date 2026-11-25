// Test helpers for node-net-project: a server on a random port and line-reading chat clients.
import net from 'node:net';
import { once } from 'node:events';
import { after } from 'node:test';
import * as mod from '../index.js';

// Works with a named export and with `export default { createChatServer }`.
export const createChatServer = mod.createChatServer ?? mod.default?.createChatServer;

const servers = [];
const sockets = new Set();
after(async () => {
  for (const s of sockets) s.destroy();
  for (const server of servers) if (server.listening) server.close();
});

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Starts a chat server on 127.0.0.1 and a random port. Returns { server, port }. */
export async function startServer(options) {
  const server = createChatServer(options);
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, port: server.address().port };
}

/**
 * A chat client. `next()` resolves with the next line the server sent (without '\n') or rejects after `ms`.
 * `send(text)` writes text as it is (add '\n' yourself). `closed` resolves when the server has closed the connection.
 */
export async function connect(port) {
  const socket = net.connect(port, '127.0.0.1');
  sockets.add(socket);
  socket.on('error', () => {});
  const lines = [];
  const waiting = [];
  let pending = Buffer.alloc(0);
  socket.on('data', (chunk) => {
    pending = Buffer.concat([pending, chunk]);
    let end = pending.indexOf(0x0a);
    while (end !== -1) {
      lines.push(pending.subarray(0, end).toString('utf8'));
      pending = pending.subarray(end + 1);
      end = pending.indexOf(0x0a);
    }
    while (waiting.length && lines.length) waiting.shift()(lines.shift());
  });
  const closed = new Promise((resolve) => socket.on('close', resolve));
  let serverEnded = false;
  socket.on('end', () => {
    serverEnded = true;
  });
  await once(socket, 'connect');

  const client = {
    socket,
    closed,
    get serverEnded() {
      return serverEnded;
    },
    send: (text) => socket.write(text),
    next(ms = 2000) {
      if (lines.length) return Promise.resolve(lines.shift());
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const i = waiting.indexOf(done);
          if (i !== -1) waiting.splice(i, 1);
          reject(new Error(`no line from the server within ${ms} ms`));
        }, ms);
        const done = (line) => {
          clearTimeout(timer);
          resolve(line);
        };
        waiting.push(done);
      });
    },
    /** Resolves with every line that arrives within `ms` (use it to check that nothing arrives). */
    async collect(ms = 150) {
      await wait(ms);
      return lines.splice(0);
    },
  };
  return client;
}

/** Connects, reads the welcome line and joins with `nick`. */
export async function join(port, nick) {
  const c = await connect(port);
  const welcome = await c.next();
  if (welcome !== 'WELCOME send your nickname') throw new Error(`expected the welcome line, got ${JSON.stringify(welcome)}`);
  c.send(nick + '\n');
  const ok = await c.next();
  if (ok !== `OK ${nick}`) throw new Error(`expected "OK ${nick}", got ${JSON.stringify(ok)}`);
  return c;
}

export const within = (p, ms = 2000, what = 'it') =>
  Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error(`${what} did not happen within ${ms} ms`)), ms))]);
