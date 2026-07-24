import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTestApp, startServer } from './helpers.js';

test('GET /health returns ok with tier', async () => {
  const { app } = buildTestApp({ tier: 'free' });
  const { baseUrl, close } = await startServer(app);
  try {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.tier, 'free');
    assert.deepEqual(body.features, []);
  } finally {
    await close();
  }
});

test('unknown routes return a 404 envelope', async () => {
  const { app } = buildTestApp();
  const { baseUrl, close } = await startServer(app);
  try {
    const res = await fetch(`${baseUrl}/does-not-exist`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error.code, 'not_found');
  } finally {
    await close();
  }
});
