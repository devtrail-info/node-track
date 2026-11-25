// Task: node-json-bodies-task. Read README.md in this folder.
import http from 'node:http';
import { fileURLToPath } from 'node:url';

/** An error that carries the HTTP status to answer with (done). */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

// TODO 1: check the content type and the size, read the chunks, parse once at the end.
export async function readJsonBody(req, { limit = 100_000 } = {}) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return JSON.parse(body);
}

// TODO 2: POST /orders with 201 + Location, 4xx errors as JSON, 404 for everything else.
export function createOrderServer({ limit = 1000 } = {}) {
  return http.createServer(async (req, res) => {
    try {
      const order = await readJsonBody(req, { limit });
      res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(order));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  });
}

// A demo server: node tasks/node-json-bodies-task/index.js
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = createOrderServer();
  server.listen(Number(process.env.PORT ?? 3000), () => {
    console.log(`listening on http://localhost:${server.address().port}`);
  });
}
