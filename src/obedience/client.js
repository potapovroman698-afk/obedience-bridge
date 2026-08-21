const DEFAULT_BASE_URL = 'https://app.obedienceapp.com';
const READ_RESOURCES = new Set(['habits', 'rewards', 'punishments', 'relationships']);

function requireNonEmpty(value, name) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${name} is required`);
  return value;
}

export function createExtensionRequestUrl({ extensionId, name, redirectUrl, baseUrl = DEFAULT_BASE_URL }) {
  requireNonEmpty(extensionId, 'extensionId');
  requireNonEmpty(name, 'name');
  requireNonEmpty(redirectUrl, 'redirectUrl');

  const redirect = new URL(redirectUrl);
  if (redirect.protocol !== 'https:') throw new TypeError('redirectUrl must use https');

  const url = new URL('/home/extension-request', baseUrl);
  url.searchParams.set('id', extensionId);
  url.searchParams.set('name', name);
  url.searchParams.set('redirect', redirect.toString());
  return url.toString();
}

export function parseExtensionCallback(value, expectedExtensionId) {
  const url = new URL(value);
  const id = requireNonEmpty(url.searchParams.get('id'), 'id');
  const secret = requireNonEmpty(url.searchParams.get('secret'), 'secret');
  const uid = requireNonEmpty(url.searchParams.get('uid'), 'uid');
  if (expectedExtensionId && id !== expectedExtensionId) throw new Error('extension id mismatch');
  return Object.freeze({ id, secret, uid });
}

export function createObedienceReadClient({ extensionId, secret, fetchImpl = fetch, baseUrl = DEFAULT_BASE_URL }) {
  requireNonEmpty(extensionId, 'extensionId');
  requireNonEmpty(secret, 'secret');

  return Object.freeze({
    async get(resource, id) {
      if (!READ_RESOURCES.has(resource)) throw new TypeError(`unsupported resource: ${resource}`);
      const url = new URL(`/extensions/${resource}`, baseUrl);
      url.searchParams.set('extensionId', extensionId);
      url.searchParams.set('secret', secret);
      if (id !== undefined) url.searchParams.set('id', requireNonEmpty(id, 'id'));

      const response = await fetchImpl(url, { method: 'GET', headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`Obedience API request failed with status ${response.status}`);
      return response.json();
    },
    getHabits(id) { return this.get('habits', id); },
    getRewards(id) { return this.get('rewards', id); },
    getPunishments(id) { return this.get('punishments', id); },
    getRelationships(id) { return this.get('relationships', id); },
  });
}
