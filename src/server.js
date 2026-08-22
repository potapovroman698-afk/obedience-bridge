import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import { logger as defaultLogger } from './logger.js';

const RESPONSE_HEADERS = Object.freeze({ 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' });
const HTTP_LIMITS = Object.freeze({ headersTimeout: 10_000, requestTimeout: 15_000, keepAliveTimeout: 5_000, maxHeadersCount: 50 });
const READ_ROUTE_PREFIX = '/api/obedience/';
const READ_RESOURCES = new Set(['habits', 'rewards', 'punishments', 'relationships']);

function send(res, statusCode, contentType, body, headers = {}) { res.writeHead(statusCode, { ...RESPONSE_HEADERS, ...headers, 'content-type': contentType }); res.end(body); }
function parseRequestUrl(value) { try { return new URL(value ?? '/', 'http://localhost'); } catch { return null; } }
function authorized(req, token) {
  if (!token) return false;
  const value = req.headers.authorization;
  if (typeof value !== 'string' || !value.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(value.slice(7)); const expected = Buffer.from(token);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function createServer({ logger = defaultLogger, readiness = async () => ({ ready: true }), obedienceAuth, obedienceCheck, obedienceRead, bridgeAccessToken, mcp } = {}) {
  const server = http.createServer(async (req, res) => {
    const url = parseRequestUrl(req.url);
    if (!url) { send(res, 400, 'text/plain; charset=utf-8', 'Bad Request'); return; }
    res.once('finish', () => logger.info('http.request', { method: req.method, path: url.pathname, statusCode: res.statusCode }));

    if (url.pathname === '/mcp') {
      if (!mcp) { send(res, 503, 'application/json; charset=utf-8', JSON.stringify({ status: 'unavailable' })); return; }
      await mcp(req, res); return;
    }
    if (req.method === 'GET' && url.pathname === '/') { send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ status: 'ok', service: 'obedience-bridge', obedienceAuthorization: obedienceAuth ? 'available' : 'unavailable', mcp: mcp ? '/mcp' : null })); return; }
    if (req.method === 'GET' && url.pathname === '/health') { send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ status: 'ok' })); return; }
    if (req.method === 'GET' && url.pathname === '/ready') {
      try { const state = await readiness(); const ready = state?.ready === true; send(res, ready ? 200 : 503, 'application/json; charset=utf-8', JSON.stringify({ status: ready ? 'ready' : 'not_ready' })); }
      catch { send(res, 503, 'application/json; charset=utf-8', JSON.stringify({ status: 'not_ready' })); }
      return;
    }
    if (req.method === 'GET' && url.pathname === '/obedience/authorize') {
      if (!obedienceAuth) { send(res, 503, 'text/plain; charset=utf-8', 'Obedience authorization unavailable'); return; }
      try { res.writeHead(302, { ...RESPONSE_HEADERS, location: obedienceAuth.authorizationUrl() }); res.end(); }
      catch { send(res, 503, 'text/plain; charset=utf-8', 'Obedience authorization unavailable'); }
      return;
    }
    if (req.method === 'GET' && url.pathname === '/obedience/callback') {
      if (!obedienceAuth) { send(res, 503, 'text/plain; charset=utf-8', 'Obedience authorization unavailable'); return; }
      try { const result = await obedienceAuth.callback(url.toString()); send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ status: 'authorized', uid: result.uid })); }
      catch { send(res, 400, 'text/plain; charset=utf-8', 'Authorization callback rejected'); }
      return;
    }
    if (req.method === 'GET' && url.pathname === '/obedience/check') {
      if (!obedienceCheck) { send(res, 503, 'application/json; charset=utf-8', JSON.stringify({ status: 'unavailable' })); return; }
      try { const state = await obedienceCheck(); send(res, state?.connected ? 200 : 401, 'application/json; charset=utf-8', JSON.stringify({ status: state?.connected ? 'connected' : 'authorization_required' })); }
      catch { send(res, 502, 'application/json; charset=utf-8', JSON.stringify({ status: 'upstream_error' })); }
      return;
    }
    if (url.pathname.startsWith(READ_ROUTE_PREFIX)) {
      if (req.method !== 'GET') { res.setHeader('allow', 'GET'); send(res, 405, 'text/plain; charset=utf-8', 'Method Not Allowed'); return; }
      const resource = url.pathname.slice(READ_ROUTE_PREFIX.length);
      if (!READ_RESOURCES.has(resource)) { send(res, 404, 'text/plain; charset=utf-8', 'Not Found'); return; }
      if (!bridgeAccessToken) { send(res, 503, 'application/json; charset=utf-8', JSON.stringify({ status: 'access_not_configured' })); return; }
      if (!authorized(req, bridgeAccessToken)) { res.setHeader('www-authenticate', 'Bearer'); send(res, 401, 'application/json; charset=utf-8', JSON.stringify({ status: 'unauthorized' })); return; }
      if (!obedienceRead) { send(res, 503, 'application/json; charset=utf-8', JSON.stringify({ status: 'unavailable' })); return; }
      try { const result = await obedienceRead(resource); if (!result?.authorized) { send(res, 401, 'application/json; charset=utf-8', JSON.stringify({ status: 'authorization_required' })); return; } send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ status: 'ok', data: result.data })); }
      catch { send(res, 502, 'application/json; charset=utf-8', JSON.stringify({ status: 'upstream_error' })); }
      return;
    }
    send(res, 404, 'text/plain; charset=utf-8', 'Not Found');
  });
  Object.assign(server, HTTP_LIMITS);
  server.on('clientError', (error, socket) => { logger.warn('http.client_error', { error }); if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); });
  return server;
}

export function startServer({ host = config.host, port = config.port, logger = defaultLogger, readiness, obedienceAuth, obedienceCheck, obedienceRead, bridgeAccessToken = config.bridgeAccessToken, mcp } = {}) { const server = createServer({ logger, readiness, obedienceAuth, obedienceCheck, obedienceRead, bridgeAccessToken, mcp }); server.listen(port, host, () => logger.info('service.started', { host, port })); return server; }
export function installGracefulShutdown(server, { signals = ['SIGINT', 'SIGTERM'], exit = (code) => process.exit(code), timeoutMs = 5000, logger = defaultLogger } = {}) { let shuttingDown = false; const shutdown = (signal) => { if (shuttingDown) return; shuttingDown = true; const timer = setTimeout(() => exit(1), timeoutMs); timer.unref?.(); server.close((error) => { clearTimeout(timer); exit(error ? 1 : 0); }); }; for (const signal of signals) process.once(signal, () => shutdown(signal)); return shutdown; }
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) { const server = startServer(); installGracefulShutdown(server); }
