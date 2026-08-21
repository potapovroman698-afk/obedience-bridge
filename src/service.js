export function createAdapterReadiness(adapter) {
  return async () => {
    const status = await adapter.getStatus();
    return Object.freeze({ ready: status?.configured === true && status?.connected === true });
  };
}

export function createService({ server, adapter, logger }) {
  let started = false;

  return Object.freeze({
    async start({ host, port }) {
      if (started) return;

      await adapter.connect();
      try {
        await new Promise((resolve, reject) => {
          const onError = (error) => {
            server.off('listening', onListening);
            reject(error);
          };
          const onListening = () => {
            server.off('error', onError);
            resolve();
          };
          server.once('error', onError);
          server.once('listening', onListening);
          server.listen(port, host);
        });
        started = true;
        logger.info('service.started', { host, port });
      } catch (error) {
        await adapter.disconnect();
        throw error;
      }
    },

    async stop() {
      if (!started) {
        await adapter.disconnect();
        return;
      }

      const closeError = await new Promise((resolve) => {
        server.close((error) => resolve(error ?? null));
      });
      await adapter.disconnect();
      started = false;

      if (closeError) throw closeError;
      logger.info('service.stopped');
    },
  });
}
