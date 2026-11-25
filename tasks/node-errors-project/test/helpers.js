// Test helpers for node-errors-project: a local test server with slow, failing and flaky endpoints.
import http from 'node:http';
import net from 'node:net';
import { once } from 'node:events';
import { after } from 'node:test';
import * as mod from '../index.js';

// Works with named exports and with `export default { fetchAll, formatReport }`.
export const fetchAll = mod.fetchAll ?? mod.default?.fetchAll;
export const formatReport = mod.formatReport ?? mod.default?.formatReport;

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const servers = [];
after(() => {
  for (const server of servers) {
    server.closeAllConnections();
    server.close();
  }
});

/**
 * Starts the test server on 127.0.0.1 and a random port.
 *   /ok/<name>?ms=<n>          200 "hello <name>" after n ms (default 0)
 *   /slow?ms=<n>               200 "slow" after n ms
 *   /status/<code>             that status, body "status <code>"
 *   /flaky/<key>?fail=<n>&status=<s>   the first n requests for <key> get status s (default 503), then 200 "recovered"
 *   /retry-after/<key>         the first request gets 429 with Retry-After: 1, then 200 "thanks for waiting"
 *   /trickle?ms=<n>            200 and the first part of the body at once, the rest after n ms
 *   /reset                     the connection is destroyed without an answer
 * `stats.started` lists every request path in arrival order, `stats.finished` every response sent in full;
 * `stats.peak` is the most requests in progress at once.
 */
export async function startServer() {
  const stats = { started: [], finished: [], active: 0, peak: 0 };
  const counters = new Map();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean);
    stats.started.push(url.pathname + url.search);
    stats.active++;
    stats.peak = Math.max(stats.peak, stats.active);
    let counted = true;
    const done = () => {
      if (counted) stats.active--;
      counted = false;
    };
    res.on('close', done);
    res.on('finish', () => stats.finished.push(url.pathname + url.search));
    const later = (ms, fn) => setTimeout(fn, ms).unref();
    const send = (status, body, headers = {}) => {
      if (res.destroyed) return;
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
      res.end(body);
    };
    const count = (key) => {
      const n = (counters.get(key) ?? 0) + 1;
      counters.set(key, n);
      return n;
    };
    switch (parts[0]) {
      case 'ok':
        return later(Number(url.searchParams.get('ms') ?? 0), () => send(200, `hello ${parts[1]}`));
      case 'slow':
        return later(Number(url.searchParams.get('ms') ?? 1000), () => send(200, 'slow'));
      case 'status':
        return send(Number(parts[1]), `status ${parts[1]}`);
      case 'flaky': {
        const n = count('flaky/' + parts[1]);
        const fail = Number(url.searchParams.get('fail') ?? 1);
        const status = Number(url.searchParams.get('status') ?? 503);
        return n <= fail ? send(status, `failure ${n}`) : send(200, 'recovered');
      }
      case 'retry-after': {
        const n = count('retry-after/' + parts[1]);
        return n === 1 ? send(429, 'slow down', { 'Retry-After': '1' }) : send(200, 'thanks for waiting');
      }
      case 'trickle':
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.write('part ');
        return later(Number(url.searchParams.get('ms') ?? 1000), () => {
          if (!res.destroyed) res.end('rest');
        });
      case 'reset':
        done();
        return req.socket.destroy();
      default:
        return send(404, 'not found');
    }
  });
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  return { server, stats, url: (path) => base + path };
}

/** A port on 127.0.0.1 where nothing listens. */
export async function unusedPort() {
  const probe = net.createServer().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  await new Promise((r) => probe.close(r));
  return port;
}

/** Resolves with { value, ms }. */
export async function timed(promise) {
  const started = Date.now();
  const value = await promise;
  return { value, ms: Date.now() - started };
}
