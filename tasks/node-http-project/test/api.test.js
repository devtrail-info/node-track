import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupRoot, cleanup, freshFile, start, raw, JSON_TYPE, sample, createBookmarksServer } from './helpers.js';

before(setupRoot);
after(cleanup);

test('createBookmarksServer returns a server that is not listening yet', async () => {
  const server = createBookmarksServer({ file: await freshFile() });
  assert.equal(typeof server.listen, 'function');
  assert.equal(server.listening, false);
});

test('POST /bookmarks creates a bookmark: 201, Location and the stored fields', async () => {
  const { api } = await start({ file: await freshFile() });
  const before = Date.now();
  const r = await api('POST', '/bookmarks', { ...sample, title: '  Node docs  ', extra: 'ignored' });
  assert.equal(r.status, 201);
  assert.equal(r.headers.get('content-type'), JSON_TYPE);
  assert.equal(r.headers.get('location'), '/bookmarks/1');
  const { createdAt, ...rest } = r.json;
  assert.deepEqual(rest, { id: 1, url: sample.url, title: 'Node docs', tags: ['node', 'docs'] });
  assert.equal(typeof createdAt, 'string');
  assert.equal(new Date(createdAt).toISOString(), createdAt, 'createdAt is an ISO string');
  assert.ok(Date.parse(createdAt) >= before - 1000 && Date.parse(createdAt) <= Date.now() + 1000);

  const second = await api('POST', '/bookmarks', { url: 'http://example.com/a', title: 'A' });
  assert.equal(second.status, 201);
  assert.equal(second.json.id, 2);
  assert.deepEqual(second.json.tags, [], 'tags default to []');
  assert.equal(second.headers.get('location'), '/bookmarks/2');
});

test('GET /bookmarks lists all bookmarks oldest first and filters by ?tag=', async () => {
  const { api } = await start({ file: await freshFile() });
  assert.deepEqual((await api('GET', '/bookmarks')).json, []);
  await api('POST', '/bookmarks', { url: 'https://a.example/', title: 'A', tags: ['node'] });
  await api('POST', '/bookmarks', { url: 'https://b.example/', title: 'B', tags: ['web'] });
  await api('POST', '/bookmarks', { url: 'https://c.example/', title: 'C', tags: ['web', 'node'] });
  const all = await api('GET', '/bookmarks');
  assert.equal(all.status, 200);
  assert.equal(all.headers.get('content-type'), JSON_TYPE);
  assert.deepEqual(all.json.map((b) => b.title), ['A', 'B', 'C']);
  assert.deepEqual((await api('GET', '/bookmarks?tag=node')).json.map((b) => b.title), ['A', 'C']);
  assert.deepEqual((await api('GET', '/bookmarks?tag=nope')).json, []);
});

test('GET and DELETE /bookmarks/:id, with 404 for unknown or malformed ids', async () => {
  const { api } = await start({ file: await freshFile() });
  await api('POST', '/bookmarks', sample);
  const one = await api('GET', '/bookmarks/1');
  assert.equal(one.status, 200);
  assert.equal(one.json.url, sample.url);
  assert.equal((await api('GET', '/bookmarks/1?expand=all')).status, 200, 'the query does not affect matching');

  for (const id of ['2', 'abc', '0', '01', '1.5', '-1', '1e0']) {
    const r = await api('GET', `/bookmarks/${id}`);
    assert.equal(r.status, 404, id);
    assert.equal(typeof r.json?.error, 'string', id);
    assert.equal(r.headers.get('content-type'), JSON_TYPE, id);
  }

  const del = await api('DELETE', '/bookmarks/1');
  assert.equal(del.status, 204);
  assert.equal(del.text, '');
  assert.equal((await api('GET', '/bookmarks/1')).status, 404);
  assert.equal((await api('DELETE', '/bookmarks/1')).status, 404);
  assert.deepEqual((await api('GET', '/bookmarks')).json, []);
});

test('unknown paths get 404 and known paths with the wrong method get 405 with Allow', async () => {
  const { api } = await start({ file: await freshFile() });
  for (const p of ['/', '/bookmark', '/bookmarks/', '/bookmarks/1/notes']) {
    const r = await api('GET', p);
    assert.equal(r.status, 404, p);
    assert.equal(typeof r.json?.error, 'string', p);
  }
  const put = await api('PUT', '/bookmarks', sample);
  assert.equal(put.status, 405);
  assert.equal(put.headers.get('allow'), 'GET, HEAD, POST');
  assert.equal(typeof put.json?.error, 'string');
  const patch = await api('PATCH', '/bookmarks/1', sample);
  assert.equal(patch.status, 405);
  assert.equal(patch.headers.get('allow'), 'GET, HEAD, DELETE');
});

test('HEAD works where GET does and has no body', async () => {
  const { api } = await start({ file: await freshFile() });
  await api('POST', '/bookmarks', sample);
  const list = await api('HEAD', '/bookmarks');
  assert.equal(list.status, 200);
  assert.equal(list.text, '');
  assert.equal(list.headers.get('content-type'), JSON_TYPE);
  assert.equal((await api('HEAD', '/bookmarks/1')).status, 200);
  assert.equal((await api('HEAD', '/bookmarks/9')).status, 404);
});

