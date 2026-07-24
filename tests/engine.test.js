import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/core/db/index.js';
import { migrate } from '../src/core/db/migrate.js';
import { createSource } from '../src/core/services/sources.js';
import { createEndpoint } from '../src/core/services/endpoints.js';
import { recordEvent } from '../src/core/services/events.js';
import { listAttemptsForEvent } from '../src/core/services/deliveries.js';
import { createFeatureGate } from '../src/shared/feature-gate.js';
import { createDeliveryEngine } from '../src/core/services/delivery-engine.js';
import { nextDelayMs } from '../src/core/services/retry.js';

function setup({ tier = 'free', loaded = new Set(), maxDeliveryAttempts = 3 } = {}) {
  const db = openDatabase(':memory:');
  migrate(db);
  const { source } = createSource(db, { name: 'S' });
  const endpoint = createEndpoint(db, source.id, { url: 'https://customer.test/hook' });
  const event = recordEvent(db, source.id, { eventType: 'order.created', payload: { a: 1 } });
  const config = {
    masterSigningSecret: 'master',
    maxDeliveryAttempts,
    deliveryTimeoutMs: 1000,
  };
  const gate = createFeatureGate(tier, loaded);
  return { db, source, endpoint, event, config, gate };
}

const instantSleep = async () => {};

test('delivers on first success (single attempt)', async () => {
  const { db, event, config, gate } = setup();
  const engine = createDeliveryEngine({
    db,
    config,
    gate,
    sleep: instantSleep,
    transport: async () => ({ ok: true, status: 200, durationMs: 5, error: null }),
  });

  const results = await engine.deliverEvent(event.id);
  assert.equal(results[0].delivered, true);
  assert.equal(results[0].attempts, 1);

  const attempts = listAttemptsForEvent(db, event.id);
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].status, 'success');
});

test('retries after failure then succeeds', async () => {
  const { db, event, config, gate } = setup();
  let calls = 0;
  const engine = createDeliveryEngine({
    db,
    config,
    gate,
    sleep: instantSleep,
    transport: async () => {
      calls += 1;
      return calls < 2
        ? { ok: false, status: 500, durationMs: 3, error: 'HTTP 500' }
        : { ok: true, status: 200, durationMs: 3, error: null };
    },
  });

  const results = await engine.deliverEvent(event.id);
  assert.equal(results[0].delivered, true);
  assert.equal(results[0].attempts, 2);

  const attempts = listAttemptsForEvent(db, event.id);
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].status, 'failed');
  assert.equal(attempts[1].status, 'success');
});

test('marks dead after exhausting max attempts', async () => {
  const { db, event, config, gate } = setup({ maxDeliveryAttempts: 3 });
  const engine = createDeliveryEngine({
    db,
    config,
    gate,
    sleep: instantSleep,
    transport: async () => ({ ok: false, status: 503, durationMs: 2, error: 'HTTP 503' }),
  });

  const results = await engine.deliverEvent(event.id);
  assert.equal(results[0].delivered, false);
  assert.equal(results[0].attempts, 3);

  const attempts = listAttemptsForEvent(db, event.id);
  assert.equal(attempts.length, 3);
  assert.equal(attempts.at(-1).status, 'dead');
});

test('free tier uses linear retry strategy', () => {
  const { db, config, gate } = setup({ tier: 'free' });
  const engine = createDeliveryEngine({ db, config, gate });
  assert.equal(engine.strategy, 'linear');
});

test('premium backoff module upgrades strategy to exponential', () => {
  const { db, config, gate } = setup({ tier: 'premium', loaded: new Set(['premium.backoff']) });
  const engine = createDeliveryEngine({ db, config, gate });
  assert.equal(engine.strategy, 'exponential');
});

test('nextDelayMs: linear is constant, exponential doubles', () => {
  assert.equal(nextDelayMs(1, { strategy: 'linear', baseMs: 1000 }), 1000);
  assert.equal(nextDelayMs(3, { strategy: 'linear', baseMs: 1000 }), 1000);
  assert.equal(nextDelayMs(1, { strategy: 'exponential', baseMs: 1000 }), 1000);
  assert.equal(nextDelayMs(2, { strategy: 'exponential', baseMs: 1000 }), 2000);
  assert.equal(nextDelayMs(3, { strategy: 'exponential', baseMs: 1000 }), 4000);
});
