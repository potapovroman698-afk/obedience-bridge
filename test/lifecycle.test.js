import assert from 'node:assert/strict';
import test from 'node:test';

import { createServer, installGracefulShutdown } from '../src/server.js';

test('graceful shutdown closes the server and exits successfully', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  let exitCode;
  const shutdown = installGracefulShutdown(server, {
    signals: [],
    exit: (code) => { exitCode = code; },
    timeoutMs: 1000,
  });

  shutdown('TEST');
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(server.listening, false);
  assert.equal(exitCode, 0);
});

test('graceful shutdown is idempotent', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const exitCodes = [];
  const shutdown = installGracefulShutdown(server, {
    signals: [],
    exit: (code) => exitCodes.push(code),
    timeoutMs: 1000,
  });

  shutdown('FIRST');
  shutdown('SECOND');
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(exitCodes, [0]);
});
