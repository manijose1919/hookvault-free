// Typed application errors. The Express error handler maps `status`/`code`
// onto a consistent JSON envelope, so throwing these anywhere is safe.

export class AppError extends Error {
  constructor(message, status = 500, code = 'internal_error') {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request', details = undefined) {
    super(message, 400, 'validation_error');
    this.details = details;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'unauthorized');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'forbidden');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404, 'not_found');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409, 'conflict');
  }
}

export class PaymentRequiredError extends AppError {
  // Used by the feature gate when a caller hits a locked paid feature.
  constructor(message = 'This feature requires a higher plan') {
    super(message, 402, 'upgrade_required');
  }
}
