import express from 'express';
import { fileURLToPath } from 'node:url';
import { healthRouter } from './routes/health.js';
import { ingestRouter } from './routes/ingest.js';
import { sourcesRouter } from './routes/sources.js';
import { deliveriesRouter, eventsRouter } from './routes/deliveries.js';
import { errorHandler } from './routes/error-handler.js';
import { createDeliveryEngine } from './services/delivery-engine.js';

// Express app factory. Dependencies (db, config, gate) are injected so tests
// can build an app around an in-memory database with any tier. `transport` and
// `sleep` are passed through to the delivery engine for deterministic tests.

export function createApp({ db, config, gate, modules = [], transport, sleep }) {
  const app = express();

  const engine = createDeliveryEngine({ db, config, gate, transport, sleep });

  app.locals.db = db;
  app.locals.config = config;
  app.locals.gate = gate;
  app.locals.engine = engine;

  // Capture the raw request body during JSON parsing so downstream HMAC
  // verification can validate signatures over the exact bytes.
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  // Static dashboard (dependency-free HTML/JS). Served at the root.
  const publicDir = fileURLToPath(new URL('../../public/', import.meta.url));
  app.use('/', express.static(publicDir, { index: 'index.html' }));

  app.use('/health', healthRouter());
  app.use('/sources', sourcesRouter());
  app.use('/ingest', ingestRouter());
  app.use('/events', eventsRouter());
  app.use('/deliveries', deliveriesRouter());

  // Paid modules attach their routes here — only present when loaded.
  for (const { mod } of modules) {
    if (typeof mod.mountRoutes === 'function') {
      mod.mountRoutes(app, { db, config, gate, engine });
    }
  }

  app.use((req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } });
  });

  app.use(errorHandler);

  return app;
}
