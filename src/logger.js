const LEVELS = new Set(['info', 'warn', 'error']);

function normalizeError(error) {
  if (!(error instanceof Error)) return undefined;
  return {
    name: error.name,
    message: error.message,
  };
}

export function createLogger({ write = (line) => process.stdout.write(`${line}\n`) } = {}) {
  function log(level, event, fields = {}) {
    if (!LEVELS.has(level)) throw new Error(`unsupported log level: ${level}`);

    const record = {
      timestamp: new Date().toISOString(),
      level,
      event,
      ...fields,
    };

    if (record.error) {
      record.error = normalizeError(record.error);
    }

    write(JSON.stringify(record));
  }

  return Object.freeze({
    info: (event, fields) => log('info', event, fields),
    warn: (event, fields) => log('warn', event, fields),
    error: (event, fields) => log('error', event, fields),
  });
}

export const logger = createLogger();
