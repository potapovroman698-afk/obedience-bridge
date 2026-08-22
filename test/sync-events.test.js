import assert from 'node:assert/strict';
import test from 'node:test';

import { createSyncEventStore } from '../src/persistence/sync-events.js';

function createSqlMock() {
  const calls = [];
  return {
    calls,
    unsafe: async (query, params) => {
      calls.push({ query, params });
      if (query.startsWith('insert')) return [{ id: 42 }];
      if (query.startsWith('update')) return [{ id: params[0] }];
      return [];
    },
  };
}

test('records received and processed sync event without payload data', async () => {
  const sql = createSqlMock();
  const store = createSyncEventStore({ sql });
  const id = await store.begin('habit');
  await store.finish(id, 'processed');

  assert.equal(id, 42);
  assert.deepEqual(sql.calls[0].params, ['habit', 'received']);
  assert.deepEqual(sql.calls[1].params, [42, 'processed', 'received']);
  assert.equal(sql.calls.some((call) => JSON.stringify(call).includes('secret')), false);
});

test('rejects unsupported event types and final statuses', async () => {
  const store = createSyncEventStore({ sql: createSqlMock() });
  await assert.rejects(() => store.begin('unknown'), /Unsupported sync event type/);
  await assert.rejects(() => store.finish(1, 'received'), /final status/);
});
