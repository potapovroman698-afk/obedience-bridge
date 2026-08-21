const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_ADAPTER = 'fake';
const SUPPORTED_ADAPTERS = new Set(['fake']);

export function parsePort(value) {
  if (value === undefined || value === '') {
    return DEFAULT_PORT;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const port = Number(value);

  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return port;
}

export function parseHost(value) {
  if (value === undefined || value === '') {
    return DEFAULT_HOST;
  }

  const host = value.trim();
  if (host !== value || host.length === 0 || /[\s/]/.test(host)) {
    throw new Error('HOST must be a non-empty hostname or IP address without whitespace or slashes');
  }

  return host;
}

export function parseAdapter(value) {
  const adapter = value === undefined || value === '' ? DEFAULT_ADAPTER : value;
  if (!SUPPORTED_ADAPTERS.has(adapter)) {
    throw new Error(`ADAPTER must be one of: ${[...SUPPORTED_ADAPTERS].join(', ')}`);
  }
  return adapter;
}

export function loadConfig(env = process.env) {
  return Object.freeze({
    host: parseHost(env.HOST),
    port: parsePort(env.PORT),
    adapter: parseAdapter(env.ADAPTER),
  });
}

export const config = loadConfig();
