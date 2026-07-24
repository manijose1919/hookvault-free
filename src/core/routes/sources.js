import { Router } from 'express';
import { parse } from '../services/validate.js';
import { createSourceSchema, createEndpointSchema } from '../services/schemas.js';
import { createSource, getSource } from '../services/sources.js';
import { createEndpoint, listEndpoints } from '../services/endpoints.js';
import { NotFoundError } from '../../shared/errors.js';

// Management API for sources and their endpoints.
//
// NOTE: In the free core these routes rely on the server binding to localhost
// (HOST=127.0.0.1). Network-facing API-key authentication is a Premium feature
// added in Layer 5.

export function sourcesRouter() {
  const router = Router();

  router.post('/', (req, res) => {
    const { db } = req.app.locals;
    const { name } = parse(createSourceSchema, req.body);
    const { source, ingestKey } = createSource(db, { name });
    // The ingest key is shown exactly once; only its hash is stored.
    res.status(201).json({ ...source, ingest_key: ingestKey });
  });

  router.post('/:id/endpoints', (req, res) => {
    const { db } = req.app.locals;
    const source = getSource(db, req.params.id);
    if (!source) throw new NotFoundError('Source not found');

    const { url } = parse(createEndpointSchema, req.body);
    const endpoint = createEndpoint(db, source.id, { url });
    res.status(201).json(endpoint);
  });

  router.get('/:id/endpoints', (req, res) => {
    const { db } = req.app.locals;
    const source = getSource(db, req.params.id);
    if (!source) throw new NotFoundError('Source not found');

    res.json({ endpoints: listEndpoints(db, source.id) });
  });

  return router;
}
