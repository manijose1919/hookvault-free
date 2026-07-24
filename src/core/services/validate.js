import { ValidationError } from '../../shared/errors.js';

// Parse `data` against a zod schema, converting a failure into a typed
// ValidationError with a flat, client-friendly issue list.

export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      'Validation failed',
      result.error.issues.map((i) => ({ path: i.path.join('.') || '(root)', message: i.message }))
    );
  }
  return result.data;
}
