import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { once } from 'node:events';
import * as mod from './index.js';

// Works with a named export and with `export default { rawRequest }`.
const rawRequest = mod.rawRequest ?? mod.default?.rawRequest;

const servers = [];
after(async () => {
  for (const s of servers) {
    s.closeAllConnections?.();
    for (const socket of s.sockets ?? []) socket.destroy();
    s.close();
  }
});

/** An http server on 127.0.0.1 and a random port. Returns the port. */
async function httpServer(handler) {
  const server = http.createServer(handler);
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}

/** A raw TCP server: onConnection(socket, request) runs once the request head has arrived. */
async function rawServer(onConnection) {
  const server = net.createServer((socket) => {
    server.sockets.add(socket);
    socket.on('close', () => server.sockets.delete(socket));
    socket.on('error', () => {});
    let head = Buffer.alloc(0);
    const onData = (chunk) => {
      head = Buffer.concat([head, chunk]);
      if (head.includes('\r\n\r\n')) {
        socket.off('data', onData);
        onConnection(socket, head.toString('latin1'));
      }
    };
    socket.on('data', onData);
  });
  server.sockets = new Set();
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}

const within = (p, ms = 3000) =>
  Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error(`did not settle within ${ms} ms`)), ms))]);

async function rejection(p, ms) {
  try {
    await within(p, ms);
  } catch (err) {
    return err;
  }
  assert.fail('expected the promise to reject');
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('a GET returns status, status text, lower-case headers and the body as a Buffer', async () => {
  const port = await httpServer((req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Order-Id', 'A-1042');
    res.end(JSON.stringify({ id: 'A-1042', total: '₹1250' }));
  });
  const res = await within(rawRequest({ port, path: '/orders/A-1042' }));
  assert.equal(res.status, 200);
  assert.equal(res.statusText, 'OK');
  assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
  assert.equal(res.headers['x-order-id'], 'A-1042');
  assert.ok(Buffer.isBuffer(res.body), 'body must be a Buffer');
  assert.deepEqual(JSON.parse(res.body.toString('utf8')), { id: 'A-1042', total: '₹1250' });
});

test('the request has a valid request line, Host, Connection: close and the custom headers', async () => {
  let seen;
  const port = await httpServer((req, res) => {
    seen = { method: req.method, url: req.url, host: req.headers.host, connection: req.headers.connection, id: req.headers['x-request-id'], version: req.httpVersion };
    res.end('ok');
  });
  const res = await within(rawRequest({ host: '127.0.0.1', port, method: 'DELETE', path: '/carts/7?force=1', headers: { 'X-Request-Id': 'req-77' } }));
  assert.equal(res.status, 200, 'Node answers 400 to a malformed request: check CRLF line endings and the Host header');
  assert.deepEqual(seen, { method: 'DELETE', url: '/carts/7?force=1', host: `127.0.0.1:${port}`, connection: 'close', id: 'req-77', version: '1.1' });
  assert.equal(res.headers.connection, 'close');
});

test('a POST body is sent with Content-Length in bytes, for text and for binary data', async () => {
  const port = await httpServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    res.end(JSON.stringify({ length: req.headers['content-length'], hex: body.toString('hex') }));
  });
  const text = 'चाय ×2 = ₹40';
  const a = JSON.parse((await within(rawRequest({ port, method: 'POST', path: '/orders', headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: text }))).body);
  assert.equal(a.length, String(Buffer.byteLength(text)), 'Content-Length counts bytes');
  assert.equal(a.hex, Buffer.from(text).toString('hex'));
  const bin = Buffer.from([0, 13, 10, 255, 128]);
  const b = JSON.parse((await within(rawRequest({ port, method: 'PUT', path: '/blob', body: bin }))).body);
  assert.deepEqual(b, { length: '5', hex: '000d0aff80' });
});

test('status texts with spaces and error statuses resolve normally', async () => {
  const port = await httpServer((req, res) => {
    res.statusCode = 404;
    res.statusMessage = 'Order Not Found';
    res.end('{"error":"no such order"}');
  });
  const res = await within(rawRequest({ port, path: '/orders/nope' }));
  assert.equal(res.status, 404);
  assert.equal(res.statusText, 'Order Not Found');
  assert.equal(res.body.toString(), '{"error":"no such order"}');
});

test('a chunked response from a Node server is decoded', async () => {
  const port = await httpServer(async (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.write('Invoice 2041\n');
    await wait(20);
    res.write('Total: ₹');
    await wait(20);
    res.end('1250\n');
  });
  const res = await within(rawRequest({ port, path: '/invoice' }));
  assert.equal(res.headers['transfer-encoding'], 'chunked');
  assert.equal(res.body.toString('utf8'), 'Invoice 2041\nTotal: ₹1250\n');
});

