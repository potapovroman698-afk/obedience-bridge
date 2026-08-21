import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import test from 'node:test';

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

function startProcess(port) {
  return spawn(process.execPath, ['src/main.js'], {
    cwd: process.cwd(),
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function waitForEvent(child, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), timeoutMs);
    child.once(event, (...args) => {
      clearTimeout(timer);
      resolve(args);
    });
  });
}

function waitForLog(child, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      reject(new Error(`timed out waiting for log ${event}${stderr ? `; stderr: ${stderr}` : ''}`));
    }, timeoutMs);

    const onData = (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const record = JSON.parse(line);
        if (record.event === event) {
          clearTimeout(timer);
          child.stdout.off('data', onData);
          resolve(record);
          return;
        }
      }
    };

    child.stdout.on('data', onData);
  });
}

test('production entrypoint starts through composition root and shuts down on SIGTERM', async (t) => {
  const port = await reservePort();
  const child = startProcess(port);
  t.after(() => {
    if (child.exitCode === null) child.kill('SIGKILL');
  });

  const started = await waitForLog(child, 'service.started');
  assert.equal(started.host, '127.0.0.1');
  assert.equal(started.port, port);

  child.kill('SIGTERM');
  const [code, signal] = await waitForEvent(child, 'exit');
  assert.equal(signal, null);
  assert.equal(code, 0);
});
