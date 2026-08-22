import { createAdapter } from './adapters/index.js';
import { config } from './config.js';
import { logger as defaultLogger } from './logger.js';
import { createObedienceAuthHandler } from './obedience/auth.js';
import { createObedienceReadClient } from './obedience/client.js';
import { createCredentialStore } from './obedience/credentials.js';
import { createServer } from './server.js';
import { createAdapterReadiness, createService } from './service.js';

export function createObedienceRuntime(obedienceConfig) {
  if (!obedienceConfig) return null;
  const credentialStore = createCredentialStore({ path: obedienceConfig.credentialPath });

  async function withClient(action) {
    const credentials = await credentialStore.load();
    if (!credentials) return null;
    const client = createObedienceReadClient({
      extensionId: credentials.id,
      secret: credentials.secret,
    });
    return action(client, credentials);
  }

  async function checkConnection() {
    const result = await withClient(async (client, credentials) => {
      await client.getHabits();
      return Object.freeze({ connected: true, uid: credentials.uid });
    });
    return result ?? Object.freeze({ connected: false });
  }

  async function read(resource) {
    const result = await withClient((client) => client.get(resource));
    if (result === null) return Object.freeze({ authorized: false });
    return Object.freeze({ authorized: true, data: result });
  }

  return Object.freeze({
    credentialStore,
    auth: createObedienceAuthHandler({
      extensionId: obedienceConfig.extensionId,
      name: obedienceConfig.name,
      redirectUrl: obedienceConfig.redirectUrl,
      credentialStore,
    }),
    checkConnection,
    read,
  });
}

export function createApplication({
  logger = defaultLogger,
  adapter = createAdapter(config.adapter),
  host = config.host,
  port = config.port,
  obedience = config.obedience,
  bridgeAccessToken = config.bridgeAccessToken,
} = {}) {
  const readiness = createAdapterReadiness(adapter);
  const obedienceRuntime = createObedienceRuntime(obedience);
  const server = createServer({
    logger,
    readiness,
    obedienceAuth: obedienceRuntime?.auth,
    obedienceCheck: obedienceRuntime?.checkConnection,
    obedienceRead: obedienceRuntime?.read,
    bridgeAccessToken,
  });
  const service = createService({ server, adapter, logger });

  return Object.freeze({
    adapter,
    server,
    obedience: obedienceRuntime,
    async start() { await service.start({ host, port }); },
    async stop() { await service.stop(); },
  });
}
