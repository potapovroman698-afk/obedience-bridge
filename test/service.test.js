import assert from 'node:assert/strict';
import test from 'node:test';

import { createFakeAdapter } from '../src/adapters/fake.js';
import { createLogger } from '../src/logger.js';
import { createServer } from '../src/server.js';
import { createService } from '../src/service.js';

function quietLogger() {
  return createLogger({ write: () => {} });
}

test('service connects adapter before listening and disconnects on stop', async () => {
  const adapter = createFakeAdapter();
  const server = createServer({ logger: quietLogger() });
  const service = createService({ server, adapter, logger: quietLogger() });

  await service.start({ host: '127.0.0.1', port: 0 });
  assert.equal(server.listening, true);
  assert.deepEqual(await adapter.getStatus(), { configured: true, connected: true });

  await service.stop();
  assert.equal(server.listening, false);
  assert.deepEqual(await adapter.getStatus(), { configured: true, connected: false });
});

test('service does not listen when adapter connection fails', async () => {
  const adapter = createFakeAdapter({ configured: false });
  const server = createServer({ logger: quietLogger() });
  const service = createService({ server, adapter, logger: quietLogger() });

  await assert.rejects(service.start({ host: '127.0.0.1', port: 0 }));
  assert.equal(server.listening, false);
});

test('service disconnects adapter when server listen fails', async () => {
  const blocker = createServer({ logger: quietLogger() });
  await new Promise((resolve) => blocker.listen(0, '127.0.0.1', resolve));
  const { port } = blocker.address();

  const adapter = createFakeAdapter();
  const server = createServer({ logger: quietLogger() });
  const service = createService({ server, adapter, logger: quietLogger() });

  await assert.rejects(service.start({ host: '127.0.0.1', port }));
  assert.deepEqual(await adapter.getStatus(), { configured: true, connected: false });

  await new Promise((resolve) => blocker.close(resolve));
});

test('service start is idempotent', async () => {
  const adapter = createFakeAdapter();
  const server = createServer({ logger: quietLogger() });
  const service = createService({ server, adapter, logger: quietLogger() });

  await service.start({ host: '127.0.0.1', port: 0 });
  const firstAddress = server.address();
  await service.start({ host: '127.0.0.1', port: 0 });
  assert.deepEqual(server.address(), firstAddress);

  await service.stop();
});
