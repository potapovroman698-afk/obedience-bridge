const PROTOCOL_VERSION = '2025-03-26';

const TOOLS = Object.freeze([
  ['get_habits', 'Read the authorized user’s Obedience habits.', 'habits'],
  ['get_rewards', 'Read the authorized user’s Obedience rewards.', 'rewards'],
  ['get_punishments', 'Read the authorized user’s Obedience punishments.', 'punishments'],
  ['get_relationships', 'Read the authorized user’s Obedience relationships.', 'relationships'],
].map(([name, description, resource]) => Object.freeze({
  name,
  description,
  resource,
  inputSchema: Object.freeze({ type: 'object', properties: Object.freeze({}), additionalProperties: false }),
})));

const TOOL_BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]));

function result(id, value) { return { jsonrpc: '2.0', id, result: value }; }
function error(id, code, message) { return { jsonrpc: '2.0', id: id ?? null, error: { code, message } }; }

async function readJson(req, limit = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('request_too_large');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : null;
}

export function createMcpHandler({ obedienceRead, authorize } = {}) {
  return async function handleMcp(req, res) {
    if (req.method === 'GET') {
      res.writeHead(405, { allow: 'POST', 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }
    if (req.method !== 'POST') {
      res.writeHead(405, { allow: 'POST', 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    let message;
    try { message = await readJson(req); }
    catch {
      res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(error(null, -32700, 'Parse error')));
      return;
    }

    if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
      res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(error(message?.id, -32600, 'Invalid Request')));
      return;
    }

    if (message.id === undefined) {
      res.writeHead(202, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ status: 'accepted' }));
      return;
    }

    let payload;
    if (message.method === 'initialize') {
      payload = result(message.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'obedience-bridge', version: '0.2.0' },
      });
    } else if (message.method === 'ping') {
      payload = result(message.id, {});
    } else if (message.method === 'tools/list') {
      payload = result(message.id, { tools: TOOLS.map(({ resource, ...tool }) => tool) });
    } else if (message.method === 'tools/call') {
      const tool = TOOL_BY_NAME.get(message.params?.name);
      if (!tool) payload = error(message.id, -32602, 'Unknown tool');
      else if (!obedienceRead) payload = error(message.id, -32000, 'Obedience is unavailable');
      else {
        try {
          const read = await obedienceRead(tool.resource);
          if (!read?.authorized) {
            payload = result(message.id, {
              content: [{ type: 'text', text: 'Obedience authorization is required.' }],
              isError: true,
              ...(authorize ? { _meta: { authorizationUrl: authorize } } : {}),
            });
          } else {
            payload = result(message.id, {
              content: [{ type: 'text', text: JSON.stringify(read.data) }],
              structuredContent: { data: read.data },
            });
          }
        } catch {
          payload = result(message.id, { content: [{ type: 'text', text: 'Obedience upstream request failed.' }], isError: true });
        }
      }
    } else {
      payload = error(message.id, -32601, 'Method not found');
    }

    res.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      'mcp-protocol-version': PROTOCOL_VERSION,
    });
    res.end(JSON.stringify(payload));
  };
}
