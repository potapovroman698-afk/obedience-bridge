import http from 'node:http';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';

const RESPONSE_HEADERS = Object.freeze({
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
});

const HTTP_LIMITS = Object.freeze({
  headersTimeout: 10_000,
  requestTimeout: 15_000,
  keepAliveTimeout: 5_000,
  maxHeadersCount: 50,
});

function send(res, statusCode, contentType, body) {
  res.writeHead(statusCode, {
    ...RESPONSE_HEADERS,
    'content-type': contentType,
  });
  res.end(body);
}

function parseRequestUrl(value) {
  try {
    return new URL(value ?? '/', 'http://localhost');
  } catch {
    return null;
  }
}

export function createServer() {
  const server = http.createServer((req, res) => {
    const url = parseRequestUrl(req.url);
    if (!url) {
      send(res, 400, 'text/plain; charset=utf-8', 'Bad Request');
      return;
    }

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

  server.headersTimeout = HTTP_LIMITS.headersTimeout;
  server.requestTimeout = HTTP_LIMITS.requestTimeout;
  server.keepAliveTimeout = HTTP_LIMITS.keepAliveTimeout;
  server.maxHeadersCount = HTTP_LIMITS.maxHeadersCount;

  server.on('clientError', (_error, socket) => {
    if (socket.writable) {
      socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
    }
  });

  return server;
}

export function startServer({ host = config.host, port = config.port } = {}) {
  const server = createServer();
  server.listen(port, host, () => {
    console.log(`obedience-bridge listening on http://${host}:${port}`);
  });
  return server;
}

export function installGracefulShutdown(server, {
  signals = ['SIGINT', 'SIGTERM'],
  exit = (code) => process.exit(code),
  timeoutMs = 5000,
} = {}) {
  let shuttingDown = false;

  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`received ${signal}; shutting down`);

    const timer = setTimeout(() => {
      console.error('graceful shutdown timed out');
      exit(1);
    }, timeoutMs);
    timer.unref?.();

    server.close((error) => {
      clearTimeout(timer);
      if (error) {
        console.error('server shutdown failed', error);
        exit(1);
        return;
      }
      exit(0);
    });
  };

  for (const signal of signals) {
    process.once(signal, () => shutdown(signal));
  }

  return shutdown;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = startServer();
  installGracefulShutdown(server);
}
