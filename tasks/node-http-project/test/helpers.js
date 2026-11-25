// Shared test helpers (not a test file).
import fsp from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import * as mod from '../index.js';

// Works with `export function createBookmarksServer` and with `export default { createBookmarksServer }`.
export const createBookmarksServer = mod.createBookmarksServer ?? mod.default?.createBookmarksServer;

let root;
let n = 0;
const servers = new Set();

export async function setupRoot() {
  root = await fsp.mkdtemp(path.join(os.tmpdir(), 'devtrail-bookmarks-'));
}

export async function cleanup() {
  for (const s of servers) {
    s.closeAllConnections();
    await new Promise((resolve) => s.close(() => resolve()));
  }
  servers.clear();
  await fsp.rm(root, { recursive: true, force: true });
}

/** A fresh folder and data-file path for one test. */
export async function freshFile() {
  const dir = path.join(root, `case-${++n}`);
  await fsp.mkdir(dir);
  return path.join(dir, 'bookmarks.json');
}

/** Starts a server on port 0. Returns { base, port, server, api }. */
export async function start(options) {
  const server = createBookmarksServer(options);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.add(server);
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const api = async (method, urlPath, body, headers) => {
    const init = { method, signal: AbortSignal.timeout(4000), headers: { ...(headers ?? {}) } };
    if (body !== undefined) {
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
      if (!headers) init.headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(base + urlPath, init);
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = undefined;
    }
    return { status: res.status, headers: res.headers, text, json };
  };
  return { base, port, server, api };
}

export async function stop(server) {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(() => resolve()));
  servers.delete(server);
}

/** Sends raw bytes on a new connection; resolves with what came back once the server closes it (or after ms). */
export function raw(port, parts, ms = 1500) {
  return new Promise((resolve) => {
    const s = net.connect(port, '127.0.0.1');
    let data = '';
    let done = false;
    s.on('data', (d) => (data += d));
    s.on('error', () => {});
    s.on('close', () => {
      if (!done) {
        done = true;
        resolve({ data, closed: true });
      }
    });
    for (const p of parts) s.write(p);
    setTimeout(() => {
      if (!done) {
        done = true;
        resolve({ data, closed: false });
        s.destroy();
      }
    }, ms);
  });
}

export const JSON_TYPE = 'application/json; charset=utf-8';
export const sample = { url: 'https://nodejs.org/docs', title: 'Node docs', tags: ['node', 'docs'] };
