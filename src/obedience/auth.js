import { createExtensionRequestUrl, parseExtensionCallback } from './client.js';

export function createObedienceAuthHandler({ extensionId, name, redirectUrl, credentialStore }) {
  if (!credentialStore?.save) throw new TypeError('credentialStore is required');

  return Object.freeze({
    authorizationUrl() {
      return createExtensionRequestUrl({ extensionId, name, redirectUrl });
    },

    async callback(requestUrl) {
      const credentials = parseExtensionCallback(requestUrl, extensionId);
      await credentialStore.save(credentials);
      return Object.freeze({ authorized: true, uid: credentials.uid });
    },
  });
}
