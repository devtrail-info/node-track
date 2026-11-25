import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import * as mod from './index.js';

// Works with `export function createRouter` and with `export default { createRouter, sendJson }`.
const createRouter = mod.createRouter ?? mod.default?.createRouter;
const sendJson = mod.sendJson ?? mod.default?.sendJson;

let server;
let base;
const calls = [];

before(async () => {
  const router = createRouter()
    .add('GET', '/', (req, res) => sendJson(res, 200, { home: true }))
    .add('GET', '/orders', (req, res, { query }) => sendJson(res, 200, { page: query.get('page'), tags: query.getAll('tag') }))
    .add('POST', '/orders', (req, res) => sendJson(res, 201, { created: true }))
    .add('GET', '/orders/export', (req, res) => sendJson(res, 200, { export: true }))
    .add('GET', '/orders/:id', (req, res, { params }) => {
      calls.push(req.method + ' ' + params.id);
      sendJson(res, 200, { id: params.id });
    })
    .add('DELETE', '/orders/:id', (req, res) => res.writeHead(204).end())
    .add('GET', '/orders/:id', () => {
      throw new Error('a later duplicate route must never run');
    })
    .add('GET', '/users/:userId/orders/:orderId', (req, res, { params }) => sendJson(res, 200, params))
    .add('PUT', '/reports', (req, res) => sendJson(res, 200, { put: true }))
    .add('POST', '/reports', (req, res) => sendJson(res, 200, { post: true }))
    .add('PUT', '/reports', () => {
      throw new Error('duplicate');
    })
    .add('GET', '/boom', () => {
      throw new Error('handler bug');
    })
    .add('GET', '/boom-async', async () => {
      await new Promise((r) => setTimeout(r, 5));
      throw new Error('async handler bug');
    });
  server = http.createServer((req, res) => {
    const p = router.handle(req, res);
    assert.ok(p && typeof p.then === 'function', 'handle(req, res) must return a promise');
    p.catch((err) => {
      res.destroy();
      throw new Error('handle() rejected: it must answer 500 instead (' + err.message + ')');
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

async function call(method, path) {
  const res = await fetch(base + path, { method, signal: AbortSignal.timeout(3000) });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, headers: res.headers, text, json };
}

test('createRouter returns a router whose add() can be chained', () => {
  const r = createRouter();
  assert.equal(typeof r.add, 'function');
  assert.equal(typeof r.handle, 'function');
  assert.equal(r.add('GET', '/x', () => {}), r);
});

test('a static route answers, including the root path /', async () => {
  assert.deepEqual((await call('GET', '/orders/export')).json, { export: true });
  assert.deepEqual((await call('GET', '/')).json, { home: true });
  assert.deepEqual((await call('POST', '/orders')).json, { created: true });
});

test('the query string is ignored for matching and passed as URLSearchParams', async () => {
  const r = await call('GET', '/orders?page=2&tag=mugs&tag=sale');
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { page: '2', tags: ['mugs', 'sale'] });
  const plain = await call('GET', '/orders');
  assert.deepEqual(plain.json, { page: null, tags: [] });
  const withId = await call('GET', '/orders/42?expand=items');
  assert.deepEqual(withId.json, { id: '42' });
});

test(':params capture one segment each and are decoded', async () => {
  assert.deepEqual((await call('GET', '/orders/42')).json, { id: '42' });
  assert.deepEqual((await call('GET', '/orders/caf%C3%A9')).json, { id: 'café' });
  assert.deepEqual((await call('GET', '/orders/a%2Fb')).json, { id: 'a/b' });
  assert.deepEqual((await call('GET', '/orders/two%20mugs')).json, { id: 'two mugs' });
  assert.deepEqual((await call('GET', '/users/u-7/orders/9')).json, { userId: 'u-7', orderId: '9' });
});

test('routes are tried in order: the first match wins', async () => {
  assert.deepEqual((await call('GET', '/orders/export')).json, { export: true });
  const r = await call('GET', '/orders/77');
  assert.equal(r.status, 200, 'the second GET /orders/:id route must never run');
});

test('a path that no route matches gets 404 JSON', async () => {
  for (const path of ['/nope', '/orders/7/items', '/orders/', '/orders//', '/Orders', '/users/1/orders']) {
    const r = await call('GET', path);
    assert.equal(r.status, 404, path);
    assert.deepEqual(r.json, { error: 'Not Found' }, path);
    assert.equal(r.headers.get('content-type'), 'application/json; charset=utf-8', path);
  }
});

test('a known path with the wrong method gets 405 with an Allow header', async () => {
  const put = await call('PUT', '/orders/7');
  assert.equal(put.status, 405);
  assert.deepEqual(put.json, { error: 'Method Not Allowed' });
  assert.equal(put.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(put.headers.get('allow'), 'GET, HEAD, DELETE');

  const patch = await call('PATCH', '/orders');
  assert.equal(patch.status, 405);
  assert.equal(patch.headers.get('allow'), 'GET, HEAD, POST');

  const del = await call('DELETE', '/reports');
  assert.equal(del.status, 405);
  assert.equal(del.headers.get('allow'), 'PUT, POST', 'no HEAD without GET, no duplicates, in the order added');

  const export405 = await call('POST', '/orders/export');
  assert.equal(export405.headers.get('allow'), 'GET, HEAD, DELETE', 'both /orders/export and /orders/:id match this path');
});

test('HEAD uses the GET route and gets no body', async () => {
  calls.length = 0;
  const r = await call('HEAD', '/orders/5');
  assert.equal(r.status, 200);
  assert.equal(r.text, '');
  assert.deepEqual(calls, ['HEAD 5']);
});

test('a parameter that cannot be decoded gets 400 JSON', async () => {
  const r = await call('GET', '/orders/%E0%A4%A');
  assert.equal(r.status, 400);
  assert.deepEqual(r.json, { error: 'Bad Request' });
  assert.equal(r.headers.get('content-type'), 'application/json; charset=utf-8');
});

test('a handler that throws or rejects gets 500 and the server keeps running', async () => {
  for (const path of ['/boom', '/boom-async']) {
    const r = await call('GET', path);
    assert.equal(r.status, 500, path);
    assert.deepEqual(r.json, { error: 'Internal Server Error' }, path);
  }
  assert.deepEqual((await call('GET', '/orders/1')).json, { id: '1' });
});
