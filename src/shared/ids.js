import { randomUUID, randomBytes } from 'node:crypto';

// Prefixed, URL-safe identifiers make logs and API responses self-describing
// (e.g. `src_ab12...`, `evt_...`). The prefix has no semantic weight beyond
// readability.

export function newId(prefix) {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}

/** High-entropy opaque secret for ingest/API keys (returned to caller once). */
export function newSecret(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}
