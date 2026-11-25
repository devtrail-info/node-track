// Task: node-http-project. Read README.md in this folder.
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Sends `data` as JSON (done). */
function sendJson(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

// TODO 1: storage: load { nextId, bookmarks } from `file` (missing = empty), save atomically, one change at a time.
// TODO 2: read and check the JSON body (415, 413 + Connection: close, 400).
// TODO 3: validate a bookmark (422) and refuse duplicate urls (409).
// TODO 4: the routes: GET/POST /bookmarks, GET/DELETE /bookmarks/:id, 404, 405 with Allow, HEAD, 500.
export function createBookmarksServer({ file, limit = 10_000 } = {}) {
  return http.createServer((req, res) => {
    sendJson(res, 404, { error: 'Not Found' });
  });
}

// node tasks/node-http-project/index.js  (PORT and BOOKMARKS_FILE are optional)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = process.env.BOOKMARKS_FILE ?? path.resolve('bookmarks.json');
  const server = createBookmarksServer({ file });
  server.listen(Number(process.env.PORT ?? 3000), () => {
    console.log(`bookmarks API on http://localhost:${server.address().port} (data in ${file})`);
  });
}
