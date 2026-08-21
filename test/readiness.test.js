import assert from 'node:assert/strict';
import test from 'node:test';

import { createLogger } from '../src/logger.js';
import { createServer } from '../src/server.js';

const logger = createLogger({ write: () => {} });

async function withServer(t, readiness) {
  const server = createServer({ logger, readiness });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  return `http://127.0.0.1:${server.address().port}`;
}

test('liveness remains independent from readiness', async (t) => {
  const baseUrl = await withServer(t, async () => ({ ready: false }));
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('ready endpoint returns 200 only for explicit ready state', async (t) => {
  const baseUrl = await withServer(t, async () => ({ ready: true }));
  const response = await fetch(`${baseUrl}/ready`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ready' });
});

test('ready endpoint returns 503 when dependency is unavailable', async (t) => {
  const baseUrl = await withServer(t, async () => ({ ready: false }));
  const response = await fetch(`${baseUrl}/ready`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: 'not_ready' });
});

test('ready endpoint fails closed when readiness check throws', async (t) => {
  const baseUrl = await withServer(t, async () => { throw new Error('dependency failed'); });
  const response = await fetch(`${baseUrl}/ready`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: 'not_ready' });
});

test('ready endpoint allows only GET', async (t) => {
  const baseUrl = await withServer(t, async () => ({ ready: true }));
  const response = await fetch(`${baseUrl}/ready`, { method: 'POST' });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
});
