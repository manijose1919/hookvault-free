import { openDatabase } from '../src/core/db/index.js';
import { migrate } from '../src/core/db/migrate.js';
import { createApp } from '../src/core/app.js';
import { createFeatureGate } from '../src/shared/feature-gate.js';

// Builds a fully-wired app around an in-memory database. `loaded` simulates
// which paid features' modules are present, letting us test any tier without
// the real module folders.

// A transport that "succeeds" without touching the network, so ingest tests
// never make real HTTP calls. Individual tests can pass their own transport.
const okTransport = async () => ({ ok: true, status: 200, durationMs: 1, error: null });
const instantSleep = async () => {};

export function buildTestApp({
  tier = 'free',
  loaded = new Set(),
  modules = [],
  configOverrides = {},
  transport = okTransport,
  sleep = instantSleep,
} = {}) {
  const db = openDatabase(':memory:');
  migrate(db);

  // Run migrations for any real modules passed in (premium/pro tests).
  for (const { mod } of modules) {
    if (typeof mod.migrate === 'function') mod.migrate(db);
  }

  const config = {
    port: 0,
    host: '127.0.0.1',
    databasePath: ':memory:',
    tier,
    masterSigningSecret: 'test-master-secret',
    deliveryTimeoutMs: 5000,
    maxDeliveryAttempts: 3,
    nodeEnv: 'test',
    ...configOverrides,
  };

  const gate = createFeatureGate(tier, loaded);
  const app = createApp({ db, config, gate, modules, transport, sleep });

  return { app, db, config, gate, engine: app.locals.engine };
}

/** Start an app on an ephemeral port and return its base URL + closer. */
export async function startServer(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}
