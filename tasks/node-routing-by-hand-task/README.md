# Task: node-routing-by-hand-task

Build a small **router** for a raw `node:http` server: the part of a web framework that looks at the method and the
path of each request and picks the function that answers it. You get a working server and a router that only
handles exact paths. Make it handle parameters, query strings, 404, 405 and crashes the way real APIs do.

```text
tasks/node-routing-by-hand-task/
  index.js         <- createRouter (you finish it), sendJson (done) and a demo server
  index.test.js    <- the tests (do not change)
```

## What to do

Open `index.js`. `createRouter()` returns an object with two methods:

- `add(method, pattern, handler)` registers a route and returns the router, so calls can be chained.
- `handle(req, res)` answers one request. It returns a promise that settles when the handler has finished.

The handler is called as `handler(req, res, { params, query })`.

1. **Match the path, not the whole URL.** `req.url` holds the path and the query string (`/orders?page=2`). Parse it
   with `new URL(req.url, 'http://localhost')` and match only `pathname`. Pass `query` to the handler: the URL's
   `searchParams` (a `URLSearchParams`).
2. **Parameters.** A pattern is split into segments at `/`. A literal segment (`orders`) must be equal (case matters).
   A segment that starts with `:` (`:id`) matches any **one non-empty** segment and goes into `params` under that name.
   The number of segments must be the same, so `/orders/7/items` and `/orders/` do not match `/orders/:id`.
   - Decode each parameter with `decodeURIComponent`: `/orders/caf%C3%A9` gives `params.id === 'café'`, and
     `/orders/a%2Fb` gives `'a/b'` (an encoded `/` stays inside the segment).
   - If a parameter cannot be decoded (`/orders/%E0%A4%A`), answer **400** with `{ "error": "Bad Request" }`.
3. **Order.** Routes are tried in the order they were added; the first one whose method and path match wins. So
   `GET /orders/export` added before `GET /orders/:id` answers `/orders/export`.
4. **404 or 405.**
   - No route has a matching path: **404** with `{ "error": "Not Found" }`.
   - Some route has a matching path, but none with this method: **405** with `{ "error": "Method Not Allowed" }`
     and an `Allow` header listing the methods that do work for this path, in the order they were added, without
     duplicates, joined with `", "`. HTTP requires the `Allow` header on every 405.
5. **HEAD.** A `HEAD` request uses the `GET` route for the same path when there is no `HEAD` route (Node leaves out
   the body for you). In an `Allow` header, `HEAD` comes right after `GET` whenever `GET` is in the list.
   For example, with `GET` and `DELETE` routes for `/orders/:id`, `PUT /orders/7` gets `Allow: GET, HEAD, DELETE`.
6. **Crashes.** If a handler throws or its promise rejects, answer **500** with
   `{ "error": "Internal Server Error" }` (if nothing was sent yet), so the server keeps running. `handle` must not
   reject.

Every error answer is JSON with `Content-Type: application/json; charset=utf-8`. `sendJson` in `index.js` already
does that; use it.

## Rules

- Only `node:` built-ins. No npm packages.
- Do not compare against the raw `req.url`, and do not use regular expressions built from the pattern text without
  escaping it. Splitting at `/` is enough.

## Try it

```
node tasks/node-routing-by-hand-task/index.js
curl -i 'http://localhost:3000/orders/42?expand=items'
curl -i -X PUT http://localhost:3000/orders/42
```

## Check your work

```
npm run task -- node-routing-by-hand-task
```

When all tests pass, commit and push your branch `task/node-routing-by-hand-task`.
