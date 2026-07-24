// Canonical schema for the free core. Paid modules add their own tables via
// their own migrations (loaded only when present). Idempotent: safe to run on
// every boot.

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sources (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  ingest_key_hash TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS endpoints (
  id          TEXT PRIMARY KEY,
  source_id   TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  -- The per-endpoint signing secret is DERIVED from the master secret + id +
  -- key_version (never stored), so rotation is just a version bump.
  key_version INTEGER NOT NULL DEFAULT 1,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,
  source_id   TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  payload     TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS delivery_attempts (
  id             TEXT PRIMARY KEY,
  event_id       TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  endpoint_id    TEXT NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('pending','success','failed','dead')),
  response_code  INTEGER,
  error          TEXT,
  duration_ms    INTEGER,
  next_retry_at  TEXT,
  attempted_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_endpoints_source ON endpoints(source_id);
CREATE INDEX IF NOT EXISTS idx_events_source ON events(source_id);
CREATE INDEX IF NOT EXISTS idx_attempts_event ON delivery_attempts(event_id);
CREATE INDEX IF NOT EXISTS idx_attempts_status ON delivery_attempts(status);
`;
