import { AppError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';

// Terminal Express error middleware. Maps typed AppErrors to their status/code
// and collapses everything else into an opaque 500 (never leak internals).

// eslint-disable-next-line no-unused-vars -- Express requires 4-arg signature
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  // Body-parser throws on malformed JSON with err.type === 'entity.parse.failed'.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'invalid_json', message: 'Malformed JSON body' } });
  }

  logger.error('unhandled_error', { message: err.message, stack: err.stack });
  return res.status(500).json({ error: { code: 'internal_error', message: 'Internal server error' } });
}
