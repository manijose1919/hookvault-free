import { Router } from 'express';
import { parse } from '../services/validate.js';
import { ingestSchema } from '../services/schemas.js';
import { authenticateIngestKey } from '../services/sources.js';
import { recordEvent } from '../services/events.js';
import { UnauthorizedError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';

// POST /ingest — the hot path. Authenticates the source via a Bearer ingest
// key, validates the body, and durably records the event. Delivery is handled
// separately (Layer 3) so ingestion stays fast and never blocks on a slow
// customer endpoint.

export function ingestRouter() {
  const router = Router();

  router.post('/', (req, res) => {
    const { db } = req.app.locals;

    const authHeader = req.get('authorization') || '';
    const key = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (!key) throw new UnauthorizedError('Missing Bearer ingest key');

    const source = authenticateIngestKey(db, key);
    if (!source) throw new UnauthorizedError('Invalid ingest key');

    const body = parse(ingestSchema, req.body);
    const event = recordEvent(db, source.id, {
      eventType: body.event_type,
      payload: body.payload,
    });

    // Fire-and-forget delivery: never block the producer on slow/dead customer
    // endpoints. Failures are captured as delivery attempts and logged.
    const { engine } = req.app.locals;
    Promise.resolve(engine.deliverEvent(event.id)).catch((err) =>
      logger.error('delivery_dispatch_failed', { event_id: event.id, message: err.message })
    );

    res.status(202).json({ event_id: event.id, status: 'accepted' });
  });

  return router;
}
