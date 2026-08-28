import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTestApp, startServer } from './helpers.js';

test('create source returns ingest key exactly once', async () => {
  const { app, db } = buildTestApp();
  const { baseUrl, close } = await startServer(app);
  try {
    const res = await fetch(`${baseUrl}/sources`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Billing' }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.ingest_key);

    // Only the hash is stored, never the plaintext key.
    const row = db.prepare('SELECT ingest_key_hash FROM sources WHERE id = ?').get(body.id);
    assert.ok(row.ingest_key_hash);
    assert.notEqual(row.ingest_key_hash, body.ingest_key);
  } finally {
    await close();
  }
});

test('endpoints can be added and listed', async () => {
  const { app } = buildTestApp();
  const { baseUrl, close } = await startServer(app);
  try {
    const source = await (
      await fetch(`${baseUrl}/sources`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Billing' }),
      })
    ).json();

    const created = await fetch(`${baseUrl}/sources/${source.id}/endpoints`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://customer.example.com/webhooks' }),
    });
    assert.equal(created.status, 201);

    const list = await (await fetch(`${baseUrl}/sources/${source.id}/endpoints`)).json();
    assert.equal(list.endpoints.length, 1);
    assert.equal(list.endpoints[0].url, 'https://customer.example.com/webhooks');
  } finally {
    await close();
  }
});

test('adding an endpoint with a bad URL returns 400', async () => {
  const { app } = buildTestApp();
  const { baseUrl, close } = await startServer(app);
  try {
    const source = await (
      await fetch(`${baseUrl}/sources`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Billing' }),
      })
    ).json();

    const res = await fetch(`${baseUrl}/sources/${source.id}/endpoints`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'ftp://nope' }),
    });
    assert.equal(res.status, 400);
  } finally {
    await close();
  }
});

test('adding an endpoint targeting loopback or metadata is rejected', async () => {
  const { app } = buildTestApp();
  const { baseUrl, close } = await startServer(app);
  try {
    const source = await (
      await fetch(`${baseUrl}/sources`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Billing' }),
      })
    ).json();

    for (const url of [
      'http://127.0.0.1/hook',
      'http://169.254.169.254/latest/meta-data/',
      'http://localhost:8080/admin',
      'http://192.168.1.10/webhook',
    ]) {
      const res = await fetch(`${baseUrl}/sources/${source.id}/endpoints`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      assert.equal(res.status, 400, url);
    }
  } finally {
    await close();
  }
});

test('endpoint operations on a missing source return 404', async () => {
  const { app } = buildTestApp();
  const { baseUrl, close } = await startServer(app);
  try {
    const res = await fetch(`${baseUrl}/sources/src_missing/endpoints`);
    assert.equal(res.status, 404);
  } finally {
    await close();
  }
});
