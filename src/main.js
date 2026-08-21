import { createApplication } from './app.js';
import { logger } from './logger.js';

const app = createApplication();
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('service.shutdown_started', { signal });

  try {
    await app.stop();
    logger.info('service.shutdown_complete');
    process.exitCode = 0;
  } catch (error) {
    logger.error('service.shutdown_failed', { error });
    process.exitCode = 1;
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => void shutdown(signal));
}

try {
  await app.start();
} catch (error) {
  logger.error('service.start_failed', { error });
  process.exitCode = 1;
}
