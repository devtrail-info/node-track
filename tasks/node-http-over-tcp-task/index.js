// Task: node-http-over-tcp-task. Read README.md in this folder.
import net from 'node:net';
import { fileURLToPath } from 'node:url';

// TODO: build a correct request, read until the server closes, parse the whole response,
// handle chunked bodies, errors and the timeout.
export function rawRequest({ host = '127.0.0.1', port, method = 'GET', path = '/', headers = {}, body, timeout = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    socket.write(`${method} ${path} HTTP/1.1\nHost: ${host}\n\n`);
    socket.on('data', (chunk) => {
      const text = chunk.toString();
      const [head, rest = ''] = text.split('\r\n\r\n');
      const [statusLine] = head.split('\r\n');
      resolve({ status: Number(statusLine.split(' ')[1]), statusText: '', headers: {}, body: Buffer.from(rest) });
      socket.end();
    });
  });
}

// A demo: node tasks/node-http-over-tcp-task/index.js example.com 80 /
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [host = 'example.com', port = '80', path = '/'] = process.argv.slice(2);
  rawRequest({ host, port: Number(port), path })
    .then((res) => {
      console.log(res.status, res.statusText);
      console.log(res.headers);
      console.log(res.body.toString('utf8').slice(0, 500));
    })
    .catch((err) => {
      console.error(`error: ${err.code ?? ''} ${err.message}`);
      process.exitCode = 1;
    });
}
