export const AdapterErrorCode = Object.freeze({
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  NOT_CONNECTED: 'NOT_CONNECTED',
  UNSUPPORTED: 'UNSUPPORTED',
  INVALID_COMMAND: 'INVALID_COMMAND',
  TIMEOUT: 'TIMEOUT',
  DEVICE_ERROR: 'DEVICE_ERROR',
});

export class AdapterError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = 'AdapterError';
    this.code = code;
  }
}

export function createFakeAdapter({ configured = true, supportedCommands = [] } = {}) {
  let connected = false;
  const allowed = new Set(supportedCommands);

  return Object.freeze({
    async connect() {
      if (!configured) {
        throw new AdapterError(AdapterErrorCode.NOT_CONFIGURED);
      }
      connected = true;
    },

    async disconnect() {
      connected = false;
    },

    async getStatus() {
      return Object.freeze({
        configured,
        connected,
      });
    },

    async execute(command) {
      if (!connected) {
        throw new AdapterError(AdapterErrorCode.NOT_CONNECTED);
      }
      if (!command || typeof command !== 'object' || typeof command.type !== 'string' || command.type.length === 0) {
        throw new AdapterError(AdapterErrorCode.INVALID_COMMAND);
      }
      if (!allowed.has(command.type)) {
        throw new AdapterError(AdapterErrorCode.UNSUPPORTED);
      }

      return Object.freeze({ ok: true, type: command.type });
    },
  });
}
