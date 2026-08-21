import assert from 'node:assert/strict';
import test from 'node:test';

import { createServer } from '../src/server.js';

test('GET /health returns a minimal healthy response', async (t) => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/health`);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('unknown routes return 404 without leaking details', async (t) => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/missing`);

  assert.equal(response.status, 404);
  assert.equal(await response.text(), 'Not Found');
});
