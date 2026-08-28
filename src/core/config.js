import 'dotenv/config';
import { TIERS } from '../shared/tiers.js';

const DEFAULT_INSECURE_SECRET = 'change-me-in-production';

// Treat empty strings as "unset" so a blank `KEY=` in .env falls back to the
// default instead of coercing to 0 / ''.
function str(value, fallback) {
  return value === undefined || value === null || value === '' ? fallback : value;
}
function int(value, fallback) {
  const raw = str(value, undefined);
  return raw === undefined ? fallback : Number(raw);
}

// Loads and validates configuration from the environment. `overrides` lets
// tests inject values without mutating process.env.

export function loadConfig(overrides = {}) {
  const env = { ...process.env, ...overrides };
  const tier = String(str(env.HOOKVAULT_TIER, 'free')).toLowerCase();

  if (!TIERS.includes(tier)) {
    throw new Error(`Invalid HOOKVAULT_TIER "${tier}". Must be one of: ${TIERS.join(', ')}`);
  }

  const config = {
    port: int(env.PORT, 3000),
    host: str(env.HOST, '127.0.0.1'),
    databasePath: str(env.DATABASE_PATH, './data/hookvault.sqlite'),
    tier,
    masterSigningSecret: str(env.MASTER_SIGNING_SECRET, DEFAULT_INSECURE_SECRET),
    deliveryTimeoutMs: int(env.DELIVERY_TIMEOUT_MS, 10000),
    maxDeliveryAttempts: int(env.MAX_DELIVERY_ATTEMPTS, 3),
    nodeEnv: str(env.NODE_ENV, 'development'),
    // Premium: persist retries so they survive restarts (requires premium tier).
    durableRetries: String(str(env.HOOKVAULT_DURABLE_RETRIES, '')) === '1',
    // Optional: enables Claude-augmented failure triage when set.
    anthropicApiKey: str(env.ANTHROPIC_API_KEY, ''),
  };

  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid PORT "${env.PORT}" (expected 1-65535)`);
  }
  if (!Number.isInteger(config.maxDeliveryAttempts) || config.maxDeliveryAttempts < 1) {
    throw new Error(`Invalid MAX_DELIVERY_ATTEMPTS "${env.MAX_DELIVERY_ATTEMPTS}"`);
  }

  // Security guard: never run in production on the shipped default secret,
  // which would make every outbound HMAC signature forgeable.
  if (config.nodeEnv === 'production' && config.masterSigningSecret === DEFAULT_INSECURE_SECRET) {
    throw new Error(
      'MASTER_SIGNING_SECRET must be set to a strong secret in production. ' +
        'Generate one with: node -e "console.log(require(\'node:crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  // Free-tier management APIs are unauthenticated. Refuse a non-loopback bind
  // unless the operator opts in, so a copied compose file cannot expose the
  // dashboard on the LAN by accident.
  const loopback = new Set(['127.0.0.1', 'localhost', '::1']);
  if (!loopback.has(config.host) && str(env.HOOKVAULT_ALLOW_REMOTE, '') !== '1') {
    throw new Error(
      `HOST "${config.host}" is not loopback. The Free-tier management API is ` +
        'unauthenticated — keep HOST=127.0.0.1, or set HOOKVAULT_ALLOW_REMOTE=1 ' +
        'if you really intend to expose it behind your own auth/proxy.'
    );
  }

  return config;
}
