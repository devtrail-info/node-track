// Task: node-graceful-shutdown-task. Read README.md in this folder.
import http from 'node:http';
import { fileURLToPath } from 'node:url';

// The orders API. It is done: do not change what it answers.
export function createOrdersServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/report') {
      const ms = Number(url.searchParams.get('ms') ?? 1000); // a slow report
      await new Promise((resolve) => setTimeout(resolve, ms));
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ report: 'done', ms }));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/health') {
      res.end('ok');
      return;
    }
    res.statusCode = 404;
    res.end('not found');
  });
}

export function createShutdown(server, { timeoutMs = 10_000, log = console.log, onClose = async () => {} } = {}) {
  // TODO: keep track of the requests in flight

  return function shutdown(signal) {
    // TODO: the whole shutdown (README steps 1 to 6). For now it stops at once.
    log(`${signal} received: shutting down`);
    server.closeAllConnections();
    server.close();
    return Promise.resolve(0);
  };
}

function main() {
  const server = createOrdersServer();
  const shutdown = createShutdown(server, { timeoutMs: Number(process.env.SHUTDOWN_TIMEOUT_MS ?? 10_000) });
  server.listen(Number(process.env.PORT ?? 3000), () => {
    console.log(`listening on ${server.address().port}`);
  });
  // TODO: SIGTERM and SIGINT (README step 7)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
