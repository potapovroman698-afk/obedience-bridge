import assert from 'node:assert/strict';
import net from 'node:net';
import test from 'node:test';

import { createServer } from '../src/server.js';

async function withServer(t, options = {}) {
  const server = createServer(options);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  return { baseUrl: `http://127.0.0.1:${address.port}`, port: address.port, server };
}

test('GET / returns a minimal service status', async (t) => {
  const { baseUrl } = await withServer(t);
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.deepEqual(await response.json(), {
    status: 'ok',
    service: 'obedience-bridge',
    obedienceAuthorization: 'unavailable',
  });
});

test('GET /health returns a minimal healthy response with defensive headers', async (t) => {
  const { baseUrl } = await withServer(t);
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('health routing ignores query strings', async (t) => {
  const { baseUrl } = await withServer(t);
  const response = await fetch(`${baseUrl}/health?probe=1`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('unsupported health methods return 405 and advertise GET', async (t) => {
  const { baseUrl } = await withServer(t);
  const response = await fetch(`${baseUrl}/health`, { method: 'POST' });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
  assert.equal(await response.text(), 'Method Not Allowed');
});

test('Obedience authorize redirects only when auth is configured', async (t) => {
  const obedienceAuth = {
    authorizationUrl: () => 'https://app.obedienceapp.com/home/extension-request?id=x',
    callback: async () => ({ authorized: true, uid: 'user-id' }),
  };
  const { baseUrl } = await withServer(t, { obedienceAuth });
  const response = await fetch(`${baseUrl}/obedience/authorize`, { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://app.obedienceapp.com/home/extension-request?id=x');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
});

test('Obedience callback returns no secret and access log contains pathname only', async (t) => {
  const records = [];
  const logger = { info: (event, data) => records.push([event, data]), warn: (event, data) => records.push([event, data]), error() {} };
  let callbackUrl;
  const obedienceAuth = {
    authorizationUrl: () => 'https://app.obedienceapp.com/',
    callback: async (value) => { callbackUrl = value; return { authorized: true, uid: 'user-id' }; },
  };
  const { baseUrl } = await withServer(t, { obedienceAuth, logger });
  const response = await fetch(`${baseUrl}/obedience/callback?id=extension&secret=DO_NOT_LOG&uid=user-id`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'authorized', uid: 'user-id' });
  assert.match(callbackUrl, /secret=DO_NOT_LOG/);
  assert.equal(JSON.stringify(records).includes('DO_NOT_LOG'), false);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
});

test('rejected Obedience callback does not leak callback parameters into logs or response', async (t) => {
  const records = [];
  const logger = { info: (event, data) => records.push([event, data]), warn: (event, data) => records.push([event, data]), error() {} };
  const obedienceAuth = { authorizationUrl: () => 'https://app.obedienceapp.com/', callback: async () => { throw new Error('secret=DO_NOT_LOG'); } };
  const { baseUrl } = await withServer(t, { obedienceAuth, logger });
  const response = await fetch(`${baseUrl}/obedience/callback?id=x&secret=DO_NOT_LOG&uid=y`);
  assert.equal(response.status, 400);
  assert.equal(await response.text(), 'Authorization callback rejected');
  assert.equal(JSON.stringify(records).includes('DO_NOT_LOG'), false);
});

test('unknown routes return 404 without leaking details', async (t) => {
  const { baseUrl } = await withServer(t);
  const response = await fetch(`${baseUrl}/missing`);
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(await response.text(), 'Not Found');
});

test('server applies bounded HTTP timeout and header limits', () => {
  const server = createServer();
  assert.equal(server.headersTimeout, 10_000);
  assert.equal(server.requestTimeout, 15_000);
  assert.equal(server.keepAliveTimeout, 5_000);
  assert.equal(server.maxHeadersCount, 50);
});

test('malformed HTTP is rejected with a minimal 400 response', async (t) => {
  const { port } = await withServer(t);
  const response = await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port }, () => socket.write('GET / HTTP/1.1\r\nBad Header\r\n\r\n'));
    let data = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => { data += chunk; });
    socket.on('end', () => resolve(data));
    socket.on('error', reject);
  });
  assert.match(response, /^HTTP\/1\.1 400 Bad Request/);
  assert.match(response, /Connection: close/);
});
