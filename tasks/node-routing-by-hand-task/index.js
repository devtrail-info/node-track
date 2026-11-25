// Task: node-routing-by-hand-task. Read README.md in this folder.
import http from 'node:http';
import { fileURLToPath } from 'node:url';

/** Sends `data` as JSON with the given status (done: you do not need to change it). */
export function sendJson(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

export function createRouter() {
  const routes = [];
  return {
    add(method, pattern, handler) {
      routes.push({ method, pattern, handler });
      return this;
    },
    // TODO: match the pathname (not req.url), :params, 400, 404 vs 405 with Allow, HEAD, and 500 on crashes.
    async handle(req, res) {
      const route = routes.find((r) => r.method === req.method && r.pattern === req.url);
      if (!route) return sendJson(res, 404, { error: 'Not Found' });
      await route.handler(req, res, { params: {}, query: new URLSearchParams() });
    },
  };
}

// A demo server: node tasks/node-routing-by-hand-task/index.js
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const orders = new Map([['42', { id: '42', items: ['MUG-1'], status: 'paid' }]]);
  const router = createRouter()
    .add('GET', '/orders', (req, res, { query }) => sendJson(res, 200, { page: Number(query.get('page') ?? 1), orders: [...orders.values()] }))
    .add('GET', '/orders/:id', (req, res, { params }) => {
      const order = orders.get(params.id);
      if (!order) return sendJson(res, 404, { error: 'Not Found' });
      sendJson(res, 200, order);
    })
    .add('DELETE', '/orders/:id', (req, res, { params }) => {
      orders.delete(params.id);
      res.writeHead(204).end();
    });
  const server = http.createServer((req, res) => router.handle(req, res));
  server.listen(Number(process.env.PORT ?? 3000), () => {
    console.log(`listening on http://localhost:${server.address().port}`);
  });
}
