import assert from 'node:assert/strict';
import test from 'node:test';

import { createObedienceRuntime } from '../src/app.js';
import { parseObedienceConfig } from '../src/config.js';

test('Obedience runtime remains disabled when no auth settings are supplied', () => {
  assert.equal(parseObedienceConfig({}), null);
  assert.equal(createObedienceRuntime(null), null);
});

test('partial Obedience runtime configuration fails closed', () => {
  assert.throws(() => parseObedienceConfig({ OBEDIENCE_EXTENSION_ID: 'id' }), /requires .* together/);
});

test('Obedience callback URL must use HTTPS and the exact callback path', () => {
  const base = { OBEDIENCE_EXTENSION_ID: 'id', OBEDIENCE_CREDENTIAL_PATH: '/tmp/credentials.json' };
  assert.throws(() => parseObedienceConfig({ ...base, OBEDIENCE_REDIRECT_URL: 'http://example.com/obedience/callback' }), /HTTPS/);
  assert.throws(() => parseObedienceConfig({ ...base, OBEDIENCE_REDIRECT_URL: 'https://example.com/wrong' }), /pathname/);
});

test('complete Obedience runtime creates auth handler and credential store', () => {
  const cfg = parseObedienceConfig({
    OBEDIENCE_EXTENSION_ID: 'extension-id',
    OBEDIENCE_REDIRECT_URL: 'https://bridge.example/obedience/callback',
    OBEDIENCE_CREDENTIAL_PATH: '/tmp/obedience-bridge-test-credentials.json',
    OBEDIENCE_EXTENSION_NAME: 'My Bridge',
  });
  const runtime = createObedienceRuntime(cfg);
  assert.equal(typeof runtime.auth.authorizationUrl, 'function');
  assert.equal(typeof runtime.auth.callback, 'function');
  assert.equal(typeof runtime.credentialStore.load, 'function');
  const url = new URL(runtime.auth.authorizationUrl());
  assert.equal(url.origin, 'https://app.obedienceapp.com');
  assert.equal(url.searchParams.get('id'), 'extension-id');
  assert.equal(url.searchParams.get('name'), 'My Bridge');
});
