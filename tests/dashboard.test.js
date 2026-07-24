import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTestApp, startServer } from './helpers.js';

test('dashboard is served at the root', async () => {
  const { app } = buildTestApp();
  const { baseUrl, close } = await startServer(app);
  try {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    const html = await res.text();
    assert.match(html, /HookVault/);
  } finally {
    await close();
  }
});

test('dashboard script is served', async () => {
  const { app } = buildTestApp();
  const { baseUrl, close } = await startServer(app);
  try {
    const res = await fetch(`${baseUrl}/app.js`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /javascript/);
  } finally {
    await close();
  }
});

test('static serving does not shadow the API or the 404 handler', async () => {
  const { app } = buildTestApp();
  const { baseUrl, close } = await startServer(app);
  try {
    assert.equal((await fetch(`${baseUrl}/health`)).status, 200);
    const missing = await fetch(`${baseUrl}/definitely-not-a-file`);
    assert.equal(missing.status, 404);
    const body = await missing.json();
    assert.equal(body.error.code, 'not_found');
  } finally {
    await close();
  }
});
