import { newId } from '../../shared/ids.js';

const COLS =
  'id, event_id, endpoint_id, attempt_number, status, response_code, error, duration_ms, next_retry_at, attempted_at';

export function recordAttempt(db, attempt) {
  const id = newId('att');
  db.prepare(
    `INSERT INTO delivery_attempts
       (id, event_id, endpoint_id, attempt_number, status, response_code, error, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    attempt.eventId,
    attempt.endpointId,
    attempt.attemptNumber,
    attempt.status,
    attempt.responseCode ?? null,
    attempt.error ?? null,
    attempt.durationMs ?? null
  );
  return id;
}

export function listAttemptsForEvent(db, eventId) {
  return db
    .prepare(`SELECT ${COLS} FROM delivery_attempts WHERE event_id = ? ORDER BY attempted_at, attempt_number`)
    .all(eventId);
}

export function listRecentAttempts(db, limit = 100) {
  return db
    .prepare(`SELECT ${COLS} FROM delivery_attempts ORDER BY attempted_at DESC, id DESC LIMIT ?`)
    .all(limit);
}

/** Terminal failures ('dead'). The Premium DLQ/replay module builds on this. */
export function listDeadLetters(db, limit = 100) {
  return db
    .prepare(`SELECT ${COLS} FROM delivery_attempts WHERE status = 'dead' ORDER BY attempted_at DESC LIMIT ?`)
    .all(limit);
}
