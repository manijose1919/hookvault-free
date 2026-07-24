import { deriveEndpointSecret } from '../../shared/signing.js';
import { getEvent } from './events.js';
import { listActiveEndpoints, getEndpoint } from './endpoints.js';
import { recordAttempt } from './deliveries.js';
import { nextDelayMs } from './retry.js';
import { httpDeliver } from './transport.js';
import { NotFoundError } from '../../shared/errors.js';

const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The delivery engine. Transport and sleep are injectable so retry/backoff
// behavior can be tested deterministically without a network or real waits.
//
// Retry strategy is chosen once, via the feature gate: the free core retries on
// a fixed interval (in-process). If a durable retry scheduler is registered
// (Premium), non-final failures are handed off to it instead of sleeping in
// process — making retries survive restarts.

export function createDeliveryEngine({
  db,
  config,
  gate,
  transport = httpDeliver,
  sleep = realSleep,
  baseRetryMs = 1000,
}) {
  const strategy = gate.has('premium.backoff') ? 'exponential' : 'linear';

  // Dead-letter listeners (Premium alerting subscribes here).
  const deadListeners = [];
  function onDeadLetter(fn) {
    deadListeners.push(fn);
  }
  function emitDeadLetter(payload) {
    for (const fn of deadListeners) Promise.resolve(fn(payload)).catch(() => {});
  }

  // Optional per-endpoint payload transformer (Pro).
  let payloadTransformer = null;
  function setPayloadTransformer(fn) {
    payloadTransformer = fn;
  }

  // Optional durable retry scheduler (Premium). When set, non-final failures are
  // persisted for later retry instead of retried in-process.
  let retryScheduler = null;
  function setRetryScheduler(scheduler) {
    retryScheduler = scheduler;
  }

  function buildBody(event, endpoint) {
    let data = event.payload;
    if (payloadTransformer) {
      const transformed = payloadTransformer(event, endpoint);
      if (transformed !== undefined) data = transformed;
    }
    return JSON.stringify({
      id: event.id,
      type: event.event_type,
      data,
      created_at: event.received_at,
    });
  }

  // A single delivery attempt: sign, POST, record the attempt row, and emit a
  // dead-letter on terminal failure. Shared by the in-process loop and the
  // durable worker so retry semantics never diverge.
  async function attemptOnce(event, endpoint, attemptNumber, isLast) {
    const secret = deriveEndpointSecret(config.masterSigningSecret, endpoint.id, endpoint.key_version);
    const body = buildBody(event, endpoint);

    const result = await transport({
      url: endpoint.url,
      signingSecret: secret,
      body,
      timeoutMs: config.deliveryTimeoutMs,
    });

    const status = result.ok ? 'success' : isLast ? 'dead' : 'failed';
    recordAttempt(db, {
      eventId: event.id,
      endpointId: endpoint.id,
      attemptNumber,
      status,
      responseCode: result.status,
      error: result.error,
      durationMs: result.durationMs,
    });

    if (!result.ok && isLast) {
      emitDeadLetter({ event_id: event.id, endpoint_id: endpoint.id, error: result.error });
    }
    return result;
  }

  async function deliverToEndpoint(event, endpoint) {
    const max = config.maxDeliveryAttempts;

    for (let attempt = 1; attempt <= max; attempt++) {
      const isLast = attempt === max;
      const result = await attemptOnce(event, endpoint, attempt, isLast);

      if (result.ok) return { endpoint: endpoint.id, delivered: true, attempts: attempt };
      if (isLast) return { endpoint: endpoint.id, delivered: false, attempts: attempt };

      const delayMs = nextDelayMs(attempt, { strategy, baseMs: baseRetryMs });

      // Durable path: hand the next attempt to the scheduler and stop the
      // in-process loop. The worker will pick it up when due.
      if (retryScheduler) {
        retryScheduler.schedule({
          eventId: event.id,
          endpointId: endpoint.id,
          attemptNumber: attempt + 1,
          delayMs,
        });
        return { endpoint: endpoint.id, delivered: false, pending: true, attempts: attempt };
      }

      await sleep(delayMs);
    }
  }

  // Executed by the durable worker for one scheduled retry. Returns what the
  // worker needs to decide the next step.
  async function runScheduledAttempt(eventId, endpointId, attemptNumber) {
    const event = getEvent(db, eventId);
    const endpoint = getEndpoint(db, endpointId);
    if (!event || !endpoint || !endpoint.active) return { ok: false, gone: true };

    const isLast = attemptNumber >= config.maxDeliveryAttempts;
    const result = await attemptOnce(event, endpoint, attemptNumber, isLast);
    return {
      ok: result.ok,
      isLast,
      nextAttempt: attemptNumber + 1,
      delayMs: nextDelayMs(attemptNumber, { strategy, baseMs: baseRetryMs }),
    };
  }

  // `endpointIds` (optional) restricts delivery to specific endpoints — used by
  // replay so a retry never re-sends to endpoints that already succeeded.
  async function deliverEvent(eventId, { endpointIds } = {}) {
    const event = getEvent(db, eventId);
    if (!event) throw new NotFoundError('Event not found');

    let endpoints = listActiveEndpoints(db, event.source_id);
    if (endpointIds) {
      const wanted = new Set(endpointIds);
      endpoints = endpoints.filter((e) => wanted.has(e.id));
    }

    const results = [];
    for (const endpoint of endpoints) {
      results.push(await deliverToEndpoint(event, endpoint));
    }
    return results;
  }

  return {
    deliverEvent,
    runScheduledAttempt,
    strategy,
    onDeadLetter,
    setPayloadTransformer,
    setRetryScheduler,
  };
}
