# Task: node-http-over-tcp-task

Make an HTTP request with nothing but a TCP socket from `node:net`: write the request text yourself, read the
bytes that come back, and turn them into a status, headers and a body. This is what `fetch` and every HTTP client
library do underneath, and what you need when you debug a proxy, a load balancer or a strange server by hand.

```text
tasks/node-http-over-tcp-task/
  index.js         <- rawRequest (you write it)
  index.test.js    <- the tests (do not change)
```

## What to do

Open `index.js` and write
`rawRequest({ host = '127.0.0.1', port, method = 'GET', path = '/', headers = {}, body, timeout = 5000 })`. It
returns a promise of `{ status, statusText, headers, body }`.

1. **Connect** with `net.connect({ host, port })`.
2. **Send the request.** Every line ends with `\r\n`:
   - the request line `<method> <path> HTTP/1.1`
   - `Host: <host>:<port>`
   - `Connection: close` (so the server closes the connection after its answer)
   - one `Name: value` line for each entry of `headers`, in order (names and values are plain ASCII)
   - when `body` is given (a string, sent as UTF-8, or a Buffer): `Content-Length: <size in bytes>`
   - an empty line, then the body bytes.

   ```text
   POST /orders HTTP/1.1
   Host: 127.0.0.1:3000
   Connection: close
   Content-Type: text/plain; charset=utf-8
   Content-Length: 21

   चाय ×2 = ₹40
   ```
3. **Read until the server closes the connection** (the socket's `'end'`). One `'data'` chunk is not one response.
4. **Parse the head** (everything before the first `\r\n\r\n`):
   - the status line `HTTP/1.1 404 Order Not Found` gives `status: 404` (a number) and `statusText: 'Order Not Found'`
     (everything after the code; it may contain spaces)
   - `headers` is an object with **lower-case** names and trimmed values; a header that appears twice is joined with
     `', '` (`X-Tag: sale` and `x-tag: new` give `{ 'x-tag': 'sale, new' }`)
5. **Find the body** (always a Buffer):
   - for a `HEAD` request, or status 204 or 304: an empty Buffer
   - `Transfer-Encoding: chunked`: decode the chunks (`<hex size>[;extensions]\r\n<data>\r\n`, ending with size `0`)
   - `Content-Length: n`: exactly the first `n` bytes after the head
   - neither: every byte until the connection closed
6. **Errors:**
   - a socket error rejects with that error (keep its `code`, such as `ECONNREFUSED`)
   - a response that ends before its head is complete, before `Content-Length` bytes, or in the middle of the chunks
     rejects with `new Error('incomplete response')`
   - no activity for `timeout` ms: reject with an `Error` whose message is `'request timed out'` and whose `code` is
     `'ETIMEDOUT'`, and destroy the socket (the idle timer does not close anything by itself)

```js
const res = await rawRequest({ port: 3000, path: '/orders/A-1042' });
res.status;                       // 200
res.headers['content-type'];      // 'application/json; charset=utf-8'
JSON.parse(res.body.toString());  // { id: 'A-1042', total: '₹1250' }
```

## Rules

- Only `node:` built-ins, and only `node:net` for the network: no `http`, no `fetch`.
- Work on Buffers: count and cut bytes, and decode text only where the README says so.
- The promise must settle exactly once.

## Try it

```
node tasks/node-http-over-tcp-task/index.js example.com 80 /
```

## Check your work

```
npm run task -- node-http-over-tcp-task
```

When all tests pass, commit and push your branch `task/node-http-over-tcp-task`.
