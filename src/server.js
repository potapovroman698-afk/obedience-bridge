import http from 'node:http';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import { logger as defaultLogger } from './logger.js';

const RESPONSE_HEADERS = Object.freeze({
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
});

const HTTP_LIMITS = Object.freeze({
  headersTimeout: 10_000,
  requestTimeout: 15_000,
  keepAliveTimeout: 5_000,
  maxHeadersCount: 50,
});

function send(res, statusCode, contentType, body, headers = {}) {
  res.writeHead(statusCode, { ...RESPONSE_HEADERS, ...headers, 'content-type': contentType });
  res.end(body);
}

function parseRequestUrl(value) {
  try { return new URL(value ?? '/', 'http://localhost'); } catch { return null; }
}

export function createServer({ logger = defaultLogger, readiness = async () => ({ ready: true }), obedienceAuth } = {}) {
  const server = http.createServer(async (req, res) => {
    const url = parseRequestUrl(req.url);
    if (!url) {
      logger.warn('http.bad_request', { method: req.method });
      send(res, 400, 'text/plain; charset=utf-8', 'Bad Request');
      return;
    }

    // Log pathname only. Authorization callbacks contain secret material in the query string.
    res.once('finish', () => logger.info('http.request', {
      method: req.method, path: url.pathname, statusCode: res.statusCode,
    }));

    if (req.method === 'GET' && url.pathname === '/') {
      send(res, 200, 'application/json; charset=utf-8', JSON.stringify({
        status: 'ok',
        service: 'obedience-bridge',
        obedienceAuthorization: obedienceAuth ? 'available' : 'unavailable',
      }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ status: 'ok' }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/ready') {
      try {
        const state = await readiness();
        const ready = state?.ready === true;
        send(res, ready ? 200 : 503, 'application/json; charset=utf-8', JSON.stringify({ status: ready ? 'ready' : 'not_ready' }));
      } catch (error) {
        logger.warn('readiness.failed', { error });
        send(res, 503, 'application/json; charset=utf-8', JSON.stringify({ status: 'not_ready' }));
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/obedience/authorize') {
      if (!obedienceAuth) { send(res, 503, 'text/plain; charset=utf-8', 'Obedience authorization unavailable'); return; }
      try {
        res.writeHead(302, { ...RESPONSE_HEADERS, location: obedienceAuth.authorizationUrl() });
        res.end();
      } catch (error) {
        logger.warn('obedience.authorization_start_failed', { error });
        send(res, 503, 'text/plain; charset=utf-8', 'Obedience authorization unavailable');
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/obedience/callback') {
      if (!obedienceAuth) { send(res, 503, 'text/plain; charset=utf-8', 'Obedience authorization unavailable'); return; }
      try {
        const result = await obedienceAuth.callback(url.toString());
        send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ status: 'authorized', uid: result.uid }));
      } catch (error) {
        // Never log the request URL or callback parameters: the query includes the extension secret.
        logger.warn('obedience.authorization_callback_failed', { error: new Error('authorization callback rejected') });
        send(res, 400, 'text/plain; charset=utf-8', 'Authorization callback rejected');
      }
      return;
    }

    if (['/', '/health', '/ready', '/obedience/authorize', '/obedience/callback'].includes(url.pathname)) {
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
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
  });
  return server;
}

export function startServer({ host = config.host, port = config.port, logger = defaultLogger, readiness, obedienceAuth } = {}) {
  const server = createServer({ logger, readiness, obedienceAuth });
  server.listen(port, host, () => logger.info('service.started', { host, port }));
  return server;
}

export function installGracefulShutdown(server, { signals = ['SIGINT', 'SIGTERM'], exit = (code) => process.exit(code), timeoutMs = 5000, logger = defaultLogger } = {}) {
  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('service.shutdown_started', { signal });
    const timer = setTimeout(() => { logger.error('service.shutdown_timeout'); exit(1); }, timeoutMs);
    timer.unref?.();
    server.close((error) => {
      clearTimeout(timer);
      if (error) { logger.error('service.shutdown_failed', { error }); exit(1); return; }
      logger.info('service.shutdown_complete');
      exit(0);
    });
  };
  for (const signal of signals) process.once(signal, () => shutdown(signal));
  return shutdown;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = startServer();
  installGracefulShutdown(server);
}
