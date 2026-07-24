import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/core/config.js';

test('loadConfig applies sane defaults', () => {
  const cfg = loadConfig({
    PORT: undefined,
    HOST: undefined,
    HOOKVAULT_TIER: undefined,
    DATABASE_PATH: undefined,
  });
  assert.equal(cfg.port, 3000);
  assert.equal(cfg.host, '127.0.0.1');
  assert.equal(cfg.tier, 'free');
  assert.equal(cfg.maxDeliveryAttempts, 3);
});

test('loadConfig honors overrides', () => {
  const cfg = loadConfig({ PORT: '8080', HOOKVAULT_TIER: 'pro' });
  assert.equal(cfg.port, 8080);
  assert.equal(cfg.tier, 'pro');
});

test('loadConfig rejects an invalid tier', () => {
  assert.throws(() => loadConfig({ HOOKVAULT_TIER: 'enterprise' }), /Invalid HOOKVAULT_TIER/);
});

test('loadConfig rejects an out-of-range port', () => {
  assert.throws(() => loadConfig({ PORT: '99999' }), /Invalid PORT/);
});

test('loadConfig treats an empty PORT as unset (regression)', () => {
  const cfg = loadConfig({ PORT: '' });
  assert.equal(cfg.port, 3000);
});

test('loadConfig refuses the default secret in production (regression)', () => {
  assert.throws(
    () => loadConfig({ NODE_ENV: 'production', MASTER_SIGNING_SECRET: '' }),
    /MASTER_SIGNING_SECRET must be set/
  );
});

test('loadConfig allows a strong secret in production', () => {
  const cfg = loadConfig({ NODE_ENV: 'production', MASTER_SIGNING_SECRET: 'a-strong-secret' });
  assert.equal(cfg.nodeEnv, 'production');
});
