import assert from 'node:assert/strict';
import test from 'node:test';

import { createExtensionRequestUrl, createObedienceReadClient, parseExtensionCallback } from '../src/obedience/client.js';

const EXTENSION_ID = '8ef02e0f-2428-4827-b411-ae887c1c599d';

test('builds official extension permission URL without user credentials', () => {
  const value = createExtensionRequestUrl({
    extensionId: EXTENSION_ID,
    name: 'Obedience Bridge',
    redirectUrl: 'https://bridge.example.test/auth/callback',
  });
  const url = new URL(value);
  assert.equal(url.origin, 'https://app.obedienceapp.com');
  assert.equal(url.pathname, '/home/extension-request');
  assert.equal(url.searchParams.get('id'), EXTENSION_ID);
  assert.equal(url.searchParams.get('name'), 'Obedience Bridge');
  assert.equal(url.searchParams.get('redirect'), 'https://bridge.example.test/auth/callback');
});

test('permission URL requires an https redirect', () => {
  assert.throws(() => createExtensionRequestUrl({ extensionId: EXTENSION_ID, name: 'Bridge', redirectUrl: 'http://localhost/callback' }), /https/);
});

test('parses callback credentials and rejects extension mismatch', () => {
  const callback = `https://bridge.example.test/auth/callback?id=${EXTENSION_ID}&secret=secret-value&uid=user-1`;
  assert.deepEqual(parseExtensionCallback(callback, EXTENSION_ID), { id: EXTENSION_ID, secret: 'secret-value', uid: 'user-1' });
  assert.throws(() => parseExtensionCallback(callback, 'other-extension'), /mismatch/);
});

test('read client uses documented GET endpoint and query parameters', async () => {
  let captured;
  const fetchImpl = async (url, options) => {
    captured = { url: new URL(url), options };
    return { ok: true, status: 200, async json() { return [{ id: 'habit-1' }]; } };
  };
  const client = createObedienceReadClient({ extensionId: EXTENSION_ID, secret: 'secret-value', fetchImpl });
  assert.deepEqual(await client.getHabits(), [{ id: 'habit-1' }]);
  assert.equal(captured.url.pathname, '/extensions/habits');
  assert.equal(captured.url.searchParams.get('extensionId'), EXTENSION_ID);
  assert.equal(captured.url.searchParams.get('secret'), 'secret-value');
  assert.equal(captured.options.method, 'GET');
});

test('read client supports documented single-object id and fails closed on unknown resources', async () => {
  let capturedUrl;
  const fetchImpl = async (url) => {
    capturedUrl = new URL(url);
    return { ok: true, status: 200, async json() { return { id: 'reward-1' }; } };
  };
  const client = createObedienceReadClient({ extensionId: EXTENSION_ID, secret: 'secret-value', fetchImpl });
  assert.deepEqual(await client.getRewards('reward-1'), { id: 'reward-1' });
  assert.equal(capturedUrl.searchParams.get('id'), 'reward-1');
  await assert.rejects(client.get('unknown'), /unsupported resource/);
});

test('read client does not return upstream error bodies', async () => {
  const client = createObedienceReadClient({
    extensionId: EXTENSION_ID,
    secret: 'secret-value',
    fetchImpl: async () => ({ ok: false, status: 403 }),
  });
  await assert.rejects(client.getHabits(), /status 403/);
});
