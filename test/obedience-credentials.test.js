import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createCredentialStore, redactCredentials } from '../src/obedience/credentials.js';

test('credential store returns null when no credentials exist', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'obedience-credentials-'));
  const store = createCredentialStore({ path: join(directory, 'nested', 'credentials.json') });
  assert.equal(await store.load(), null);
});

test('credential store writes and reads only id, secret, and uid', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'obedience-credentials-'));
  const path = join(directory, 'nested', 'credentials.json');
  const store = createCredentialStore({ path });
  await store.save({ id: 'extension-id', secret: 'sensitive', uid: 'user-id', ignored: 'nope' });

  assert.deepEqual(await store.load(), { id: 'extension-id', secret: 'sensitive', uid: 'user-id' });
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.equal((await stat(join(directory, 'nested'))).mode & 0o077, 0);
  assert.equal((await readFile(path, 'utf8')).includes('ignored'), false);
});

test('credential store rejects malformed values without exposing the secret', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'obedience-credentials-'));
  const store = createCredentialStore({ path: join(directory, 'credentials.json') });
  await assert.rejects(store.save({ id: 'x', secret: '', uid: 'y' }), /non-empty secret/);
});

test('redactCredentials removes secret material from loggable objects', () => {
  const input = { id: 'extension-id', secret: 'do-not-log', uid: 'user-id', event: 'authorized' };
  assert.deepEqual(redactCredentials(input), {
    id: 'extension-id', secret: '[REDACTED]', uid: 'user-id', event: 'authorized',
  });
  assert.equal(input.secret, 'do-not-log');
});
