import { createHmac, timingSafeEqual } from 'node:crypto';

// Outbound signature scheme. Each endpoint's signing secret is DERIVED from the
// master secret (never stored), so key rotation is just a version bump and a
// database leak never exposes usable signing material.

export function deriveEndpointSecret(masterSecret, endpointId, version = 1) {
  return createHmac('sha256', masterSecret).update(`endpoint:${endpointId}:v${version}`).digest('hex');
}

// Signature covers `${timestamp}.${body}` so a captured payload cannot be
// replayed with a fresh timestamp. Receivers recompute and compare.
export function signPayload(secret, timestamp, rawBody) {
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody));
  return createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex');
}

/** Constant-time string comparison that never throws on length mismatch. */
export function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
