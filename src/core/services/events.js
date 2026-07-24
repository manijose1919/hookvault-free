import { newId } from '../../shared/ids.js';

// Events are immutable once recorded. Payload is stored as a JSON string and
// re-parsed on read so callers always see structured data.

export function recordEvent(db, sourceId, { eventType, payload }) {
  const id = newId('evt');
  db.prepare('INSERT INTO events (id, source_id, event_type, payload) VALUES (?, ?, ?, ?)').run(
    id,
    sourceId,
    eventType,
    JSON.stringify(payload)
  );
  return getEvent(db, id);
}

export function getEvent(db, id) {
  const row = db
    .prepare('SELECT id, source_id, event_type, payload, received_at FROM events WHERE id = ?')
    .get(id);
  if (!row) return null;
  return { ...row, payload: JSON.parse(row.payload) };
}
