import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

function validateCredentials(value) {
  if (!value || typeof value !== 'object') throw new Error('Obedience credentials must be an object');
  for (const key of ['id', 'secret', 'uid']) {
    if (typeof value[key] !== 'string' || value[key].length === 0) {
      throw new Error(`Obedience credentials require non-empty ${key}`);
    }
  }
  return Object.freeze({ id: value.id, secret: value.secret, uid: value.uid });
}

export function createCredentialStore({ path }) {
  if (typeof path !== 'string' || path.length === 0) throw new Error('Credential store path is required');

  return Object.freeze({
    async load() {
      let text;
      try {
        text = await readFile(path, 'utf8');
      } catch (error) {
        if (error?.code === 'ENOENT') return null;
        throw new Error('Failed to read Obedience credentials', { cause: error });
      }

      try {
        return validateCredentials(JSON.parse(text));
      } catch (error) {
        throw new Error('Stored Obedience credentials are invalid', { cause: error });
      }
    },

    async save(credentials) {
      const value = validateCredentials(credentials);
      const directory = dirname(path);
      const temporaryPath = `${path}.${process.pid}.tmp`;
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await writeFile(temporaryPath, `${JSON.stringify(value)}\n`, { encoding: 'utf8', mode: 0o600 });
      await chmod(temporaryPath, 0o600);
      await rename(temporaryPath, path);
      await chmod(path, 0o600);
    },
  });
}

export function redactCredentials(value) {
  if (!value || typeof value !== 'object') return value;
  const copy = { ...value };
  if ('secret' in copy) copy.secret = '[REDACTED]';
  return copy;
}