test('POST rejects other content types with 415 and broken JSON with 400', async () => {
  const { api } = await start({ file: await freshFile() });
  const form = await api('POST', '/bookmarks', 'url=https://a.example', { 'Content-Type': 'application/x-www-form-urlencoded' });
  assert.equal(form.status, 415);
  const text = await api('POST', '/bookmarks', JSON.stringify(sample), { 'Content-Type': 'text/plain' });
  assert.equal(text.status, 415);
  const ok = await api('POST', '/bookmarks', JSON.stringify(sample), { 'Content-Type': 'Application/JSON; charset=UTF-8' });
  assert.equal(ok.status, 201, 'parameters and letter case are fine');
  for (const body of ['{"url":', '', 'nope']) {
    const r = await api('POST', '/bookmarks', body, { 'Content-Type': 'application/json' });
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.equal(typeof r.json?.error, 'string');
  }
});

test('POST validates the bookmark with 422', async () => {
  const { api } = await start({ file: await freshFile() });
  const bad = [
    null,
    [],
    'https://a.example',
    {},
    { title: 'No url' },
    { url: 'not a url', title: 'x' },
    { url: 'ftp://files.example/a', title: 'x' },
    { url: 'javascript:alert(1)', title: 'x' },
    { url: 42, title: 'x' },
    { url: 'https://a.example/', title: '   ' },
    { url: 'https://a.example/', title: 7 },
    { url: 'https://a.example/', title: 'x'.repeat(201) },
    { url: 'https://a.example/', title: 'x', tags: 'node' },
    { url: 'https://a.example/', title: 'x', tags: [''] },
    { url: 'https://a.example/', title: 'x', tags: ['  '] },
    { url: 'https://a.example/', title: 'x', tags: [1] },
    { url: 'https://a.example/', title: 'x', tags: ['t'.repeat(31)] },
    { url: 'https://a.example/', title: 'x', tags: Array.from({ length: 11 }, (_, i) => 't' + i) },
  ];
  for (const body of bad) {
    const r = await api('POST', '/bookmarks', JSON.stringify(body));
    assert.equal(r.status, 422, JSON.stringify(body));
    assert.equal(typeof r.json?.error, 'string', JSON.stringify(body));
  }
  assert.equal((await api('POST', '/bookmarks', { url: 'https://a.example/', title: 'x'.repeat(200), tags: Array.from({ length: 10 }, (_, i) => 't'.repeat(29) + i) })).status, 201, 'the limits themselves are allowed');
  assert.deepEqual((await api('GET', '/bookmarks')).json.length, 1, 'nothing invalid was stored');
});

test('POST with an existing url gets 409', async () => {
  const { api } = await start({ file: await freshFile() });
  assert.equal((await api('POST', '/bookmarks', sample)).status, 201);
  const dup = await api('POST', '/bookmarks', { ...sample, title: 'Same link again' });
  assert.equal(dup.status, 409);
  assert.equal(typeof dup.json?.error, 'string');
  assert.equal((await api('GET', '/bookmarks')).json.length, 1);
});

test('a body over the limit gets 413 with Connection: close, by Content-Length or while counting', async () => {
  const { api, port } = await start({ file: await freshFile(), limit: 200 });
  const head = await raw(port, ['POST /bookmarks HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: 100000\r\n\r\n']);
  assert.match(head.data, /^HTTP\/1\.1 413 /, 'answer at once, without waiting for 100000 bytes');
  assert.match(head.data, /\r\nconnection: close\r\n/i);
  assert.equal(head.closed, true);

  const chunk = '64\r\n' + ' '.repeat(100) + '\r\n';
  const chunked = await raw(port, ['POST /bookmarks HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n', chunk, chunk, chunk, chunk]);
  assert.match(chunked.data, /^HTTP\/1\.1 413 /);
  assert.match(chunked.data, /\r\nconnection: close\r\n/i);
  assert.equal(chunked.closed, true);

  const small = await api('POST', '/bookmarks', sample);
  assert.equal(small.status, 201, 'a body under the limit still works');
  const body = Buffer.from(JSON.stringify('é'.repeat(150))); // 152 characters, 302 bytes
  const multibyte = await raw(port, [
    'POST /bookmarks HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n',
    Buffer.concat([Buffer.from(body.length.toString(16) + '\r\n'), body, Buffer.from('\r\n0\r\n\r\n')]),
  ]);
  assert.match(multibyte.data, /^HTTP\/1\.1 413 /, 'the limit counts bytes, not characters');
});

test('the default limit is 10000 bytes', async () => {
  const { api } = await start({ file: await freshFile() });
  const r = await api('POST', '/bookmarks', { ...sample, note: 'x'.repeat(10_000) });
  assert.equal(r.status, 413);
  const ok = await api('POST', '/bookmarks', { ...sample, note: 'x'.repeat(9_000) });
  assert.equal(ok.status, 201);
});
