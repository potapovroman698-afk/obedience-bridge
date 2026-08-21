import assert from 'node:assert/strict';
import test from 'node:test';

import { createServer } from '../src/server.js';

async function withServer(t) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

test('GET /health returns a minimal healthy response with defensive headers', async (t) => {
  const baseUrl = await withServer(t);
  const response = await fetch(`${baseUrl}/health`);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('health routing ignores query strings', async (t) => {
  const baseUrl = await withServer(t);
  const response = await fetch(`${baseUrl}/health?probe=1`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('unsupported health methods return 405 and advertise GET', async (t) => {
  const baseUrl = await withServer(t);
  const response = await fetch(`${baseUrl}/health`, { method: 'POST' });

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
  assert.equal(await response.text(), 'Method Not Allowed');
});

test('unknown routes return 404 without leaking details', async (t) => {
  const baseUrl = await withServer(t);
  const response = await fetch(`${baseUrl}/missing`);

  assert.equal(response.status, 404);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(await response.text(), 'Not Found');
});
