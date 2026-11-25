# Task: node-json-bodies-task

Read JSON request bodies safely on a raw `node:http` server. A body arrives as a stream of chunks, and the client
decides how big it is, what it claims to be and whether it is valid. Your server must answer each kind of bad
body with the right status code, and never keep more than a set number of bytes in memory.

```text
tasks/node-json-bodies-task/
  index.js         <- HttpError (done), readJsonBody and createOrderServer (you write them)
  index.test.js    <- the tests (do not change)
```

## What to do

Open `index.js`.

1. `readJsonBody(req, { limit = 100_000 } = {})` returns a promise of the parsed JSON body. `req` is the request
   (a Readable stream with a `headers` object whose names are lower case). Check, in this order:
   1. **Content type.** Take the `content-type` header up to the first `;`, trim it and lower-case it. If it is
      not `application/json` (or the header is missing), reject with `new HttpError(415, 'Content-Type must be
      application/json')` **without reading the body**. `application/json; charset=utf-8` and `Application/JSON`
      are fine.
   2. **Declared size.** If a `content-length` header is present and its number is bigger than `limit`, reject with
      `new HttpError(413, 'Body is larger than <limit> bytes')` without reading the body.
   3. **Real size.** Read the chunks (Buffers) and count their **bytes**. As soon as the total is bigger than
      `limit`, reject with the same 413 error and stop keeping chunks. Do not wait for the end of the stream: a
      client can send chunks forever (chunked encoding has no `content-length`).
   4. **Parse.** At the end, join the chunks with `Buffer.concat` and decode them as UTF-8 once (a character such as
      `₹` can be split across two chunks). An empty body rejects with `new HttpError(400, 'Request body is
      empty')`; text that `JSON.parse` refuses rejects with `new HttpError(400, 'Invalid JSON')`.
   5. If the stream emits `'error'`, reject with that error.
   A body of exactly `limit` bytes is allowed.
2. `createOrderServer({ limit = 1000 } = {})` returns an `http.Server` (not listening yet) that answers
   `POST /orders`:
   - Read the body with `readJsonBody(req, { limit })`. If it rejects with an `HttpError`, answer its `status` with
     `{ "error": <message> }`. For **413**, also send `Connection: close`, so Node closes the connection instead of
     reading the rest of a huge body.
   - The body must be an object with an `items` array of 1 or more items, each `{ sku, qty }` where `sku` is a
     non-empty string and `qty` a whole number of at least 1. Otherwise answer **422** with `{ "error": ... }`
     (any message).
   - Otherwise answer **201** with a `Location: /orders/<id>` header and the body `{ id, items, totalQty }`. Ids are
     1, 2, 3, ... per server; `totalQty` is the sum of the quantities.
   - Any other method or path: **404** with `{ "error": "Not Found" }`. Any other error: **500** with
     `{ "error": "Internal Server Error" }`.
   - Every answer is JSON with `Content-Type: application/json; charset=utf-8`.

## Rules

- Only `node:` built-ins. No npm packages.
- Do not build the body with `body += chunk`.
- Do not wait for `'end'` before checking the size.

## Try it

```
node tasks/node-json-bodies-task/index.js
curl -i -X POST localhost:3000/orders -H 'Content-Type: application/json' -d '{"items":[{"sku":"MUG-1","qty":2}]}'
curl -i -X POST localhost:3000/orders -H 'Content-Type: application/json' -d '{"items":'
curl -i -X POST localhost:3000/orders -d 'sku=MUG-1'
```

## Check your work

```
npm run task -- node-json-bodies-task
```

When all tests pass, commit and push your branch `task/node-json-bodies-task`.
