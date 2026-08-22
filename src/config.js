const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_ADAPTER = 'fake';
const SUPPORTED_ADAPTERS = new Set(['fake']);

export function parsePort(value) {
  if (value === undefined || value === '') return DEFAULT_PORT;
  if (!/^\d+$/.test(value)) throw new Error('PORT must be an integer between 1 and 65535');
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535');
  return port;
}

export function parseHost(value) {
  if (value === undefined || value === '') return DEFAULT_HOST;
  const host = value.trim();
  if (host !== value || host.length === 0 || /[\s/]/.test(host)) throw new Error('HOST must be a non-empty hostname or IP address without whitespace or slashes');
  return host;
}

export function parseAdapter(value) {
  const adapter = value === undefined || value === '' ? DEFAULT_ADAPTER : value;
  if (!SUPPORTED_ADAPTERS.has(adapter)) throw new Error(`ADAPTER must be one of: ${[...SUPPORTED_ADAPTERS].join(', ')}`);
  return adapter;
}

function optionalString(value, name) {
  if (value === undefined || value === '') return null;
  if (value.trim() !== value || value.length === 0) throw new Error(`${name} must not contain surrounding whitespace`);
  return value;
}

export function parseObedienceConfig(env) {
  const extensionId = optionalString(env.OBEDIENCE_EXTENSION_ID, 'OBEDIENCE_EXTENSION_ID');
  const redirectUrl = optionalString(env.OBEDIENCE_REDIRECT_URL, 'OBEDIENCE_REDIRECT_URL');
  const credentialPath = optionalString(env.OBEDIENCE_CREDENTIAL_PATH, 'OBEDIENCE_CREDENTIAL_PATH');
  const name = optionalString(env.OBEDIENCE_EXTENSION_NAME, 'OBEDIENCE_EXTENSION_NAME') ?? 'Obedience Bridge';

  const supplied = [extensionId, redirectUrl, credentialPath].filter(Boolean).length;
  if (supplied === 0) return null;
  if (supplied !== 3) throw new Error('Obedience auth requires OBEDIENCE_EXTENSION_ID, OBEDIENCE_REDIRECT_URL, and OBEDIENCE_CREDENTIAL_PATH together');

  let parsedRedirect;
  try { parsedRedirect = new URL(redirectUrl); } catch { throw new Error('OBEDIENCE_REDIRECT_URL must be a valid HTTPS URL'); }
  if (parsedRedirect.protocol !== 'https:' || parsedRedirect.username || parsedRedirect.password || parsedRedirect.hash) {
    throw new Error('OBEDIENCE_REDIRECT_URL must be an HTTPS URL without credentials or fragment');
  }
  if (parsedRedirect.pathname !== '/obedience/callback') throw new Error('OBEDIENCE_REDIRECT_URL pathname must be /obedience/callback');

  return Object.freeze({ extensionId, redirectUrl, credentialPath, name });
}

export function loadConfig(env = process.env) {
  return Object.freeze({
    host: parseHost(env.HOST),
    port: parsePort(env.PORT),
    adapter: parseAdapter(env.ADAPTER),
    obedience: parseObedienceConfig(env),
    bridgeAccessToken: optionalString(env.BRIDGE_ACCESS_TOKEN, 'BRIDGE_ACCESS_TOKEN'),
  });
}

export const config = loadConfig();
