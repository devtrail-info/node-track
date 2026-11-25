// Test helpers for node-graceful-shutdown-task: servers on random ports and small HTTP clients.
import http from 'node:http';
import { once } from 'node:events';
import { after } from 'node:test';
import * as mod from '../index.js';

// Works with named exports and with `export default { createOrdersServer, createShutdown }`.
export const createOrdersServer = mod.createOrdersServer ?? mod.default?.createOrdersServer;
export const createShutdown = mod.createShutdown ?? mod.default?.createShutdown;

const servers = [];
const agents = [];
after(() => {
  for (const agent of agents) agent.destroy();
  for (const server of servers) {
    server.closeAllConnections?.();
    if (server.listening) server.close();
  }
});

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Starts the orders server with your shutdown on 127.0.0.1 and a random port. */
export async function start(options = {}) {
  const logs = [];
  const closed = [];
  const server = createOrdersServer();
  servers.push(server);
  const shutdown = createShutdown(server, {
    log: (line) => logs.push(line),
    onClose: async () => {
      closed.push(Date.now());
    },
    ...options,
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, shutdown, logs, closed, port: server.address().port };
}

/** A keep-alive agent, like the ones real clients and load balancers use. */
export function keepAliveAgent() {
  const agent = new http.Agent({ keepAlive: true, maxSockets: 10 });
  agents.push(agent);
  return agent;
}

/**
 * GET a path. Resolves with { status, headers, body, at } (at = Date.now() when the body ended) or with
 * { error } (the error code or message) when the request fails.
 */
export function get(port, path, agent) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path, agent: agent ?? false }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body, at: Date.now() }));
      res.on('error', (err) => resolve({ error: err.code ?? err.message }));
    });
    req.on('error', (err) => resolve({ error: err.code ?? err.message }));
  });
}

/** Resolves with the number of milliseconds `promise` took, and its value. */
export async function timed(promise) {
  const started = Date.now();
  const value = await promise;
  return { value, ms: Date.now() - started };
}
