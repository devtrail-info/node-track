// Task: node-net-project. Read README.md in this folder.
import net from 'node:net';
import { fileURLToPath } from 'node:url';

export function createChatServer({ idleMs = 5 * 60 * 1000 } = {}) {
  const server = net.createServer((socket) => {
    socket.write('WELCOME send your nickname\n');
    // TODO: frame the bytes into lines, nicknames, broadcast, /who, /quit, limits, timeouts, clean-up
    socket.on('data', (chunk) => {
      socket.write(chunk); // echo, for now
    });
  });

  // TODO: say goodbye to every client and close the server
  server.stop = async () => {
    server.close();
  };

  return server;
}

// A demo server: node tasks/node-net-project/index.js, then connect with: nc localhost 4000
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = createChatServer();
  server.listen(Number(process.env.PORT ?? 4000), () => {
    console.log(`chat listening on port ${server.address().port}`);
  });
  process.on('SIGINT', () => server.stop().then(() => console.log('stopped')));
}
