import { Router } from 'express';
import { VERSION } from '../../shared/version.js';

// Liveness + tier introspection. Verifies the DB is reachable so orchestrators
// can distinguish "process up" from "process healthy".

export function healthRouter() {
  const router = Router();

  router.get('/', (req, res) => {
    const { db, gate } = req.app.locals;

    let dbOk = true;
    try {
      db.prepare('SELECT 1').get();
    } catch {
      dbOk = false;
    }

    res.status(dbOk ? 200 : 503).json({
      status: dbOk ? 'ok' : 'degraded',
      version: VERSION,
      tier: gate.tier,
      features: gate.activeFeatures(),
      uptime_s: Math.round(process.uptime()),
    });
  });

  return router;
}
