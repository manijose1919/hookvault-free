import { Router } from 'express';
import { getEvent } from '../services/events.js';
import { listRecentAttempts, listAttemptsForEvent } from '../services/deliveries.js';
import { NotFoundError } from '../../shared/errors.js';

// Read-only delivery log. Free tier exposes recent attempts and per-event
// history; full-text search over payloads is a Premium feature (Layer 5).

export function deliveriesRouter() {
  const router = Router();

  router.get('/', (req, res) => {
    const { db } = req.app.locals;
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    res.json({ attempts: listRecentAttempts(db, limit) });
  });

  return router;
}

export function eventsRouter() {
  const router = Router();

  router.get('/:id', (req, res) => {
    const { db } = req.app.locals;
    const event = getEvent(db, req.params.id);
    if (!event) throw new NotFoundError('Event not found');
    res.json({ ...event, attempts: listAttemptsForEvent(db, event.id) });
  });

  return router;
}
