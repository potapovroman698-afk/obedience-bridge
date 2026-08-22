import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import test from 'node:test';

import { createObedienceWebhookVerifier } from '../src/obedience/webhook.js';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });

function body(overrides = {}) {
  return Buffer.from(JSON.stringify({
    type: 'habit', extensionId: 'extension-1', secret: 'secret-1', before: { amount: 1 }, after: { amount: 2 }, ...overrides,
  }));
}
function signature(rawBody) { return sign('RSA-SHA256', rawBody, privateKey).toString('base64'); }
function verifier(options = {}) {
  return createObedienceWebhookVerifier({ publicKeyPem, extensionId: 'extension-1', secret: 'secret-1', ...options });
}

test('accepts a correctly signed Obedience event and strips credentials', () => {
  const rawBody = body();
  const result = verifier().verify({ rawBody, signature: signature(rawBody) });
  assert.equal(result.accepted, true);
  assert.deepEqual(result.event, { type: 'habit', before: { amount: 1 }, after: { amount: 2 } });
  assert.equal('secret' in result.event, false);
});

test('rejects missing or forged signatures before parsing payload', () => {
  const rawBody = body();
  assert.equal(verifier().verify({ rawBody }).reason, 'missing_signature');
  assert.equal(verifier().verify({ rawBody, signature: Buffer.from('forged').toString('base64') }).reason, 'invalid_signature');
});

test('rejects credential mismatch and unsupported event types', () => {
  let rawBody = body({ secret: 'wrong' });
  assert.equal(verifier().verify({ rawBody, signature: signature(rawBody) }).reason, 'credential_mismatch');
  rawBody = body({ type: 'unknown' });
  assert.equal(verifier().verify({ rawBody, signature: signature(rawBody) }).reason, 'unsupported_type');
});

test('rejects oversized payloads', () => {
  const rawBody = body();
  assert.equal(verifier({ maxBodyBytes: 8 }).verify({ rawBody, signature: signature(rawBody) }).reason, 'body_too_large');
});
