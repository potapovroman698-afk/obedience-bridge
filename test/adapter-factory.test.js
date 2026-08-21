import assert from 'node:assert/strict';
import test from 'node:test';

import { createAdapter } from '../src/adapters/index.js';

test('adapter factory creates the safe fake adapter', async () => {
  const adapter = createAdapter('fake');
  assert.deepEqual(await adapter.getStatus(), { configured: true, connected: false });
});

test('adapter factory fails closed for unknown adapters', () => {
  assert.throws(() => createAdapter('obins'), /Unsupported adapter: obins/);
});
