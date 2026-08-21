import assert from 'node:assert/strict';
import test from 'node:test';

import { createObedienceAuthHandler } from '../src/obedience/auth.js';

test('authorization handler builds official permission URL', () => {
  const auth = createObedienceAuthHandler({
    extensionId: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Obedience Bridge',
    redirectUrl: 'https://bridge.example/obedience/callback',
    credentialStore: { save: async () => {} },
  });
  const url = new URL(auth.authorizationUrl());
  assert.equal(url.origin, 'https://app.obedienceapp.com');
  assert.equal(url.pathname, '/home/extension-request');
  assert.equal(url.searchParams.get('id'), '123e4567-e89b-12d3-a456-426614174000');
});

test('authorization callback validates id and persists credentials', async () => {
  let saved;
  const auth = createObedienceAuthHandler({
    extensionId: 'extension-id', name: 'Bridge', redirectUrl: 'https://bridge.example/obedience/callback',
    credentialStore: { save: async (value) => { saved = value; } },
  });
  const result = await auth.callback('https://bridge.example/obedience/callback?id=extension-id&secret=private&uid=user-id');
  assert.deepEqual(saved, { id: 'extension-id', secret: 'private', uid: 'user-id' });
  assert.deepEqual(result, { authorized: true, uid: 'user-id' });
  assert.equal('secret' in result, false);
});

test('authorization callback rejects another extension id before storage', async () => {
  let saves = 0;
  const auth = createObedienceAuthHandler({
    extensionId: 'expected', name: 'Bridge', redirectUrl: 'https://bridge.example/obedience/callback',
    credentialStore: { save: async () => { saves += 1; } },
  });
  await assert.rejects(
    auth.callback('https://bridge.example/obedience/callback?id=other&secret=private&uid=user-id'),
    /extension id mismatch/,
  );
  assert.equal(saves, 0);
});
