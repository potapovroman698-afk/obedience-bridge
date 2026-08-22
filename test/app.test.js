import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
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

test('application accepts a correctly signed webhook through the real HTTP endpoint', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const adapter = createFakeAdapter();
  const app = createApplication({
    logger,
    adapter,
    host: '127.0.0.1',
    port: 0,
    obedienceWebhook: { publicKeyPem, extensionId: 'extension-e2e', secret: 'secret-e2e' },
  });

  await app.start();
  try {
    const rawBody = Buffer.from(JSON.stringify({
      type: 'habit',
      extensionId: 'extension-e2e',
      secret: 'secret-e2e',
      before: { amount: 1 },
      after: { amount: 2 },
    }));
    const signature = sign('RSA-SHA256', rawBody, privateKey).toString('base64');
    const { port } = app.server.address();
    const response = await fetch(`http://127.0.0.1:${port}/obedience/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-signature': signature },
      body: rawBody,
    });

    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { status: 'accepted' });
    assert.ok(app.obedienceWebhook);
  } finally {
    await app.stop();
  }
});
