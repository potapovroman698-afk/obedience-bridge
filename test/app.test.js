import assert from 'node:assert/strict';
import test from 'node:test';

import { createFakeAdapter } from '../src/adapters/fake.js';
import { createApplication } from '../src/app.js';
import { createLogger } from '../src/logger.js';

const logger = createLogger({ write: () => {} });

test('application composition root wires adapter, readiness, server, and lifecycle', async () => {
  const adapter = createFakeAdapter();
  const app = createApplication({ logger, adapter, host: '127.0.0.1', port: 0 });

  assert.equal(app.server.listening, false);
  assert.deepEqual(await adapter.getStatus(), { configured: true, connected: false });

  await app.start();
  assert.equal(app.server.listening, true);
  assert.deepEqual(await adapter.getStatus(), { configured: true, connected: true });

  const { port } = app.server.address();
  const response = await fetch(`http://127.0.0.1:${port}/ready`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ready' });

  await app.stop();
  assert.equal(app.server.listening, false);
  assert.deepEqual(await adapter.getStatus(), { configured: true, connected: false });
});

test('application does not start HTTP server when adapter cannot connect', async () => {
  const adapter = createFakeAdapter({ configured: false });
  const app = createApplication({ logger, adapter, host: '127.0.0.1', port: 0 });

  await assert.rejects(app.start());
  assert.equal(app.server.listening, false);
});
