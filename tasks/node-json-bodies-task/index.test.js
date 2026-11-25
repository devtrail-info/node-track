import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { Readable } from 'node:stream';
import * as mod from './index.js';

// Works with named exports and with `export default { readJsonBody, createOrderServer, HttpError }`.
const readJsonBody = mod.readJsonBody ?? mod.default?.readJsonBody;
const createOrderServer = mod.createOrderServer ?? mod.default?.createOrderServer;

/** A request-like Readable: Buffer chunks plus a headers object. Records whether anything was read. */
function fakeReq(chunks, headers = { 'content-type': 'application/json' }) {
  const list = chunks.map((c) => (Buffer.isBuffer(c) ? c : Buffer.from(c)));
  let i = 0;
  const req = new Readable({
    read() {
      req.wasRead = true;
      this.push(i < list.length ? list[i++] : null);
    },
  });
  req.wasRead = false;
  req.headers = headers;
  return req;
}

/** A request whose body never ends: 100-byte chunks forever (destroyed after the tests). */
const endless = [];
function endlessReq(headers = { 'content-type': 'application/json' }) {
  const req = new Readable({
    read() {
      setImmediate(() => {
        if (!this.destroyed) this.push(Buffer.alloc(100, 0x20));
      });
    },
  });
  req.on('error', () => {});
  req.headers = headers;
  endless.push(req);
  return req;
}
after(() => {
  for (const req of endless) req.destroy();
});

const within = (p, ms = 2000) =>
  Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error(`did not settle within ${ms} ms`)), ms))]);

async function rejection(p) {
  try {
    await within(p);
  } catch (err) {
    return err;
  }
  assert.fail('expected the promise to reject');
}

test('readJsonBody parses a body split into several chunks', async () => {
  assert.deepEqual(await within(readJsonBody(fakeReq(['{"items":', '[{"sku":"MUG-1",', '"qty":2}]}']))), { items: [{ sku: 'MUG-1', qty: 2 }] });
  assert.deepEqual(await within(readJsonBody(fakeReq(['[1,2,3]']))), [1, 2, 3]);
});

test('readJsonBody decodes once at the end: a character split across chunks survives', async () => {
  const bytes = Buffer.from('{"note":"Total ₹500"}');
  const cut = bytes.indexOf(0xe2) + 1; // inside the 3-byte ₹
  const body = await within(readJsonBody(fakeReq([bytes.subarray(0, cut), bytes.subarray(cut)])));
  assert.deepEqual(body, { note: 'Total ₹500' });
});

test('readJsonBody accepts parameters and any letter case in the content type', async () => {
  for (const type of ['application/json; charset=utf-8', 'Application/JSON', ' application/json ;charset=UTF-8']) {
    assert.deepEqual(await within(readJsonBody(fakeReq(['{"ok":true}'], { 'content-type': type }))), { ok: true }, type);
  }
});

test('readJsonBody rejects other or missing content types with 415, without reading the body', async () => {
  for (const headers of [{ 'content-type': 'text/plain' }, { 'content-type': 'application/x-www-form-urlencoded' }, { 'content-type': 'application/jsonp' }, {}]) {
    const req = fakeReq(['{"ok":true}'], headers);
    const err = await rejection(readJsonBody(req));
    assert.equal(err.status, 415, JSON.stringify(headers));
    assert.equal(err.message, 'Content-Type must be application/json');
    assert.equal(req.wasRead, false, 'the body must not be read for a 415');
  }
});

test('readJsonBody rejects a too-big content-length with 413, without reading the body', async () => {
  const req = fakeReq(['{}'], { 'content-type': 'application/json', 'content-length': '5000' });
  const err = await rejection(readJsonBody(req, { limit: 1000 }));
  assert.equal(err.status, 413);
  assert.equal(err.message, 'Body is larger than 1000 bytes');
  assert.equal(req.wasRead, false, 'the body must not be read when content-length is too big');
});

test('readJsonBody counts bytes, not characters, and allows exactly limit bytes', async () => {
  const exact = '"' + 'a'.repeat(98) + '"'; // 100 bytes
  assert.equal(await within(readJsonBody(fakeReq([exact]), { limit: 100 })), 'a'.repeat(98));
  const rupees = '"' + '₹'.repeat(40) + '"'; // 42 characters, 122 bytes
  const err = await rejection(readJsonBody(fakeReq([rupees]), { limit: 100 }));
  assert.equal(err.status, 413);
});

test('readJsonBody rejects with 413 as soon as an endless body passes the limit', async () => {
  const err = await rejection(readJsonBody(endlessReq(), { limit: 1000 }));
  assert.equal(err.status, 413);
  assert.equal(err.message, 'Body is larger than 1000 bytes');
});

test('readJsonBody uses a default limit of 100000 bytes', async () => {
  const ok = '"' + 'a'.repeat(99_998) + '"';
  assert.equal((await within(readJsonBody(fakeReq([ok])))).length, 99_998);
  const err = await rejection(readJsonBody(fakeReq([ok + ' '])));
  assert.equal(err.status, 413);
});

test('readJsonBody rejects an empty body and invalid JSON with 400', async () => {
  const empty = await rejection(readJsonBody(fakeReq([])));
  assert.equal(empty.status, 400);
  assert.equal(empty.message, 'Request body is empty');
  for (const text of ['{"items":', "{'a':1}", 'undefined']) {
    const err = await rejection(readJsonBody(fakeReq([text])));
    assert.equal(err.status, 400, text);
    assert.equal(err.message, 'Invalid JSON', text);
  }
});

