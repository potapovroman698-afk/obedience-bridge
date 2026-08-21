import assert from 'node:assert/strict';
import test from 'node:test';

import { loadConfig, parseAdapter, parseHost, parsePort } from '../src/config.js';

test('loadConfig uses safe defaults', () => {
  assert.deepEqual(loadConfig({}), { host: '127.0.0.1', port: 3000, adapter: 'fake', obedience: null });
});

test('parsePort accepts only complete decimal integers in range', () => {
  assert.equal(parsePort('8080'), 8080);
  for (const value of ['0', '65536', '-1', '3000abc', '3.14', ' 3000']) assert.throws(() => parsePort(value), /PORT must be an integer/);
});

test('parseHost rejects whitespace and slash-bearing values', () => {
  assert.equal(parseHost('localhost'), 'localhost');
  assert.equal(parseHost('0.0.0.0'), '0.0.0.0');
  for (const value of [' localhost', 'localhost ', 'bad host', 'http://localhost']) assert.throws(() => parseHost(value), /HOST must be/);
});

test('parseAdapter accepts only implemented adapters', () => {
  assert.equal(parseAdapter(undefined), 'fake');
  assert.equal(parseAdapter('fake'), 'fake');
  for (const value of ['obins', 'real', 'FAKE', ' fake ']) assert.throws(() => parseAdapter(value), /ADAPTER must be one of: fake/);
});

test('loadConfig returns a frozen validated object', () => {
  const value = loadConfig({ HOST: 'localhost', PORT: '8080', ADAPTER: 'fake' });
  assert.deepEqual(value, { host: 'localhost', port: 8080, adapter: 'fake', obedience: null });
  assert.equal(Object.isFrozen(value), true);
});
