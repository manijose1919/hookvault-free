// Minimal structured JSON logger with automatic secret redaction.
// Security requirement: no secret material (keys, signing secrets, tokens)
// may ever reach stdout/stderr.

const REDACT_KEYS = new Set([
  'ingest_key',
  'ingestkey',
  'signing_secret',
  'signingsecret',
  'authorization',
  'password',
  'master_signing_secret',
  'mastersigningsecret',
  'secret',
  'token',
  'apikey',
  'api_key',
]);

function redact(value) {
  if (!value || typeof value !== 'object') return value;
  const out = Array.isArray(value) ? [] : {};
  for (const [key, val] of Object.entries(value)) {
    if (REDACT_KEYS.has(key.toLowerCase())) {
      out[key] = '[redacted]';
    } else if (val && typeof val === 'object') {
      out[key] = redact(val);
    } else {
      out[key] = val;
    }
  }
  return out;
}

function emit(level, msg, meta) {
  if (process.env.HOOKVAULT_LOG_SILENT === '1') return; // used by the test runner
  const line = { ts: new Date().toISOString(), level, msg, ...(meta ? redact(meta) : {}) };
  const serialized = JSON.stringify(line) + '\n';
  if (level === 'error' || level === 'warn') process.stderr.write(serialized);
  else process.stdout.write(serialized);
}

export const logger = {
  info: (msg, meta) => emit('info', msg, meta),
  warn: (msg, meta) => emit('warn', msg, meta),
  error: (msg, meta) => emit('error', msg, meta),
};