test('readJsonBody rejects with the stream error itself', async () => {
  const req = new Readable({
    read() {
      this.destroy(new Error('socket hang up'));
    },
  });
  req.headers = { 'content-type': 'application/json' };
  const err = await rejection(readJsonBody(req));
  assert.equal(err.message, 'socket hang up');
});

// ---- the server ----

let server;
let base;
let port;
before(async () => {
  server = createOrderServer({ limit: 1000 });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
  base = `http://127.0.0.1:${port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

async function post(body, headers = { 'Content-Type': 'application/json' }, path = '/orders') {
  const res = await fetch(base + path, { method: 'POST', headers, body, signal: AbortSignal.timeout(3000) });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, headers: res.headers, json };
}

/** Sends raw bytes on a fresh connection and collects the reply until the server closes it (or ms pass). */
function raw(parts, ms = 1500) {
  return new Promise((resolve) => {
    const s = net.connect(port, '127.0.0.1');
    let data = '';
    let closed = false;
    s.on('data', (d) => (data += d));
    s.on('error', () => {});
    s.on('close', () => {
      closed = true;
      resolve({ data, closed });
    });
    for (const p of parts) s.write(p);
    setTimeout(() => {
      if (!closed) {
        resolve({ data, closed: false });
        s.destroy();
      }
    }, ms);
  });
}

test('POST /orders creates an order: 201, Location and the body', async () => {
  const first = await post(JSON.stringify({ items: [{ sku: 'MUG-1', qty: 2 }, { sku: 'TEA-9', qty: 3 }] }));
  assert.equal(first.status, 201);
  assert.equal(first.headers.get('content-type'), 'application/json; charset=utf-8');
  const id = first.json.id;
  assert.equal(first.headers.get('location'), `/orders/${id}`);
  assert.deepEqual(first.json, { id, items: [{ sku: 'MUG-1', qty: 2 }, { sku: 'TEA-9', qty: 3 }], totalQty: 5 });
  const second = await post(JSON.stringify({ items: [{ sku: 'MUG-1', qty: 1 }] }), { 'Content-Type': 'application/json; charset=utf-8' });
  assert.equal(second.status, 201);
  assert.equal(second.json.id, id + 1);
  assert.equal(second.headers.get('location'), `/orders/${id + 1}`);
});

test('the server answers 415, 400 and 422 as JSON', async () => {
  const form = await post('sku=MUG-1&qty=2', { 'Content-Type': 'application/x-www-form-urlencoded' });
  assert.equal(form.status, 415);
  assert.deepEqual(form.json, { error: 'Content-Type must be application/json' });

  const broken = await post('{"items":');
  assert.equal(broken.status, 400);
  assert.deepEqual(broken.json, { error: 'Invalid JSON' });

  for (const body of [{}, [], { items: [] }, { items: [{ sku: '', qty: 1 }] }, { items: [{ sku: 'MUG-1', qty: 0 }] }, { items: [{ sku: 'MUG-1', qty: 1.5 }] }, { items: [{ sku: 'MUG-1', qty: '2' }] }, { items: [null] }, { items: 'MUG-1' }]) {
    const r = await post(JSON.stringify(body));
    assert.equal(r.status, 422, JSON.stringify(body));
    assert.equal(typeof r.json?.error, 'string', JSON.stringify(body));
    assert.equal(r.headers.get('content-type'), 'application/json; charset=utf-8');
  }
  const nullBody = await post('null');
  assert.equal(nullBody.status, 422, 'null is valid JSON but not an order');
});

test('other paths and methods get 404 JSON', async () => {
  const getRes = await fetch(base + '/orders', { signal: AbortSignal.timeout(3000) });
  assert.equal(getRes.status, 404);
  assert.deepEqual(await getRes.json(), { error: 'Not Found' });
  const other = await post('{}', { 'Content-Type': 'application/json' }, '/invoices');
  assert.equal(other.status, 404);
});

test('a too-big content-length gets 413 with Connection: close before any body is sent', async () => {
  const r = await raw(['POST /orders HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: 5000\r\n\r\n']);
  assert.match(r.data, /^HTTP\/1\.1 413 /, 'the answer must come without waiting for the 5000 bytes');
  assert.match(r.data, /\r\nconnection: close\r\n/i);
  assert.ok(r.data.includes('{"error":"Body is larger than 1000 bytes"}'), r.data);
  assert.equal(r.closed, true, 'the server should close the connection after a 413');
});

test('a chunked body that grows past the limit gets 413 and the connection is closed', async () => {
  const head = 'POST /orders HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n';
  const chunk = '100\r\n' + ' '.repeat(256) + '\r\n'; // 256 bytes each, never finished
  const r = await raw([head, ...Array(8).fill(chunk)]);
  assert.match(r.data, /^HTTP\/1\.1 413 /);
  assert.match(r.data, /\r\nconnection: close\r\n/i);
  assert.equal(r.closed, true, 'the server should close the connection after a 413');
  const ok = await post(JSON.stringify({ items: [{ sku: 'MUG-1', qty: 1 }] }));
  assert.equal(ok.status, 201, 'the server keeps working after a 413');
});
