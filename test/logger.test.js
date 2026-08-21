import assert from 'node:assert/strict';
import test from 'node:test';

import { createLogger } from '../src/logger.js';

test('logger emits one JSON record with structured fields', () => {
  const lines = [];
  const logger = createLogger({ write: (line) => lines.push(line) });

  logger.info('service.started', { host: '127.0.0.1', port: 3000 });

  assert.equal(lines.length, 1);
  const record = JSON.parse(lines[0]);
  assert.equal(record.level, 'info');
  assert.equal(record.event, 'service.started');
  assert.equal(record.host, '127.0.0.1');
  assert.equal(record.port, 3000);
  assert.match(record.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test('logger serializes errors without stack traces', () => {
  const lines = [];
  const logger = createLogger({ write: (line) => lines.push(line) });

  logger.error('service.failed', { error: new Error('boom') });

  const record = JSON.parse(lines[0]);
  assert.deepEqual(record.error, { name: 'Error', message: 'boom' });
  assert.equal('stack' in record.error, false);
});
