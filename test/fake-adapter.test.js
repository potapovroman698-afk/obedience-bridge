import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AdapterError,
  AdapterErrorCode,
  createFakeAdapter,
} from '../src/adapters/fake.js';

async function assertAdapterError(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof AdapterError);
    assert.equal(error.code, code);
    return true;
  });
}

test('fake adapter connects and disconnects idempotently', async () => {
  const adapter = createFakeAdapter();

  assert.deepEqual(await adapter.getStatus(), { configured: true, connected: false });
  await adapter.connect();
  await adapter.connect();
  assert.deepEqual(await adapter.getStatus(), { configured: true, connected: true });
  await adapter.disconnect();
  await adapter.disconnect();
  assert.deepEqual(await adapter.getStatus(), { configured: true, connected: false });
});

test('fake adapter refuses connection when not configured', async () => {
  const adapter = createFakeAdapter({ configured: false });
  await assertAdapterError(adapter.connect(), AdapterErrorCode.NOT_CONFIGURED);
});

test('fake adapter requires a connection before commands', async () => {
  const adapter = createFakeAdapter({ supportedCommands: ['PING'] });
  await assertAdapterError(adapter.execute({ type: 'PING' }), AdapterErrorCode.NOT_CONNECTED);
});

test('fake adapter rejects malformed commands', async () => {
  const adapter = createFakeAdapter({ supportedCommands: ['PING'] });
  await adapter.connect();

  await assertAdapterError(adapter.execute(null), AdapterErrorCode.INVALID_COMMAND);
  await assertAdapterError(adapter.execute({}), AdapterErrorCode.INVALID_COMMAND);
  await assertAdapterError(adapter.execute({ type: '' }), AdapterErrorCode.INVALID_COMMAND);
});

test('fake adapter rejects unsupported commands', async () => {
  const adapter = createFakeAdapter({ supportedCommands: ['PING'] });
  await adapter.connect();
  await assertAdapterError(adapter.execute({ type: 'UNKNOWN' }), AdapterErrorCode.UNSUPPORTED);
});

test('fake adapter executes only explicitly allowed internal command types', async () => {
  const adapter = createFakeAdapter({ supportedCommands: ['PING'] });
  await adapter.connect();

  assert.deepEqual(await adapter.execute({ type: 'PING' }), { ok: true, type: 'PING' });
});
