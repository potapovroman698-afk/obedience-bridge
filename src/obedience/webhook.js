import { createPublicKey, verify } from 'node:crypto';

const WEBHOOK_TYPES = new Set(['habit', 'reward', 'punishment', 'relationship']);
const DEFAULT_MAX_BODY_BYTES = 256 * 1024;

export function createObedienceWebhookVerifier({ publicKeyPem, extensionId, secret, maxBodyBytes = DEFAULT_MAX_BODY_BYTES }) {
  if (typeof publicKeyPem !== 'string' || !publicKeyPem.trim()) throw new TypeError('publicKeyPem is required');
  if (typeof extensionId !== 'string' || !extensionId) throw new TypeError('extensionId is required');
  if (typeof secret !== 'string' || !secret) throw new TypeError('secret is required');
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes <= 0) throw new TypeError('maxBodyBytes must be a positive integer');

  const publicKey = createPublicKey(publicKeyPem);

  return Object.freeze({
    verify({ rawBody, signature }) {
      if (!Buffer.isBuffer(rawBody)) throw new TypeError('rawBody must be a Buffer');
      if (rawBody.length > maxBodyBytes) return Object.freeze({ accepted: false, reason: 'body_too_large' });
      if (typeof signature !== 'string' || !signature) return Object.freeze({ accepted: false, reason: 'missing_signature' });

      let signatureBytes;
      try { signatureBytes = Buffer.from(signature, 'base64'); }
      catch { return Object.freeze({ accepted: false, reason: 'invalid_signature' }); }
      if (signatureBytes.length === 0 || !verify('RSA-SHA256', rawBody, publicKey, signatureBytes)) {
        return Object.freeze({ accepted: false, reason: 'invalid_signature' });
      }

      let payload;
      try { payload = JSON.parse(rawBody.toString('utf8')); }
      catch { return Object.freeze({ accepted: false, reason: 'invalid_json' }); }

      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return Object.freeze({ accepted: false, reason: 'invalid_payload' });
      if (!WEBHOOK_TYPES.has(payload.type)) return Object.freeze({ accepted: false, reason: 'unsupported_type' });
      if (payload.extensionId !== extensionId || payload.secret !== secret) return Object.freeze({ accepted: false, reason: 'credential_mismatch' });

      return Object.freeze({
        accepted: true,
        event: Object.freeze({ type: payload.type, before: payload.before ?? null, after: payload.after ?? null }),
      });
    },
  });
}
