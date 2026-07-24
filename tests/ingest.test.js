import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTestApp, startServer } from './helpers.js';

async function createSource(baseUrl, name = 'Orders Service') {
  const res = await fetch(`${baseUrl}/sources`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

test('full ingest happy path returns 202 and persists the event', async () => {
  const { app, db } = buildTestApp();
  const { baseUrl, close } = await startServer(app);
  try {
    const source = await createSource(baseUrl);
    assert.match(source.ingest_key, /^src_.+\..+/);

    const res = await fetch(`${baseUrl}/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${source.ingest_key}` },
      body: JSON.stringify({ event_type: 'order.created', payload: { id: 42 } }),
    });
    assert.equal(res.status, 202);
    const body = await res.json();
    assert.match(body.event_id, /^evt_/);

    const stored = db.prepare('SELECT COUNT(*) AS n FROM events').get();
    assert.equal(stored.n, 1);
  } finally {
    await close();
  }
});

test('ingest rejects a missing key with 401', async () => {
  const { app } = buildTestApp();
  const { baseUrl, close } = await startServer(app);
  try {
    const res = await fetch(`${baseUrl}/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event_type: 'x', payload: {} }),
    });
    assert.equal(res.status, 401);
  } finally {
    await close();
  }
});

test('ingest rejects a wrong key with 401', async () => {
  const { app } = buildTestApp();
  const { baseUrl, close } = await startServer(app);
  try {
    const source = await createSource(baseUrl);
    const res = await fetch(`${baseUrl}/ingest`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${source.id}.wrong-secret`,
      },
      body: JSON.stringify({ event_type: 'x', payload: {} }),
    });
    assert.equal(res.status, 401);
  } finally {
    await close();
  }
});

test('ingest rejects a body missing payload with 400', async () => {
  const { app } = buildTestApp();
  const { baseUrl, close } = await startServer(app);
  try {
    const source = await createSource(baseUrl);
    const res = await fetch(`${baseUrl}/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${source.ingest_key}` },
      body: JSON.stringify({ event_type: 'x' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'validation_error');
  } finally {
    await close();
  }
});
