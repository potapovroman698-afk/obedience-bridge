import { createAdapter } from './adapters/index.js';
import { config } from './config.js';
import { logger as defaultLogger } from './logger.js';
import { createObedienceAuthHandler } from './obedience/auth.js';
import { createCredentialStore } from './obedience/credentials.js';
import { createServer } from './server.js';
import { createAdapterReadiness, createService } from './service.js';

export function createObedienceRuntime(obedienceConfig) {
  if (!obedienceConfig) return null;
  const credentialStore = createCredentialStore({ path: obedienceConfig.credentialPath });
  return Object.freeze({
    credentialStore,
    auth: createObedienceAuthHandler({
      extensionId: obedienceConfig.extensionId,
      name: obedienceConfig.name,
      redirectUrl: obedienceConfig.redirectUrl,
      credentialStore,
    }),
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
  const server = createServer({ logger, readiness, obedienceAuth: obedienceRuntime?.auth });
  const service = createService({ server, adapter, logger });

  return Object.freeze({
    adapter,
    server,
    obedience: obedienceRuntime,
    async start() { await service.start({ host, port }); },
    async stop() { await service.stop(); },
  });
}
