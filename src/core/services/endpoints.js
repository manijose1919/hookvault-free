import { newId } from '../../shared/ids.js';

const COLUMNS = 'id, source_id, url, key_version, active, created_at';

export function createEndpoint(db, sourceId, { url }) {
  const id = newId('ep');
  db.prepare('INSERT INTO endpoints (id, source_id, url) VALUES (?, ?, ?)').run(id, sourceId, url);
  return getEndpoint(db, id);
}

export function getEndpoint(db, id) {
  return db.prepare(`SELECT ${COLUMNS} FROM endpoints WHERE id = ?`).get(id) ?? null;
}

export function listEndpoints(db, sourceId) {
  return db
    .prepare(`SELECT ${COLUMNS} FROM endpoints WHERE source_id = ? ORDER BY created_at`)
    .all(sourceId);
}

/** Active endpoints only — the delivery engine ignores disabled ones. */
export function listActiveEndpoints(db, sourceId) {
  return db
    .prepare(`SELECT ${COLUMNS} FROM endpoints WHERE source_id = ? AND active = 1 ORDER BY created_at`)
    .all(sourceId);
}
