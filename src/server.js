import http from 'node:http';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';

export function createServer() {
  return http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  });
}

export function startServer(port = config.port) {
  const server = createServer();
  server.listen(port, () => {
    console.log(`obedience-bridge listening on port ${port}`);
  });
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer();
}
