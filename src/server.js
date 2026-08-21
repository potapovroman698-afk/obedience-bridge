import http from 'node:http';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';

const RESPONSE_HEADERS = Object.freeze({
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
});

function send(res, statusCode, contentType, body) {
  res.writeHead(statusCode, {
    ...RESPONSE_HEADERS,
    'content-type': contentType,
  });
  res.end(body);
}

export function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/health') {
      send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ status: 'ok' }));
      return;
    }

    if (url.pathname === '/health') {
      res.setHeader('allow', 'GET');
      send(res, 405, 'text/plain; charset=utf-8', 'Method Not Allowed');
      return;
    }

    send(res, 404, 'text/plain; charset=utf-8', 'Not Found');
  });
}

export function startServer({ host = config.host, port = config.port } = {}) {
  const server = createServer();
  server.listen(port, host, () => {
    console.log(`obedience-bridge listening on http://${host}:${port}`);
  });
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer();
}
