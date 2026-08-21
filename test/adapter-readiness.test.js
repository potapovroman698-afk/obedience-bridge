import assert from 'node:assert/strict';
import test from 'node:test';

import { createFakeAdapter } from '../src/adapters/fake.js';
import { createLogger } from '../src/logger.js';
import { createServer } from '../src/server.js';
import { createAdapterReadiness } from '../src/service.js';

const logger = createLogger({ write: () => {} });

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

test('adapter readiness is false before connection and true after connection', async () => {
  const adapter = createFakeAdapter();
  const readiness = createAdapterReadiness(adapter);

  assert.deepEqual(await readiness(), { ready: false });
  await adapter.connect();
  assert.deepEqual(await readiness(), { ready: true });
  await adapter.disconnect();
  assert.deepEqual(await readiness(), { ready: false });
});

test('unconfigured adapter never reports ready', async () => {
  const adapter = createFakeAdapter({ configured: false });
  const readiness = createAdapterReadiness(adapter);
  assert.deepEqual(await readiness(), { ready: false });
});

test('/ready reflects the vendor-neutral adapter state without exposing details', async (t) => {
  const adapter = createFakeAdapter();
  const server = createServer({ logger, readiness: createAdapterReadiness(adapter) });
  const baseUrl = await listen(server);
  t.after(() => server.close());

  let response = await fetch(`${baseUrl}/ready`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: 'not_ready' });

  await adapter.connect();
  response = await fetch(`${baseUrl}/ready`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ready' });

  await adapter.disconnect();
  response = await fetch(`${baseUrl}/ready`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: 'not_ready' });
});

test('adapter status errors fail readiness closed', async () => {
  const adapter = { async getStatus() { throw new Error('status unavailable'); } };
  const readiness = createAdapterReadiness(adapter);
  await assert.rejects(readiness(), /status unavailable/);
});
