import http from 'node:http';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import { logger as defaultLogger } from './logger.js';

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

export function createServer({ logger = defaultLogger } = {}) {
  const server = http.createServer((req, res) => {
    const url = parseRequestUrl(req.url);
    if (!url) {
      logger.warn('http.bad_request', { method: req.method });
      send(res, 400, 'text/plain; charset=utf-8', 'Bad Request');
      return;
    }

    res.once('finish', () => {
      logger.info('http.request', {
        method: req.method,
        path: url.pathname,
        statusCode: res.statusCode,
      });
    });

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

  server.on('clientError', (error, socket) => {
    logger.warn('http.client_error', { error });
    if (socket.writable) {
      socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
    }
  });

  return server;
}

export function startServer({ host = config.host, port = config.port, logger = defaultLogger } = {}) {
  const server = createServer({ logger });
  server.listen(port, host, () => {
    logger.info('service.started', { host, port });
  });
  return server;
}

export function installGracefulShutdown(server, {
  signals = ['SIGINT', 'SIGTERM'],
  exit = (code) => process.exit(code),
  timeoutMs = 5000,
  logger = defaultLogger,
} = {}) {
  let shuttingDown = false;

  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('service.shutdown_started', { signal });

    const timer = setTimeout(() => {
      logger.error('service.shutdown_timeout');
      exit(1);
    }, timeoutMs);
    timer.unref?.();

    server.close((error) => {
      clearTimeout(timer);
      if (error) {
        logger.error('service.shutdown_failed', { error });
        exit(1);
        return;
      }
      logger.info('service.shutdown_complete');
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
