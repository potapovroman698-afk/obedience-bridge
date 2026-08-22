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

  async function checkConnection() {
    const credentials = await credentialStore.load();
    if (!credentials) return Object.freeze({ connected: false });

    const client = createObedienceReadClient({
      extensionId: credentials.id,
      secret: credentials.secret,
    });
    await client.getHabits();
    return Object.freeze({ connected: true, uid: credentials.uid });
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
  });
}

export function createApplication({
  logger = defaultLogger,
  adapter = createAdapter(config.adapter),
  host = config.host,
  port = config.port,
  obedience = config.obedience,
} = {}) {
  const readiness = createAdapterReadiness(adapter);
  const obedienceRuntime = createObedienceRuntime(obedience);
  const server = createServer({
    logger,
    readiness,
    obedienceAuth: obedienceRuntime?.auth,
    obedienceCheck: obedienceRuntime?.checkConnection,
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
