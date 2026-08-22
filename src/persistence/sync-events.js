import postgres from 'postgres';

const EVENT_TYPES = new Set(['habit', 'reward', 'punishment', 'relationship']);
const FINAL_STATUSES = new Set(['processed', 'failed']);

function validateEventType(value) {
  if (!EVENT_TYPES.has(value)) throw new TypeError('Unsupported sync event type');
  return value;
}

function validateEventId(value) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError('Sync event id must be a positive integer');
  return value;
}

function validateFinalStatus(value) {
  if (!FINAL_STATUSES.has(value)) throw new TypeError('Sync event final status must be processed or failed');
  return value;
}

export function createSyncEventStore({ sql }) {
  if (!sql || typeof sql.unsafe !== 'function') throw new TypeError('PostgreSQL client is required');

  return Object.freeze({
    async begin(eventType) {
      const type = validateEventType(eventType);
      const rows = await sql.unsafe(
        'insert into bridge.sync_events (event_type, status) values ($1, $2) returning id',
        [type, 'received'],
      );
      const id = Number(rows?.[0]?.id);
      return validateEventId(id);
    },

    async finish(id, status) {
      const eventId = validateEventId(id);
      const finalStatus = validateFinalStatus(status);
      const rows = await sql.unsafe(
        'update bridge.sync_events set status = $2, processed_at = now() where id = $1 and status = $3 returning id',
        [eventId, finalStatus, 'received'],
      );
      if (Number(rows?.[0]?.id) !== eventId) throw new Error('Sync event could not be finalized');
    },
  });
}

export function createPostgresSyncEventStore({ databaseUrl }) {
  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) throw new TypeError('databaseUrl is required');
  const sql = postgres(databaseUrl, { max: 3, ssl: 'require', idle_timeout: 20, connect_timeout: 10 });
  const store = createSyncEventStore({ sql });
  return Object.freeze({
    ...store,
    async close() { await sql.end({ timeout: 5 }); },
  });
}
