import { createFakeAdapter } from './adapters/fake.js';
import { config } from './config.js';
import { logger as defaultLogger } from './logger.js';
import { createServer } from './server.js';
import { createAdapterReadiness, createService } from './service.js';

export function createApplication({
  logger = defaultLogger,
  adapter = createFakeAdapter(),
  host = config.host,
  port = config.port,
} = {}) {
  const readiness = createAdapterReadiness(adapter);
  const server = createServer({ logger, readiness });
  const service = createService({ server, adapter, logger });

  return Object.freeze({
    adapter,
    server,
    async start() {
      await service.start({ host, port });
    },
    async stop() {
      await service.stop();
    },
  });
}
