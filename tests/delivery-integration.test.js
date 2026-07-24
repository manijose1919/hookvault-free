import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTestApp, startServer } from './helpers.js';

// Poll a predicate until it returns truthy or the attempt budget runs out.
// Used to observe the fire-and-forget delivery path deterministically.
async function eventually(fn, tries = 50) {
  for (let i = 0; i < tries; i += 1) {
    const value = await fn();
    if (value) return value;
    await new Promise((r) => setImmediate(r));
  }
  throw new Error('condition not met in time');
}

test('ingested event is auto-delivered and visible via GET /events/:id', async () => {
  // Transport that always succeeds, recording the signed headers it received.
  let received = null;
  const transport = async (opts) => {
    received = opts;
    return { ok: true, status: 200, durationMs: 2, error: null };
  };

  const { app } = buildTestApp({ transport });
  const { baseUrl, close } = await startServer(app);
  try {
    const source = await (
      await fetch(`${baseUrl}/sources`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Orders' }),
      })
    ).json();

    await fetch(`${baseUrl}/sources/${source.id}/endpoints`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://customer.test/hook' }),
    });

    const ingest = await (
      await fetch(`${baseUrl}/ingest`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${source.ingest_key}`,
        },
        body: JSON.stringify({ event_type: 'order.created', payload: { id: 7 } }),
      })
    ).json();

    // The delivery is dispatched asynchronously; poll the event until its
    // successful attempt appears.
    const event = await eventually(async () => {
      const e = await (await fetch(`${baseUrl}/events/${ingest.event_id}`)).json();
      return e.attempts && e.attempts.length > 0 ? e : null;
    });

    assert.equal(event.attempts.length, 1);
    assert.equal(event.attempts[0].status, 'success');
    assert.ok(received, 'transport should have been invoked');
    assert.equal(received.url, 'https://customer.test/hook');
  } finally {
    await close();
  }
});

test('recent deliveries are listed via GET /deliveries', async () => {
  const { app } = buildTestApp();
  const { baseUrl, close } = await startServer(app);
  try {
    const source = await (
      await fetch(`${baseUrl}/sources`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Orders' }),
      })
    ).json();
    await fetch(`${baseUrl}/sources/${source.id}/endpoints`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://customer.test/hook' }),
    });
    await fetch(`${baseUrl}/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${source.ingest_key}` },
      body: JSON.stringify({ event_type: 'x', payload: { ok: true } }),
    });

    const list = await eventually(async () => {
      const l = await (await fetch(`${baseUrl}/deliveries`)).json();
      return l.attempts.length > 0 ? l : null;
    });
    assert.ok(list.attempts.length >= 1);
  } finally {
    await close();
  }
});