test('the whole response is read, even when it arrives a few bytes at a time', async () => {
  const body = 'Lassi ₹40, Samosa ₹15';
  const response = Buffer.from(`HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`);
  const port = await rawServer(async (socket) => {
    for (let i = 0; i < response.length; i += 3) {
      socket.write(response.subarray(i, i + 3));
      await wait(2);
    }
    socket.end();
  });
  const res = await within(rawRequest({ port }));
  assert.equal(res.status, 200);
  assert.equal(res.headers['content-type'], 'text/plain');
  assert.equal(res.body.toString('utf8'), body);
});

test('chunk extensions, upper-case hex and split chunks are handled', async () => {
  const data = 'x'.repeat(26);
  const response = `HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n1A;source=cache\r\n${data}\r\n3\r\n₹\r\n0\r\n\r\n`;
  const bytes = Buffer.from(response);
  const port = await rawServer(async (socket) => {
    socket.write(bytes.subarray(0, 60));
    await wait(20);
    socket.end(bytes.subarray(60));
  });
  const res = await within(rawRequest({ port }));
  assert.equal(res.body.toString('utf8'), data + '₹');
});

test('repeated headers are joined with ", " and values are trimmed', async () => {
  const port = await rawServer((socket) => {
    socket.end('HTTP/1.1 200 OK\r\nX-Tag: sale\r\nx-tag: new\r\nX-Pad:    spaced out   \r\nContent-Length: 2\r\n\r\nok');
  });
  const res = await within(rawRequest({ port }));
  assert.equal(res.headers['x-tag'], 'sale, new');
  assert.equal(res.headers['x-pad'], 'spaced out');
  assert.equal(res.body.toString(), 'ok');
});

test('without Content-Length or chunked, the body is everything until the server closes', async () => {
  const port = await rawServer(async (socket) => {
    socket.write('HTTP/1.1 200 OK\r\nContent-Type: text/csv\r\n\r\nid,total\n');
    await wait(30);
    socket.end('A-1,250\n');
  });
  const res = await within(rawRequest({ port }));
  assert.equal(res.body.toString(), 'id,total\nA-1,250\n');
});

test('Content-Length decides where the body ends; a HEAD response has no body', async () => {
  const port = await rawServer((socket, request) => {
    if (request.startsWith('HEAD ')) socket.end('HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\n');
    else socket.end('HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhello, and some junk');
  });
  assert.equal((await within(rawRequest({ port }))).body.toString(), 'hello');
  const head = await within(rawRequest({ port, method: 'HEAD' }));
  assert.equal(head.status, 200);
  assert.equal(head.body.length, 0);
});

test('a response that ends too early rejects with "incomplete response"', async () => {
  const replies = [
    'HTTP/1.1 200 OK\r\nContent-Length: 50\r\n\r\nonly a part',
    'HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n',
    'HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nhel',
  ];
  for (const reply of replies) {
    const port = await rawServer((socket) => socket.end(reply));
    const err = await rejection(rawRequest({ port }));
    assert.equal(err.message, 'incomplete response', JSON.stringify(reply));
  }
});

test('a refused connection rejects with the ECONNREFUSED error', async () => {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  server.close();
  await once(server, 'close');
  const err = await rejection(rawRequest({ port }));
  assert.equal(err.code, 'ECONNREFUSED');
});

test('a server that never answers: rejects with ETIMEDOUT and closes the socket', async () => {
  let serverSide;
  let markClosed;
  const closed = new Promise((resolve) => (markClosed = resolve));
  const port = await rawServer((socket) => {
    serverSide = socket; // accept the request and never answer
    socket.on('close', markClosed);
  });
  const started = Date.now();
  const err = await rejection(rawRequest({ port, timeout: 300 }), 3000);
  assert.equal(err.code, 'ETIMEDOUT');
  assert.equal(err.message, 'request timed out');
  assert.ok(Date.now() - started >= 250, 'rejected before the timeout');
  assert.ok(serverSide, 'the request head should have reached the server');
  await within(closed, 2000);
});

test('the timeout is an idle timeout: a slow response that keeps sending bytes succeeds', async () => {
  const body = 'tick tick tick tick tick';
  const response = Buffer.from(`HTTP/1.1 200 OK\r\nContent-Length: ${body.length}\r\n\r\n${body}`);
  const port = await rawServer(async (socket) => {
    const step = Math.ceil(response.length / 6);
    for (let i = 0; i < response.length; i += step) {
      socket.write(response.subarray(i, i + step)); // a piece every 150 ms: about 900 ms in total
      await wait(150);
    }
    socket.end();
  });
  const res = await within(rawRequest({ port, timeout: 400 }), 3000);
  assert.equal(res.body.toString(), body, 'no 400 ms gap without bytes, so this must not time out');
});
