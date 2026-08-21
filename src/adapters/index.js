import { createFakeAdapter } from './fake.js';

export function createAdapter(kind) {
  switch (kind) {
    case 'fake':
      return createFakeAdapter();
    default:
      throw new Error(`Unsupported adapter: ${kind}`);
  }
}
