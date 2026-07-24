import { createHash } from 'node:crypto';
import { newId, newSecret } from '../../shared/ids.js';
import { timingSafeEqualStr } from '../../shared/signing.js';

// A source is an authenticated producer of events. Its ingest key has the form
// `<sourceId>.<secret>` so we can look up the source directly, then verify the
// secret against the stored hash. The plaintext key is returned exactly once.
//
// Ingest keys are 192-bit random secrets, not human passwords, so a fast
// SHA-256 hash is the correct choice: it is infeasible to brute-force a leaked
// digest, yet cheap enough to run on every ingest without becoming a DoS lever.

const DUMMY_HASH = createHash('sha256').update('dummy').digest('hex');

function hashSecret(secret) {
  return createHash('sha256').update(secret).digest('hex');
}

export function createSource(db, { name }) {
  const id = newId('src');
  const secret = newSecret(24);
  const ingestKey = `${id}.${secret}`;

  db.prepare('INSERT INTO sources (id, name, ingest_key_hash) VALUES (?, ?, ?)').run(
    id,
    name,
    hashSecret(secret)
  );
  return { source: getSource(db, id), ingestKey };
}

export function getSource(db, id) {
  return db.prepare('SELECT id, name, created_at FROM sources WHERE id = ?').get(id) ?? null;
}

// Returns the authenticated source, or null. Always performs a constant-time
// comparison — even for an unknown source id — so response timing never reveals
// which source ids exist.
export function authenticateIngestKey(db, presentedKey) {
  if (typeof presentedKey !== 'string' || !presentedKey.includes('.')) return null;

  const dot = presentedKey.indexOf('.');
  const sourceId = presentedKey.slice(0, dot);
  const secret = presentedKey.slice(dot + 1);

  const row = db.prepare('SELECT id, ingest_key_hash FROM sources WHERE id = ?').get(sourceId);
  const expected = row ? row.ingest_key_hash : DUMMY_HASH;
  const ok = timingSafeEqualStr(hashSecret(secret), expected);

  return row && ok ? getSource(db, sourceId) : null;
}
